import mongoose from "mongoose";
import staffMutation from "./mutation.js";
import {
  OvertimeRequest,
  Shift,
  Timesheet,
} from "../../../models/index.js";
import { assertNoLockedPayrollPeriodOverlap } from "../../../src/services/payroll/payrollLockGuard.service.js";
import { withFinanceOperationLock } from "../../../src/services/finance/financeOperationLock.service.js";
import {
  ATTENDANCE_REVIEW_ROLES,
  userCanAccessRestaurant,
  userHasAnyRole,
} from "../../../src/services/scheduling/schedulingPermission.service.js";

const MANAGER_PAYROLL_SETTING_FIELDS = new Set([
  "standardWorkDaysPerMonth",
  "standardHoursPerDay",
  "latenessPenaltyPerMinute",
  "earlyLeavePenaltyPerMinute",
  "unpaidLeaveDeductionPerDay",
  "defaultAllowance",
  "allowPaidLeaveInWorkDays",
  "weekendDays",
  "holidayDates",
  "nightShiftStart",
  "nightShiftEnd",
  "notes",
]);

const ADVANCED_PAYROLL_SETTING_FIELDS = new Set([
  "currentPayrollPeriodId",
  "timezone",
  "overtimeMultiplierWeekday",
  "overtimeMultiplierWeekend",
  "overtimeMultiplierHoliday",
  "defaultBonus",
  "defaultDeduction",
  "nightShiftAllowanceRate",
  "enablePersonalIncomeTax",
  "personalIncomeTaxRate",
  "personalIncomeTaxFreeThreshold",
]);

const PAYROLL_SETTING_FIELDS = new Set([
  "restaurantId",
  ...MANAGER_PAYROLL_SETTING_FIELDS,
  ...ADVANCED_PAYROLL_SETTING_FIELDS,
]);

const NUMERIC_SETTING_RULES = {
  standardWorkDaysPerMonth: [1, 31, "Số ngày công chuẩn phải từ 1 đến 31."],
  standardHoursPerDay: [1, 24, "Số giờ công chuẩn phải từ 1 đến 24."],
  overtimeMultiplierWeekday: [1, 5, "Hệ số tăng ca ngày thường phải từ 1 đến 5."],
  overtimeMultiplierWeekend: [1, 5, "Hệ số tăng ca cuối tuần phải từ 1 đến 5."],
  overtimeMultiplierHoliday: [1, 5, "Hệ số tăng ca ngày lễ phải từ 1 đến 5."],
  latenessPenaltyPerMinute: [0, 1_000_000_000, "Mức trừ đi muộn không hợp lệ."],
  earlyLeavePenaltyPerMinute: [0, 1_000_000_000, "Mức trừ về sớm không hợp lệ."],
  unpaidLeaveDeductionPerDay: [0, 1_000_000_000, "Mức trừ nghỉ không lương không hợp lệ."],
  defaultAllowance: [0, 1_000_000_000, "Phụ cấp mặc định không hợp lệ."],
  defaultBonus: [0, 1_000_000_000, "Thưởng mặc định không hợp lệ."],
  defaultDeduction: [0, 1_000_000_000, "Khấu trừ mặc định không hợp lệ."],
  nightShiftAllowanceRate: [0, 1, "Tỷ lệ phụ cấp ca đêm phải từ 0 đến 100%."],
  personalIncomeTaxRate: [0, 1, "Tỷ lệ thuế TNCN phải từ 0 đến 100%."],
  personalIncomeTaxFreeThreshold: [
    0,
    1_000_000_000_000,
    "Ngưỡng miễn thuế TNCN không hợp lệ.",
  ],
};

const WEEKDAY_KEYS = new Set(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function toId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function actorId(ctx) {
  return ctx?.user?.id || ctx?.user?._id || null;
}

function assertAuthenticated(ctx) {
  if (!actorId(ctx)) throw new Error("UNAUTHENTICATED");
}

function hasOwn(source, field) {
  return Object.prototype.hasOwnProperty.call(source || {}, field);
}

function actorPayrollRoles(ctx) {
  return new Set(
    [ctx?.user?.userType, ctx?.user?.roleName, ctx?.user?.role?.slug]
      .map((value) => String(value || "").trim().toUpperCase())
      .filter(Boolean),
  );
}

function canEditAdvancedPayrollSettings(ctx) {
  const roles = actorPayrollRoles(ctx);
  return roles.has("ADMIN") || roles.has("ACCOUNTANT");
}

function normalizeNumberSetting(field, value) {
  const numeric = Number(value);
  const [minimum, maximum, message] = NUMERIC_SETTING_RULES[field];
  if (!Number.isFinite(numeric) || numeric < minimum || numeric > maximum) {
    throw new Error(message);
  }
  return numeric;
}

function normalizeHolidayDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Ngày lễ phải có định dạng ngày hợp lệ.");
  }
  return date.toISOString().slice(0, 10);
}

function normalizePayrollSettingsInput(input = {}, ctx) {
  assertAuthenticated(ctx);
  const suppliedFields = Object.keys(input);
  const unsupportedField = suppliedFields.find(
    (field) => !PAYROLL_SETTING_FIELDS.has(field),
  );
  if (unsupportedField) {
    throw new Error(`Trường cấu hình lương không được hỗ trợ: ${unsupportedField}.`);
  }

  if (!canEditAdvancedPayrollSettings(ctx)) {
    const restrictedField = suppliedFields.find((field) =>
      ADVANCED_PAYROLL_SETTING_FIELDS.has(field),
    );
    if (restrictedField) {
      throw new Error(
        "Quản lý nhà hàng chỉ được thay đổi cấu hình vận hành; cấu hình tài chính cần quyền Kế toán hoặc Admin.",
      );
    }
  }

  const normalized = {};
  if (hasOwn(input, "restaurantId")) normalized.restaurantId = input.restaurantId;

  Object.keys(NUMERIC_SETTING_RULES).forEach((field) => {
    if (hasOwn(input, field)) {
      normalized[field] = normalizeNumberSetting(field, input[field]);
    }
  });

  ["allowPaidLeaveInWorkDays", "enablePersonalIncomeTax"].forEach((field) => {
    if (!hasOwn(input, field)) return;
    if (typeof input[field] !== "boolean") {
      throw new Error(`Giá trị ${field} phải là đúng hoặc sai.`);
    }
    normalized[field] = input[field];
  });

  if (hasOwn(input, "weekendDays")) {
    if (!Array.isArray(input.weekendDays)) {
      throw new Error("Danh sách ngày cuối tuần không hợp lệ.");
    }
    const weekendDays = [
      ...new Set(
        input.weekendDays.map((value) => String(value || "").trim().toUpperCase()),
      ),
    ];
    if (weekendDays.some((day) => !WEEKDAY_KEYS.has(day))) {
      throw new Error("Ngày cuối tuần chỉ nhận các giá trị MON đến SUN.");
    }
    normalized.weekendDays = weekendDays;
  }

  if (hasOwn(input, "holidayDates")) {
    if (!Array.isArray(input.holidayDates)) {
      throw new Error("Danh sách ngày lễ không hợp lệ.");
    }
    normalized.holidayDates = [
      ...new Set(input.holidayDates.map(normalizeHolidayDate)),
    ].sort();
  }

  ["nightShiftStart", "nightShiftEnd"].forEach((field) => {
    if (!hasOwn(input, field)) return;
    const value = String(input[field] || "").trim();
    if (!TIME_PATTERN.test(value)) {
      throw new Error("Khung giờ ca đêm phải theo định dạng HH:mm.");
    }
    normalized[field] = value;
  });
  if (
    normalized.nightShiftStart &&
    normalized.nightShiftEnd &&
    normalized.nightShiftStart === normalized.nightShiftEnd
  ) {
    throw new Error("Giờ bắt đầu và kết thúc ca đêm không được trùng nhau.");
  }

  if (hasOwn(input, "timezone")) {
    const timezone = String(input.timezone || "").trim();
    if (!timezone || timezone.length > 80) {
      throw new Error("Múi giờ tính lương không hợp lệ.");
    }
    normalized.timezone = timezone;
  }

  if (hasOwn(input, "currentPayrollPeriodId")) {
    normalized.currentPayrollPeriodId = input.currentPayrollPeriodId || null;
  }

  if (hasOwn(input, "notes")) {
    const notes = String(input.notes || "").trim();
    if (notes.length > 1000) {
      throw new Error("Ghi chú cấu hình lương không được vượt quá 1000 ký tự.");
    }
    normalized.notes = notes;
  }

  const editableFieldCount = Object.keys(normalized).filter(
    (field) => field !== "restaurantId",
  ).length;
  if (!editableFieldCount) {
    throw new Error("Chưa có nội dung cấu hình lương cần cập nhật.");
  }

  return normalized;
}

async function assertCanReviewRequest(ctx, restaurantId) {
  assertAuthenticated(ctx);
  if (!userHasAnyRole(ctx?.user, ATTENDANCE_REVIEW_ROLES)) {
    throw new Error("FORBIDDEN");
  }
  if (!(await userCanAccessRestaurant(ctx?.user, restaurantId))) {
    throw new Error("RESTAURANT_SCOPE_FORBIDDEN");
  }
}

function dayBounds(value) {
  const start = new Date(value);
  const end = new Date(value);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function assertShiftAttendanceNotLocked(shiftId, action) {
  const sid = toId(shiftId);
  if (!sid) throw new Error("Invalid shiftId");
  const shift = await Shift.findById(sid).lean();
  if (!shift) throw new Error("Không tìm thấy ca làm.");

  await assertNoLockedPayrollPeriodOverlap({
    restaurantId: shift.restaurantId,
    employeeId: shift.employeeId,
    startDate: shift.startTime,
    endDate: shift.endTime,
    action,
  });
}

async function checkInShift(parent, args, ctx, info) {
  await assertShiftAttendanceNotLocked(args?.shiftId, "attendance_check_in");
  return staffMutation.checkInShift(parent, args, ctx, info);
}

async function checkOutShift(parent, args, ctx, info) {
  await assertShiftAttendanceNotLocked(args?.shiftId, "attendance_check_out");
  return staffMutation.checkOutShift(parent, args, ctx, info);
}

async function upsertStaffAttendance(parent, args, ctx, info) {
  const employeeId = args?.input?.employeeId;
  const currentActorId = actorId(ctx);
  if (
    employeeId &&
    currentActorId &&
    String(employeeId) === String(currentActorId)
  ) {
    throw new Error(
      "Nhân viên phải chấm công từ ca đã công bố bằng check-in/check-out.",
    );
  }
  return staffMutation.upsertStaffAttendance(parent, args, ctx, info);
}

async function updatePayrollSettings(parent, args, ctx, info) {
  const input = normalizePayrollSettingsInput(args?.input || {}, ctx);
  return staffMutation.updatePayrollSettings(
    parent,
    { ...args, input },
    ctx,
    info,
  );
}

function buildTimesheetFilter(request) {
  const filter = {
    employeeId: request.employeeId,
    restaurantId: request.restaurantId,
  };
  if (request.timesheetId) {
    filter._id = request.timesheetId;
    return filter;
  }

  const { start, end } = dayBounds(request.workDate);
  filter.workDate = { $gte: start, $lte: end };
  if (request.shiftId) filter.shiftId = request.shiftId;
  return filter;
}

async function findCompletionTimesheet(request) {
  const query = Timesheet.findOne(buildTimesheetFilter(request));
  if (!request.timesheetId) query.sort({ createdAt: -1 });
  return query.lean();
}

async function findCompletionTimesheetDocument(request) {
  const query = Timesheet.findOne(buildTimesheetFilter(request));
  if (!request.timesheetId) query.sort({ createdAt: -1 });
  return query;
}

async function loadReviewRequest(requestId) {
  const request = await OvertimeRequest.findById(requestId)
    .select({
      _id: 1,
      employeeId: 1,
      restaurantId: 1,
      shiftId: 1,
      timesheetId: 1,
      workDate: 1,
    })
    .lean();
  if (!request) throw new Error("Không tìm thấy yêu cầu tăng ca.");
  return request;
}

async function completeOvertimeRequest(parent, args, ctx, info) {
  assertAuthenticated(ctx);
  const suppliedInput = args?.input || {};
  const requestId = suppliedInput.requestId || args?.id;
  const request = await loadReviewRequest(requestId);
  await assertCanReviewRequest(ctx, request.restaurantId);

  const timesheet = await findCompletionTimesheet(request);
  if (!timesheet) throw new Error("TIMESHEET_NOT_FOUND_FOR_OVERTIME");

  const recordedActualMinutes = Math.max(
    Number(timesheet.overtimeMinutes || 0),
    0,
  );
  const suppliedActual = Number(suppliedInput.actualOvertimeMinutes);
  if (
    suppliedInput.actualOvertimeMinutes !== undefined &&
    suppliedInput.actualOvertimeMinutes !== null &&
    suppliedInput.actualOvertimeMinutes !== "" &&
    (!Number.isFinite(suppliedActual) || suppliedActual !== recordedActualMinutes)
  ) {
    throw new Error(
      "Số phút tăng ca thực tế phải lấy từ bản ghi chấm công đã lưu.",
    );
  }

  const hasApprovedInput =
    suppliedInput.approvedOvertimeMinutes !== undefined &&
    suppliedInput.approvedOvertimeMinutes !== null &&
    suppliedInput.approvedOvertimeMinutes !== "";
  const suppliedApproved = Number(suppliedInput.approvedOvertimeMinutes);
  if (
    hasApprovedInput &&
    (!Number.isFinite(suppliedApproved) ||
      suppliedApproved < 0 ||
      suppliedApproved > recordedActualMinutes)
  ) {
    throw new Error("Số phút tăng ca được trả không được vượt thời gian thực tế.");
  }

  return staffMutation.completeOvertimeRequest(
    parent,
    {
      ...args,
      input: {
        ...suppliedInput,
        requestId: String(request._id),
        actualOvertimeMinutes: recordedActualMinutes,
      },
    },
    ctx,
    info,
  );
}

async function rejectOvertimeRequest(parent, args, ctx, info) {
  assertAuthenticated(ctx);
  const suppliedInput = args?.input || {};
  const requestId = suppliedInput.requestId || args?.id;
  const request = await loadReviewRequest(requestId);
  await assertCanReviewRequest(ctx, request.restaurantId);
  await assertNoLockedPayrollPeriodOverlap({
    restaurantId: request.restaurantId,
    employeeId: request.employeeId,
    startDate: request.workDate,
    endDate: dayBounds(request.workDate).end,
    action: "overtime_rejection",
  });

  const result = await staffMutation.rejectOvertimeRequest(
    parent,
    {
      ...args,
      input: {
        ...suppliedInput,
        requestId: String(request._id),
      },
    },
    ctx,
    info,
  );

  const timesheet = await findCompletionTimesheetDocument(request);
  if (timesheet && Number(timesheet.overtimeMinutes || 0) > 0) {
    timesheet.approvedOvertimeMinutes = 0;
    timesheet.overtimeApprovalStatus = "rejected";
    timesheet.overtimeReviewNote = String(
      suppliedInput.reason || suppliedInput.note || "",
    ).trim();
    timesheet.overtimeReviewedBy = toId(actorId(ctx));
    timesheet.overtimeReviewedAt = new Date();
    timesheet.overtimeRequestId = request._id;
    await timesheet.save();
  }

  return result;
}

async function markPayrollItemPaid(parent, args, ctx, info) {
  const key = `payroll-item:${String(args?.input?.periodId || "")}:${String(args?.input?.employeeId || "")}`;
  return withFinanceOperationLock(key, () =>
    staffMutation.markPayrollItemPaid(parent, args, ctx, info),
  );
}

async function batchMarkPayrollPaid(parent, args, ctx, info) {
  const employeeKey = Array.isArray(args?.input?.employeeIds)
    ? args.input.employeeIds.map(String).sort().join(",")
    : "all";
  const key = `payroll-batch:${String(args?.input?.periodId || "")}:${employeeKey}`;
  return withFinanceOperationLock(key, () =>
    staffMutation.batchMarkPayrollPaid(parent, args, ctx, info),
  );
}

async function markPayrollPeriodPaid(parent, args, ctx, info) {
  const key = `payroll-period:${String(args?.periodId || "")}`;
  return withFinanceOperationLock(key, () =>
    staffMutation.markPayrollPeriodPaid(parent, args, ctx, info),
  );
}

export default {
  checkInShift,
  checkOutShift,
  upsertStaffAttendance,
  updatePayrollSettings,
  completeOvertimeRequest,
  rejectOvertimeRequest,
  markPayrollItemPaid,
  batchMarkPayrollPaid,
  markPayrollPeriodPaid,
};
