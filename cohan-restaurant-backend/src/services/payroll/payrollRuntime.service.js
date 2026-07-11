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
import { getPayrollPolicyForDate } from "../../config/payrollPolicy.vn.js";
import { assertPayrollPeriodEditable } from "./payrollLockGuard.service.js";
import { getStaffMembershipRestaurantFilter } from "../auth/restaurantScope.service.js";

const DEFAULT_PAYROLL_TIMEZONE = "Asia/Ho_Chi_Minh";

function safeTimeZone(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return DEFAULT_PAYROLL_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return DEFAULT_PAYROLL_TIMEZONE;
  }
}

function formatDateInTimeZone(value, timezone = DEFAULT_PAYROLL_TIMEZONE) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function zonedDateTimeToUtc(datePart, timePart, timezone = DEFAULT_PAYROLL_TIMEZONE) {
  const [year, month, day] = String(datePart).split("-").map(Number);
  const [hour = 0, minute = 0, second = 0] = String(timePart || "00:00:00")
    .split(":")
    .map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
  const rendered = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timezone),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utcGuess);
  const map = Object.fromEntries(rendered.map((part) => [part.type, part.value]));
  const renderedAsUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
    0,
  );
  return new Date(utcGuess.getTime() - (renderedAsUtc - utcGuess.getTime()));
}

export function toStartOfDay(
  date,
  timezone = DEFAULT_PAYROLL_TIMEZONE,
) {
  const safeTimezone = safeTimeZone(timezone);
  return zonedDateTimeToUtc(
    formatDateInTimeZone(date, safeTimezone),
    "00:00:00",
    safeTimezone,
  );
}

export function toEndOfDay(
  date,
  timezone = DEFAULT_PAYROLL_TIMEZONE,
) {
  const safeTimezone = safeTimeZone(timezone);
  return zonedDateTimeToUtc(
    formatDateInTimeZone(date, safeTimezone),
    "23:59:59",
    safeTimezone,
  );
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
function normalizeYmd(dateValue, timezone = DEFAULT_PAYROLL_TIMEZONE) {
  return formatDateInTimeZone(dateValue, timezone);
}

function getWeekdayCode(dateValue, timezone = DEFAULT_PAYROLL_TIMEZONE) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timezone),
    weekday: "short",
  }).format(date).toUpperCase();
  return ({ SUN: "SUN", MON: "MON", TUE: "TUE", WED: "WED", THU: "THU", FRI: "FRI", SAT: "SAT" })[weekday] || "";
}

function isTimesheetIncludedInPayroll(row) {
  return (
    row?.isOffSchedule !== true ||
    row?.approved === true ||
    row?.offScheduleApprovalStatus === "approved"
  );
}

function isHolidayWorkDate(row, settings) {
  const holidaySet = new Set(
    (settings?.holidayDates || []).map((value) => normalizeYmd(value, settings?.timezone)),
  );
  return holidaySet.has(normalizeYmd(row.workDate, settings?.timezone));
}
function isWeekendWorkDate(row, settings) {
  const weekendSet = new Set(
    (settings?.weekendDays || ["SUN"]).map((day) =>
      String(day).trim().toUpperCase(),
    ),
  );

  return weekendSet.has(getWeekdayCode(row.workDate, settings?.timezone));
}
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const DEFAULT_PAYROLL_TIMEZONE_OFFSET_MINUTES = 7 * 60;

function parseClockMinutes(clockText) {
  const [hour = "0", minute = "0"] = String(clockText || "00:00").split(":");
  return Number(hour) * 60 + Number(minute);
}

function resolvePayrollTimezoneOffsetMinutes(settings) {
  const configuredOffset = Number(
    settings?.timezoneOffsetMinutes ??
      settings?.utcOffsetMinutes ??
      settings?.payrollTimezoneOffsetMinutes,
  );

  if (Number.isFinite(configuredOffset)) return configuredOffset;
  return DEFAULT_PAYROLL_TIMEZONE_OFFSET_MINUTES;
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
  const nightEndMinutes = parseClockMinutes(settings?.nightShiftEnd || "06:00");
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
      timezone: safeTimeZone(doc.timezone || DEFAULT_PAYROLL_TIMEZONE),
      currentPayrollPeriodId: doc.currentPayrollPeriodId
        ? String(doc.currentPayrollPeriodId)
        : null,
    };
  }

  return {
    restaurantId: String(rid),
    timezone: DEFAULT_PAYROLL_TIMEZONE,
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

function summarize(items) {
  const totalPayroll = items.reduce(
    (sum, row) => sum + Number(row.netSalary || 0),
    0,
  );
  const paidAmount = items.reduce(
    (sum, row) =>
      sum + (row.status === "paid" ? Number(row.netSalary || 0) : 0),
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
  const paidEmployees = items.filter((row) => row.status === "paid").length;
  const remaining = totalPayroll - paidAmount;
  return {
    totalPayroll,
    paidAmount,
    remaining,
    progress:
      totalPayroll > 0 ? Math.round((paidAmount / totalPayroll) * 100) : 0,
    totalAllowance,
    totalBonus,
    totalDeduction,
    paidEmployees,
    unpaidEmployees: Math.max(items.length - paidEmployees, 0),
    employees: items.length,
  };
}

function applySettingOverrides(payroll, aggregate, settings) {
  const dailyRate =
    payroll.workDays > 0 ? payroll.baseSalary / payroll.workDays : 0;
  const latenessPenalty =
    Number(aggregate.totalLatenessMinutes || 0) *
    Number(settings.latenessPenaltyPerMinute || 0);
  const earlyLeavePenalty =
    Number(aggregate.totalEarlyLeaveMinutes || 0) *
    Number(settings.earlyLeavePenaltyPerMinute || 0);
  const unpaidLeaveDeduction =
    Number(aggregate.unpaidLeaveDays || 0) *
    (Number(settings.unpaidLeaveDeductionPerDay || 0) || dailyRate);

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

  const extraPenalty =
    latenessPenalty + earlyLeavePenalty + unpaidLeaveDeduction;
  const deduction =
    Number(payroll.deduction || 0) + Number(aggregate.adjustmentDeduction || 0);
  const advance =
    Number(payroll.advance || 0) + Number(aggregate.adjustmentAdvance || 0);
  const otherDeduction =
    Number(payroll.otherDeduction || 0) +
    Number(settings.defaultDeduction || 0) +
    Number(aggregate.adjustmentOtherDeduction || 0);

  const baseWorkIncome = Number(payroll.grossIncome || 0);
  const totalIncome = baseWorkIncome + allowance + bonus + otherAddition;

  const totalDeduction =
    deduction +
    otherDeduction +
    advance +
    Number(payroll.insuranceTotal || 0) +
    Number(payroll.personalIncomeTax || 0) +
    extraPenalty;

  const netSalary = totalIncome - totalDeduction;

  return {
    ...payroll,
    allowance,
    bonus,
    otherAddition,
    deduction,
    advance,
    otherDeduction,
    grossIncome: baseWorkIncome,
    totalIncome,
    totalDeduction,
    netSalary,
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
  const b = row.breakdown || {};
  return {
    id: String(row.employeeId || row.id),
    payrollItemId: String(row._id || row.payrollItemId || ""),
    periodId: row.periodId ? String(row.periodId) : null,
    periodName: row.periodName || row.periodSnapshot?.name || null,
    periodStartDate: row.periodStartDate || row.periodSnapshot?.startDate || null,
    periodEndDate: row.periodEndDate || row.periodSnapshot?.endDate || null,
    periodStatus: row.periodStatus || row.periodSnapshot?.status || null,
    periodFinalizedAt: row.periodFinalizedAt || row.periodSnapshot?.finalizedAt || null,
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
    salaryType: b.salaryType || "monthly",
    commissionRate: Number(b.commissionRate || 0),
    regularHours: Number(b.regularHours || 0),
    commissionableAmount: Number(b.commissionableAmount || 0),
    salaryConfigurationIssue: b.salaryConfigurationIssue || null,
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
    paidAmount: Number(b.paidAmount || 0),
    remainingAmount: Number(b.remainingAmount ?? b.netSalary ?? 0),
    paidAt: row.paidAt || null,
    lateMinutes: Number(b.lateMinutes || 0),
    earlyLeaveMinutes: Number(b.earlyLeaveMinutes || 0),
    unpaidLeaveDays: Number(b.unpaidLeaveDays || 0),
    paidLeaveDays: Number(b.paidLeaveDays || 0),
    scheduleShiftCount: Number(b.scheduleShiftCount || 0),
    manualAdjustmentTotal: Number(b.manualAdjustmentTotal || 0),
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

  const settings = await getPayrollSettings(rid);
  const rangeStart = toStartOfDay(start, settings?.timezone);
  const rangeEnd = toEndOfDay(end, settings?.timezone);
  const staffScopeFilter = await getStaffMembershipRestaurantFilter(rid, {
    roles: ["staff", "manager"],
  });

  const staffFilter = {
    userType: { $in: ["STAFF", "MANAGER"] },
    ...staffScopeFilter,
  };
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
      salaryType: 1,
      hourlyRate: 1,
      commissionRate: 1,
      shiftType: 1,
      workingDays: 1,
      employmentType: 1,
      employmentStatus: 1,
    })
    .lean();

  if (!staffs.length) return [];

  const staffIds = staffs.map((s) => s._id);

  const shifts = await Shift.find({
    employeeId: { $in: staffIds },
    restaurantId: rid,
    startTime: { $lte: rangeEnd },
    endTime: { $gte: rangeStart },
  })
    .select({ _id: 1, employeeId: 1, startTime: 1 })
    .lean();

  const timesheetRows = await Timesheet.find({
    employeeId: { $in: staffIds },
    restaurantId: rid,
    workDate: { $gte: rangeStart, $lte: rangeEnd },
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
    .lean();
  const runtimeBreakdownByStaff = new Map();

  timesheetRows.forEach((row) => {
    if (!isTimesheetIncludedInPayroll(row)) return;

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

    if (approvedOvertimeMinutes > 0) {
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
  });
  const timesheetAgg = await Timesheet.aggregate([
    {
      $match: {
        employeeId: { $in: staffIds },
        restaurantId: rid,
        workDate: { $gte: rangeStart, $lte: rangeEnd },
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
        approvedOvertimePayableMinutes: {
          $cond: [
            { $eq: ["$overtimeApprovalStatus", "approved"] },
            { $max: [{ $ifNull: ["$approvedOvertimeMinutes", 0] }, 0] },
            0,
          ],
        },
      },
    },
    {
      $group: {
        _id: "$employeeId",
        totalHours: {
          $sum: { $cond: ["$includeInPayroll", { $ifNull: ["$hours", 0] }, 0] },
        },
        totalWage: {
          $sum: { $cond: ["$includeInPayroll", { $ifNull: ["$wage", 0] }, 0] },
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
        overtimeNormalMinutes: {
          $sum: {
            $cond: [
              {
                $and: [
                  "$includeInPayroll",
                  { $ne: [{ $dayOfWeek: { date: "$workDate", timezone: settings?.timezone || DEFAULT_PAYROLL_TIMEZONE } }, 1] },
                  { $gt: ["$approvedOvertimePayableMinutes", 0] },
                ],
              },
              "$approvedOvertimePayableMinutes",
              0,
            ],
          },
        },
        overtimeWeekendMinutes: {
          $sum: {
            $cond: [
              {
                $and: [
                  "$includeInPayroll",
                  { $eq: [{ $dayOfWeek: { date: "$workDate", timezone: settings?.timezone || DEFAULT_PAYROLL_TIMEZONE } }, 1] },
                  { $gt: ["$approvedOvertimePayableMinutes", 0] },
                ],
              },
              "$approvedOvertimePayableMinutes",
              0,
            ],
          },
        },
        overtimeHolidayMinutes: { $sum: 0 },
        nightMinutes: { $sum: 0 },
        overtimeNightMinutes: { $sum: 0 },
        workedDateKeys: {
          $addToSet: {
            $cond: [
              "$includeInPayroll",
              { $dateToString: {
                format: "%Y-%m-%d",
                date: "$workDate",
                timezone: settings?.timezone || DEFAULT_PAYROLL_TIMEZONE,
              } },
              null,
            ],
          },
        },
      },
    },
  ]);

  const leaveAgg = await LeaveRequest.aggregate([
    {
      $match: {
        employeeId: { $in: staffIds },
        restaurantId: rid,
        status: "approved",
        startDate: { $lte: rangeEnd },
        endDate: { $gte: rangeStart },
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
        adjustmentAdvance: 0,
        adjustmentOtherAddition: 0,
        adjustmentOtherDeduction: 0,
      });
    }
    const bucket = adjustmentMap.get(sid);
    if (adj.type === "allowance")
      bucket.adjustmentAllowance += Number(adj.amount || 0);
    else if (adj.type === "bonus")
      bucket.adjustmentBonus += Number(adj.amount || 0);
    else if (adj.type === "deduction")
      bucket.adjustmentDeduction += Math.abs(Number(adj.amount || 0));
    else if (adj.type === "advance")
      bucket.adjustmentAdvance += Math.abs(Number(adj.amount || 0));
    else if (adj.type === "other_deduction")
      bucket.adjustmentOtherDeduction += Math.abs(Number(adj.amount || 0));
    else bucket.adjustmentOtherAddition += Number(adj.amount || 0);
  });

  const timesheetMap = new Map(
    timesheetAgg.map((row) => {
      const runtimeBreakdown =
        runtimeBreakdownByStaff.get(String(row._id)) || {};

      return [
        String(row._id),
        {
          totalHours: Number(row.totalHours || 0),
          totalWage: Number(row.totalWage || 0),
          totalAmount: Number(row.totalAmount || 0),
          totalLatenessMinutes: Number(row.totalLatenessMinutes || 0),
          totalEarlyLeaveMinutes: Number(row.totalEarlyLeaveMinutes || 0),
          overtimeNormalHours:
            Number(runtimeBreakdown.overtimeNormalMinutes || 0) / 60,
          overtimeWeekendHours:
            Number(runtimeBreakdown.overtimeWeekendMinutes || 0) / 60,
          overtimeHolidayHours:
            Number(runtimeBreakdown.overtimeHolidayMinutes || 0) / 60,
          nightHours: Number(runtimeBreakdown.nightMinutes || 0) / 60,
          overtimeNightHours:
            Number(runtimeBreakdown.overtimeNightMinutes || 0) / 60,
          workedDateCount: (row.workedDateKeys || []).filter(Boolean).length,
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

  const shiftCountByStaff = new Map();
  shifts.forEach((shift) => {
    const sid = String(shift.employeeId);
    shiftCountByStaff.set(sid, (shiftCountByStaff.get(sid) || 0) + 1);
  });

  const workDays = calculatePeriodCalendarDays(rangeStart, rangeEnd);
  const restaurant = await Restaurant.findById(rid)
    .select({ address: 1, payrollRegionCode: 1 })
    .lean();
  const regionCode = normalizeRegionCode(
    inferRegionCodeFromRestaurant(restaurant),
  );

  const items = staffs.map((staff) => {
    const sid = String(staff._id);
    const ts = timesheetMap.get(sid) || {
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
    };
    const leave = leaveMap.get(sid) || { paidLeaveDays: 0, unpaidLeaveDays: 0 };
    const adjustmentsForStaff = adjustmentMap.get(sid) || {
      adjustmentAllowance: 0,
      adjustmentBonus: 0,
      adjustmentDeduction: 0,
      adjustmentAdvance: 0,
      adjustmentOtherAddition: 0,
      adjustmentOtherDeduction: 0,
    };

    const paidLeaveWorkDays = settings.allowPaidLeaveInWorkDays
      ? Number(leave.paidLeaveDays || 0)
      : 0;
    const paidWorkDateCount =
      Number(ts.workedDateCount || 0) + paidLeaveWorkDays;

    const payroll = buildPayrollItem({
      staff,
      period: { start: rangeStart, end: rangeEnd, calendarDays: workDays },
      aggregate: {
        workedDateCount: paidWorkDateCount,
        totalHours: ts.totalHours,
        totalWage: ts.totalWage,
        totalAmount: ts.totalAmount,
        overtimeNormalHours: ts.overtimeNormalHours,
        overtimeWeekendHours: ts.overtimeWeekendHours,
        overtimeHolidayHours: ts.overtimeHolidayHours,
        nightHours: ts.nightHours,
        overtimeNightHours: ts.overtimeNightHours,
        scheduleShiftCount: shiftCountByStaff.get(sid) || 0,
      },
      regionCode,
      payrollStatus: forceStatus || "draft",
      settings,
    });

    const withSettings = applySettingOverrides(
      payroll,
      {
        ...ts,
        ...leave,
        ...adjustmentsForStaff,
        scheduleShiftCount: shiftCountByStaff.get(sid) || 0,
        salaryType: staff.salaryType || "monthly",
      },
      settings,
    );

    const warningMessages = [];
    if (withSettings.minimumWageViolation)
      warningMessages.push(
        "Lương cơ bản thấp hơn lương tối thiểu vùng áp dụng.",
      );
    if (!withSettings.insuranceEligible)
      warningMessages.push(
        "Nhân sự chưa thuộc diện đóng BH bắt buộc theo cấu hình chính sách.",
      );
    if (Number(withSettings.lateMinutes || 0) > 0)
      warningMessages.push(
        `Đi muộn ${withSettings.lateMinutes} phút trong kỳ.`,
      );
    if (Number(withSettings.unpaidLeaveDays || 0) > 0)
      warningMessages.push(
        `Có ${withSettings.unpaidLeaveDays} ngày nghỉ không lương.`,
      );

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
  assertPayrollPeriodEditable(periodDoc);
  const periodId = String(periodDoc._id);
  const items = await buildPayrollItemsForRange({
    start: toStartOfDay(periodDoc.startDate),
    end: toEndOfDay(periodDoc.endDate),
    restaurantId: periodDoc.restaurantId,
    periodId,
    forceStatus: periodDoc.status === "paid" ? "paid" : periodDoc.status,
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
          },
        },
        { upsert: true, new: true },
      ),
    ),
  );

  const docs = await PayrollItem.find({ periodId: periodDoc._id }).lean();
  const gqlItems = docs.map(mapPayrollDocToGql);
  const stats = summarize(gqlItems);

  await PayrollPeriod.findByIdAndUpdate(periodDoc._id, {
    $set: {
      settingsSnapshot: await getPayrollSettings(periodDoc.restaurantId),
      policySnapshot: getPayrollPolicyForDate(periodDoc.endDate),
      statsSnapshot: stats,
      calculationVersion: "payroll_v1",
    },
  });

  return { items: gqlItems, stats };
}

export async function getPeriodDetail(periodId) {
  const period = await PayrollPeriod.findById(periodId).lean();
  if (!period) return null;
  const settings = ["finalized", "locked", "paid"].includes(
    String(period.status),
  )
    ? period.settingsSnapshot || (await getPayrollSettings(period.restaurantId))
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

export { summarize, toObjectId };
