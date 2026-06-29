import mongoose from "mongoose";
import { EventLog, Staff, SystemSetting, Timesheet } from "../../../models/index.js";
import {
  assertPayrollPeriodEditable,
  findPayrollPeriodOverlap,
} from "../payroll/payrollLockGuard.service.js";
import {
  ATTENDANCE_REVIEW_ROLES,
  userCanAccessRestaurant,
  userHasAnyRole,
} from "../scheduling/schedulingPermission.service.js";
import {
  applyAttendanceOvertimeState,
  buildAttendanceOvertimeState,
} from "./attendanceOvertimeState.service.js";

const { Types } = mongoose;

const REVIEWABLE_ATTENDANCE_STATUSES = new Set([
  "completed",
  "late",
  "early_leave",
  "late_early_leave",
  "unscheduled_completed",
]);

const BLOCKING_PAYROLL_PERIOD_STATUSES = ["finalized", "locked", "paid"];

const DEFAULT_OVERTIME_POLICY = {
  enabled: true,
  defaultMaxMinutesPerDay: 120,
  roleGroupLimits: {
    service: { maxMinutesPerDay: 120 },
    kitchen: { maxMinutesPerDay: 180 },
    shiftManager: { maxMinutesPerDay: 240 },
  },
};

const OVERTIME_ROLE_GROUP_LABELS = {
  service: "Nhân viên phục vụ",
  kitchen: "Bếp",
  shiftManager: "Quản lý ca",
  default: "Nhóm mặc định",
};

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new Types.ObjectId(value);
}

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeOvertimeApprovalStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getActorId(ctx) {
  return toObjectId(ctx?.user?.id || ctx?.user?._id);
}

function getActorRole(ctx) {
  return normalizeRole(
    ctx?.user?.roleName ||
      ctx?.user?.userType ||
      ctx?.user?.role?.slug ||
      ctx?.user?.role ||
      "",
  );
}

function getActorName(ctx) {
  return (
    ctx?.user?.fullName ||
    ctx?.user?.name ||
    ctx?.user?.username ||
    ctx?.user?.email ||
    "Người dùng"
  );
}

function assertAuthenticated(ctx) {
  if (!ctx?.user?.id && !ctx?.user?._id) {
    throw new Error("UNAUTHENTICATED");
  }
}

async function assertCanReviewAttendanceOvertime(ctx, restaurantId) {
  assertAuthenticated(ctx);

  if (!userHasAnyRole(ctx?.user, ATTENDANCE_REVIEW_ROLES)) {
    throw new Error("FORBIDDEN");
  }

  if (!await userCanAccessRestaurant(ctx?.user, restaurantId)) {
    throw new Error("RESTAURANT_SCOPE_FORBIDDEN");
  }
}

function mapAttendanceStatus(timesheet) {
  if (!timesheet?.actualCheckInAt) {
    return timesheet?.isOffSchedule ? "unscheduled_absent" : "scheduled_absent";
  }
  if (!timesheet?.actualCheckOutAt) {
    return timesheet?.isOffSchedule ? "unscheduled_checkin" : "checked_in";
  }
  if (timesheet?.isOffSchedule) return "unscheduled_completed";
  const hasLate = Number(timesheet?.latenessMinutes || 0) > 0;
  const hasEarly = Number(timesheet?.earlyLeaveMinutes || 0) > 0;
  if (hasLate && hasEarly) return "late_early_leave";
  if (hasLate) return "late";
  if (hasEarly) return "early_leave";
  return "completed";
}

function mapOffScheduleApprovalStatus(timesheet) {
  const isOffSchedule = Boolean(timesheet?.isOffSchedule);
  const storedApproval = String(
    timesheet?.offScheduleApprovalStatus || "",
  ).toLowerCase();

  if (!isOffSchedule) return "not_required";
  if (Boolean(timesheet?.approved)) return "approved";
  if (storedApproval === "rejected") return "rejected";
  return "pending";
}

function assertAttendanceOvertimeReviewable(timesheet) {
  if (!timesheet) {
    throw new Error("TIMESHEET_NOT_FOUND");
  }

  const attendanceStatus = mapAttendanceStatus(timesheet);
  if (!REVIEWABLE_ATTENDANCE_STATUSES.has(attendanceStatus)) {
    if (attendanceStatus === "scheduled_absent") {
      throw new Error("ATTENDANCE_OVERTIME_NO_SHOW_NOT_REVIEWABLE");
    }
    if (attendanceStatus === "checked_in" || attendanceStatus === "missed_checkout") {
      throw new Error("ATTENDANCE_OVERTIME_MISSED_CHECKOUT_NOT_REVIEWABLE");
    }
    throw new Error("ATTENDANCE_OVERTIME_NOT_REVIEWABLE");
  }

  if (Number(timesheet.overtimeMinutes || 0) <= 0) {
    throw new Error("ATTENDANCE_OVERTIME_NOT_FOUND");
  }

  const overtimeApprovalStatus = normalizeOvertimeApprovalStatus(
    timesheet.overtimeApprovalStatus,
  );
  if (["approved", "rejected"].includes(overtimeApprovalStatus)) {
    throw new Error("ATTENDANCE_OVERTIME_ALREADY_REVIEWED");
  }
  if (overtimeApprovalStatus === "not_required") {
    throw new Error("ATTENDANCE_OVERTIME_NOT_FOUND");
  }
}

async function assertAttendanceOvertimePayrollEditable(timesheet) {
  const overlap = await findPayrollPeriodOverlap({
    restaurantId: timesheet?.restaurantId,
    startDate: timesheet?.workDate,
    endDate: timesheet?.workDate,
    statuses: BLOCKING_PAYROLL_PERIOD_STATUSES,
  });

  if (!overlap) return;

  try {
    assertPayrollPeriodEditable(overlap);
  } catch {
    throw new Error("ATTENDANCE_OVERTIME_PAYROLL_PERIOD_LOCKED");
  }
}

function getSafeMinuteLimit(value, fallback) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 1440) return fallback;
  return numeric;
}

function normalizeOvertimePolicy(policy = {}) {
  const source = policy || {};
  const roleGroupLimits = source.roleGroupLimits || {};

  return {
    enabled: Boolean(source.enabled ?? DEFAULT_OVERTIME_POLICY.enabled),
    defaultMaxMinutesPerDay: getSafeMinuteLimit(
      source.defaultMaxMinutesPerDay,
      DEFAULT_OVERTIME_POLICY.defaultMaxMinutesPerDay,
    ),
    roleGroupLimits: {
      service: {
        maxMinutesPerDay: getSafeMinuteLimit(
          roleGroupLimits.service?.maxMinutesPerDay,
          DEFAULT_OVERTIME_POLICY.roleGroupLimits.service.maxMinutesPerDay,
        ),
      },
      kitchen: {
        maxMinutesPerDay: getSafeMinuteLimit(
          roleGroupLimits.kitchen?.maxMinutesPerDay,
          DEFAULT_OVERTIME_POLICY.roleGroupLimits.kitchen.maxMinutesPerDay,
        ),
      },
      shiftManager: {
        maxMinutesPerDay: getSafeMinuteLimit(
          roleGroupLimits.shiftManager?.maxMinutesPerDay,
          DEFAULT_OVERTIME_POLICY.roleGroupLimits.shiftManager.maxMinutesPerDay,
        ),
      },
    },
  };
}

function getStaffOvertimeRoleGroup(staff) {
  const roleText = normalizeText(
    [
      staff?.role?.slug,
      staff?.role?.name,
      staff?.roleName,
      staff?.positionTitle,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const department = normalizeText(staff?.department);

  if (
    roleText.includes("supervisor") ||
    roleText.includes("manager") ||
    roleText.includes("shift_manager") ||
    roleText.includes("quan ly") ||
    roleText.includes("giam sat") ||
    roleText.includes("truong ca")
  ) {
    return "shiftManager";
  }
  if (department === "kitchen" || roleText.includes("chef") || roleText.includes("cook") || roleText.includes("bep")) {
    return "kitchen";
  }
  if (department === "service" || roleText.includes("server") || roleText.includes("phuc vu") || roleText.includes("host")) {
    return "service";
  }
  return "default";
}

async function loadOvertimePolicy(restaurantId) {
  if (!SystemSetting?.findOne) return normalizeOvertimePolicy();
  const setting = await SystemSetting.findOne({ restaurantId })
    .select({ overtimePolicy: 1 })
    .lean();
  return normalizeOvertimePolicy(setting?.overtimePolicy);
}

async function loadStaffForOvertimePolicy(employeeId) {
  if (!employeeId) return null;
  return Staff.findById(employeeId)
    .populate("role")
    .select({
      _id: 1,
      fullName: 1,
      employeeCode: 1,
      department: 1,
      positionTitle: 1,
      role: 1,
      roleName: 1,
      avatarUrl: 1,
      avatar: 1,
    })
    .lean();
}

async function assertApprovedOvertimeWithinPolicy({ timesheet, staff, approvedOvertimeMinutes }) {
  const policy = await loadOvertimePolicy(timesheet.restaurantId);
  if (!policy.enabled) return;

  const group = getStaffOvertimeRoleGroup(staff);
  const groupLimit = policy.roleGroupLimits[group]?.maxMinutesPerDay;
  const maxMinutes = getSafeMinuteLimit(groupLimit, policy.defaultMaxMinutesPerDay);

  if (approvedOvertimeMinutes > maxMinutes) {
    const label = OVERTIME_ROLE_GROUP_LABELS[group] || OVERTIME_ROLE_GROUP_LABELS.default;
    throw new Error(`ATTENDANCE_OVERTIME_LIMIT_EXCEEDED|${maxMinutes}|${label}`);
  }
}

export async function mapAttendanceRecordWithOvertime(timesheet, staffDoc = null) {
  let staff = staffDoc;
  if (!staff && timesheet?.employeeId) {
    staff = await Staff.findById(timesheet.employeeId)
      .populate("role")
      .select({
        _id: 1,
        fullName: 1,
        employeeCode: 1,
        department: 1,
        positionTitle: 1,
        role: 1,
        roleName: 1,
        avatarUrl: 1,
        avatar: 1,
      })
      .lean();
  }

  return {
    id: String(timesheet._id),
    employeeId: String(timesheet.employeeId),
    employeeName: staff?.fullName || null,
    employeeCode: staff?.employeeCode || null,
    employeeRole:
      staff?.positionTitle || staff?.roleName || staff?.role?.name || null,
    employeeAvatar: staff?.avatarUrl || staff?.avatar || null,
    restaurantId: String(timesheet.restaurantId),
    workDate: timesheet.workDate,
    shiftId: timesheet.shiftId
      ? String(timesheet.shiftId._id || timesheet.shiftId)
      : null,
    shiftType: timesheet.shiftId?.shiftType || null,
    plannedStartTime:
      timesheet.plannedStartTime || timesheet.shiftId?.startTime || null,
    plannedEndTime:
      timesheet.plannedEndTime || timesheet.shiftId?.endTime || null,
    actualCheckInAt: timesheet.actualCheckInAt || null,
    actualCheckOutAt: timesheet.actualCheckOutAt || null,
    workedMinutes: Number(timesheet.workedMinutes || 0),
    hours: Number(timesheet.hours || 0),
    latenessMinutes: Number(timesheet.latenessMinutes || 0),
    earlyLeaveMinutes: Number(timesheet.earlyLeaveMinutes || 0),
    overtimeMinutes: Number(timesheet.overtimeMinutes || 0),
    approvedOvertimeMinutes: Number(timesheet.approvedOvertimeMinutes || 0),
    overtimeApprovalStatus: String(
      timesheet.overtimeApprovalStatus || "not_required",
    ),
    overtimeReviewNote: timesheet.overtimeReviewNote || "",
    overtimeReviewedBy: timesheet.overtimeReviewedBy
      ? String(timesheet.overtimeReviewedBy)
      : null,
    overtimeReviewedAt: timesheet.overtimeReviewedAt || null,
    status: mapAttendanceStatus(timesheet),
    isOffSchedule: Boolean(timesheet.isOffSchedule),
    offScheduleApprovalStatus: mapOffScheduleApprovalStatus(timesheet),
    offScheduleReasonCategory: timesheet.offScheduleReasonCategory || "other",
    offScheduleReason: timesheet.offScheduleReason || "",
    offScheduleReviewedBy: timesheet.offScheduleReviewedBy
      ? String(timesheet.offScheduleReviewedBy)
      : null,
    offScheduleReviewedAt: timesheet.offScheduleReviewedAt || null,
    offScheduleReviewNote: timesheet.offScheduleReviewNote || "",
    source: timesheet.source || "quick",
    note: timesheet.note || "",
    approved: Boolean(timesheet.approved),
    createdAt: timesheet.createdAt || null,
    updatedAt: timesheet.updatedAt || null,
  };
}

async function logAttendanceOvertimeEvent({
  ctx,
  restaurantId,
  timesheetId,
  verb,
  status = "success",
  meta = {},
}) {
  try {
    await EventLog.create({
      restaurantId,
      actorUserId: getActorId(ctx),
      verb,
      object: {
        kind: "Timesheet",
        id: timesheetId,
      },
      source: "attendance-overtime-approval",
      status,
      meta,
      at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("Failed to log attendance overtime event:", error.message);
  }
}

export async function approveAttendanceOvertime({ input, ctx }) {
  const timesheetId = toObjectId(input.timesheetId || input.id);
  if (!timesheetId) throw new Error("INVALID_TIMESHEET_ID");

  const timesheet = await Timesheet.findById(timesheetId).populate("shiftId");
  if (!timesheet) throw new Error("TIMESHEET_NOT_FOUND");

  await assertCanReviewAttendanceOvertime(ctx, timesheet.restaurantId);
  assertAttendanceOvertimeReviewable(timesheet);
  await assertAttendanceOvertimePayrollEditable(timesheet);

  const approvedOvertimeMinutes =
    input.approvedOvertimeMinutes == null
      ? Number(timesheet.overtimeMinutes || 0)
      : Number(input.approvedOvertimeMinutes);

  if (!Number.isFinite(approvedOvertimeMinutes)) {
    throw new Error("ATTENDANCE_OVERTIME_INVALID_APPROVED_MINUTES");
  }
  if (approvedOvertimeMinutes < 0) {
    throw new Error("ATTENDANCE_OVERTIME_NEGATIVE_APPROVED_MINUTES");
  }
  if (approvedOvertimeMinutes > Number(timesheet.overtimeMinutes || 0)) {
    throw new Error("ATTENDANCE_OVERTIME_APPROVED_EXCEEDS_RAW");
  }

  const staff = await loadStaffForOvertimePolicy(timesheet.employeeId);
  await assertApprovedOvertimeWithinPolicy({
    timesheet,
    staff,
    approvedOvertimeMinutes,
  });

  timesheet.approvedOvertimeMinutes = approvedOvertimeMinutes;
  timesheet.overtimeApprovalStatus = "approved";
  timesheet.overtimeReviewNote = String(input.reviewNote || "").trim();
  timesheet.overtimeReviewedBy = getActorId(ctx);
  timesheet.overtimeReviewedAt = new Date();
  await timesheet.save();

  await logAttendanceOvertimeEvent({
    ctx,
    restaurantId: timesheet.restaurantId,
    timesheetId: timesheet._id,
    verb: "attendance.overtime.approve",
    meta: {
      approvedOvertimeMinutes,
      overtimeMinutes: Number(timesheet.overtimeMinutes || 0),
      reviewer: getActorName(ctx),
    },
  });

  return mapAttendanceRecordWithOvertime(timesheet, staff);
}

export async function rejectAttendanceOvertime({ input, ctx }) {
  const timesheetId = toObjectId(input.timesheetId || input.id);
  if (!timesheetId) throw new Error("INVALID_TIMESHEET_ID");

  const timesheet = await Timesheet.findById(timesheetId).populate("shiftId");
  if (!timesheet) throw new Error("TIMESHEET_NOT_FOUND");

  await assertCanReviewAttendanceOvertime(ctx, timesheet.restaurantId);
  assertAttendanceOvertimeReviewable(timesheet);
  await assertAttendanceOvertimePayrollEditable(timesheet);

  const reviewNote = String(input.reviewNote || input.reason || "").trim();
  if (!reviewNote) {
    throw new Error("ATTENDANCE_OVERTIME_REVIEW_NOTE_REQUIRED");
  }

  const proposedApprovedMinutes =
    input.approvedOvertimeMinutes == null
      ? 0
      : Number(input.approvedOvertimeMinutes);

  if (!Number.isFinite(proposedApprovedMinutes)) {
    throw new Error("ATTENDANCE_OVERTIME_INVALID_APPROVED_MINUTES");
  }
  if (proposedApprovedMinutes < 0) {
    throw new Error("ATTENDANCE_OVERTIME_NEGATIVE_APPROVED_MINUTES");
  }
  if (proposedApprovedMinutes > Number(timesheet.overtimeMinutes || 0)) {
    throw new Error("ATTENDANCE_OVERTIME_APPROVED_EXCEEDS_RAW");
  }

  timesheet.approvedOvertimeMinutes = 0;
  timesheet.overtimeApprovalStatus = "rejected";
  timesheet.overtimeReviewNote = reviewNote;
  timesheet.overtimeReviewedBy = getActorId(ctx);
  timesheet.overtimeReviewedAt = new Date();
  await timesheet.save();

  await logAttendanceOvertimeEvent({
    ctx,
    restaurantId: timesheet.restaurantId,
    timesheetId: timesheet._id,
    verb: "attendance.overtime.reject",
    meta: {
      overtimeMinutes: Number(timesheet.overtimeMinutes || 0),
      reviewNote,
      reviewer: getActorName(ctx),
    },
  });

  return mapAttendanceRecordWithOvertime(timesheet);
}

export { applyAttendanceOvertimeState, buildAttendanceOvertimeState };
