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
  normalizeSalaryType,
} from "./payrollCalculator.service.js";
import { getPayrollPolicyForDate } from "../../config/payrollPolicy.vn.js";
import { assertPayrollPeriodEditable } from "./payrollLockGuard.service.js";
import { getStaffMembershipRestaurantFilter } from "../auth/restaurantScope.service.js";

export function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

export function toStartOfDay(date) {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

export function toEndOfDay(date) {
  const value = new Date(date);
  value.setUTCHours(23, 59, 59, 999);
  return value;
}

function mapDepartmentLabel(department) {
  const labels = {
    management: "Management",
    kitchen: "Kitchen",
    service: "Service",
    cashier: "Cashier",
    cleaning: "Cleaning",
    delivery: "Delivery",
    inventory: "Inventory",
    bar: "Bar",
  };
  return labels[String(department || "").toLowerCase()] || "Other";
}

function normalizeYmd(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function getWeekdayCode(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][
    date.getUTCDay()
  ];
}

function isTimesheetIncludedInPayroll(row) {
  return (
    row?.isOffSchedule !== true ||
    row?.approved === true ||
    row?.offScheduleApprovalStatus === "approved"
  );
}

function isHolidayWorkDate(row, settings) {
  const holidays = new Set(
    (settings?.holidayDates || []).map((value) => normalizeYmd(value)),
  );
  return holidays.has(normalizeYmd(row.workDate));
}

function isWeekendWorkDate(row, settings) {
  const weekends = new Set(
    (settings?.weekendDays || ["SUN"]).map((day) =>
      String(day).trim().toUpperCase(),
    ),
  );
  return weekends.has(getWeekdayCode(row.workDate));
}

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const DEFAULT_PAYROLL_TIMEZONE_OFFSET_MINUTES = 7 * 60;

function parseClockMinutes(clockText) {
  const [hour = "0", minute = "0"] = String(clockText || "00:00").split(
    ":",
  );
  return Number(hour) * 60 + Number(minute);
}

function resolvePayrollTimezoneOffsetMinutes(settings) {
  const configuredOffset = Number(
    settings?.timezoneOffsetMinutes ??
      settings?.utcOffsetMinutes ??
      settings?.payrollTimezoneOffsetMinutes,
  );
  return Number.isFinite(configuredOffset)
    ? configuredOffset
    : DEFAULT_PAYROLL_TIMEZONE_OFFSET_MINUTES;
}

function toOffsetDayStart(dateValue, offsetMinutes) {
  const shifted = new Date(
    new Date(dateValue).getTime() + offsetMinutes * MINUTE_MS,
  );
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - offsetMinutes * MINUTE_MS);
}

function calculateNightOverlapMinutes(row, settings) {
  const checkIn = row.actualCheckInAt ? new Date(row.actualCheckInAt) : null;
  const checkOut = row.actualCheckOutAt ? new Date(row.actualCheckOutAt) : null;
  if (!checkIn || !checkOut || checkOut <= checkIn) return 0;

  const nightStartMinutes = parseClockMinutes(
    settings?.nightShiftStart || "22:00",
  );
  const nightEndMinutes = parseClockMinutes(
    settings?.nightShiftEnd || "06:00",
  );
  const wrapsMidnight = nightEndMinutes <= nightStartMinutes;
  const offsetMinutes = resolvePayrollTimezoneOffsetMinutes(settings);
  const firstDayStart = toOffsetDayStart(checkIn, offsetMinutes);
  const lastDayStart = toOffsetDayStart(checkOut, offsetMinutes);
  let overlap = 0;

  for (
    let dayStart = firstDayStart.getTime() - DAY_MS;
    dayStart <= lastDayStart.getTime();
    dayStart += DAY_MS
  ) {
    const windowStart = dayStart + nightStartMinutes * MINUTE_MS;
    const windowEnd =
      dayStart +
      nightEndMinutes * MINUTE_MS +
      (wrapsMidnight ? DAY_MS : 0);
    overlap += Math.max(
      0,
      Math.min(checkOut.getTime(), windowEnd) -
        Math.max(checkIn.getTime(), windowStart),
    );
  }

  return Math.round(overlap / MINUTE_MS);
}

function inferRegionCodeFromRestaurant(restaurant) {
  const manual = String(restaurant?.payrollRegionCode || "")
    .trim()
    .toUpperCase();
  if (["I", "II", "III", "IV"].includes(manual)) return manual;

  const city = String(restaurant?.address?.city || "").toLowerCase();
  if (
    city.includes("hà nội") ||
    city.includes("ha noi") ||
    city.includes("hồ chí minh") ||
    city.includes("ho chi minh")
  ) {
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
    weekendDays: ["SUN"],
    holidayDates: [],
    nightShiftStart: "22:00",
    nightShiftEnd: "06:00",
    nightShiftAllowanceRate: 0.3,
    enablePersonalIncomeTax: false,
    personalIncomeTaxRate: 0,
    personalIncomeTaxFreeThreshold: 0,
    notes: "",
    updatedAt: null,
  };
}

function paidAmountForItem(row) {
  const netSalary = Number(row?.netSalary || 0);
  const recorded = Number(row?.paidAmount || 0);
  const fallback = ["paid", "locked"].includes(String(row?.status || ""))
    ? netSalary
    : 0;
  return Math.min(Math.max(recorded || fallback, 0), Math.max(netSalary, 0));
}

export function summarize(items = []) {
  const totalPayroll = items.reduce(
    (sum, row) => sum + Number(row.netSalary || 0),
    0,
  );
  const paidAmount = items.reduce(
    (sum, row) => sum + paidAmountForItem(row),
    0,
  );
  const remaining = items.reduce(
    (sum, row) =>
      sum +
      Math.max(Number(row.netSalary || 0) - paidAmountForItem(row), 0),
    0,
  );
  const totalAllowance = items.reduce(
    (sum, row) => sum + Number(row.allowance || 0),
    0,
  );
  const totalBonus = items.reduce(
    (sum, row) => sum + Number(row.bonus || 0),
    0,
  );
  const totalDeduction = items.reduce(
    (sum, row) => sum + Number(row.totalDeduction || 0),
    0,
  );
  const paidEmployees = items.filter(
    (row) =>
      ["paid", "locked"].includes(String(row.status || "")) ||
      (Number(row.netSalary || 0) > 0 &&
        paidAmountForItem(row) >= Number(row.netSalary || 0)),
  ).length;

  return {
    totalPayroll,
    paidAmount,
    remaining,
    progress:
      totalPayroll > 0
        ? Math.min(
            100,
            Math.max(0, Math.round((paidAmount / totalPayroll) * 100)),
          )
        : 0,
    totalAllowance,
    totalBonus,
    totalDeduction,
    paidEmployees,
    unpaidEmployees: Math.max(items.length - paidEmployees, 0),
    employees: items.length,
  };
}

function applySettingOverrides(payroll, aggregate, settings) {
  const salaryType = normalizeSalaryType(payroll.salaryType);
  const monthlyDailyRate =
    payroll.workDays > 0 ? payroll.baseSalary / payroll.workDays : 0;
  const configuredUnpaidLeaveRate = Number(
    settings.unpaidLeaveDeductionPerDay || 0,
  );
  const unpaidLeaveRate =
    configuredUnpaidLeaveRate > 0
      ? configuredUnpaidLeaveRate
      : salaryType === "monthly"
        ? monthlyDailyRate
        : 0;
  const latenessPenalty =
    Number(aggregate.totalLatenessMinutes || 0) *
    Number(settings.latenessPenaltyPerMinute || 0);
  const earlyLeavePenalty =
    Number(aggregate.totalEarlyLeaveMinutes || 0) *
    Number(settings.earlyLeavePenaltyPerMinute || 0);
  const unpaidLeaveDeduction =
    Number(aggregate.unpaidLeaveDays || 0) * unpaidLeaveRate;

  const allowance =
    Number(payroll.allowance || 0) +
    Number(settings.defaultAllowance || 0) +
    Number(aggregate.adjustmentAllowance || 0);
  const bonus =
    Number(payroll.bonus || 0) +
    Number(settings.defaultBonus || 0) +
    Number(aggregate.adjustmentBonus || 0);
  const otherAddition =
    Number(payroll.otherAddition || 0) +
    Number(aggregate.adjustmentOtherAddition || 0);
  const deduction =
    Number(payroll.deduction || 0) +
    Number(aggregate.adjustmentDeduction || 0);
  const advance =
    Number(payroll.advance || 0) + Number(aggregate.adjustmentAdvance || 0);
  const otherDeduction =
    Number(payroll.otherDeduction || 0) +
    Number(settings.defaultDeduction || 0) +
    Number(aggregate.adjustmentOtherDeduction || 0);

  const totalIncome =
    Number(payroll.grossIncome || 0) + allowance + bonus + otherAddition;
  const taxableIncome = Math.max(
    totalIncome -
      Number(payroll.insuranceTotal || 0) -
      Number(settings.personalIncomeTaxFreeThreshold || 0),
    0,
  );
  const personalIncomeTax = settings.enablePersonalIncomeTax
    ? taxableIncome * Number(settings.personalIncomeTaxRate || 0)
    : 0;
  const extraPenalty =
    latenessPenalty + earlyLeavePenalty + unpaidLeaveDeduction;
  const totalDeduction =
    deduction +
    otherDeduction +
    advance +
    Number(payroll.insuranceTotal || 0) +
    personalIncomeTax +
    extraPenalty;

  return {
    ...payroll,
    allowance,
    bonus,
    otherAddition,
    deduction,
    advance,
    otherDeduction,
    totalIncome,
    personalIncomeTax,
    totalDeduction,
    netSalary: totalIncome - totalDeduction,
    lateMinutes: Number(aggregate.totalLatenessMinutes || 0),
    earlyLeaveMinutes: Number(aggregate.totalEarlyLeaveMinutes || 0),
    unpaidLeaveDays: Number(aggregate.unpaidLeaveDays || 0),
    paidLeaveDays: Number(aggregate.paidLeaveDays || 0),
    scheduleShiftCount: Number(aggregate.scheduleShiftCount || 0),
    manualAdjustmentTotal:
      Number(aggregate.adjustmentAllowance || 0) +
      Number(aggregate.adjustmentBonus || 0) +
      Number(aggregate.adjustmentOtherAddition || 0) -
      Number(aggregate.adjustmentDeduction || 0) -
      Number(aggregate.adjustmentAdvance || 0) -
      Number(aggregate.adjustmentOtherDeduction || 0),
  };
}

export function mapPayrollDocToGql(row) {
  const breakdown = row.breakdown || {};
  const netSalary = Number(breakdown.netSalary || 0);
  const paidAmount = Math.min(
    Math.max(
      Number(
        breakdown.paidAmount ||
          (["paid", "locked"].includes(String(row.status || ""))
            ? netSalary
            : 0),
      ),
      0,
    ),
    Math.max(netSalary, 0),
  );

  return {
    id: String(row.employeeId || row.id),
    payrollItemId: String(row._id || row.payrollItemId || ""),
    periodId: row.periodId ? String(row.periodId) : null,
    periodName: row.periodName || row.periodSnapshot?.name || null,
    periodStartDate:
      row.periodStartDate || row.periodSnapshot?.startDate || null,
    periodEndDate: row.periodEndDate || row.periodSnapshot?.endDate || null,
    periodStatus: row.periodStatus || row.periodSnapshot?.status || null,
    periodFinalizedAt:
      row.periodFinalizedAt || row.periodSnapshot?.finalizedAt || null,
    name: row.employeeName || row.name || "Nhân viên",
    code: row.employeeCode || row.code || null,
    role: row.role || null,
    department: row.department || null,
    avatar: row.avatar || null,
    baseSalary: Number(breakdown.baseSalary || 0),
    workDays: Number(breakdown.workDays || 0),
    actualWorkDays: Number(breakdown.actualWorkDays || 0),
    totalHours: Number(breakdown.totalHours || 0),
    hourlyRate: Number(breakdown.hourlyRate || 0),
    allowance: Number(breakdown.allowance || 0),
    bonus: Number(breakdown.bonus || 0),
    otherAddition: Number(breakdown.otherAddition || 0),
    overtime: Number(breakdown.overtime || 0),
    overtimeNormal: Number(breakdown.overtimeNormal || 0),
    overtimeWeekend: Number(breakdown.overtimeWeekend || 0),
    overtimeHoliday: Number(breakdown.overtimeHoliday || 0),
    nightShiftExtra: Number(breakdown.nightShiftExtra || 0),
    overtimeHours: Number(breakdown.overtimeHours || 0),
    overtimeNormalHours: Number(breakdown.overtimeNormalHours || 0),
    overtimeWeekendHours: Number(breakdown.overtimeWeekendHours || 0),
    overtimeHolidayHours: Number(breakdown.overtimeHolidayHours || 0),
    nightHours: Number(breakdown.nightHours || 0),
    overtimeNightHours: Number(breakdown.overtimeNightHours || 0),
    deduction: Number(breakdown.deduction || 0),
    otherDeduction: Number(breakdown.otherDeduction || 0),
    advance: Number(breakdown.advance || 0),
    insuranceSocial: Number(breakdown.insuranceSocial || 0),
    insuranceHealth: Number(breakdown.insuranceHealth || 0),
    insuranceUnemployment: Number(breakdown.insuranceUnemployment || 0),
    insuranceTotal: Number(breakdown.insuranceTotal || 0),
    insuranceEmployerTotal: Number(breakdown.insuranceEmployerTotal || 0),
    personalIncomeTax: Number(breakdown.personalIncomeTax || 0),
    grossIncome: Number(breakdown.grossIncome || 0),
    coefficient: Number(breakdown.coefficient || 0),
    totalIncome: Number(breakdown.totalIncome || 0),
    totalDeduction: Number(breakdown.totalDeduction || 0),
    netSalary,
    policyCode: breakdown.policyCode || null,
    policyEffectiveFrom: breakdown.policyEffectiveFrom || null,
    regionCode: breakdown.regionCode || null,
    minimumWageMonthly: Number(breakdown.minimumWageMonthly || 0),
    minimumWageHourly: Number(breakdown.minimumWageHourly || 0),
    minimumWageViolation: Boolean(breakdown.minimumWageViolation),
    insuranceEligible: Boolean(breakdown.insuranceEligible),
    warningMessages: row.warningMessages || [],
    status: row.status || "draft",
    paidAmount,
    remainingAmount: Number(
      breakdown.remainingAmount ?? Math.max(netSalary - paidAmount, 0),
    ),
    paidAt: row.paidAt || null,
    lateMinutes: Number(breakdown.lateMinutes || 0),
    earlyLeaveMinutes: Number(breakdown.earlyLeaveMinutes || 0),
    unpaidLeaveDays: Number(breakdown.unpaidLeaveDays || 0),
    paidLeaveDays: Number(breakdown.paidLeaveDays || 0),
    scheduleShiftCount: Number(breakdown.scheduleShiftCount || 0),
    manualAdjustmentTotal: Number(
      breakdown.manualAdjustmentTotal || 0,
    ),
  };
}

function createEmptyAggregate() {
  return {
    totalHours: 0,
    totalWage: 0,
    totalAmount: 0,
    totalLatenessMinutes: 0,
    totalEarlyLeaveMinutes: 0,
    overtimeNormalHours: 0,
    overtimeWeekendHours: 0,
    overtimeHolidayHours: 0,
    nightHours: 0,
    overtimeNightHours: 0,
    workedDateCount: 0,
    workedShiftCount: 0,
  };
}

export async function buildPayrollItemsForRange({
  start,
  end,
  restaurantId,
  periodId = null,
  forceStatus = null,
}) {
  const rid = toObjectId(restaurantId);
  if (!rid) return [];

  const [settings, scopedStaffFilter] = await Promise.all([
    getPayrollSettings(rid),
    getStaffMembershipRestaurantFilter(rid),
  ]);
  const staffs = await Staff.find({
    userType: "STAFF",
    deletedAt: null,
    ...scopedStaffFilter,
  })
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
      salaryType: 1,
      hourlyRate: 1,
      allowanceAmount: 1,
      employmentType: 1,
      employmentStatus: 1,
    })
    .lean();
  if (!staffs.length) return [];

  const staffIds = staffs.map((staff) => staff._id);
  const [shifts, timesheetRows, timesheetAgg, leaveAgg, adjustments] =
    await Promise.all([
      Shift.find({
        employeeId: { $in: staffIds },
        restaurantId: rid,
        startTime: { $lte: end },
        endTime: { $gte: start },
        status: { $ne: "cancelled" },
      })
        .select({ _id: 1, employeeId: 1, startTime: 1, endTime: 1 })
        .lean(),
      Timesheet.find({
        employeeId: { $in: staffIds },
        restaurantId: rid,
        workDate: { $gte: start, $lte: end },
      })
        .select({
          employeeId: 1,
          workDate: 1,
          actualCheckInAt: 1,
          actualCheckOutAt: 1,
          isOffSchedule: 1,
          approved: 1,
          offScheduleApprovalStatus: 1,
          overtimeApprovalStatus: 1,
          approvedOvertimeMinutes: 1,
        })
        .lean(),
      Timesheet.aggregate([
        {
          $match: {
            employeeId: { $in: staffIds },
            restaurantId: rid,
            workDate: { $gte: start, $lte: end },
          },
        },
        {
          $addFields: {
            includeInPayroll: {
              $or: [
                { $ne: ["$isOffSchedule", true] },
                { $eq: ["$approved", true] },
                { $eq: ["$offScheduleApprovalStatus", "approved"] },
              ],
            },
          },
        },
        {
          $group: {
            _id: "$employeeId",
            totalHours: {
              $sum: {
                $cond: ["$includeInPayroll", { $ifNull: ["$hours", 0] }, 0],
              },
            },
            totalWage: {
              $sum: {
                $cond: ["$includeInPayroll", { $ifNull: ["$wage", 0] }, 0],
              },
            },
            totalAmount: {
              $sum: {
                $cond: ["$includeInPayroll", { $ifNull: ["$amount", 0] }, 0],
              },
            },
            totalLatenessMinutes: {
              $sum: {
                $cond: [
                  "$includeInPayroll",
                  { $ifNull: ["$latenessMinutes", 0] },
                  0,
                ],
              },
            },
            totalEarlyLeaveMinutes: {
              $sum: {
                $cond: [
                  "$includeInPayroll",
                  { $ifNull: ["$earlyLeaveMinutes", 0] },
                  0,
                ],
              },
            },
            workedShiftCount: {
              $sum: { $cond: ["$includeInPayroll", 1, 0] },
            },
            workedDateKeys: {
              $addToSet: {
                $cond: [
                  "$includeInPayroll",
                  {
                    $dateToString: {
                      format: "%Y-%m-%d",
                      date: "$workDate",
                      timezone: "UTC",
                    },
                  },
                  null,
                ],
              },
            },
          },
        },
      ]),
      LeaveRequest.aggregate([
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
                $cond: [
                  { $eq: ["$payrollFlags.isPaidLeave", true] },
                  { $ifNull: ["$requestedDays", 0] },
                  0,
                ],
              },
            },
            unpaidLeaveDays: {
              $sum: {
                $cond: [
                  { $ne: ["$payrollFlags.isPaidLeave", true] },
                  { $ifNull: ["$requestedDays", 0] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      periodId
        ? PayrollAdjustment.find({ periodId: toObjectId(periodId) }).lean()
        : [],
    ]);

  const runtimeBreakdownByStaff = new Map();
  for (const row of timesheetRows) {
    if (!isTimesheetIncludedInPayroll(row)) continue;
    const sid = String(row.employeeId);
    if (!runtimeBreakdownByStaff.has(sid)) {
      runtimeBreakdownByStaff.set(sid, {
        overtimeNormalMinutes: 0,
        overtimeWeekendMinutes: 0,
        overtimeHolidayMinutes: 0,
        nightMinutes: 0,
        overtimeNightMinutes: 0,
      });
    }
    const bucket = runtimeBreakdownByStaff.get(sid);
    const approvedOvertimeMinutes =
      row.overtimeApprovalStatus === "approved"
        ? Math.max(Number(row.approvedOvertimeMinutes || 0), 0)
        : 0;
    const nightMinutes = calculateNightOverlapMinutes(row, settings);
    bucket.nightMinutes += nightMinutes;
    if (approvedOvertimeMinutes <= 0) continue;
    if (isHolidayWorkDate(row, settings)) {
      bucket.overtimeHolidayMinutes += approvedOvertimeMinutes;
    } else if (isWeekendWorkDate(row, settings)) {
      bucket.overtimeWeekendMinutes += approvedOvertimeMinutes;
    } else {
      bucket.overtimeNormalMinutes += approvedOvertimeMinutes;
    }
    bucket.overtimeNightMinutes += Math.min(
      approvedOvertimeMinutes,
      nightMinutes,
    );
  }

  const timesheetMap = new Map(
    timesheetAgg.map((row) => {
      const runtime = runtimeBreakdownByStaff.get(String(row._id)) || {};
      return [
        String(row._id),
        {
          totalHours: Number(row.totalHours || 0),
          totalWage: Number(row.totalWage || 0),
          totalAmount: Number(row.totalAmount || 0),
          totalLatenessMinutes: Number(row.totalLatenessMinutes || 0),
          totalEarlyLeaveMinutes: Number(row.totalEarlyLeaveMinutes || 0),
          overtimeNormalHours:
            Number(runtime.overtimeNormalMinutes || 0) / 60,
          overtimeWeekendHours:
            Number(runtime.overtimeWeekendMinutes || 0) / 60,
          overtimeHolidayHours:
            Number(runtime.overtimeHolidayMinutes || 0) / 60,
          nightHours: Number(runtime.nightMinutes || 0) / 60,
          overtimeNightHours:
            Number(runtime.overtimeNightMinutes || 0) / 60,
          workedDateCount: (row.workedDateKeys || []).filter(Boolean).length,
          workedShiftCount: Number(row.workedShiftCount || 0),
        },
      ];
    }),
  );
  const leaveMap = new Map(
    leaveAgg.map((row) => [
      String(row._id),
      {
        paidLeaveDays: Number(row.paidLeaveDays || 0),
        unpaidLeaveDays: Number(row.unpaidLeaveDays || 0),
      },
    ]),
  );
  const adjustmentMap = new Map();
  for (const adjustment of adjustments) {
    const sid = String(adjustment.employeeId);
    if (!adjustmentMap.has(sid)) {
      adjustmentMap.set(sid, {
        adjustmentAllowance: 0,
        adjustmentBonus: 0,
        adjustmentDeduction: 0,
        adjustmentAdvance: 0,
        adjustmentOtherAddition: 0,
        adjustmentOtherDeduction: 0,
      });
    }
    const bucket = adjustmentMap.get(sid);
    const amount = Number(adjustment.amount || 0);
    if (adjustment.type === "allowance") bucket.adjustmentAllowance += amount;
    else if (adjustment.type === "bonus") bucket.adjustmentBonus += amount;
    else if (adjustment.type === "deduction")
      bucket.adjustmentDeduction += Math.abs(amount);
    else if (adjustment.type === "advance")
      bucket.adjustmentAdvance += Math.abs(amount);
    else if (adjustment.type === "other_deduction")
      bucket.adjustmentOtherDeduction += Math.abs(amount);
    else bucket.adjustmentOtherAddition += amount;
  }

  const shiftCountByStaff = new Map();
  for (const shift of shifts) {
    const sid = String(shift.employeeId);
    shiftCountByStaff.set(sid, (shiftCountByStaff.get(sid) || 0) + 1);
  }

  const workDays = calculatePeriodCalendarDays(start, end);
  const restaurant = await Restaurant.findById(rid)
    .select({ address: 1, payrollRegionCode: 1 })
    .lean();
  const regionCode = normalizeRegionCode(
    inferRegionCodeFromRestaurant(restaurant),
  );

  return staffs.map((staff) => {
    const sid = String(staff._id);
    const timesheet = timesheetMap.get(sid) || createEmptyAggregate();
    const leave = leaveMap.get(sid) || {
      paidLeaveDays: 0,
      unpaidLeaveDays: 0,
    };
    const adjustmentsForStaff = adjustmentMap.get(sid) || {
      adjustmentAllowance: 0,
      adjustmentBonus: 0,
      adjustmentDeduction: 0,
      adjustmentAdvance: 0,
      adjustmentOtherAddition: 0,
      adjustmentOtherDeduction: 0,
    };
    const paidLeaveDays = settings.allowPaidLeaveInWorkDays
      ? Number(leave.paidLeaveDays || 0)
      : 0;
    const payroll = buildPayrollItem({
      staff,
      period: { start, end, calendarDays: workDays },
      aggregate: {
        ...timesheet,
        workedDateCount:
          Number(timesheet.workedDateCount || 0) + paidLeaveDays,
        paidLeaveDays,
      },
      regionCode,
      payrollStatus: forceStatus || "draft",
      settings,
    });
    const breakdown = applySettingOverrides(
      payroll,
      {
        ...timesheet,
        ...leave,
        ...adjustmentsForStaff,
        scheduleShiftCount: shiftCountByStaff.get(sid) || 0,
      },
      settings,
    );

    const warningMessages = [];
    if (breakdown.missingCompensationRate) {
      const messages = {
        monthly: "Nhân viên chưa có mức lương tháng hợp lệ.",
        hourly: "Nhân viên chưa có đơn giá lương theo giờ hợp lệ.",
        shift: "Nhân viên chưa có đơn giá lương theo ca hợp lệ.",
        commission: "Chưa có dữ liệu doanh số/hoa hồng trong kỳ.",
      };
      warningMessages.push(
        messages[breakdown.salaryType] || messages.monthly,
      );
    }
    if (breakdown.minimumWageViolation) {
      warningMessages.push(
        breakdown.salaryType === "monthly"
          ? "Lương cơ bản thấp hơn lương tối thiểu vùng áp dụng."
          : "Đơn giá giờ quy đổi thấp hơn lương tối thiểu vùng áp dụng.",
      );
    }
    if (!breakdown.insuranceEligible) {
      warningMessages.push(
        "Nhân sự chưa thuộc diện đóng BH bắt buộc theo cấu hình chính sách.",
      );
    }
    if (Number(breakdown.lateMinutes || 0) > 0) {
      warningMessages.push(
        `Đi muộn ${breakdown.lateMinutes} phút trong kỳ.`,
      );
    }
    if (Number(breakdown.unpaidLeaveDays || 0) > 0) {
      warningMessages.push(
        `Có ${breakdown.unpaidLeaveDays} ngày nghỉ không lương.`,
      );
    }

    return {
      employeeId: staff._id,
      employeeName: staff.fullName || "Nhân viên",
      employeeCode: staff.employeeCode || "",
      role: staff.positionTitle || staff.roleName || "Nhân viên",
      department: mapDepartmentLabel(staff.department),
      avatar: staff.avatarUrl || staff.avatar || null,
      breakdown,
      warningMessages,
      status: forceStatus || "draft",
      paidAt: null,
    };
  });
}

export async function upsertPeriodItems(periodDoc) {
  assertPayrollPeriodEditable(periodDoc);
  const periodId = String(periodDoc._id);
  const items = await buildPayrollItemsForRange({
    start: toStartOfDay(periodDoc.startDate),
    end: toEndOfDay(periodDoc.endDate),
    restaurantId: periodDoc.restaurantId,
    periodId,
    forceStatus: periodDoc.status,
  });

  await Promise.all(
    items.map((row) =>
      PayrollItem.findOneAndUpdate(
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
            paidAt: null,
            paidBy: null,
            paymentMethod: "",
            paymentNote: "",
          },
        },
        { upsert: true, new: true },
      ),
    ),
  );

  const employeeIds = items.map((row) => row.employeeId);
  await PayrollItem.deleteMany({
    periodId: periodDoc._id,
    ...(employeeIds.length
      ? { employeeId: { $nin: employeeIds } }
      : {}),
  });

  const docs = await PayrollItem.find({ periodId: periodDoc._id }).lean();
  const gqlItems = docs.map(mapPayrollDocToGql);
  const stats = summarize(gqlItems);

  await PayrollPeriod.findByIdAndUpdate(periodDoc._id, {
    $set: {
      settingsSnapshot: await getPayrollSettings(periodDoc.restaurantId),
      policySnapshot: getPayrollPolicyForDate(periodDoc.endDate),
      statsSnapshot: stats,
      calculationVersion: "payroll_v2_salary_scope",
    },
  });

  return { items: gqlItems, stats };
}

export async function getPeriodDetail(periodId) {
  const period = await PayrollPeriod.findById(periodId).lean();
  if (!period) return null;
  const settings = ["finalized", "paying", "locked", "paid"].includes(
    String(period.status),
  )
    ? period.settingsSnapshot ||
      (await getPayrollSettings(period.restaurantId))
    : await getPayrollSettings(period.restaurantId);
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
