// src/graphql/staff/query.js
import mongoose from "mongoose";
import {
  Staff,
  Shift,
  Timesheet,
  LeaveRequest,
  LeaveBalance,
  Order,
  Table,
  Category,
  Promotion,
  Restaurant,
} from "../../../models/index.js";
import { buildStaffSchedulingAssistant } from "../../../src/services/ai/staffSchedulingAssistant.service.js";
import {
  buildPayrollItem,
  calculatePeriodCalendarDays,
  normalizeRegionCode,
} from "../../../src/services/payroll/payrollCalculator.service.js";

function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function toStartOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toEndOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function mapAttendanceStatus(timesheet) {
  if (!timesheet?.actualCheckInAt) {
    return timesheet?.isOffSchedule ? "unscheduled_absent" : "scheduled_absent";
  }
  if (!timesheet?.actualCheckOutAt) return timesheet?.isOffSchedule ? "unscheduled_checkin" : "checked_in";
  if (timesheet?.isOffSchedule) return "unscheduled_completed";
  const hasLate = Number(timesheet?.latenessMinutes || 0) > 0;
  const hasEarly = Number(timesheet?.earlyLeaveMinutes || 0) > 0;
  if (hasLate && hasEarly) return "late_early_leave";
  if (hasLate) return "late";
  if (hasEarly) return "early_leave";
  return "completed";
}

function mapAttendanceRecord(timesheet, staff) {
  return {
    id: String(timesheet._id),
    employeeId: String(timesheet.employeeId),
    employeeName: staff?.fullName || null,
    employeeCode: staff?.employeeCode || null,
    employeeRole: staff?.positionTitle || staff?.roleName || staff?.role?.name || null,
    employeeAvatar: staff?.avatarUrl || staff?.avatar || null,
    restaurantId: String(timesheet.restaurantId),
    workDate: timesheet.workDate,
    shiftId: timesheet.shiftId ? String(timesheet.shiftId._id || timesheet.shiftId) : null,
    shiftType: timesheet?.shiftId?.shiftType || null,
    plannedStartTime: timesheet.plannedStartTime || timesheet?.shiftId?.startTime || null,
    plannedEndTime: timesheet.plannedEndTime || timesheet?.shiftId?.endTime || null,
    actualCheckInAt: timesheet.actualCheckInAt || null,
    actualCheckOutAt: timesheet.actualCheckOutAt || null,
    workedMinutes: Number(timesheet.workedMinutes || 0),
    hours: Number(timesheet.hours || 0),
    latenessMinutes: Number(timesheet.latenessMinutes || 0),
    earlyLeaveMinutes: Number(timesheet.earlyLeaveMinutes || 0),
    overtimeMinutes: Number(timesheet.overtimeMinutes || 0),
    status: mapAttendanceStatus(timesheet),
    isOffSchedule: Boolean(timesheet.isOffSchedule),
    source: timesheet.source || "quick",
    note: timesheet.note || "",
    approved: Boolean(timesheet.approved),
    createdAt: timesheet.createdAt || null,
    updatedAt: timesheet.updatedAt || null,
  };
}

function toGraphLeaveType(value) {
  const map = {
    annual: "ANNUAL",
    sick: "SICK",
    unpaid: "UNPAID",
    paid_personal: "PAID_PERSONAL",
    maternity: "MATERNITY",
    compensatory: "COMPENSATORY",
    holiday: "HOLIDAY",
    half_day: "HALF_DAY",
  };
  return map[String(value || "").toLowerCase()] || "ANNUAL";
}

function toGraphLeaveStatus(value) {
  const map = {
    pending: "PENDING",
    pending_replacement_confirmation: "PENDING_REPLACEMENT_CONFIRMATION",
    approved: "APPROVED",
    rejected: "REJECTED",
  };
  return map[String(value || "").toLowerCase()] || "PENDING";
}

function toGraphReplacementStatus(value) {
  const map = {
    not_required: "NOT_REQUIRED",
    pending: "PENDING",
    confirmed: "CONFIRMED",
    rejected: "REJECTED",
  };
  return map[String(value || "").toLowerCase()] || "NOT_REQUIRED";
}

function toGraphSession(value) {
  const map = { full: "FULL", morning: "MORNING", afternoon: "AFTERNOON" };
  return map[String(value || "").toLowerCase()] || "FULL";
}

function toYmd(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function toNumber(v) {
  return Number(v || 0);
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

async function resolveStaffDoc(staffId, ctx) {
  const fallbackId = ctx?.user?.id;
  const targetId = staffId || fallbackId;
  const oid = toObjectId(targetId);
  if (!oid) return null;

  return Staff.findById(oid)
    .populate("role")
    .populate("refRestaurants")
    .populate("primaryRestaurant");
}

export default {
  // =========================
  // GET ONE STAFF
  // =========================
  staff: async (_, { id }) => {
    const user = await Staff.findById(id)
      .populate("role")
      .populate("refRestaurants")
      .populate("primaryRestaurant");

    if (!user || user.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    return user;
  },

  // =========================
  // GET STAFF LIST
  // =========================
  staffList: async (
    _,
    { restaurantId, roleId, search, employmentStatus }
  ) => {
    const filter = { userType: "STAFF" };

    if (restaurantId) filter.refRestaurants = restaurantId;
    if (roleId) filter.role = roleId;
    if (employmentStatus) filter.employmentStatus = employmentStatus;

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { fullName: regex },
        { email: regex },
        { phone: regex },
        { username: regex },
        { employeeCode: regex },
      ];
    }

    return Staff.find(filter)
      .populate("role")
      .populate("refRestaurants")
      .populate("primaryRestaurant")
      .sort({ fullName: 1 });
  },

  staffAccountOverview: async (_, { staffId }, ctx) => {
    const staff = await resolveStaffDoc(staffId, ctx);
    if (!staff || staff.userType !== "STAFF") return null;

    const restaurantId =
      staff?.restaurantForStaff || staff?.primaryRestaurant?._id || null;
    const rid = toObjectId(restaurantId);

    let floorAssigned = [];
    let tableList = [];
    let tableCount = 0;
    let floorCount = 0;
    let categoryCount = 0;
    let promotionCount = 0;

    if (rid) {
      const [tables, categoryAgg, promoAgg] = await Promise.all([
        Table.find({ restaurantId: rid }).select({ code: 1, floorLevel: 1 }).lean(),
        Category.countDocuments({ restaurantId: rid }),
        Promotion.countDocuments({ restaurantId: rid, isActive: true }),
      ]);
      tableCount = tables.length;
      tableList = tables.map((t) => t.code).filter(Boolean);
      floorAssigned = Array.from(
        new Set(
          tables
            .map((t) =>
              t?.floorLevel != null ? `Tầng ${Number(t.floorLevel)}` : null
            )
            .filter(Boolean)
        )
      );
      floorCount = floorAssigned.length;
      categoryCount = Number(categoryAgg || 0);
      promotionCount = Number(promoAgg || 0);
    }

    const orderFilter = {
      userId: staff._id,
      currentStatus: { $in: ["served", "completed", "paid"] },
    };
    if (rid) orderFilter.restaurantId = rid;

    const [ordersServedCount, shiftDocs] = await Promise.all([
      Order.countDocuments(orderFilter),
      Shift.find({ employeeId: staff._id })
        .sort({ startTime: -1 })
        .limit(2)
        .lean(),
    ]);

    const shiftsWorkedCount = await Shift.countDocuments({ employeeId: staff._id });

    return {
      staffId: String(staff._id),
      fullName: staff.fullName || null,
      email: staff.email || null,
      phone: staff.phone || null,
      avatarUrl: staff.avatarUrl || staff.avatar || null,
      roleName:
        staff?.positionTitle || staff?.roleName || staff?.role?.name || "Nhân viên",
      positionTitle: staff.positionTitle || null,
      employeeCode: staff.employeeCode || null,
      employmentStatus: String(staff.employmentStatus || "working").toUpperCase(),
      primaryRestaurant: staff.primaryRestaurant || null,
      restaurantForStaff: staff.restaurantForStaff || null,
      floorAssigned,
      floorCount,
      tableCount,
      categoryCount,
      promotionCount,
      tableList,
      ordersServedCount,
      shiftsWorkedCount,
      currentShift: shiftDocs?.[0]?.shiftType || null,
      lastShift: shiftDocs?.[1]?.shiftType || shiftDocs?.[0]?.shiftType || null,
    };
  },

  staffSalarySummary: async (_, { staffId }, ctx) => {
    const staff = await resolveStaffDoc(staffId, ctx);
    if (!staff || staff.userType !== "STAFF") return null;

    const shifts = await Shift.find({ employeeId: staff._id })
      .select({ _id: 1 })
      .lean();
    const shiftIds = shifts.map((s) => s._id);

    if (!shiftIds.length) {
      const baseSalary = Number(staff.baseSalary || 0);
      const payroll = buildPayrollItem({
        staff,
        period: { start: new Date(), end: new Date(), calendarDays: 0 },
        aggregate: { workedDateCount: 0, totalHours: 0, totalWage: 0, totalAmount: 0 },
        regionCode: "I",
        payrollStatus: "draft",
      });
      return {
        staffId: String(staff._id),
        baseSalary,
        totalHours: 0,
        totalWage: 0,
        totalAmount: 0,
        bonusAmount: 0,
        grossIncome: 0,
        totalDeduction: 0,
        netSalary: 0,
        insuranceSocial: 0,
        insuranceHealth: 0,
        insuranceUnemployment: 0,
        insuranceTotal: 0,
        overtimeNormal: 0,
        overtimeWeekend: 0,
        overtimeHoliday: 0,
        nightShiftExtra: 0,
        insuranceEligible: payroll.insuranceEligible,
        policyCode: payroll.policyCode,
        policyEffectiveFrom: payroll.policyEffectiveFrom,
        warningMessages: [],
        coefficient: 0,
        timesheetCount: 0,
      };
    }

    const agg = await Timesheet.aggregate([
      { $match: { shiftId: { $in: shiftIds } } },
      {
        $group: {
          _id: null,
          totalHours: { $sum: { $ifNull: ["$hours", 0] } },
          totalWage: { $sum: { $ifNull: ["$wage", 0] } },
          totalAmount: { $sum: { $ifNull: ["$amount", 0] } },
          timesheetCount: { $sum: 1 },
        },
      },
    ]);

    const row = agg?.[0] || {};
    const totalWage = Number(row.totalWage || 0);
    const totalAmount = Number(row.totalAmount || 0);
    const baseSalary = Number(staff.baseSalary || 0);
    const bonusAmount = Math.max(0, totalAmount - totalWage);
    const coefficient = baseSalary > 0 ? totalWage / baseSalary : 0;
    const payroll = buildPayrollItem({
      staff,
      period: {
        start: new Date(),
        end: new Date(),
        calendarDays: 26,
      },
      aggregate: {
        workedDateCount: Number(row.timesheetCount || 0),
        totalHours: Number(row.totalHours || 0),
        totalWage,
        totalAmount,
      },
      regionCode: "I",
      payrollStatus: "draft",
    });

    return {
      staffId: String(staff._id),
      baseSalary,
      totalHours: Number(row.totalHours || 0),
      totalWage,
      totalAmount,
      bonusAmount,
      grossIncome: payroll.grossIncome,
      totalDeduction: payroll.totalDeduction,
      netSalary: payroll.netSalary,
      insuranceSocial: payroll.insuranceSocial,
      insuranceHealth: payroll.insuranceHealth,
      insuranceUnemployment: payroll.insuranceUnemployment,
      insuranceTotal: payroll.insuranceTotal,
      overtimeNormal: payroll.overtimeNormal,
      overtimeWeekend: payroll.overtimeWeekend,
      overtimeHoliday: payroll.overtimeHoliday,
      nightShiftExtra: payroll.nightShiftExtra,
      insuranceEligible: payroll.insuranceEligible,
      policyCode: payroll.policyCode,
      policyEffectiveFrom: payroll.policyEffectiveFrom,
      warningMessages: payroll.minimumWageViolation ? ["Lương cơ bản thấp hơn mức tối thiểu vùng"] : [],
      coefficient: Number(coefficient.toFixed(2)),
      timesheetCount: Number(row.timesheetCount || 0),
    };
  },

  staffShiftHistory: async (_, { staffId, limit = 20 }, ctx) => {
    const staff = await resolveStaffDoc(staffId, ctx);
    if (!staff || staff.userType !== "STAFF") return [];

    const rows = await Shift.find({ employeeId: staff._id })
      .sort({ startTime: -1 })
      .limit(Math.max(1, Math.min(Number(limit || 20), 100)))
      .populate("restaurantId", "name")
      .lean();

    return rows.map((r) => ({
      id: String(r._id),
      restaurant: r.restaurantId
        ? { id: String(r.restaurantId._id || r.restaurantId.id), name: r.restaurantId.name }
        : null,
      shiftType: r.shiftType || null,
      startTime: r.startTime || null,
      endTime: r.endTime || null,
      status: r.status || null,
      notes: r.notes || null,
    }));
  },

  staffPayrollOverview: async (_, { startDate, endDate, restaurantId }, ctx) => {
    const start = toStartOfDay(startDate);
    const end = toEndOfDay(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return {
        stats: { totalPayroll: 0, paidAmount: 0, remaining: 0, progress: 0 },
        items: [],
      };
    }

    const authUser = ctx?.user || null;
    const fallbackRestaurantId =
      restaurantId ||
      authUser?.restaurantForStaff ||
      authUser?.primaryRestaurantId ||
      null;
    const rid = toObjectId(fallbackRestaurantId);

    const staffFilter = { userType: "STAFF" };
    if (rid) {
      staffFilter.$or = [{ primaryRestaurant: rid }, { refRestaurants: rid }];
    }

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
      })
      .lean();

    if (!staffs.length) {
      return {
        stats: { totalPayroll: 0, paidAmount: 0, remaining: 0, progress: 0 },
        items: [],
      };
    }

    const staffIds = staffs.map((s) => s._id);
    const shiftMatch = {
      employeeId: { $in: staffIds },
      startTime: { $gte: start, $lte: end },
    };
    if (rid) shiftMatch.restaurantId = rid;

    const shifts = await Shift.find(shiftMatch)
      .select({ _id: 1, employeeId: 1, startTime: 1 })
      .lean();

    const shiftIds = shifts.map((s) => s._id);
    const timesheetAgg = shiftIds.length
      ? await Timesheet.aggregate([
          { $match: { shiftId: { $in: shiftIds } } },
          {
            $group: {
              _id: "$shiftId",
              totalHours: { $sum: { $ifNull: ["$hours", 0] } },
              totalWage: { $sum: { $ifNull: ["$wage", 0] } },
              totalAmount: { $sum: { $ifNull: ["$amount", 0] } },
            },
          },
        ])
      : [];

    const timesheetByShiftId = new Map(
      timesheetAgg.map((row) => [
        String(row._id),
        {
          totalHours: Number(row.totalHours || 0),
          totalWage: Number(row.totalWage || 0),
          totalAmount: Number(row.totalAmount || 0),
        },
      ])
    );

    const payrollByStaffId = new Map();
    for (const shift of shifts) {
      const sid = String(shift.employeeId);
      if (!payrollByStaffId.has(sid)) {
        payrollByStaffId.set(sid, {
          workedDateKeys: new Set(),
          totalHours: 0,
          totalWage: 0,
          totalAmount: 0,
        });
      }
      const bucket = payrollByStaffId.get(sid);
      bucket.workedDateKeys.add(new Date(shift.startTime).toISOString().slice(0, 10));
      const ts = timesheetByShiftId.get(String(shift._id)) || {
        totalHours: 0,
        totalWage: 0,
        totalAmount: 0,
      };
      bucket.totalHours += ts.totalHours;
      bucket.totalWage += ts.totalWage;
      bucket.totalAmount += ts.totalAmount;
    }

    const now = new Date();
    const workDays = calculatePeriodCalendarDays(start, end);
    const restaurant = rid ? await Restaurant.findById(rid).select({ address: 1, payrollRegionCode: 1 }).lean() : null;
    const regionCode = normalizeRegionCode(inferRegionCodeFromRestaurant(restaurant));

    const items = staffs.map((staff) => {
      const sid = String(staff._id);
      const agg = payrollByStaffId.get(sid) || {
        workedDateKeys: new Set(),
        totalHours: 0,
        totalWage: 0,
        totalAmount: 0,
      };

      const actualWorkDays = agg.workedDateKeys.size;
      let status = "draft";
      if (actualWorkDays > 0) status = end < now ? "paid" : "approved";

      const payroll = buildPayrollItem({
        staff,
        period: { start, end, calendarDays: workDays },
        aggregate: {
          workedDateCount: actualWorkDays,
          totalHours: agg.totalHours,
          totalWage: agg.totalWage,
          totalAmount: agg.totalAmount,
        },
        regionCode,
        payrollStatus: status,
      });

      const warningMessages = [];
      if (payroll.minimumWageViolation) warningMessages.push("Lương cơ bản thấp hơn lương tối thiểu vùng áp dụng.");
      if (payroll.missingTimesheetData) warningMessages.push("Có ca làm nhưng thiếu dữ liệu timesheet giờ công.");
      if (!payroll.insuranceEligible) warningMessages.push("Nhân sự chưa thuộc diện đóng BH bắt buộc theo cấu hình chính sách.");

      return {
        id: sid,
        name: staff.fullName || "Nhân viên",
        code: staff.employeeCode || null,
        role: staff.positionTitle || staff.roleName || "Nhân viên",
        department: mapDepartmentLabel(staff.department),
        avatar: staff.avatarUrl || staff.avatar || null,
        baseSalary: payroll.baseSalary,
        workDays: payroll.workDays,
        actualWorkDays: payroll.actualWorkDays,
        totalHours: payroll.totalHours,
        hourlyRate: payroll.hourlyRate,
        allowance: payroll.allowance,
        bonus: payroll.bonus,
        otherAddition: payroll.otherAddition,
        overtime: payroll.overtime,
        overtimeNormal: payroll.overtimeNormal,
        overtimeWeekend: payroll.overtimeWeekend,
        overtimeHoliday: payroll.overtimeHoliday,
        nightShiftExtra: payroll.nightShiftExtra,
        overtimeHours: payroll.overtimeHours,
        overtimeNormalHours: payroll.overtimeNormalHours,
        overtimeWeekendHours: payroll.overtimeWeekendHours,
        overtimeHolidayHours: payroll.overtimeHolidayHours,
        nightHours: payroll.nightHours,
        overtimeNightHours: payroll.overtimeNightHours,
        deduction: payroll.deduction,
        otherDeduction: payroll.otherDeduction,
        advance: payroll.advance,
        insuranceSocial: payroll.insuranceSocial,
        insuranceHealth: payroll.insuranceHealth,
        insuranceUnemployment: payroll.insuranceUnemployment,
        insuranceTotal: payroll.insuranceTotal,
        insuranceEmployerTotal: payroll.insuranceEmployerTotal,
        personalIncomeTax: payroll.personalIncomeTax,
        grossIncome: payroll.grossIncome,
        totalIncome: payroll.totalIncome,
        totalDeduction: payroll.totalDeduction,
        netSalary: payroll.netSalary,
        coefficient: Number(payroll.coefficient.toFixed(2)),
        status: payroll.payrollStatus,
        policyCode: payroll.policyCode,
        policyEffectiveFrom: payroll.policyEffectiveFrom,
        regionCode: payroll.regionCode,
        minimumWageMonthly: payroll.minimumWageMonthly,
        minimumWageHourly: payroll.minimumWageHourly,
        minimumWageViolation: payroll.minimumWageViolation,
        insuranceEligible: payroll.insuranceEligible,
        warningMessages,
      };
    });

    const totalPayroll = items.reduce(
      (sum, item) => sum + Number(item.netSalary || 0),
      0,
    );

    const paidAmount = items.reduce((sum, item) => {
      if (item.status !== "paid") return sum;
      return sum + Number(item.netSalary || 0);
    }, 0);

    const remaining = totalPayroll - paidAmount;
    const progress = totalPayroll > 0 ? Math.round((paidAmount / totalPayroll) * 100) : 0;

    return {
      stats: {
        totalPayroll,
        paidAmount,
        remaining,
        progress,
      },
      items,
    };
  },



  staffSchedulingAssistant: async (_, { restaurantId, horizonDays = 2, timezone = "Asia/Ho_Chi_Minh" }) => {
    return buildStaffSchedulingAssistant({
      restaurantId,
      horizonDays,
      timezone,
    });
  },

  staffShifts: async (
    _,
    { restaurantId, employeeId, startDate, endDate, status, limit = 500 },
    ctx,
  ) => {
    const filter = { userType: "STAFF" };
    const authUser = ctx?.user || null;
    const fallbackRestaurantId =
      restaurantId ||
      authUser?.restaurantForStaff ||
      authUser?.primaryRestaurantId ||
      null;
    const rid = toObjectId(fallbackRestaurantId);
    const eid = toObjectId(employeeId);

    if (rid) filter.restaurantId = rid;
    if (eid) filter.employeeId = eid;
    if (status) filter.status = status;

    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) filter.startTime.$gte = toStartOfDay(startDate);
      if (endDate) filter.startTime.$lte = toEndOfDay(endDate);
    }

    const rows = await Shift.find(filter)
      .sort({ startTime: 1 })
      .limit(Math.max(1, Math.min(Number(limit || 500), 2000)))
      .populate("employeeId", "fullName")
      .lean();

    return rows.map((row) => ({
      id: String(row._id),
      employeeId: String(row.employeeId?._id || row.employeeId),
      employeeName: row.employeeId?.fullName || null,
      restaurantId: String(row.restaurantId),
      shiftType: row.shiftType,
      startTime: row.startTime,
      endTime: row.endTime,
      status: row.status || "scheduled",
      notes: row.notes || "",
    }));
  },

  staffAttendanceRecords: async (_, { restaurantId, startDate, endDate, employeeId, status, search }, ctx) => {
    const start = toStartOfDay(startDate);
    const end = toEndOfDay(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

    const authUser = ctx?.user || null;
    const fallbackRestaurantId =
      restaurantId ||
      authUser?.restaurantForStaff ||
      authUser?.primaryRestaurantId ||
      null;
    const rid = toObjectId(fallbackRestaurantId);
    if (!rid) return [];

    const staffFilter = {
      userType: "STAFF",
      $or: [{ primaryRestaurant: rid }, { refRestaurants: rid }],
    };
    const eid = toObjectId(employeeId);
    if (eid) staffFilter._id = eid;
    if (search) {
      const regex = new RegExp(search, "i");
      staffFilter.$and = [
        { $or: [{ primaryRestaurant: rid }, { refRestaurants: rid }] },
        { $or: [{ fullName: regex }, { employeeCode: regex }, { phone: regex }, { email: regex }] },
      ];
      delete staffFilter.$or;
    }

    const staffs = await Staff.find(staffFilter)
      .populate("role")
      .select({ _id: 1, fullName: 1, employeeCode: 1, positionTitle: 1, roleName: 1, avatarUrl: 1, avatar: 1 })
      .lean();
    if (!staffs.length) return [];

    const staffById = new Map(staffs.map((s) => [String(s._id), s]));
    const staffIds = staffs.map((s) => s._id);

    const shifts = await Shift.find({
      employeeId: { $in: staffIds },
      restaurantId: rid,
      startTime: { $lte: end },
      endTime: { $gte: start },
    })
      .select({ _id: 1, employeeId: 1, shiftType: 1, startTime: 1, endTime: 1, status: 1, createdAt: 1, updatedAt: 1 })
      .lean();

    const timesheets = await Timesheet.find({
      restaurantId: rid,
      employeeId: { $in: staffIds },
      workDate: { $gte: start, $lte: end },
    })
      .populate("shiftId")
      .sort({ workDate: -1, createdAt: -1 })
      .lean();

    const existingKey = new Set(
      timesheets.map((ts) => {
        const day = new Date(ts.workDate).toISOString().slice(0, 10);
        return `${String(ts.employeeId)}|${day}|${ts.shiftId ? String(ts.shiftId._id || ts.shiftId) : "off"}`;
      })
    );

    const records = [...timesheets];
    for (const shift of shifts) {
      const day = new Date(shift.startTime).toISOString().slice(0, 10);
      const key = `${String(shift.employeeId)}|${day}|${String(shift._id)}`;
      if (existingKey.has(key)) continue;
      records.push({
        _id: `${key}-virtual`,
        employeeId: shift.employeeId,
        restaurantId: rid,
        workDate: toStartOfDay(shift.startTime),
        shiftId: shift,
        plannedStartTime: shift.startTime,
        plannedEndTime: shift.endTime,
        actualCheckInAt: null,
        actualCheckOutAt: null,
        workedMinutes: 0,
        hours: 0,
        latenessMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        isOffSchedule: false,
        source: "system",
        note: "",
        approved: false,
        createdAt: shift.createdAt || null,
        updatedAt: shift.updatedAt || null,
      });
    }

    const mapped = records
      .map((record) => mapAttendanceRecord(record, staffById.get(String(record.employeeId))))
      .sort((a, b) => new Date(b.workDate).getTime() - new Date(a.workDate).getTime());
    if (!status || status === "all") return mapped;
    return mapped.filter((record) => record.status === status);
  },

  leaveRequests: async (_, { filter = {} }, ctx) => {
    const authUser = ctx?.user || null;
    const fallbackRestaurantId =
      filter.restaurantId ||
      authUser?.restaurantForStaff ||
      authUser?.primaryRestaurantId ||
      null;
    const rid = toObjectId(fallbackRestaurantId);
    if (!rid) return [];

    const query = { restaurantId: rid };
    const eid = toObjectId(filter.employeeId);
    if (eid) query.employeeId = eid;
    if (filter.status) query.status = String(filter.status).toLowerCase();
    if (filter.startDate || filter.endDate) {
      query.startDate = {};
      if (filter.startDate) query.startDate.$gte = toStartOfDay(filter.startDate);
      if (filter.endDate) query.startDate.$lte = toEndOfDay(filter.endDate);
    }

    const rows = await LeaveRequest.find(query)
      .populate("employeeId", "fullName employeeCode positionTitle roleName avatarUrl avatar role")
      .populate("approverId", "fullName")
      .populate("replacementManagerId", "fullName")
      .populate("replacementConfirmedBy", "fullName")
      .sort({ createdAt: -1 })
      .lean();

    const searched = !filter.search
      ? rows
      : rows.filter((row) => {
          const needle = String(filter.search || "").toLowerCase();
          return (
            String(row.employeeId?.fullName || "").toLowerCase().includes(needle) ||
            String(row.employeeId?.employeeCode || "").toLowerCase().includes(needle)
          );
        });

    return searched.map((row) => ({
      id: String(row._id),
      employeeId: String(row.employeeId?._id || row.employeeId),
      employeeName: row.employeeId?.fullName || null,
      employeeCode: row.employeeId?.employeeCode || null,
      employeeRole: row.employeeId?.positionTitle || row.employeeId?.roleName || null,
      employeeAvatar: row.employeeId?.avatarUrl || row.employeeId?.avatar || null,
      restaurantId: String(row.restaurantId),
      leaveType: toGraphLeaveType(row.leaveType),
      startDate: row.startDate,
      endDate: row.endDate,
      startSession: toGraphSession(row.startSession),
      endSession: toGraphSession(row.endSession),
      requestedDays: Number(row.requestedDays || 0),
      requestedHours: Number(row.requestedHours || 0),
      reason: row.reason || "",
      status: toGraphLeaveStatus(row.status),
      approverId: row.approverId?._id ? String(row.approverId._id) : null,
      approverName: row.approverId?.fullName || null,
      approvedAt: row.approvedAt || null,
      rejectedAt: row.rejectedAt || null,
      rejectionReason: row.rejectionReason || "",
      replacementManagerId: row.replacementManagerId?._id ? String(row.replacementManagerId._id) : null,
      replacementManagerName: row.replacementManagerId?.fullName || null,
      replacementStatus: toGraphReplacementStatus(row.replacementStatus),
      replacementConfirmedAt: row.replacementConfirmedAt || null,
      replacementConfirmedBy: row.replacementConfirmedBy?._id
        ? String(row.replacementConfirmedBy._id)
        : null,
      payrollFlags: {
        isPaidLeave: Boolean(row.payrollFlags?.isPaidLeave),
        deductLeaveBalance: Boolean(row.payrollFlags?.deductLeaveBalance),
        payrollCountable: Boolean(row.payrollFlags?.payrollCountable),
        halfDayFactor: Number(row.payrollFlags?.halfDayFactor ?? 1),
        maternityTreatment: Boolean(row.payrollFlags?.maternityTreatment),
        holidayTreatment: Boolean(row.payrollFlags?.holidayTreatment),
        compensatoryTreatment: Boolean(row.payrollFlags?.compensatoryTreatment),
        unpaidFactor: Number(row.payrollFlags?.unpaidFactor ?? 0),
      },
      quotaImpact: {
        deductAnnualDays: Number(row.quotaImpact?.deductAnnualDays || 0),
        deductSickDays: Number(row.quotaImpact?.deductSickDays || 0),
        deductCompensatoryDays: Number(row.quotaImpact?.deductCompensatoryDays || 0),
        totalDeductDays: Number(row.quotaImpact?.totalDeductDays || 0),
      },
      leaveBalanceSnapshot: null,
      auditLogs: (row.auditLogs || []).map((log) => ({
        action: log.action,
        actorId: log.actorId ? String(log.actorId) : null,
        actorName: log.actorName || null,
        note: log.note || "",
        at: log.at || null,
      })),
      createdAt: row.createdAt || null,
      updatedAt: row.updatedAt || null,
    }));
  },

  myReplacementLeaveRequests: async (_, { restaurantId, status }, ctx) => {
    const authUserId = ctx?.user?.id || ctx?.user?._id || null;
    const uid = toObjectId(authUserId);
    if (!uid) return [];
    return (await LeaveRequest.find({
      replacementManagerId: uid,
      ...(restaurantId ? { restaurantId: toObjectId(restaurantId) } : {}),
      ...(status ? { replacementStatus: String(status).toLowerCase() } : {}),
    })
      .populate("employeeId", "fullName employeeCode")
      .sort({ createdAt: -1 })
      .lean()).map((row) => ({
      id: String(row._id),
      employeeId: String(row.employeeId?._id || row.employeeId),
      employeeName: row.employeeId?.fullName || null,
      employeeCode: row.employeeId?.employeeCode || null,
      employeeRole: null,
      employeeAvatar: null,
      restaurantId: String(row.restaurantId),
      leaveType: toGraphLeaveType(row.leaveType),
      startDate: row.startDate,
      endDate: row.endDate,
      startSession: toGraphSession(row.startSession),
      endSession: toGraphSession(row.endSession),
      requestedDays: Number(row.requestedDays || 0),
      requestedHours: Number(row.requestedHours || 0),
      reason: row.reason || "",
      status: toGraphLeaveStatus(row.status),
      approverId: row.approverId ? String(row.approverId) : null,
      approverName: null,
      approvedAt: row.approvedAt || null,
      rejectedAt: row.rejectedAt || null,
      rejectionReason: row.rejectionReason || "",
      replacementManagerId: row.replacementManagerId ? String(row.replacementManagerId) : null,
      replacementManagerName: null,
      replacementStatus: toGraphReplacementStatus(row.replacementStatus),
      replacementConfirmedAt: row.replacementConfirmedAt || null,
      replacementConfirmedBy: row.replacementConfirmedBy ? String(row.replacementConfirmedBy) : null,
      payrollFlags: {
        isPaidLeave: Boolean(row.payrollFlags?.isPaidLeave),
        deductLeaveBalance: Boolean(row.payrollFlags?.deductLeaveBalance),
        payrollCountable: Boolean(row.payrollFlags?.payrollCountable),
        halfDayFactor: Number(row.payrollFlags?.halfDayFactor ?? 1),
        maternityTreatment: Boolean(row.payrollFlags?.maternityTreatment),
        holidayTreatment: Boolean(row.payrollFlags?.holidayTreatment),
        compensatoryTreatment: Boolean(row.payrollFlags?.compensatoryTreatment),
        unpaidFactor: Number(row.payrollFlags?.unpaidFactor ?? 0),
      },
      quotaImpact: {
        deductAnnualDays: Number(row.quotaImpact?.deductAnnualDays || 0),
        deductSickDays: Number(row.quotaImpact?.deductSickDays || 0),
        deductCompensatoryDays: Number(row.quotaImpact?.deductCompensatoryDays || 0),
        totalDeductDays: Number(row.quotaImpact?.totalDeductDays || 0),
      },
      leaveBalanceSnapshot: null,
      auditLogs: [],
      createdAt: row.createdAt || null,
      updatedAt: row.updatedAt || null,
    }));
  },

  leaveBalance: async (_, { employeeId, year }) => {
    const y = Number(year || new Date().getFullYear());
    const row = await LeaveBalance.findOne({ employeeId: toObjectId(employeeId), year: y }).lean();
    if (!row) return null;
    return {
      id: String(row._id),
      employeeId: String(row.employeeId),
      year: Number(row.year),
      annualEntitledDays: Number(row.annualEntitledDays || 0),
      annualUsedDays: Number(row.annualUsedDays || 0),
      annualRemainingDays: Number(row.annualRemainingDays || 0),
      sickEntitledDays: Number(row.sickEntitledDays || 0),
      sickUsedDays: Number(row.sickUsedDays || 0),
      sickRemainingDays: Number(row.sickRemainingDays || 0),
      compensatoryEntitledDays: Number(row.compensatoryEntitledDays || 0),
      compensatoryUsedDays: Number(row.compensatoryUsedDays || 0),
      compensatoryRemainingDays: Number(row.compensatoryRemainingDays || 0),
    };
  },

  staffReportsOverview: async (_, { input }, ctx) => {
    const start = toStartOfDay(input.startDate);
    const end = toEndOfDay(input.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      throw new Error("Invalid report period");
    }

    const authUser = ctx?.user || null;
    const fallbackRestaurantId =
      input.restaurantId ||
      authUser?.restaurantForStaff ||
      authUser?.primaryRestaurantId ||
      null;
    const rid = toObjectId(fallbackRestaurantId);
    if (!rid) throw new Error("Missing restaurantId for staff report");

    const periodDays = Math.max(Math.round((end.getTime() - start.getTime()) / 86400000) + 1, 1);
    const compareStart = input.compareStartDate
      ? toStartOfDay(input.compareStartDate)
      : toStartOfDay(new Date(start.getTime() - periodDays * 86400000));
    const compareEnd = input.compareEndDate
      ? toEndOfDay(input.compareEndDate)
      : toEndOfDay(new Date(start.getTime() - 1));

    const [staffDocs, timesheets, leaveRequests, leaveBalances] = await Promise.all([
      Staff.find({
        userType: "STAFF",
        $or: [{ primaryRestaurant: rid }, { refRestaurants: rid }],
      })
        .select({ _id: 1, fullName: 1, employeeCode: 1, employmentStatus: 1, dateJoined: 1, dateLeft: 1, createdAt: 1 })
        .lean(),
      Timesheet.find({
        restaurantId: rid,
        workDate: { $gte: start, $lte: end },
      })
        .populate("employeeId", "fullName employeeCode")
        .populate("shiftId", "shiftType")
        .lean(),
      LeaveRequest.find({
        restaurantId: rid,
        startDate: { $lte: end },
        endDate: { $gte: start },
      })
        .populate("employeeId", "fullName employeeCode")
        .lean(),
      LeaveBalance.find({
        year: new Date(end).getFullYear(),
        employeeId: { $in: staffDocs.map((s) => s._id) },
      }).lean(),
    ]);

    const activeEmployees = staffDocs.filter((s) => String(s.employmentStatus || "").toLowerCase() !== "resigned").length;
    const terminatedEmployees = staffDocs.filter((s) => String(s.employmentStatus || "").toLowerCase() === "resigned").length;
    const joinedEmployees = staffDocs.filter((s) => {
      const joinDate = s.dateJoined || s.createdAt;
      if (!joinDate) return false;
      const d = new Date(joinDate);
      return d >= start && d <= end;
    }).length;
    const leftEmployees = staffDocs.filter((s) => {
      if (!s.dateLeft) return false;
      const d = new Date(s.dateLeft);
      return d >= start && d <= end;
    }).length;

    const presentCount = timesheets.filter((t) => Boolean(t.actualCheckInAt)).length;
    const absentCount = timesheets.filter((t) => !t.actualCheckInAt && !t.isOffSchedule).length;
    const lateCount = timesheets.filter((t) => toNumber(t.latenessMinutes) > 0).length;
    const earlyLeaveCount = timesheets.filter((t) => toNumber(t.earlyLeaveMinutes) > 0).length;

    const leaveApproved = leaveRequests.filter((r) => String(r.status) === "approved");
    const leaveRejected = leaveRequests.filter((r) => String(r.status) === "rejected");
    const leavePending = leaveRequests.filter((r) => String(r.status).startsWith("pending"));
    const paidLeaveDays = leaveApproved.reduce(
      (sum, row) => sum + (row?.payrollFlags?.isPaidLeave ? toNumber(row.requestedDays) : 0),
      0
    );
    const unpaidLeaveDays = leaveApproved.reduce(
      (sum, row) => sum + (!row?.payrollFlags?.isPaidLeave ? toNumber(row.requestedDays) : 0),
      0
    );

    const remainingLeaveBalanceDays = leaveBalances.reduce(
      (sum, row) =>
        sum +
        toNumber(row.annualRemainingDays) +
        toNumber(row.sickRemainingDays) +
        toNumber(row.compensatoryRemainingDays),
      0
    );

    const attendanceTrendMap = new Map();
    for (const row of timesheets) {
      const key = toYmd(row.workDate);
      if (!attendanceTrendMap.has(key)) {
        attendanceTrendMap.set(key, { date: key, present: 0, absent: 0, late: 0, earlyLeave: 0 });
      }
      const bucket = attendanceTrendMap.get(key);
      if (row.actualCheckInAt) bucket.present += 1;
      if (!row.actualCheckInAt && !row.isOffSchedule) bucket.absent += 1;
      if (toNumber(row.latenessMinutes) > 0) bucket.late += 1;
      if (toNumber(row.earlyLeaveMinutes) > 0) bucket.earlyLeave += 1;
    }
    const attendanceTrend = [...attendanceTrendMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    const attendanceByShiftMap = new Map();
    for (const row of timesheets) {
      const shiftType = String(row?.shiftId?.shiftType || "unknown");
      if (!attendanceByShiftMap.has(shiftType)) {
        attendanceByShiftMap.set(shiftType, {
          shiftType,
          records: 0,
          present: 0,
          absent: 0,
          late: 0,
          earlyLeave: 0,
        });
      }
      const bucket = attendanceByShiftMap.get(shiftType);
      bucket.records += 1;
      if (row.actualCheckInAt) bucket.present += 1;
      if (!row.actualCheckInAt && !row.isOffSchedule) bucket.absent += 1;
      if (toNumber(row.latenessMinutes) > 0) bucket.late += 1;
      if (toNumber(row.earlyLeaveMinutes) > 0) bucket.earlyLeave += 1;
    }
    const attendanceByShift = [...attendanceByShiftMap.values()].sort((a, b) => a.shiftType.localeCompare(b.shiftType));

    const leaveByTypeMap = new Map();
    for (const row of leaveRequests) {
      const key = String(row.leaveType || "unknown");
      if (!leaveByTypeMap.has(key)) leaveByTypeMap.set(key, { leaveType: key, count: 0, days: 0 });
      const bucket = leaveByTypeMap.get(key);
      bucket.count += 1;
      bucket.days += toNumber(row.requestedDays);
    }
    const leaveByType = [...leaveByTypeMap.values()];

    const leaveStatusDistribution = [
      { label: "approved", count: leaveApproved.length },
      { label: "rejected", count: leaveRejected.length },
      { label: "pending", count: leavePending.length },
    ];

    const workforceStatusDistribution = [
      { label: "Đang hoạt động", count: activeEmployees },
      { label: "Đã nghỉ việc", count: terminatedEmployees },
    ];

    const attendanceIssueDistribution = [
      { label: "Đi muộn", count: lateCount },
      { label: "Về sớm", count: earlyLeaveCount },
      { label: "Vắng", count: absentCount },
    ];

    const attendanceDetails = timesheets.slice(0, 300).map((row) => ({
      employeeId: String(row.employeeId?._id || row.employeeId),
      employeeName: row.employeeId?.fullName || null,
      employeeCode: row.employeeId?.employeeCode || null,
      date: toYmd(row.workDate),
      shiftType: row.shiftId?.shiftType || null,
      status: mapAttendanceStatus(row),
      checkInAt: row.actualCheckInAt || null,
      checkOutAt: row.actualCheckOutAt || null,
      workedMinutes: toNumber(row.workedMinutes),
      lateMinutes: toNumber(row.latenessMinutes),
      earlyLeaveMinutes: toNumber(row.earlyLeaveMinutes),
    }));

    const leaveDetails = leaveRequests.slice(0, 300).map((row) => ({
      requestId: String(row._id),
      employeeId: String(row.employeeId?._id || row.employeeId),
      employeeName: row.employeeId?.fullName || null,
      employeeCode: row.employeeId?.employeeCode || null,
      leaveType: String(row.leaveType || ""),
      status: String(row.status || ""),
      startDate: row.startDate,
      endDate: row.endDate,
      requestedDays: toNumber(row.requestedDays),
      reason: row.reason || "",
    }));

    const currentSummary = {
      activeEmployees,
      terminatedEmployees,
      joinedEmployees,
      leftEmployees,
      attendanceRecords: timesheets.length,
      presentCount,
      absentCount,
      lateCount,
      earlyLeaveCount,
      leaveTotal: leaveRequests.length,
      leaveApproved: leaveApproved.length,
      leaveRejected: leaveRejected.length,
      leavePending: leavePending.length,
      leaveDaysUsed: Number(leaveApproved.reduce((s, r) => s + toNumber(r.requestedDays), 0).toFixed(2)),
      paidLeaveDays: Number(paidLeaveDays.toFixed(2)),
      unpaidLeaveDays: Number(unpaidLeaveDays.toFixed(2)),
      remainingLeaveBalanceDays: Number(remainingLeaveBalanceDays.toFixed(2)),
    };

    const [prevTimesheets, prevLeaves] = await Promise.all([
      Timesheet.find({
        restaurantId: rid,
        workDate: { $gte: compareStart, $lte: compareEnd },
      })
        .select({ actualCheckInAt: 1, latenessMinutes: 1, earlyLeaveMinutes: 1, isOffSchedule: 1 })
        .lean(),
      LeaveRequest.find({
        restaurantId: rid,
        startDate: { $lte: compareEnd },
        endDate: { $gte: compareStart },
      })
        .select({ status: 1, requestedDays: 1 })
        .lean(),
    ]);

    const prevSummary = {
      attendanceRecords: prevTimesheets.length,
      presentCount: prevTimesheets.filter((r) => Boolean(r.actualCheckInAt)).length,
      lateCount: prevTimesheets.filter((r) => toNumber(r.latenessMinutes) > 0).length,
      earlyLeaveCount: prevTimesheets.filter((r) => toNumber(r.earlyLeaveMinutes) > 0).length,
      absentCount: prevTimesheets.filter((r) => !r.actualCheckInAt && !r.isOffSchedule).length,
      leaveTotal: prevLeaves.length,
      leaveApproved: prevLeaves.filter((r) => String(r.status) === "approved").length,
      leaveRejected: prevLeaves.filter((r) => String(r.status) === "rejected").length,
      leavePending: prevLeaves.filter((r) => String(r.status).startsWith("pending")).length,
      leaveDaysUsed: prevLeaves
        .filter((r) => String(r.status) === "approved")
        .reduce((sum, r) => sum + toNumber(r.requestedDays), 0),
    };

    const comparisonMetricKeys = [
      "activeEmployees",
      "terminatedEmployees",
      "joinedEmployees",
      "leftEmployees",
      "attendanceRecords",
      "presentCount",
      "absentCount",
      "lateCount",
      "earlyLeaveCount",
      "leaveTotal",
      "leaveApproved",
      "leaveRejected",
      "leavePending",
      "leaveDaysUsed",
    ];
    const prevSummaryWithWorkforce = {
      ...prevSummary,
      activeEmployees,
      terminatedEmployees,
      joinedEmployees: 0,
      leftEmployees: 0,
    };
    const comparison = comparisonMetricKeys.map((metric) => {
      const current = toNumber(currentSummary[metric]);
      const previous = toNumber(prevSummaryWithWorkforce[metric]);
      const delta = current - previous;
      const deltaPct = previous === 0 ? (current === 0 ? 0 : 100) : Number(((delta / previous) * 100).toFixed(2));
      return { metric, current, previous, delta, deltaPct };
    });

    return {
      currentPeriod: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      comparisonPeriod: {
        startDate: compareStart.toISOString(),
        endDate: compareEnd.toISOString(),
      },
      summary: currentSummary,
      comparison,
      attendanceTrend,
      attendanceByShift,
      attendanceIssueDistribution,
      leaveByType,
      leaveStatusDistribution,
      workforceStatusDistribution,
      attendanceDetails,
      leaveDetails,
    };
  },
};
