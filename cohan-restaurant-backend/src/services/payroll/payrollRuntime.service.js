import mongoose from "mongoose";
import {
  Staff,
  Shift,
  Timesheet,
  LeaveRequest,
  Restaurant,
  PayrollSetting,
  PayrollPeriod,
  PayrollItem,
  PayrollAdjustment,
} from "../../../models/index.js";
import {
  buildPayrollItem,
  calculatePeriodCalendarDays,
  normalizeRegionCode,
} from "./payrollCalculator.service.js";

function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

export function toStartOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toEndOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function mapDepartmentLabel(department) {
  const map = {
    management: "Management",
    kitchen: "Kitchen",
    service: "Service",
    cashier: "Cashier",
    cleaning: "Cleaning",
    delivery: "Delivery",
  };
  return map[String(department || "").toLowerCase()] || "Other";
}

function inferRegionCodeFromRestaurant(restaurant) {
  const manual = String(restaurant?.payrollRegionCode || "").trim().toUpperCase();
  if (["I", "II", "III", "IV"].includes(manual)) return manual;

  const city = String(restaurant?.address?.city || "").toLowerCase();
  if (city.includes("hà nội") || city.includes("ha noi") || city.includes("hồ chí minh") || city.includes("ho chi minh")) {
    return "I";
  }
  return "II";
}

export async function getPayrollSettings(restaurantId) {
  const rid = toObjectId(restaurantId);
  if (!rid) return null;

  const doc = await PayrollSetting.findOne({ restaurantId: rid }).lean();
  if (doc) {
    return {
      ...doc,
      restaurantId: String(doc.restaurantId),
      currentPayrollPeriodId: doc.currentPayrollPeriodId
        ? String(doc.currentPayrollPeriodId)
        : null,
    };
  }

  return {
    restaurantId: String(rid),
    currentPayrollPeriodId: null,
    standardWorkDaysPerMonth: 26,
    standardHoursPerDay: 8,
    overtimeMultiplierWeekday: 1.5,
    overtimeMultiplierWeekend: 2,
    overtimeMultiplierHoliday: 3,
    latenessPenaltyPerMinute: 0,
    earlyLeavePenaltyPerMinute: 0,
    unpaidLeaveDeductionPerDay: 0,
    defaultAllowance: 0,
    allowPaidLeaveInWorkDays: true,
    defaultBonus: 0,
    defaultDeduction: 0,
    notes: "",
    updatedAt: null,
  };
}

function summarize(items) {
  const totalPayroll = items.reduce((sum, row) => sum + Number(row.netSalary || 0), 0);
  const paidAmount = items.reduce((sum, row) => sum + (row.status === "paid" ? Number(row.netSalary || 0) : 0), 0);
  const totalAllowance = items.reduce((sum, row) => sum + Number(row.allowance || 0), 0);
  const totalBonus = items.reduce((sum, row) => sum + Number(row.bonus || 0), 0);
  const totalDeduction = items.reduce((sum, row) => sum + Number(row.totalDeduction || 0), 0);
  const paidEmployees = items.filter((row) => row.status === "paid").length;
  const remaining = totalPayroll - paidAmount;
  return {
    totalPayroll,
    paidAmount,
    remaining,
    progress: totalPayroll > 0 ? Math.round((paidAmount / totalPayroll) * 100) : 0,
    totalAllowance,
    totalBonus,
    totalDeduction,
    paidEmployees,
    unpaidEmployees: Math.max(items.length - paidEmployees, 0),
    employees: items.length,
  };
}

function applySettingOverrides(payroll, aggregate, settings) {
  const dailyRate = payroll.workDays > 0 ? payroll.baseSalary / payroll.workDays : 0;
  const latenessPenalty = Number(aggregate.totalLatenessMinutes || 0) * Number(settings.latenessPenaltyPerMinute || 0);
  const earlyLeavePenalty = Number(aggregate.totalEarlyLeaveMinutes || 0) * Number(settings.earlyLeavePenaltyPerMinute || 0);
  const unpaidLeaveDeduction = Number(aggregate.unpaidLeaveDays || 0) * (
    Number(settings.unpaidLeaveDeductionPerDay || 0) || dailyRate
  );

  const allowance = Number(payroll.allowance || 0) + Number(settings.defaultAllowance || 0) + Number(aggregate.adjustmentAllowance || 0);
  const bonus = Number(payroll.bonus || 0) + Number(settings.defaultBonus || 0) + Number(aggregate.adjustmentBonus || 0);
  const otherAddition = Number(payroll.otherAddition || 0) + Number(aggregate.adjustmentOther || 0);

  const extraPenalty = latenessPenalty + earlyLeavePenalty + unpaidLeaveDeduction;
  const otherDeduction = Number(payroll.otherDeduction || 0) + Number(settings.defaultDeduction || 0) + Number(aggregate.adjustmentDeduction || 0) + extraPenalty;

  const totalIncome = Number(payroll.grossIncome || 0) + Number(settings.defaultAllowance || 0) + Number(settings.defaultBonus || 0)
    + Number(aggregate.adjustmentAllowance || 0) + Number(aggregate.adjustmentBonus || 0) + Number(aggregate.adjustmentOther || 0);

  const totalDeduction = Number(payroll.insuranceTotal || 0)
    + Number(payroll.advance || 0)
    + Number(payroll.personalIncomeTax || 0)
    + otherDeduction;

  const netSalary = totalIncome - totalDeduction;

  return {
    ...payroll,
    allowance,
    bonus,
    otherAddition,
    deduction: Number(payroll.deduction || 0) + extraPenalty,
    otherDeduction,
    grossIncome: totalIncome,
    totalIncome,
    totalDeduction,
    netSalary,
    lateMinutes: Number(aggregate.totalLatenessMinutes || 0),
    earlyLeaveMinutes: Number(aggregate.totalEarlyLeaveMinutes || 0),
    unpaidLeaveDays: Number(aggregate.unpaidLeaveDays || 0),
    paidLeaveDays: Number(aggregate.paidLeaveDays || 0),
    scheduleShiftCount: Number(aggregate.scheduleShiftCount || 0),
    manualAdjustmentTotal: Number(aggregate.adjustmentAllowance || 0)
      + Number(aggregate.adjustmentBonus || 0)
      + Number(aggregate.adjustmentOther || 0)
      - Number(aggregate.adjustmentDeduction || 0),
  };
}

export function mapPayrollDocToGql(row) {
  const b = row.breakdown || {};
  return {
    id: String(row.employeeId || row.id),
    payrollItemId: String(row._id || row.payrollItemId || ""),
    name: row.employeeName || row.name || "Nhân viên",
    code: row.employeeCode || row.code || null,
    role: row.role || null,
    department: row.department || null,
    avatar: row.avatar || null,
    baseSalary: Number(b.baseSalary || 0),
    workDays: Number(b.workDays || 0),
    actualWorkDays: Number(b.actualWorkDays || 0),
    totalHours: Number(b.totalHours || 0),
    hourlyRate: Number(b.hourlyRate || 0),
    allowance: Number(b.allowance || 0),
    bonus: Number(b.bonus || 0),
    otherAddition: Number(b.otherAddition || 0),
    overtime: Number(b.overtime || 0),
    overtimeNormal: Number(b.overtimeNormal || 0),
    overtimeWeekend: Number(b.overtimeWeekend || 0),
    overtimeHoliday: Number(b.overtimeHoliday || 0),
    nightShiftExtra: Number(b.nightShiftExtra || 0),
    overtimeHours: Number(b.overtimeHours || 0),
    overtimeNormalHours: Number(b.overtimeNormalHours || 0),
    overtimeWeekendHours: Number(b.overtimeWeekendHours || 0),
    overtimeHolidayHours: Number(b.overtimeHolidayHours || 0),
    nightHours: Number(b.nightHours || 0),
    overtimeNightHours: Number(b.overtimeNightHours || 0),
    deduction: Number(b.deduction || 0),
    otherDeduction: Number(b.otherDeduction || 0),
    advance: Number(b.advance || 0),
    insuranceSocial: Number(b.insuranceSocial || 0),
    insuranceHealth: Number(b.insuranceHealth || 0),
    insuranceUnemployment: Number(b.insuranceUnemployment || 0),
    insuranceTotal: Number(b.insuranceTotal || 0),
    insuranceEmployerTotal: Number(b.insuranceEmployerTotal || 0),
    personalIncomeTax: Number(b.personalIncomeTax || 0),
    grossIncome: Number(b.grossIncome || 0),
    coefficient: Number(b.coefficient || 0),
    totalIncome: Number(b.totalIncome || 0),
    totalDeduction: Number(b.totalDeduction || 0),
    netSalary: Number(b.netSalary || 0),
    policyCode: b.policyCode || null,
    policyEffectiveFrom: b.policyEffectiveFrom || null,
    regionCode: b.regionCode || null,
    minimumWageMonthly: Number(b.minimumWageMonthly || 0),
    minimumWageHourly: Number(b.minimumWageHourly || 0),
    minimumWageViolation: Boolean(b.minimumWageViolation),
    insuranceEligible: Boolean(b.insuranceEligible),
    warningMessages: row.warningMessages || [],
    status: row.status || "draft",
    paidAt: row.paidAt || null,
    lateMinutes: Number(b.lateMinutes || 0),
    earlyLeaveMinutes: Number(b.earlyLeaveMinutes || 0),
    unpaidLeaveDays: Number(b.unpaidLeaveDays || 0),
    paidLeaveDays: Number(b.paidLeaveDays || 0),
    scheduleShiftCount: Number(b.scheduleShiftCount || 0),
    manualAdjustmentTotal: Number(b.manualAdjustmentTotal || 0),
  };
}

export async function buildPayrollItemsForRange({ start, end, restaurantId, periodId = null, forceStatus = null }) {
  const rid = toObjectId(restaurantId);
  if (!rid) return [];

  const settings = await getPayrollSettings(rid);

  const staffFilter = { userType: "STAFF", $or: [{ primaryRestaurant: rid }, { refRestaurants: rid }] };
  const staffs = await Staff.find(staffFilter)
    .select({
      _id: 1,
      fullName: 1,
      employeeCode: 1,
      positionTitle: 1,
      roleName: 1,
      department: 1,
      avatarUrl: 1,
      avatar: 1,
      baseSalary: 1,
      employmentType: 1,
      employmentStatus: 1,
    })
    .lean();

  if (!staffs.length) return [];

  const staffIds = staffs.map((s) => s._id);

  const shifts = await Shift.find({
    employeeId: { $in: staffIds },
    restaurantId: rid,
    startTime: { $gte: start, $lte: end },
  })
    .select({ _id: 1, employeeId: 1, startTime: 1 })
    .lean();

  const shiftIds = shifts.map((s) => s._id);

  const timesheetAgg = await Timesheet.aggregate([
    {
      $match: {
        employeeId: { $in: staffIds },
        restaurantId: rid,
        workDate: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: "$employeeId",
        totalHours: { $sum: { $ifNull: ["$hours", 0] } },
        totalWage: { $sum: { $ifNull: ["$wage", 0] } },
        totalAmount: { $sum: { $ifNull: ["$amount", 0] } },
        totalLatenessMinutes: { $sum: { $ifNull: ["$latenessMinutes", 0] } },
        totalEarlyLeaveMinutes: { $sum: { $ifNull: ["$earlyLeaveMinutes", 0] } },
        workedDateKeys: { $addToSet: { $dateToString: { format: "%Y-%m-%d", date: "$workDate" } } },
      },
    },
  ]);

  const leaveAgg = await LeaveRequest.aggregate([
    {
      $match: {
        employeeId: { $in: staffIds },
        restaurantId: rid,
        status: "approved",
        startDate: { $lte: end },
        endDate: { $gte: start },
      },
    },
    {
      $group: {
        _id: "$employeeId",
        paidLeaveDays: {
          $sum: {
            $cond: [{ $eq: ["$payrollFlags.isPaidLeave", true] }, { $ifNull: ["$requestedDays", 0] }, 0],
          },
        },
        unpaidLeaveDays: {
          $sum: {
            $cond: [{ $ne: ["$payrollFlags.isPaidLeave", true] }, { $ifNull: ["$requestedDays", 0] }, 0],
          },
        },
      },
    },
  ]);

  const adjustments = periodId
    ? await PayrollAdjustment.find({ periodId: toObjectId(periodId) }).lean()
    : [];

  const adjustmentMap = new Map();
  adjustments.forEach((adj) => {
    const sid = String(adj.employeeId);
    if (!adjustmentMap.has(sid)) {
      adjustmentMap.set(sid, {
        adjustmentAllowance: 0,
        adjustmentBonus: 0,
        adjustmentDeduction: 0,
        adjustmentOther: 0,
      });
    }
    const bucket = adjustmentMap.get(sid);
    if (adj.type === "allowance") bucket.adjustmentAllowance += Number(adj.amount || 0);
    else if (adj.type === "bonus") bucket.adjustmentBonus += Number(adj.amount || 0);
    else if (adj.type === "deduction") bucket.adjustmentDeduction += Math.abs(Number(adj.amount || 0));
    else bucket.adjustmentOther += Number(adj.amount || 0);
  });

  const timesheetMap = new Map(
    timesheetAgg.map((row) => [String(row._id), {
      totalHours: Number(row.totalHours || 0),
      totalWage: Number(row.totalWage || 0),
      totalAmount: Number(row.totalAmount || 0),
      totalLatenessMinutes: Number(row.totalLatenessMinutes || 0),
      totalEarlyLeaveMinutes: Number(row.totalEarlyLeaveMinutes || 0),
      workedDateCount: (row.workedDateKeys || []).length,
    }]),
  );

  const leaveMap = new Map(
    leaveAgg.map((row) => [String(row._id), {
      paidLeaveDays: Number(row.paidLeaveDays || 0),
      unpaidLeaveDays: Number(row.unpaidLeaveDays || 0),
    }]),
  );

  const shiftCountByStaff = new Map();
  shifts.forEach((shift) => {
    const sid = String(shift.employeeId);
    shiftCountByStaff.set(sid, (shiftCountByStaff.get(sid) || 0) + 1);
  });

  const workDays = calculatePeriodCalendarDays(start, end);
  const restaurant = await Restaurant.findById(rid).select({ address: 1, payrollRegionCode: 1 }).lean();
  const regionCode = normalizeRegionCode(inferRegionCodeFromRestaurant(restaurant));

  const items = staffs.map((staff) => {
    const sid = String(staff._id);
    const ts = timesheetMap.get(sid) || {
      totalHours: 0,
      totalWage: 0,
      totalAmount: 0,
      totalLatenessMinutes: 0,
      totalEarlyLeaveMinutes: 0,
      workedDateCount: 0,
    };
    const leave = leaveMap.get(sid) || { paidLeaveDays: 0, unpaidLeaveDays: 0 };
    const adjustmentsForStaff = adjustmentMap.get(sid) || {
      adjustmentAllowance: 0,
      adjustmentBonus: 0,
      adjustmentDeduction: 0,
      adjustmentOther: 0,
    };

    const payroll = buildPayrollItem({
      staff,
      period: { start, end, calendarDays: workDays },
      aggregate: {
        workedDateCount: ts.workedDateCount,
        totalHours: ts.totalHours,
        totalWage: ts.totalWage,
        totalAmount: ts.totalAmount,
      },
      regionCode,
      payrollStatus: forceStatus || "draft",
    });

    let effectiveActualWorkDays = ts.workedDateCount;
    if (settings.allowPaidLeaveInWorkDays) {
      effectiveActualWorkDays += leave.paidLeaveDays;
      payroll.actualWorkDays = effectiveActualWorkDays;
      payroll.coefficient = workDays > 0 ? effectiveActualWorkDays / workDays : 0;
    }

    const withSettings = applySettingOverrides(payroll, {
      ...ts,
      ...leave,
      ...adjustmentsForStaff,
      scheduleShiftCount: shiftCountByStaff.get(sid) || 0,
    }, settings);

    const warningMessages = [];
    if (withSettings.minimumWageViolation) warningMessages.push("Lương cơ bản thấp hơn lương tối thiểu vùng áp dụng.");
    if (!withSettings.insuranceEligible) warningMessages.push("Nhân sự chưa thuộc diện đóng BH bắt buộc theo cấu hình chính sách.");
    if (Number(withSettings.lateMinutes || 0) > 0) warningMessages.push(`Đi muộn ${withSettings.lateMinutes} phút trong kỳ.`);
    if (Number(withSettings.unpaidLeaveDays || 0) > 0) warningMessages.push(`Có ${withSettings.unpaidLeaveDays} ngày nghỉ không lương.`);

    return {
      employeeId: staff._id,
      employeeName: staff.fullName || "Nhân viên",
      employeeCode: staff.employeeCode || "",
      role: staff.positionTitle || staff.roleName || "Nhân viên",
      department: mapDepartmentLabel(staff.department),
      avatar: staff.avatarUrl || staff.avatar || null,
      breakdown: withSettings,
      warningMessages,
      status: forceStatus || "draft",
      paidAt: null,
    };
  });

  return items;
}

export async function upsertPeriodItems(periodDoc) {
  const periodId = String(periodDoc._id);
  const items = await buildPayrollItemsForRange({
    start: toStartOfDay(periodDoc.startDate),
    end: toEndOfDay(periodDoc.endDate),
    restaurantId: periodDoc.restaurantId,
    periodId,
    forceStatus: periodDoc.status === "paid" ? "paid" : periodDoc.status,
  });

  await Promise.all(items.map((row) => PayrollItem.findOneAndUpdate(
    { periodId: periodDoc._id, employeeId: row.employeeId },
    {
      $set: {
        periodId: periodDoc._id,
        restaurantId: periodDoc.restaurantId,
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        employeeCode: row.employeeCode,
        role: row.role,
        department: row.department,
        avatar: row.avatar,
        breakdown: row.breakdown,
        warningMessages: row.warningMessages,
        status: row.status,
      },
    },
    { upsert: true, new: true },
  )));

  const docs = await PayrollItem.find({ periodId: periodDoc._id }).lean();
  const gqlItems = docs.map(mapPayrollDocToGql);
  const stats = summarize(gqlItems);

  await PayrollPeriod.findByIdAndUpdate(periodDoc._id, {
    $set: {
      settingsSnapshot: await getPayrollSettings(periodDoc.restaurantId),
      statsSnapshot: stats,
    },
  });

  return { items: gqlItems, stats };
}

export async function getPeriodDetail(periodId) {
  const period = await PayrollPeriod.findById(periodId).lean();
  if (!period) return null;
  const settings = await getPayrollSettings(period.restaurantId);
  const docs = await PayrollItem.find({ periodId: period._id }).lean();
  const items = docs.map(mapPayrollDocToGql);
  const stats = summarize(items);

  return {
    period: {
      id: String(period._id),
      restaurantId: String(period.restaurantId),
      name: period.name || "",
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
      finalizedAt: period.finalizedAt || null,
      lockedAt: period.lockedAt || null,
      paidAt: period.paidAt || null,
      stats,
    },
    settings,
    stats,
    items,
  };
}

export { summarize, toObjectId };
