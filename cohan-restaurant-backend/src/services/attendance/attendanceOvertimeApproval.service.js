import mongoose from "mongoose";
import { EventLog, Staff, Timesheet } from "../../../models/index.js";
import {
  ATTENDANCE_REVIEW_ROLES,
  userCanAccessRestaurant,
  userHasAnyRole,
} from "../scheduling/schedulingPermission.service.js";

const { Types } = mongoose;

const REVIEWABLE_ATTENDANCE_STATUSES = new Set([
  "completed",
  "late",
  "early_leave",
  "late_early_leave",
  "unscheduled_completed",
]);

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new Types.ObjectId(value);
}

function normalizeRole(value) {
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

function assertCanReviewAttendanceOvertime(ctx, restaurantId) {
  assertAuthenticated(ctx);

  if (!userHasAnyRole(ctx?.user, ATTENDANCE_REVIEW_ROLES)) {
    throw new Error("FORBIDDEN");
  }

  if (!userCanAccessRestaurant(ctx?.user, restaurantId)) {
    throw new Error("RESTAURANT_SCOPE_FORBIDDEN");
  }
}

export function buildAttendanceOvertimeState({
  overtimeMinutes,
  currentStatus,
  approvedOvertimeMinutes,
  previousOvertimeMinutes = null,
  reviewNote = "",
  reviewedBy = null,
  reviewedAt = null,
  preserveApproved = false,
}) {
  const overtime = Math.max(Number(overtimeMinutes || 0), 0);
  const approved = Math.max(Number(approvedOvertimeMinutes || 0), 0);
  const status = String(currentStatus || "").toLowerCase();
  const changed =
    previousOvertimeMinutes !== null &&
    previousOvertimeMinutes !== undefined &&
    Number(previousOvertimeMinutes) !== overtime;

  if (overtime <= 0) {
    return {
      approvedOvertimeMinutes: 0,
      overtimeApprovalStatus: "not_required",
      overtimeReviewNote: "",
      overtimeReviewedBy: null,
      overtimeReviewedAt: null,
    };
  }

  if (
    preserveApproved &&
    !changed &&
    status === "approved" &&
    approved > 0 &&
    approved <= overtime
  ) {
    return {
      approvedOvertimeMinutes: approved,
      overtimeApprovalStatus: "approved",
      overtimeReviewNote: String(reviewNote || ""),
      overtimeReviewedBy: reviewedBy || null,
      overtimeReviewedAt: reviewedAt || null,
    };
  }

  if (!changed && status === "rejected" && approved === 0) {
    return {
      approvedOvertimeMinutes: 0,
      overtimeApprovalStatus: "rejected",
      overtimeReviewNote: String(reviewNote || ""),
      overtimeReviewedBy: reviewedBy || null,
      overtimeReviewedAt: reviewedAt || null,
    };
  }

  return {
    approvedOvertimeMinutes: 0,
    overtimeApprovalStatus: "pending",
    overtimeReviewNote: "",
    overtimeReviewedBy: null,
    overtimeReviewedAt: null,
  };
}

export function applyAttendanceOvertimeState(timesheet, options = {}) {
  const nextState = buildAttendanceOvertimeState({
    overtimeMinutes: timesheet?.overtimeMinutes,
    currentStatus: timesheet?.overtimeApprovalStatus,
    approvedOvertimeMinutes: timesheet?.approvedOvertimeMinutes,
    previousOvertimeMinutes: options.previousOvertimeMinutes,
    reviewNote: timesheet?.overtimeReviewNote,
    reviewedBy: timesheet?.overtimeReviewedBy,
    reviewedAt: timesheet?.overtimeReviewedAt,
    preserveApproved: Boolean(options.preserveApproved),
  });

  timesheet.approvedOvertimeMinutes = nextState.approvedOvertimeMinutes;
  timesheet.overtimeApprovalStatus = nextState.overtimeApprovalStatus;
  timesheet.overtimeReviewNote = nextState.overtimeReviewNote;
  timesheet.overtimeReviewedBy = nextState.overtimeReviewedBy;
  timesheet.overtimeReviewedAt = nextState.overtimeReviewedAt;
  return timesheet;
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
        positionTitle: 1,
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

  assertCanReviewAttendanceOvertime(ctx, timesheet.restaurantId);
  assertAttendanceOvertimeReviewable(timesheet);

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

  return mapAttendanceRecordWithOvertime(timesheet);
}

export async function rejectAttendanceOvertime({ input, ctx }) {
  const timesheetId = toObjectId(input.timesheetId || input.id);
  if (!timesheetId) throw new Error("INVALID_TIMESHEET_ID");

  const timesheet = await Timesheet.findById(timesheetId).populate("shiftId");
  if (!timesheet) throw new Error("TIMESHEET_NOT_FOUND");

  assertCanReviewAttendanceOvertime(ctx, timesheet.restaurantId);
  assertAttendanceOvertimeReviewable(timesheet);

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
