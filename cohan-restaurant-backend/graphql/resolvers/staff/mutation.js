// src/graphql/staff/mutation.js
import mongoose from "mongoose";
import process from "process";
import {
  Staff,
  Role,
  EventLog,
  Shift,
  Timesheet,
  LeaveRequest,
  LeaveBalance,
  PayrollSetting,
  PayrollPeriod,
  PayrollItem,
  PayrollAdjustment,
  EmployeeCodeCounter,
  Notification,
  SchedulePublication,
  ShiftAcknowledgement,
  ScheduleAcknowledgement,
  AvailabilityRegistrationWindow,
  AttendanceCorrectionRequest,
  OvertimeRequest,
  EmployeeBankAccount,
  PayrollPayout,
  RestaurantPayoutAccount,
} from "../../../models/index.js";
import { mailer } from "../../../lib/mailer.js";
import { issueVerificationForUser } from "../../../src/services/auth/accountVerification.service.js";
import { sanitizeStaffPrivateProfile } from "../../../src/security/userDtos.js";
import {
  recalculateStaffPerformanceSnapshots,
  upsertStaffPerformanceReview,
} from "../../../src/services/staffPerformance/staffPerformance.service.js";
import {
  startSchedulingOperations,
  updateSchedulingPolicy,
} from "../../../src/services/scheduling/schedulingPolicy.service.js";
import {
  assertShiftAssignmentValid,
  hasNonInfoWarnings,
  validateShiftAssignment,
} from "../../../src/services/scheduling/shiftAssignmentValidation.service.js";
import {
  assertAutoSchedulePeriodCanEdit,
  buildAutoScheduleCreateInputs,
  buildAutoSchedulePreviewBackend,
} from "../../../src/services/scheduling/autoSchedule.service.js";
import {
  hasBlockingSchedulePublishIssues,
  validateScheduleBeforePublish,
} from "../../../src/services/scheduling/schedulePublishValidation.service.js";
import {
  approveAttendanceCorrectionRequest as approveAttendanceCorrectionRequestService,
  cancelAttendanceCorrectionRequest as cancelAttendanceCorrectionRequestService,
  createAttendanceCorrectionRequest as createAttendanceCorrectionRequestService,
  rejectAttendanceCorrectionRequest as rejectAttendanceCorrectionRequestService,
} from "../../../src/services/attendance/attendanceCorrectionWorkflow.service.js";
import {
  approveOffScheduleAttendance as approveOffScheduleAttendanceService,
  rejectOffScheduleAttendance as rejectOffScheduleAttendanceService,
} from "../../../src/services/attendance/offScheduleAttendance.service.js";
import {
  approveOvertimeRequest as approveOvertimeRequestService,
  cancelOvertimeRequest as cancelOvertimeRequestService,
  completeOvertimeRequest as completeOvertimeRequestService,
  confirmOvertimeRequest as confirmOvertimeRequestService,
  createOvertimeRequest as createOvertimeRequestService,
  rejectOvertimeRequest as rejectOvertimeRequestService,
} from "../../../src/services/overtime/overtimeRequest.service.js";
import {
  getPayrollSettings,
  getPeriodDetail,
  mapPayrollDocToGql,
  toEndOfDay as payrollToEndOfDay,
  toObjectId as payrollToObjectId,
  toStartOfDay as payrollToStartOfDay,
  upsertPeriodItems,
} from "../../../src/services/payroll/payrollRuntime.service.js";
import { assertNoLockedPayrollPeriodOverlap } from "../../../src/services/payroll/payrollLockGuard.service.js";
import {
  validatePayrollPeriod as validatePayrollPeriodService,
  hasBlockingPayrollIssues,
} from "../../../src/services/payroll/payrollValidation.service.js";
import { assertPayrollPermission } from "../../../src/services/payroll/payrollPermission.service.js";
import {
  applyPayrollPayoutResult as applyPayrollPayoutResultService,
  cancelPayrollPayout as cancelPayrollPayoutService,
  createPayrollBatchPayout as createPayrollBatchPayoutService,
  createPayrollPayout as createPayrollPayoutService,
  retryPayrollPayout as retryPayrollPayoutService,
  upsertEmployeeBankAccount as upsertEmployeeBankAccountService,
  upsertRestaurantPayoutAccount as upsertRestaurantPayoutAccountService,
  verifyEmployeeBankAccount as verifyEmployeeBankAccountService,
} from "../../../src/services/payroll/payrollPayout.service.js";
import { logPayrollEvent } from "../../../src/services/payroll/payrollEventLog.service.js";
import {
  batchMarkPayrollPaid as batchMarkPayrollPaidService,
  markPayrollItemPaid as markPayrollItemPaidService,
} from "../../../src/services/payroll/payrollPayment.service.js";
import { getPayrollPolicyForDate } from "../../../src/config/payrollPolicy.vn.js";
import {
  mapSchedulePublicationOutput,
  resolveScheduleLifecycleStatus,
} from "../../../src/services/scheduling/scheduleLifecycle.service.js";
import {
  requireAuth,
  requireRestaurantAccess,
  requireRoles,
} from "../../guards.js";
import {
  ATTENDANCE_REVIEW_ROLES,
  ATTENDANCE_OPERATION_ROLES,
  ATTENDANCE_SELF_ROLES,
  SCHEDULE_WRITE_ROLES,
  SHIFT_ACK_ADMIN_ROLES,
  resolveUserRoles,
  userCanAccessRestaurant,
} from "../../../src/services/scheduling/schedulingPermission.service.js";
import { syncAttendancePerformanceIncidents } from "../../../src/services/performance/attendancePerformanceIntegration.service.js";
import { syncKitchenShiftRosterSnapshotsForPublication } from "../../../src/services/kitchen/kitchenShiftRosterSnapshot.service.js";
import { runAttendanceExceptionDetectionJob } from "../../../src/jobs/attendanceException.job.js";
import {
  createPerformanceIncidentOnce,
  applyPerformanceIncidentScore as applyPerformanceIncidentScoreService,
  getPerformanceIncidentById,
  markPerformanceIncidentEligible as markPerformanceIncidentEligibleService,
  reviewPerformanceIncident as reviewPerformanceIncidentService,
  waivePerformanceIncident as waivePerformanceIncidentService,
} from "../../../src/services/performance/performanceIncident.service.js";
import {
  createPerformanceIncidentAppeal,
  cancelPerformanceIncidentAppeal,
  getPerformanceIncidentAppealById,
  reviewPerformanceIncidentAppeal,
  reverseScoreForAcceptedAppeal as reverseScoreForAcceptedAppealService,
} from "../../../src/services/performance/performanceAppeal.service.js";

import { assignStaffRoleWithinRestaurant } from "../../../src/services/auth/staffRoleAssignment.service.js";

function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}



function mapShiftAttendanceMutationResult(timesheet) {
  const hasCheckIn = Boolean(timesheet?.actualCheckInAt);
  const hasCheckOut = Boolean(timesheet?.actualCheckOutAt);
  const status = hasCheckOut ? "checked_out" : hasCheckIn ? "checked_in" : "scheduled";
  const displayStatus = timesheet?.status || status;
  const normalizedStatus = String(timesheet?.status || "").toLowerCase();
  const isLate =
    ["late", "late_early_leave"].includes(normalizedStatus) ||
    (hasCheckIn && timesheet?.plannedStartTime
      ? new Date(timesheet.actualCheckInAt).getTime() >
        new Date(timesheet.plannedStartTime).getTime()
      : false);

  return {
    id: String(timesheet._id),
    restaurantId: String(timesheet.restaurantId),
    employeeId: String(timesheet.employeeId),
    shiftId: String(timesheet.shiftId),
    checkInAt: timesheet.actualCheckInAt || null,
    checkOutAt: timesheet.actualCheckOutAt || null,
    status,
    displayStatus,
    isLate: Boolean(isLate),
    createdAt: timesheet.createdAt || null,
    updatedAt: timesheet.updatedAt || null,
  };
}


async function checkShiftAttendanceAction({ shiftId, ctx, action }) {
  requireAuth(ctx);
  const actorId = ctx?.user?.id || ctx?.user?._id;
  const shift = await Shift.findById(shiftId).lean();
  if (!shift) throw new Error("Không tìm thấy ca làm.");
  if (String(shift.employeeId) !== String(actorId)) throw new Error("Bạn không thể chấm công cho ca của người khác.");
  const shiftStatus = String(shift.status || "").toLowerCase();
  if (["cancelled"].includes(shiftStatus)) throw new Error("Ca làm không hợp lệ để chấm công.");
  const publication = await SchedulePublication.findOne({
    restaurantId: shift.restaurantId,
    periodStart: { $lte: shift.startTime },
    periodEnd: { $gte: shift.endTime },
    status: { $in: ["published", "active"] },
  })
    .select({ _id: 1, status: 1 })
    .lean();
  if (!publication) {
    throw new Error("Ca chưa được công bố nên không thể chấm công.");
  }
  const now = new Date();
  const start = new Date(shift.startTime);
  const end = new Date(shift.endTime);
  const checkInWindowStart = new Date(start.getTime() - 2 * 60 * 60 * 1000);
  if (action === "check_in" && (now < checkInWindowStart || now > end)) throw new Error("Chỉ được check-in trong khoảng từ 2 giờ trước ca đến khi kết thúc ca.");

  let timesheet = await Timesheet.findOne({ employeeId: shift.employeeId, shiftId: shift._id });
  if (!timesheet) {
    timesheet = new Timesheet({ employeeId: shift.employeeId, restaurantId: shift.restaurantId, shiftId: shift._id, workDate: toStartOfDay(start), plannedStartTime: shift.startTime, plannedEndTime: shift.endTime, isOffSchedule: false, source: "quick", offScheduleApprovalStatus: "not_required" });
  }
  if (action === "check_in") {
    if (timesheet.actualCheckInAt) throw new Error("Bạn đã check-in cho ca này.");
    timesheet.actualCheckInAt = now;
  } else {
    if (!timesheet.actualCheckInAt) throw new Error("Bạn chưa check-in ca này.");
    if (timesheet.actualCheckOutAt) throw new Error("Bạn đã check-out ca này rồi.");
    if (now < timesheet.actualCheckInAt) throw new Error("Thời gian check-out không hợp lệ.");
    timesheet.actualCheckOutAt = now;
  }
  const toMinutes = (value) => Math.max(0, Math.round(value / (1000 * 60)));
  const checkInAt = timesheet.actualCheckInAt;
  const checkOutAt = timesheet.actualCheckOutAt;
  const plannedStart = timesheet.plannedStartTime;
  const plannedEnd = timesheet.plannedEndTime;

  timesheet.latenessMinutes =
    plannedStart && checkInAt
      ? toMinutes(new Date(checkInAt) - new Date(plannedStart))
      : 0;
  timesheet.earlyLeaveMinutes =
    plannedEnd && checkOutAt
      ? toMinutes(new Date(plannedEnd) - new Date(checkOutAt))
      : 0;
  timesheet.workedMinutes =
    checkInAt && checkOutAt
      ? toMinutes(new Date(checkOutAt) - new Date(checkInAt))
      : 0;
  timesheet.overtimeMinutes =
    plannedEnd && checkOutAt
      ? toMinutes(new Date(checkOutAt) - new Date(plannedEnd))
      : 0;
  timesheet.hours = Number((timesheet.workedMinutes / 60).toFixed(2));
  if (!checkOutAt) {
    timesheet.status = timesheet.latenessMinutes > 0 ? "late" : "checked_in";
  } else if (timesheet.latenessMinutes > 0 && timesheet.earlyLeaveMinutes > 0) {
    timesheet.status = "late_early_leave";
  } else if (timesheet.earlyLeaveMinutes > 0) {
    timesheet.status = "early_leave";
  } else if (timesheet.latenessMinutes > 0) {
    timesheet.status = "late";
  } else {
    timesheet.status = "completed";
  }

  try {
    await timesheet.save();
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await Timesheet.findOne({
        employeeId: shift.employeeId,
        shiftId: shift._id,
      }).lean();
      if (existing) throw new Error("Bạn đã chấm công cho ca này.");
    }
    throw error;
  }
  return {
    id: String(timesheet._id),
    restaurantId: String(timesheet.restaurantId),
    employeeId: String(timesheet.employeeId),
    shiftId: String(timesheet.shiftId),
    checkInAt: timesheet.actualCheckInAt || null,
    checkOutAt: timesheet.actualCheckOutAt || null,
    status: timesheet.actualCheckOutAt ? "checked_out" : "checked_in",
    createdAt: timesheet.createdAt || null,
    updatedAt: timesheet.updatedAt || null,
  };
}
const EMPLOYEE_CODE_PREFIX = "NV";
const EMPLOYEE_CODE_COUNTER_RETRIES = 3;

function formatEmployeeCode(sequence) {
  const padded = String(Math.max(Number(sequence) || 0, 0)).padStart(4, "0");
  return `${EMPLOYEE_CODE_PREFIX}${padded}`;
}

async function getNextEmployeeCode(restaurantId) {
  const rid = toObjectId(restaurantId);
  if (!rid) {
    throw new Error("Missing primary restaurant to generate employee code");
  }

  let lastError = null;
  for (
    let attempt = 1;
    attempt <= EMPLOYEE_CODE_COUNTER_RETRIES;
    attempt += 1
  ) {
    try {
      const counter = await EmployeeCodeCounter.findOneAndUpdate(
        { restaurantId: rid },
        {
          $setOnInsert: { restaurantId: rid },
          $inc: { seq: 1 },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      return formatEmployeeCode(counter?.seq);
    } catch (error) {
      lastError = error;
      if (error?.code !== 11000 || attempt === EMPLOYEE_CODE_COUNTER_RETRIES) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Failed to generate employee code");
}

function toStartOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildAcknowledgementDeadline(baseTime, hours = 24) {
  return new Date(new Date(baseTime).getTime() + hours * 60 * 60 * 1000);
}

function assertAcknowledgementCanRespond(doc, employeeId) {
  if (!doc) throw new Error("SHIFT_ACKNOWLEDGEMENT_NOT_FOUND");
  if (String(doc.employeeId) !== String(employeeId))
    throw new Error("FORBIDDEN");
  if (doc.status === "accepted" || doc.status === "declined") {
    throw new Error("SHIFT_ACKNOWLEDGEMENT_ALREADY_RESPONDED");
  }
  if (doc.status === "expired")
    throw new Error("SHIFT_ACKNOWLEDGEMENT_EXPIRED");
  if (doc.status === "cancelled")
    throw new Error("SHIFT_ACKNOWLEDGEMENT_CANCELLED");
}
function staffBelongsToRestaurant(staff, restaurantId) {
  const rid = String(restaurantId);
  return String(staff?.restaurantForStaff || "") === rid;
}

function isSelf(ctx, employeeId) {
  const actorId = ctx?.user?.id || ctx?.user?._id;
  return actorId && String(actorId) === String(employeeId);
}

async function loadStaffForRestaurant(employeeId, restaurantId) {
  const staff = await Staff.findById(employeeId)
    .select({
      _id: 1,
      userType: 1,
      deletedAt: 1,
      restaurantForStaff: 1,
      fullName: 1,
      employeeCode: 1,
    })
    .lean();
  if (!staff || staff.userType !== "STAFF" || staff.deletedAt) {
    throw new Error("Staff not found");
  }
  if (!staffBelongsToRestaurant(staff, restaurantId)) {
    throw new Error("Staff does not belong to this restaurant");
  }
  return staff;
}

async function requireScheduleWriteAccess(ctx, restaurantId) {
  requireAuth(ctx);
  requireRoles(ctx, SCHEDULE_WRITE_ROLES);
  await requireRestaurantAccess(ctx, restaurantId);
}
async function createStaffShiftInternal(input, ctx) {
  requireAuth(ctx);
  requireRoles(ctx, SCHEDULE_WRITE_ROLES);
  const restaurantId = input.restaurantId;
  await requireRestaurantAccess(ctx, restaurantId);
  const startTime = toValidDateTime(input.startTime, "Giờ bắt đầu ca");
  const endTime = toValidDateTime(input.endTime, "Giờ kết thúc ca");

  const publication = await getSchedulePublicationForShift({
    restaurantId,
    shiftTime: startTime,
  });

  if (publication) {
    const effectiveStatus = resolveScheduleLifecycleStatus({
      publication,
      periodStart: publication.periodStart,
      periodEnd: publication.periodEnd,
    });
    if (!["draft", "revision_draft"].includes(effectiveStatus)) {
      throw new Error(
        "Không thể tạo ca trực tiếp khi lịch không còn ở trạng thái bản nháp.",
      );
    }
  }

  const validationResult = await assertShiftAssignmentValid({
    input: {
      employeeId: input.employeeId,
      restaurantId,
      shiftType: input.shiftType,
      startTime,
      endTime,
      allowOverride: input.allowOverride,
      overrideReason: input.overrideReason,
    },
    ctx,
  });
  const hasWarnings = hasNonInfoWarnings(validationResult);
  if (hasWarnings && input.allowOverride !== true) {
    throw new Error("Có cảnh báo policy khi xếp ca. Cần override có lý do để tiếp tục.");
  }
  if (hasWarnings && input.allowOverride === true && !String(input.overrideReason || "").trim()) {
    throw new Error("Cần nhập lý do override khi xếp ca có cảnh báo policy.");
  }
  const staff = await loadStaffForRestaurant(input.employeeId, restaurantId);

  const overrideNote =
    input.allowOverride === true && String(input.overrideReason || "").trim()
      ? `[Override cảnh báo] ${String(input.overrideReason || "").trim()}`
      : "";
  const mergedNotes = [input.notes || "", overrideNote].filter(Boolean).join("\n");
  const created = await Shift.create({
    employeeId: input.employeeId,
    restaurantId,
    shiftType: input.shiftType.toString().toLowerCase(),
    startTime,
    endTime,
    status: input.status || "scheduled",
    notes: mergedNotes,
  });

  return {
    id: String(created._id),
    employeeId: String(created.employeeId),
    employeeName: staff.fullName || null,
    restaurantId: String(created.restaurantId),
    shiftType: created.shiftType,
    startTime: created.startTime,
    endTime: created.endTime,
    status: created.status,
    notes: created.notes || "",
  };
}
async function ensureShiftAcknowledgement({
  shift,
  publication,
  actorUserId,
  createdFrom = "publish",
  deadlineAt,
}) {
  const employeeId = toObjectId(shift.employeeId);
  if (!employeeId) return null;
  const filter = { shiftId: shift._id, employeeId };
  const update = {
    $setOnInsert: {
      restaurantId: shift.restaurantId,
      publicationId: publication?._id || null,
      shiftId: shift._id,
      employeeId,
      periodStart: publication?.periodStart || shift.startTime,
      periodEnd: publication?.periodEnd || shift.endTime,
      status: "pending",
      deadlineAt:
        deadlineAt ||
        buildAcknowledgementDeadline(publication?.publishedAt || new Date()),
      createdFrom,
      createdBy: actorUserId,
    },
  };
  return ShiftAcknowledgement.findOneAndUpdate(filter, update, {
    upsert: true,
    new: true,
  });
}

async function assertShiftAcknowledgementPublicationActive(ackDoc) {
  if (!ackDoc?.publicationId)
    throw new Error("SHIFT_ACKNOWLEDGEMENT_NOT_PUBLISHED");
  const publication = await SchedulePublication.findById(
    ackDoc.publicationId,
  ).lean();
  if (!publication || !["published", "active"].includes(publication.status)) {
    throw new Error("SHIFT_ACKNOWLEDGEMENT_NOT_PUBLISHED");
  }
}

async function markScheduleAcknowledgementsNeedReview({
  restaurantId,
  publicationId,
  employeeIds = [],
}) {
  const ids = [...new Set(employeeIds.map((id) => String(id)).filter(Boolean))]
    .map(toObjectId)
    .filter(Boolean);
  if (!ids.length || !publicationId) return;
  await ScheduleAcknowledgement.updateMany(
    {
      restaurantId,
      schedulePublicationId: publicationId,
      employeeId: { $in: ids },
    },
    {
      $set: {
        status: "needs_review",
        changedAfterAcknowledgement: true,
        lastChangedAt: new Date(),
      },
    },
  );
}

function toEndOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function mapAttendanceStatus(timesheet) {
  if (!timesheet?.actualCheckInAt)
    return timesheet?.isOffSchedule ? "unscheduled_absent" : "scheduled_absent";
  if (!timesheet?.actualCheckOutAt)
    return timesheet?.isOffSchedule ? "unscheduled_checkin" : "checked_in";
  if (timesheet?.isOffSchedule) return "unscheduled_completed";
  const hasLate = Number(timesheet?.latenessMinutes || 0) > 0;
  const hasEarly = Number(timesheet?.earlyLeaveMinutes || 0) > 0;
  if (hasLate && hasEarly) return "late_early_leave";
  if (hasLate) return "late";
  if (hasEarly) return "early_leave";
  return "completed";
}

function toMinutes(ms) {
  return Math.max(Math.round(ms / 60000), 0);
}

function mapAttendanceOutput(timesheet, staff) {
  const isOffSchedule = Boolean(timesheet.isOffSchedule);
  const storedApproval = String(
    timesheet.offScheduleApprovalStatus || "",
  ).toLowerCase();
  const offScheduleApprovalStatus = !isOffSchedule
    ? "not_required"
    : Boolean(timesheet.approved)
      ? "approved"
      : storedApproval === "rejected"
        ? "rejected"
        : "pending";
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
    isOffSchedule,
    offScheduleApprovalStatus,
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

function fromGraphLeaveType(value) {
  const map = {
    ANNUAL: "annual",
    SICK: "sick",
    UNPAID: "unpaid",
    PAID_PERSONAL: "paid_personal",
    MATERNITY: "maternity",
    COMPENSATORY: "compensatory",
    HOLIDAY: "holiday",
    HALF_DAY: "half_day",
  };
  return map[String(value || "").toUpperCase()] || "annual";
}

function fromGraphSession(value) {
  const map = { FULL: "full", MORNING: "morning", AFTERNOON: "afternoon" };
  return map[String(value || "").toUpperCase()] || "full";
}

function toGraphLeaveType(value) {
  const reverse = {
    annual: "ANNUAL",
    sick: "SICK",
    unpaid: "UNPAID",
    paid_personal: "PAID_PERSONAL",
    maternity: "MATERNITY",
    compensatory: "COMPENSATORY",
    holiday: "HOLIDAY",
    half_day: "HALF_DAY",
  };
  return reverse[String(value || "").toLowerCase()] || "ANNUAL";
}

function toGraphLeaveStatus(value) {
  const reverse = {
    pending: "PENDING",
    pending_replacement_confirmation: "PENDING_REPLACEMENT_CONFIRMATION",
    approved: "APPROVED",
    rejected: "REJECTED",
  };
  return reverse[String(value || "").toLowerCase()] || "PENDING";
}

function toGraphReplacementStatus(value) {
  const reverse = {
    not_required: "NOT_REQUIRED",
    pending: "PENDING",
    confirmed: "CONFIRMED",
    rejected: "REJECTED",
  };
  return reverse[String(value || "").toLowerCase()] || "NOT_REQUIRED";
}

function toGraphSession(value) {
  const reverse = { full: "FULL", morning: "MORNING", afternoon: "AFTERNOON" };
  return reverse[String(value || "").toLowerCase()] || "FULL";
}

function calcLeaveDays(
  startDate,
  endDate,
  startSession = "full",
  endSession = "full",
  leaveType = "annual",
) {
  if (leaveType === "half_day") return 0.5;
  const start = toStartOfDay(startDate);
  const end = toStartOfDay(endDate);
  if (end < start) return 0;

  let days =
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (startSession !== "full") days -= 0.5;
  if (endSession !== "full" && days > 0.5) days -= 0.5;
  return Math.max(Number(days.toFixed(2)), 0);
}

function computeLeaveFlags(leaveType, requestedDays) {
  const paidTypes = new Set([
    "annual",
    "sick",
    "paid_personal",
    "maternity",
    "compensatory",
    "holiday",
    "half_day",
  ]);
  const deductTypes = new Set(["annual", "sick", "compensatory", "half_day"]);
  const isPaidLeave = paidTypes.has(leaveType);
  const deductLeaveBalance = deductTypes.has(leaveType);
  const isHalfDay = leaveType === "half_day" || requestedDays === 0.5;
  const quotaImpact = {
    deductAnnualDays:
      leaveType === "annual" || leaveType === "half_day" ? requestedDays : 0,
    deductSickDays: leaveType === "sick" ? requestedDays : 0,
    deductCompensatoryDays: leaveType === "compensatory" ? requestedDays : 0,
    totalDeductDays: deductLeaveBalance ? requestedDays : 0,
  };
  return {
    payrollFlags: {
      isPaidLeave,
      deductLeaveBalance,
      payrollCountable: isPaidLeave,
      halfDayFactor: isHalfDay ? 0.5 : 1,
      maternityTreatment: leaveType === "maternity",
      holidayTreatment: leaveType === "holiday",
      compensatoryTreatment: leaveType === "compensatory",
      unpaidFactor: isPaidLeave ? 0 : 1,
    },
    quotaImpact,
  };
}

async function applyLeaveBalanceImpact({ employeeId, year, quotaImpact }) {
  if (!quotaImpact || Number(quotaImpact.totalDeductDays || 0) <= 0)
    return null;
  const balance =
    (await LeaveBalance.findOne({ employeeId, year })) ||
    (await LeaveBalance.create({ employeeId, year }));
  balance.annualUsedDays += Number(quotaImpact.deductAnnualDays || 0);
  balance.sickUsedDays += Number(quotaImpact.deductSickDays || 0);
  balance.compensatoryUsedDays += Number(
    quotaImpact.deductCompensatoryDays || 0,
  );
  balance.annualRemainingDays = Math.max(
    balance.annualEntitledDays - balance.annualUsedDays,
    0,
  );
  balance.sickRemainingDays = Math.max(
    balance.sickEntitledDays - balance.sickUsedDays,
    0,
  );
  balance.compensatoryRemainingDays = Math.max(
    balance.compensatoryEntitledDays - balance.compensatoryUsedDays,
    0,
  );
  await balance.save();
  return balance;
}

function mapLeaveOutput(row) {
  return {
    id: String(row._id),
    employeeId: String(row.employeeId?._id || row.employeeId),
    employeeName: row.employeeId?.fullName || null,
    employeeCode: row.employeeId?.employeeCode || null,
    employeeRole:
      row.employeeId?.positionTitle || row.employeeId?.roleName || null,
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
    approverId: row.approverId?._id
      ? String(row.approverId._id)
      : row.approverId
        ? String(row.approverId)
        : null,
    approverName: row.approverId?.fullName || null,
    approvedAt: row.approvedAt || null,
    rejectedAt: row.rejectedAt || null,
    rejectionReason: row.rejectionReason || "",
    replacementManagerId: row.replacementManagerId?._id
      ? String(row.replacementManagerId._id)
      : row.replacementManagerId
        ? String(row.replacementManagerId)
        : null,
    replacementManagerName: row.replacementManagerId?.fullName || null,
    replacementStatus: toGraphReplacementStatus(row.replacementStatus),
    replacementConfirmedAt: row.replacementConfirmedAt || null,
    replacementConfirmedBy: row.replacementConfirmedBy?._id
      ? String(row.replacementConfirmedBy._id)
      : row.replacementConfirmedBy
        ? String(row.replacementConfirmedBy)
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
      deductCompensatoryDays: Number(
        row.quotaImpact?.deductCompensatoryDays || 0,
      ),
      totalDeductDays: Number(row.quotaImpact?.totalDeductDays || 0),
    },
    leaveBalanceSnapshot: null,
    auditLogs: (row.auditLogs || []).map((item) => ({
      action: item.action,
      actorId: item.actorId ? String(item.actorId) : null,
      actorName: item.actorName || null,
      note: item.note || "",
      at: item.at || null,
    })),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function formatLeaveTypeLabel(leaveType) {
  const map = {
    annual: "Nghỉ năm",
    sick: "Nghỉ bệnh",
    unpaid: "Nghỉ không lương",
    paid_personal: "Nghỉ việc riêng có lương",
    maternity: "Nghỉ thai sản",
    compensatory: "Nghỉ bù",
    holiday: "Nghỉ lễ/tết",
    half_day: "Nghỉ nửa ngày",
  };
  return map[String(leaveType || "").toLowerCase()] || leaveType;
}
function formatShiftTimeVi(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function toValidDateTime(value, fieldName) {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} không hợp lệ.`);
  }

  return date;
}

function getActorUserId(ctx) {
  return toObjectId(ctx?.user?.id || ctx?.user?._id);
}

function getShiftGroupRange(shifts = []) {
  const startTimes = shifts
    .map((shift) => new Date(shift.startTime))
    .filter((date) => !Number.isNaN(date.getTime()));

  const endTimes = shifts
    .map((shift) => new Date(shift.endTime))
    .filter((date) => !Number.isNaN(date.getTime()));

  return {
    oldStartTime: new Date(
      Math.min(...startTimes.map((date) => date.getTime())),
    ),
    oldEndTime: new Date(Math.max(...endTimes.map((date) => date.getTime()))),
  };
}

function buildShiftTimeChangedMessage({
  shiftType,
  oldStartTime,
  oldEndTime,
  newStartTime,
  newEndTime,
  reason,
}) {
  return `Ca ${shiftType} của bạn đã được thay đổi giờ từ ${formatShiftTimeVi(
    oldStartTime,
  )} - ${formatShiftTimeVi(oldEndTime)} sang ${formatShiftTimeVi(
    newStartTime,
  )} - ${formatShiftTimeVi(newEndTime)}.${reason ? ` Lý do: ${reason}` : ""}`;
}
async function getSchedulePublicationForShift({ restaurantId, shiftTime }) {
  return SchedulePublication.findOne({
    restaurantId,
    periodStart: { $lte: shiftTime },
    periodEnd: { $gte: shiftTime },
  }).lean();
}

async function getPublishedScheduleForShift({ restaurantId, shiftTime }) {
  const publication = await getSchedulePublicationForShift({
    restaurantId,
    shiftTime,
  });
  if (!publication) return null;
  const effectiveStatus = resolveScheduleLifecycleStatus({
    publication,
    periodStart: publication.periodStart,
    periodEnd: publication.periodEnd,
  });
  return effectiveStatus === "published" ? publication : null;
}

function assertPublishedScheduleCanChange(publication) {
  const effectiveStatus = resolveScheduleLifecycleStatus({
    publication,
    periodStart: publication?.periodStart,
    periodEnd: publication?.periodEnd,
  });

  if (effectiveStatus !== "published") {
    if (effectiveStatus === "active") {
      throw new Error(
        "Lịch đang hoạt động, không thể chỉnh sửa trực tiếp. Vui lòng dùng quy trình điều chỉnh chấm công.",
      );
    }
    if (effectiveStatus === "locked") {
      throw new Error("Lịch đã bị khóa, không thể chỉnh sửa.");
    }
    if (effectiveStatus === "closed") {
      throw new Error("Lịch đã đóng, không thể chỉnh sửa từ lịch làm việc.");
    }
    throw new Error(
      "Lịch chưa công bố, vui lòng dùng luồng chỉnh sửa bản nháp.",
    );
  }

  return effectiveStatus;
}

async function assertShiftGroupNotStartedOrCheckedIn({
  shiftIds,
  oldStartTime,
}) {
  const now = new Date();

  if (now >= oldStartTime) {
    throw new Error(
      "Ca đã bắt đầu hoặc đã kết thúc, không thể chỉnh sửa trực tiếp. Vui lòng dùng quy trình điều chỉnh chấm công.",
    );
  }

  const timesheet = await Timesheet.findOne({
    shiftId: { $in: shiftIds },
    $or: [
      { actualCheckInAt: { $ne: null } },
      { actualCheckOutAt: { $ne: null } },
      { approved: true },
    ],
  }).lean();

  if (timesheet) {
    throw new Error(
      "Ca đã phát sinh chấm công hoặc đã được duyệt công, không thể chỉnh sửa từ lịch làm việc.",
    );
  }
}

function buildShiftAddedMessage({ shiftType, startTime, endTime, reason }) {
  return `Bạn đã được thêm vào ca ${shiftType} từ ${formatShiftTimeVi(
    startTime,
  )} đến ${formatShiftTimeVi(endTime)}.${reason ? ` Lý do: ${reason}` : ""}`;
}

function buildShiftRemovedMessage({ shiftType, startTime, endTime, reason }) {
  return `Bạn đã được gỡ khỏi ca ${shiftType} từ ${formatShiftTimeVi(
    startTime,
  )} đến ${formatShiftTimeVi(endTime)}.${reason ? ` Lý do: ${reason}` : ""}`;
}

function mapStaffScheduleShiftOutput(row, employeeDoc = null) {
  return {
    id: String(row._id),
    employeeId: String(row.employeeId?._id || row.employeeId),
    employeeName:
      employeeDoc?.fullName ||
      row.employeeId?.fullName ||
      row.employeeName ||
      null,
    restaurantId: String(row.restaurantId),
    shiftType: row.shiftType,
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status || "scheduled",
    notes: row.notes || "",
  };
}
function formatDateVi(date) {
  const d = new Date(date);
  return Number.isNaN(d.getTime())
    ? String(date || "")
    : d.toLocaleDateString("vi-VN");
}

async function sendLeaveDecisionMail({ leaveDoc, decision }) {
  const employeeEmail = String(leaveDoc?.employeeId?.email || "")
    .trim()
    .toLowerCase();
  if (!isValidEmail(employeeEmail)) {
    throw new Error(
      "Nhân viên không có email hợp lệ để gửi thông báo nghỉ phép",
    );
  }

  const employeeName =
    leaveDoc?.employeeId?.fullName ||
    leaveDoc?.employeeId?.employeeCode ||
    "Nhân viên";
  const leaveTypeLabel = formatLeaveTypeLabel(leaveDoc?.leaveType);
  const rangeText = `${formatDateVi(leaveDoc?.startDate)} - ${formatDateVi(leaveDoc?.endDate)}`;
  const isApproved = decision === "approved";
  const subject = isApproved
    ? "Đơn nghỉ phép của bạn đã được duyệt"
    : "Đơn nghỉ phép của bạn đã bị từ chối";
  const statusText = isApproved ? "ĐÃ DUYỆT" : "BỊ TỪ CHỐI";
  const rejectReason =
    !isApproved && leaveDoc?.rejectionReason
      ? `<p><strong>Lý do từ chối:</strong> ${leaveDoc.rejectionReason}</p>`
      : "";

  const mailResult = await mailer.sendMail({
    to: employeeEmail,
    subject,
    text: [
      `Xin chào ${employeeName},`,
      `Đơn nghỉ phép: ${leaveTypeLabel}`,
      `Thời gian: ${rangeText}`,
      `Kết quả xử lý: ${statusText}`,
      !isApproved && leaveDoc?.rejectionReason
        ? `Lý do từ chối: ${leaveDoc.rejectionReason}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
    html: `
      <h3>Thông báo xử lý đơn nghỉ phép</h3>
      <p>Xin chào <strong>${employeeName}</strong>,</p>
      <p>Đơn nghỉ phép của bạn đã được xử lý.</p>
      <ul>
        <li><strong>Loại nghỉ:</strong> ${leaveTypeLabel}</li>
        <li><strong>Thời gian:</strong> ${rangeText}</li>
        <li><strong>Kết quả:</strong> ${statusText}</li>
      </ul>
      ${rejectReason}
    `,
  });

  if (
    mailResult?.skipped ||
    (Array.isArray(mailResult?.rejected) && mailResult.rejected.length > 0)
  ) {
    throw new Error("Email provider chưa sẵn sàng hoặc từ chối gửi email");
  }

  return mailResult;
}

async function logStaffEvent({
  staff,
  verb,
  ctx,
  status = "success",
  meta = {},
  diff = {},
}) {
  try {
    const actorUserId = ctx?.user?.id || ctx?.user?._id || null;

    const restaurantId = staff.restaurantForStaff || null;

    await EventLog.create({
      restaurantId,
      actorUserId,
      verb,
      object: {
        kind: "User",
        id: staff._id,
        code: staff.employeeCode || staff.username || staff.email || null,
      },
      source: "staff-mutation",
      status,
      meta,
      diff,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Failed to create staff event log:", err.message);
  }
}

function getRoleParentSlug(roleDoc) {
  return String(
    roleDoc?.parentRole?.slug || roleDoc?.parentRole || "",
  ).toLowerCase();
}

function normalizeRoleDepartment(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

async function resolveStaffRoleById(roleId, department) {
  if (!mongoose.isValidObjectId(roleId)) {
    throw new Error("Invalid roleId");
  }

  const roleDoc = await Role.findById(roleId).populate("parentRole");
  if (!roleDoc) {
    throw new Error("Role not found");
  }

  const parentSlug = getRoleParentSlug(roleDoc);
  const roleSlug = String(roleDoc.slug || "").toLowerCase();
  if (parentSlug !== "staff" && roleSlug !== "staff") {
    throw new Error(
      "Role không hợp lệ: STAFF chỉ được nhận role thuộc nhóm staff",
    );
  }

  const roleDepartment = normalizeRoleDepartment(roleDoc.department);
  const selectedDepartment = normalizeRoleDepartment(department);
  if (
    roleSlug !== "staff" &&
    roleDepartment &&
    selectedDepartment &&
    roleDepartment !== selectedDepartment
  ) {
    throw new Error("Role không thuộc bộ phận đã chọn");
  }

  return roleDoc;
}

export const __testables = {
  formatEmployeeCode,
  getNextEmployeeCode,
};
function resolveStaffRestaurantId(staff) {
  return staff?.restaurantForStaff || null;
}

async function loadStaffScope(staffId) {
  if (!mongoose.isValidObjectId(staffId)) return null;
  return Staff.findById(staffId)
    .select({
      _id: 1,
      userType: 1,
      deletedAt: 1,
      restaurantForStaff: 1,
      refRestaurants: 1,
      role: 1,
      employmentStatus: 1,
    })
    .lean();
}

async function requireStaffMutationAccess(ctx, staffId) {
  requireAuth(ctx);
  const staff = await loadStaffScope(staffId);
  if (!staff || staff.userType !== "STAFF" || staff.deletedAt) {
    throw new Error("Staff not found");
  }
  const restaurantId = resolveStaffRestaurantId(staff);
  if (!restaurantId) throw new Error("STAFF_RESTAURANT_NOT_FOUND");
  await requireRestaurantAccess(ctx, restaurantId);
  return { staff, restaurantId };
}

function getBatchErrorCode(error) {
  return (
    error?.extensions?.code ||
    error?.code ||
    error?.name ||
    "CREATE_STAFF_SHIFT_FAILED"
  );
}

function getBatchErrorMessage(error) {
  return (
    error?.message ||
    error?.extensions?.message ||
    "Không thể tạo ca cho nhân viên này."
  );
}
const mutationResolvers = {
  assignStaffRole: async (_, { input }, ctx) => {
    requireAuth(ctx);
    const staff = await assignStaffRoleWithinRestaurant({
      actor: ctx.user,
      staffUserId: input.staffUserId,
      roleId: input.roleId,
      restaurantId: input.restaurantId,
      ctx,
    });
    return sanitizeStaffPrivateProfile(staff, ctx, { restaurantId: input.restaurantId, skipAuthorization: true });
  },

  assignStaffRoleWithinRestaurant: async (_, args, ctx) => {
    requireAuth(ctx);
    const staff = await assignStaffRoleWithinRestaurant({
      actor: ctx.user,
      staffUserId: args.staffUserId,
      roleId: args.roleId,
      restaurantId: args.restaurantId,
      ctx,
    });
    return sanitizeStaffPrivateProfile(staff, ctx, { restaurantId: args.restaurantId, skipAuthorization: true });
  },

  // =========================
  // CREATE STAFF
  // =========================
  createStaff: async (_, { input }, ctx) => {
    requireAuth(ctx);
    // Ép kiểu userType (HIỆN TẠI luôn là STAFF)
    const normalizedUserType = (input.userType || "STAFF")
      .toString()
      .toUpperCase();
    input.userType = normalizedUserType;

    if (Object.prototype.hasOwnProperty.call(input, "primaryRestaurantId")) {
      const err = new Error(
        "primaryRestaurantId has been removed; use restaurantForStaff",
      );
      err.extensions = { code: "BAD_USER_INPUT" };
      throw err;
    }
    if (Object.prototype.hasOwnProperty.call(input, "refRestaurantIds")) {
      const err = new Error(
        "refRestaurantIds is not allowed for staff; use restaurantForStaff",
      );
      err.extensions = { code: "BAD_USER_INPUT" };
      throw err;
    }
    const restaurantAccessId = input.restaurantForStaff || null;
    if (!mongoose.isValidObjectId(restaurantAccessId)) {
      throw new Error(
        "restaurantForStaff is required and must be a valid ObjectId",
      );
    }
    await requireRestaurantAccess(ctx, restaurantAccessId);

    // =========================
    // XÁC ĐỊNH ROLE CHO STAFF
    // =========================
    let roleDoc = null;

    if (input.roleId) {
      requireRoles(ctx, ["ADMIN"]);
      roleDoc = await resolveStaffRoleById(input.roleId, input.department);
    } else {
      // Không truyền roleId -> dùng default staff role
      roleDoc =
        (await Role.findOne({ slug: "staff" }).populate("parentRole")) ||
        (await Role.findOne({ parent: "staff" }).populate("parentRole"));

      if (!roleDoc) {
        throw new Error(
          "Default staff role not found (slug='staff' or parent='staff')",
        );
      }
      // Với default này thì đương nhiên thuộc nhóm staff nên không cần check thêm
    }

    const roleId = roleDoc._id;

    const { password, employeeCode: _ignoredEmployeeCode, ...rest } = input;

    const doc = {
      ...rest,
      role: roleId,
    };

    // Chuẩn hoá enum để khớp Mongoose
    // EmploymentType: FULL_TIME -> full_time
    if (doc.employmentType) {
      doc.employmentType = doc.employmentType.toString().toLowerCase();
    }

    // EmploymentStatus: ON_LEAVE -> on_leave
    if (doc.employmentStatus) {
      doc.employmentStatus = doc.employmentStatus.toString().toLowerCase();
    }

    // ShiftType: MORNING -> morning, FULL_DAY -> full_day
    if (doc.shiftType) {
      doc.shiftType = doc.shiftType.toString().toLowerCase();
    }

    // StaffWorkingDay: [MON, TUE] -> ["mon", "tue"]
    if (doc.workingDays && Array.isArray(doc.workingDays)) {
      doc.workingDays = doc.workingDays.map((d) =>
        d != null ? d.toString().toLowerCase() : d,
      );
    }

    // DepartmentType đã là lowercase (service, kitchen, ...) -> không cần đổi

    // Gán nhà hàng
    const sequenceRestaurantId = input.restaurantForStaff || null;
    if (!sequenceRestaurantId) {
      throw new Error(
        "restaurantForStaff is required to generate employee code",
      );
    }

    doc.restaurantForStaff = sequenceRestaurantId;

    let staff = null;
    let lastCreateError = null;
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      const employeeCode = await getNextEmployeeCode(sequenceRestaurantId);
      const candidate = new Staff({
        ...doc,
        employeeCode,
      });

      // Nếu FE có truyền password → hash luôn
      // Nếu không → hook pre('save') trong User.js sẽ tự generate (nếu em có thêm logic đó)
      if (password && password.trim() !== "") {
        await candidate.setPassword(password.trim());
      }

      try {
        await candidate.save();
        staff = candidate;
        break;
      } catch (error) {
        lastCreateError = error;
        if (error?.code !== 11000 || attempt === MAX_RETRIES) {
          throw error;
        }
      }
    }

    if (!staff) {
      throw lastCreateError || new Error("Failed to create staff");
    }

    const staffRequiresVerification =
      String(process.env.STAFF_ACCOUNT_REQUIRES_VERIFICATION ?? "false").toLowerCase() === "true";
    if (staffRequiresVerification && staff.status === "active") {
      staff.status = "pending";
      await staff.save();
    }

    let verificationDispatch = null;
    if (staff.email || staff.phone) {
      try {
        verificationDispatch = await issueVerificationForUser({
          user: staff,
          channels: "AUTO",
          requestedBy: ctx.user,
          reason: "staff_create",
          ctx,
        });
      } catch (err) {
        verificationDispatch = {
          ok: false,
          status: "FAILED",
          errors: [err?.extensions?.code || err?.message || "VERIFICATION_DISPATCH_FAILED"],
        };
      }
    }

    await staff.populate(["role", "refRestaurants"]);

    await logStaffEvent({
      staff,
      verb: "staff.create",
      ctx,
      meta: {
        roleId: String(roleId),
        roleSlug: roleDoc.slug,
        userType: staff.userType,
        department: staff.department || null,
        verificationDispatch,
      },
    });

    return sanitizeStaffPrivateProfile(staff, ctx, { restaurantId: staff.restaurantForStaff, skipAuthorization: true });
  },

  // =========================
  // UPDATE STAFF
  // =========================
  updateStaff: async (_, { userId, input }, ctx) => {
    requireAuth(ctx);
    const { staff: scopedStaff, restaurantId: currentRestaurantId } =
      await requireStaffMutationAccess(ctx, userId);
    const targetRestaurantIds = [];
    if (Object.prototype.hasOwnProperty.call(input, "primaryRestaurantId")) {
      const err = new Error(
        "primaryRestaurantId has been removed; use restaurantForStaff",
      );
      err.extensions = { code: "BAD_USER_INPUT" };
      throw err;
    }
    if (Object.prototype.hasOwnProperty.call(input, "refRestaurantIds")) {
      const err = new Error(
        "refRestaurantIds is not allowed for staff; use restaurantForStaff",
      );
      err.extensions = { code: "BAD_USER_INPUT" };
      throw err;
    }
    if (input.restaurantForStaff) {
      if (!mongoose.isValidObjectId(input.restaurantForStaff)) {
        throw new Error("Invalid restaurantForStaff");
      }
      targetRestaurantIds.push(input.restaurantForStaff);
    }
    for (const rid of [...new Set(targetRestaurantIds.map(String))]) {
      if (String(rid) !== String(currentRestaurantId)) {
        await requireRestaurantAccess(ctx, rid);
      }
    }
    const staff = await Staff.findById(userId);
    if (!staff || staff.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    if ("employeeCode" in input) {
      delete input.employeeCode;
    }
    if ("deletedAt" in input) delete input.deletedAt;
    if ("userType" in input) delete input.userType;

    const before = staff.toObject();
    const payrollSensitiveFields = [
      "baseSalary",
      "employmentType",
      "employmentStatus",
      "department",
      "positionTitle",
      "roleId",
      "dateJoined",
      "dateLeft",
    ];
    if (
      Object.keys(input || {}).some((key) =>
        payrollSensitiveFields.includes(key),
      )
    ) {
      await assertNoLockedPayrollPeriodOverlap({
        restaurantId: staff.restaurantForStaff,
        employeeId: staff._id,
        startDate: staff.dateJoined || new Date("2000-01-01"),
        endDate: new Date(),
        action: "update_staff",
      });
    }

    const hasRestaurantForStaffInput = Object.prototype.hasOwnProperty.call(
      input,
      "restaurantForStaff",
    );
    if (
      hasRestaurantForStaffInput &&
      input.restaurantForStaff &&
      !mongoose.isValidObjectId(input.restaurantForStaff)
    ) {
      throw new Error("Invalid restaurantForStaff");
    }

    // Chuẩn hoá enum giống như createStaff
    if (input.employmentType) {
      input.employmentType = input.employmentType.toString().toLowerCase();
    }

    if (input.employmentStatus) {
      input.employmentStatus = input.employmentStatus.toString().toLowerCase();
    }

    if (input.shiftType) {
      input.shiftType = input.shiftType.toString().toLowerCase();
    }

    if (input.workingDays && Array.isArray(input.workingDays)) {
      input.workingDays = input.workingDays.map((d) =>
        d != null ? d.toString().toLowerCase() : d,
      );
    }

    if (input.roleId) {
      requireRoles(ctx, ["ADMIN"]);
      const roleDoc = await resolveStaffRoleById(
        input.roleId,
        input.department || staff.department,
      );
      input.role = roleDoc._id;
      delete input.roleId;
    }
    if (Object.prototype.hasOwnProperty.call(input, "baseSalary")) {
      requireRoles(ctx, ["ADMIN"]);
    }

    // Hỗ trợ đổi mật khẩu nếu có truyền trong input
    if (input.password && input.password.trim() !== "") {
      await staff.setPassword(input.password.trim());
      delete input.password;
    }

    Object.assign(staff, input);
    await staff.save();
    await staff.populate(["role", "refRestaurants"]);

    await logStaffEvent({
      staff,
      verb: "staff.update",
      ctx,
      diff: {
        before: {
          fullName: before.fullName,
          employeeCode: before.employeeCode,
          positionTitle: before.positionTitle,
          department: before.department,
          employmentType: before.employmentType,
          employmentStatus: before.employmentStatus,
          role: before.role ? String(before.role) : null,
        },
        after: {
          fullName: staff.fullName,
          employeeCode: staff.employeeCode,
          positionTitle: staff.positionTitle,
          department: staff.department,
          employmentType: staff.employmentType,
          employmentStatus: staff.employmentStatus,
          role: staff.role ? String(staff.role._id || staff.role) : null,
        },
      },
    });

    return sanitizeStaffPrivateProfile(staff, ctx, { restaurantId: staff.restaurantForStaff, skipAuthorization: true });
  },

  // =========================
  // DELETE STAFF (SOFT DELETE)
  // =========================
  deleteStaff: async (_, { userId }, ctx) => {
    requireAuth(ctx);
    await requireStaffMutationAccess(ctx, userId);
    const staff = await Staff.findById(userId);

    if (!staff || staff.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    staff.status = "inactive";
    // Enum trong User.js: "working", "on_leave", "resigned", "suspended"
    staff.employmentStatus = "resigned";
    await assertNoLockedPayrollPeriodOverlap({
      restaurantId: staff.restaurantForStaff,
      employeeId: staff._id,
      startDate: staff.dateJoined || new Date("2000-01-01"),
      endDate: new Date(),
      action: "delete_staff",
    });
    await staff.save();

    await logStaffEvent({
      staff,
      verb: "staff.delete",
      ctx,
      meta: { reason: "soft-delete" },
    });

    return true;
  },

  // =========================
  // SET STAFF EMPLOYMENT STATUS
  // =========================
  setStaffEmploymentStatus: async (_, { userId, employmentStatus }, ctx) => {
    requireAuth(ctx);
    await requireStaffMutationAccess(ctx, userId);
    const staff = await Staff.findById(userId);

    if (!staff || staff.userType !== "STAFF") {
      throw new Error("Staff not found");
    }

    const beforeStatus = staff.employmentStatus;

    // GraphQL: WORKING, ON_LEAVE, RESIGNED, SUSPENDED
    // Mongo: "working", "on_leave", "resigned", "suspended"
    const normalizedStatus = employmentStatus
      ? employmentStatus.toString().toLowerCase()
      : "";

    staff.employmentStatus = normalizedStatus;
    await assertNoLockedPayrollPeriodOverlap({
      restaurantId: staff.restaurantForStaff,
      employeeId: staff._id,
      startDate: staff.dateJoined || new Date("2000-01-01"),
      endDate: new Date(),
      action: "set_staff_employment_status",
    });
    await staff.save();
    await staff.populate(["role", "refRestaurants"]);

    const verb =
      normalizedStatus === "on_leave"
        ? "staff.setOnLeave"
        : "staff.setEmploymentStatus";

    await logStaffEvent({
      staff,
      verb,
      ctx,
      diff: {
        before: { employmentStatus: beforeStatus },
        after: { employmentStatus: staff.employmentStatus },
      },
    });

    return sanitizeStaffPrivateProfile(staff, ctx, { restaurantId: staff.restaurantForStaff, skipAuthorization: true });
  },

  publishSchedule: async (_, { input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, SCHEDULE_WRITE_ROLES);
    const restaurantId = toObjectId(input.restaurantId);
    const actorUserId = toObjectId(ctx?.user?.id || ctx?.user?._id);
    const periodStart = toStartOfDay(input.periodStart);
    const periodEnd = toEndOfDay(input.periodEnd);

    if (!restaurantId) throw new Error("restaurantId không hợp lệ.");
    if (!actorUserId) throw new Error("Unauthorized.");
    await requireRestaurantAccess(ctx, restaurantId);
    const shiftCount = await Shift.countDocuments({
      restaurantId,
      startTime: { $gte: periodStart, $lte: periodEnd },
      status: { $ne: "cancelled" },
    });
    if (shiftCount <= 0) {
      throw new Error(
        "Không thể công bố lịch rỗng. Cần có ít nhất 1 ca làm trong tuần.",
      );
    }

    const publishValidation = await validateScheduleBeforePublish({
      restaurantId,
      periodStart,
      periodEnd,
    });
    if (hasBlockingSchedulePublishIssues(publishValidation)) {
      const first = publishValidation.issues.find(
        (issue) => issue.severity === "error",
      );
      throw new Error(
        first?.message || "Không thể công bố lịch vì còn lỗi blocking.",
      );
    }

    const existingPublication = await SchedulePublication.findOne({
      restaurantId,
      periodStart,
      periodEnd,
    }).lean();
    const currentStatus = existingPublication
      ? resolveScheduleLifecycleStatus({
          publication: existingPublication,
          periodStart,
          periodEnd,
        })
      : "draft";
    const isRepublish = currentStatus === "revision_draft";

    if (["published", "active", "locked", "closed"].includes(currentStatus)) {
      throw new Error("Không thể công bố lịch ở trạng thái hiện tại.");
    }

    const notificationType = isRepublish
      ? "schedule_updated"
      : "schedule_published";
    const notificationTitle = isRepublish
      ? "Lịch làm việc đã được cập nhật"
      : "Lịch làm việc đã được công bố";
    const notificationMessage = isRepublish
      ? "Lịch làm việc đã được cập nhật sau khi chỉnh sửa. Vui lòng kiểm tra lại ca làm của bạn."
      : "Lịch làm việc mới đã được công bố. Vui lòng kiểm tra ca làm của bạn.";

    const publishAt = new Date();
    const publication = await SchedulePublication.findOneAndUpdate(
      {
        restaurantId,
        periodStart,
        periodEnd,
      },
      {
        $set: {
          restaurantId,
          periodStart,
          periodEnd,
          status: "published",
          publishedAt: publishAt,
          publishedBy: actorUserId,
          lastChangedAt: new Date(),
        },
      },
      { new: true, upsert: true },
    );

    await AvailabilityRegistrationWindow.updateOne(
      {
        restaurantId,
        periodStart,
        periodEnd,
        status: { $in: ["closed", "open"] },
      },
      {
        $set: {
          status: "used_for_schedule",
          usedForScheduleAt: publishAt,
          usedForScheduleBy: actorUserId,
        },
      },
    );

    const shifts = await Shift.find({
      restaurantId,
      startTime: { $gte: periodStart, $lte: periodEnd },
      status: { $ne: "cancelled" },
    }).lean();

    const employeeIds = [
      ...new Set(
        shifts.map((shift) => String(shift.employeeId)).filter(Boolean),
      ),
    ];

    const kitchenRosterSyncResult =
      await syncKitchenShiftRosterSnapshotsForPublication({
        restaurantId,
        publication,
        periodStart,
        periodEnd,
        shifts,
        actorUserId,
        source: isRepublish ? "schedule_republish" : "schedule_publish",
      });

    await Promise.all(
      shifts.map((shift) =>
        ensureShiftAcknowledgement({
          shift,
          publication,
          actorUserId,
          createdFrom: isRepublish ? "published_change" : "publish",
          deadlineAt: buildAcknowledgementDeadline(publishAt),
        }),
      ),
    );

    if (employeeIds.length) {
      await Notification.insertMany(
        employeeIds.map((employeeId) => ({
          toUserId: employeeId,
          restaurantId,
          type: notificationType,
          payload: {
            periodStart,
            periodEnd,
            publicationId: String(publication._id),
            isRepublish,
            title: notificationTitle,
            message: notificationMessage,
          },
          readAt: null,
        })),
      );
    }

    await EventLog.create({
      restaurantId,
      actorUserId,
      verb: isRepublish ? "schedule.republish" : "schedule.publish",
      object: {
        kind: "SchedulePublication",
        id: publication._id,
        code: `${periodStart.toISOString().slice(0, 10)}_${periodEnd
          .toISOString()
          .slice(0, 10)}`,
      },
      source: "schedule-management",
      status: "success",
      meta: {
        periodStart,
        periodEnd,
        previousStatus: currentStatus,
        nextStatus: "published",
        isRepublish,
        affectedEmployees: employeeIds.length,
        affectedShifts: shifts.length,
        kitchenRosterSynced: true,
        kitchenRosterCreatedCount: kitchenRosterSyncResult.createdCount,
        kitchenRosterSupersededCount: kitchenRosterSyncResult.supersededCount,
      },
      at: new Date(),
    });

    return mapSchedulePublicationOutput(publication);
  },
  lockSchedule: async (_, { input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, SCHEDULE_WRITE_ROLES);
    const restaurantId = toObjectId(input.restaurantId);
    const actorUserId = getActorUserId(ctx);
    const reason = String(input.reason || "").trim();
    if (!restaurantId) throw new Error("restaurantId không hợp lệ.");
    if (!actorUserId) throw new Error("Unauthorized.");
    await requireRestaurantAccess(ctx, restaurantId);
    if (!reason) throw new Error("Cần nhập lý do khóa lịch.");
    const periodStart = toStartOfDay(input.periodStart);
    const periodEnd = toEndOfDay(input.periodEnd);

    const publishAt = new Date();
    const publication = await SchedulePublication.findOneAndUpdate(
      { restaurantId, periodStart, periodEnd },
      {
        $set: {
          restaurantId,
          periodStart,
          periodEnd,
          status: "locked",
          lockedAt: new Date(),
          lockedBy: actorUserId,
          lockReason: reason,
          lastChangedAt: new Date(),
        },
        $setOnInsert: { publishedAt: null },
      },
      { new: true, upsert: true },
    );
    await EventLog.create({
      restaurantId,
      actorUserId,
      verb: "schedule.lock",
      object: {
        kind: "SchedulePublication",
        id: publication._id,
        code: `${periodStart.toISOString().slice(0, 10)}_${periodEnd.toISOString().slice(0, 10)}`,
      },
      source: "schedule-management",
      status: "success",
      meta: { reason, periodStart, periodEnd },
      at: new Date(),
    });
    return mapSchedulePublicationOutput(publication);
  },

  reopenSchedule: async (_, { input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, SCHEDULE_WRITE_ROLES);
    const restaurantId = toObjectId(input.restaurantId);
    const actorUserId = getActorUserId(ctx);
    const reason = String(input.reason || "").trim();
    if (!restaurantId) throw new Error("restaurantId không hợp lệ.");
    if (!actorUserId) throw new Error("Unauthorized.");
    await requireRestaurantAccess(ctx, restaurantId);
    if (!reason) throw new Error("Cần nhập lý do mở lại lịch để chỉnh sửa.");
    const periodStart = toStartOfDay(input.periodStart);
    const periodEnd = toEndOfDay(input.periodEnd);
    const publication = await SchedulePublication.findOne({
      restaurantId,
      periodStart,
      periodEnd,
    });
    if (!publication)
      throw new Error("Không tìm thấy lịch đã công bố để mở lại.");
    const effectiveStatus = resolveScheduleLifecycleStatus({
      publication,
      periodStart: publication.periodStart,
      periodEnd: publication.periodEnd,
    });
    if (effectiveStatus !== "published")
      throw new Error("Chỉ có thể mở lại lịch đang ở trạng thái đã công bố.");
    publication.status = "revision_draft";
    publication.reopenedAt = new Date();
    publication.reopenedBy = actorUserId;
    publication.reopenReason = reason;
    publication.reopenCount = Number(publication.reopenCount || 0) + 1;
    publication.lastChangedAt = new Date();
    await publication.save();
    await EventLog.create({
      restaurantId,
      actorUserId,
      verb: "schedule.reopen",
      object: {
        kind: "SchedulePublication",
        id: publication._id,
        code: `${periodStart.toISOString().slice(0, 10)}_${periodEnd.toISOString().slice(0, 10)}`,
      },
      source: "schedule-management",
      status: "success",
      meta: {
        reason,
        periodStart,
        periodEnd,
        previousStatus: effectiveStatus,
        nextStatus: "revision_draft",
      },
      diff: {
        before: { status: effectiveStatus },
        after: { status: "revision_draft" },
      },
      at: new Date(),
    });
    return mapSchedulePublicationOutput(publication);
  },
  closeSchedule: async (_, { input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, SCHEDULE_WRITE_ROLES);
    const restaurantId = toObjectId(input.restaurantId);
    const actorUserId = getActorUserId(ctx);
    const reason = String(input.reason || "").trim();
    if (!restaurantId) throw new Error("restaurantId không hợp lệ.");
    if (!actorUserId) throw new Error("Unauthorized.");
    await requireRestaurantAccess(ctx, restaurantId);
    if (!reason) throw new Error("Cần nhập lý do đóng lịch.");
    const periodStart = toStartOfDay(input.periodStart);
    const periodEnd = toEndOfDay(input.periodEnd);

    const publishAt = new Date();
    const publication = await SchedulePublication.findOneAndUpdate(
      { restaurantId, periodStart, periodEnd },
      {
        $set: {
          restaurantId,
          periodStart,
          periodEnd,
          status: "closed",
          closedAt: new Date(),
          closedBy: actorUserId,
          closeReason: reason,
          lastChangedAt: new Date(),
        },
      },
      { new: true, upsert: true },
    );
    await EventLog.create({
      restaurantId,
      actorUserId,
      verb: "schedule.close",
      object: {
        kind: "SchedulePublication",
        id: publication._id,
        code: `${periodStart.toISOString().slice(0, 10)}_${periodEnd.toISOString().slice(0, 10)}`,
      },
      source: "schedule-management",
      status: "success",
      meta: { reason, periodStart, periodEnd },
      at: new Date(),
    });
    return mapSchedulePublicationOutput(publication);
  },
  previewAutoSchedule: async (_, { input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, SCHEDULE_WRITE_ROLES);
    const restaurantId = toObjectId(input.restaurantId);
    if (!restaurantId) throw new Error("restaurantId không hợp lệ.");
    await requireRestaurantAccess(ctx, restaurantId);
    return buildAutoSchedulePreviewBackend(input, ctx);
  },
  applyAutoSchedule: async (_, { input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, SCHEDULE_WRITE_ROLES);
    const restaurantId = toObjectId(input.restaurantId);
    if (!restaurantId) throw new Error("restaurantId không hợp lệ.");
    await requireRestaurantAccess(ctx, restaurantId);
    await assertAutoSchedulePeriodCanEdit({
      restaurantId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    });
    const rows = await buildAutoScheduleCreateInputs(input, ctx);
    if (!rows.length) {
      return { successCount: 0, failedCount: 0, shifts: [], errors: [] };
    }
    return mutationResolvers.createStaffShifts(_, { inputs: rows }, ctx);
  },
  createStaffShift: async (_, { input }, ctx) => {
    const shift = await createStaffShiftInternal(input, ctx);
    return mapStaffScheduleShiftOutput(shift);
  },
  createStaffShifts: async (_, { inputs }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, SCHEDULE_WRITE_ROLES);

    const rows = Array.isArray(inputs) ? inputs : [];

    if (!rows.length) {
      throw new Error("Cần chọn ít nhất một nhân viên để tạo ca.");
    }

    const seenKeys = new Set();
    const normalizedInputs = [];

    rows.forEach((input, index) => {
      const key = [
        String(input?.employeeId || ""),
        String(input?.restaurantId || ""),
        String(input?.shiftType || ""),
        String(input?.startTime || ""),
        String(input?.endTime || ""),
      ].join("|");

      if (!input?.employeeId || !input?.restaurantId) {
        normalizedInputs.push({ input, index, duplicate: false });
        return;
      }

      if (seenKeys.has(key)) {
        normalizedInputs.push({ input, index, duplicate: true });
        return;
      }

      seenKeys.add(key);
      normalizedInputs.push({ input, index, duplicate: false });
    });

    const shifts = [];
    const errors = [];

    for (const row of normalizedInputs) {
      const { input, index, duplicate } = row;

      if (duplicate) {
        errors.push({
          index,
          employeeId: input?.employeeId || null,
          message: "Nhân viên này đã được chọn trùng trong cùng ca.",
          code: "DUPLICATE_BATCH_EMPLOYEE",
        });
        continue;
      }

      try {
        const createdShift = await createStaffShiftInternal(input, ctx);
        shifts.push(createdShift);
      } catch (error) {
        errors.push({
          index,
          employeeId: input?.employeeId || null,
          message: getBatchErrorMessage(error),
          code: getBatchErrorCode(error),
        });
      }
    }

    return {
      successCount: shifts.length,
      failedCount: errors.length,
      shifts,
      errors,
    };
  },
  updateStaffShift: async (_, { shiftId, input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, SCHEDULE_WRITE_ROLES);
    const oldShift = await Shift.findById(shiftId)
      .select({
        restaurantId: 1,
        employeeId: 1,
        startTime: 1,
        endTime: 1,
        shiftType: 1,
        status: 1,
      })
      .lean();
    if (!oldShift) throw new Error("Shift not found");
    await requireRestaurantAccess(ctx, oldShift.restaurantId);
    if (oldShift) {
      const publication = await getPublishedScheduleForShift({
        restaurantId: oldShift.restaurantId,
        shiftTime: new Date(oldShift.startTime),
      });

      if (publication) {
        const effectiveStatus = resolveScheduleLifecycleStatus({
          publication,
          periodStart: publication.periodStart,
          periodEnd: publication.periodEnd,
        });
        if (effectiveStatus !== "draft") {
          throw new Error(
            "Không thể sửa ca trực tiếp khi lịch không còn ở trạng thái bản nháp.",
          );
        }
      }
    }
    await assertNoLockedPayrollPeriodOverlap({
      restaurantId: oldShift.restaurantId,
      employeeId: oldShift.employeeId,
      startDate: oldShift.startTime,
      endDate: oldShift.endTime,
      action: "shift",
    });
    const payload = { ...input };
    if (payload.shiftType)
      payload.shiftType = payload.shiftType.toString().toLowerCase();
    if (payload.startTime) payload.startTime = new Date(payload.startTime);
    if (payload.endTime) payload.endTime = new Date(payload.endTime);
    if (Object.prototype.hasOwnProperty.call(payload, "restaurantId")) {
      delete payload.restaurantId;
    }
    if (
      payload.employeeId &&
      String(payload.employeeId) !== String(oldShift.employeeId)
    ) {
      await loadStaffForRestaurant(payload.employeeId, oldShift.restaurantId);
    }
    const nextStartTime = payload.startTime || oldShift.startTime;
    const nextEndTime = payload.endTime || oldShift.endTime;
    const nextRestaurantId = oldShift.restaurantId;
    const nextEmployeeId = payload.employeeId || oldShift.employeeId;

    await assertShiftAssignmentValid({
      input: {
        employeeId: nextEmployeeId,
        restaurantId: nextRestaurantId,
        shiftType: payload.shiftType || oldShift.shiftType,
        startTime: nextStartTime,
        endTime: nextEndTime,
        ignoreShiftId: shiftId,
        allowOverride: input.allowOverride,
        overrideReason: input.overrideReason,
      },
      ctx,
    });
    const updated = await Shift.findByIdAndUpdate(shiftId, payload, {
      new: true,
    }).populate("employeeId", "fullName");
    if (!updated) throw new Error("Shift not found");

    return {
      id: String(updated._id),
      employeeId: String(updated.employeeId?._id || updated.employeeId),
      employeeName: updated.employeeId?.fullName || null,
      restaurantId: String(updated.restaurantId),
      shiftType: updated.shiftType,
      startTime: updated.startTime,
      endTime: updated.endTime,
      status: updated.status || "scheduled",
      notes: updated.notes || "",
    };
  },
  changePublishedShiftGroupTime: async (_, { input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, SCHEDULE_WRITE_ROLES);
    const restaurantId = toObjectId(input.restaurantId);
    const actorUserId = getActorUserId(ctx);

    if (!restaurantId) {
      throw new Error("restaurantId không hợp lệ.");
    }

    if (!actorUserId) {
      throw new Error("Unauthorized.");
    }
    await requireRestaurantAccess(ctx, restaurantId);

    const reason = String(input.reason || "").trim();
    const overrideReason = String(input.overrideReason || reason || "").trim();

    if (!reason) {
      throw new Error("Cần nhập lý do khi thay đổi giờ ca đã công bố.");
    }

    const shiftIds = (input.shiftIds || []).map(toObjectId).filter(Boolean);

    if (!shiftIds.length) {
      throw new Error("Không có ca cần cập nhật.");
    }

    const newStartTime = toValidDateTime(input.startTime, "Giờ bắt đầu mới");
    const newEndTime = toValidDateTime(input.endTime, "Giờ kết thúc mới");

    if (newEndTime <= newStartTime) {
      throw new Error("Giờ kết thúc mới phải lớn hơn giờ bắt đầu mới.");
    }

    const shifts = await Shift.find({
      _id: { $in: shiftIds },
      restaurantId,
      status: { $ne: "cancelled" },
    }).lean();

    if (shifts.length !== shiftIds.length) {
      throw new Error(
        "Một số phân công ca không tồn tại hoặc không thuộc nhà hàng hiện tại.",
      );
    }

    const firstShift = shifts[0];
    const shiftType = String(firstShift.shiftType || "").toLowerCase();

    const hasDifferentShiftType = shifts.some(
      (shift) => String(shift.shiftType || "").toLowerCase() !== shiftType,
    );

    if (hasDifferentShiftType) {
      throw new Error(
        "Chỉ được đổi giờ cho các phân công thuộc cùng một loại ca.",
      );
    }

    const { oldStartTime, oldEndTime } = getShiftGroupRange(shifts);
    const now = new Date();

    if (now >= oldStartTime) {
      throw new Error(
        "Ca đã bắt đầu hoặc đã kết thúc, không thể sửa giờ trực tiếp. Vui lòng dùng quy trình điều chỉnh chấm công.",
      );
    }

    if (newStartTime <= now) {
      throw new Error("Giờ bắt đầu mới phải nằm trong tương lai.");
    }

    const publication = await getPublishedScheduleForShift({
      restaurantId,
      shiftTime: oldStartTime,
    });

    if (!publication) {
      throw new Error(
        "Không tìm thấy kỳ lịch đã công bố chứa ca này. Vui lòng kiểm tra trạng thái publish của lịch.",
      );
    }
    assertPublishedScheduleCanChange(publication);

    const timesheet = await Timesheet.findOne({
      shiftId: { $in: shiftIds },
      $or: [
        { actualCheckInAt: { $ne: null } },
        { actualCheckOutAt: { $ne: null } },
        { approved: true },
      ],
    }).lean();

    if (timesheet) {
      throw new Error(
        "Ca đã phát sinh chấm công hoặc đã được duyệt công, không thể sửa giờ từ lịch làm việc.",
      );
    }

    const validationWarnings = [];

    for (const shift of shifts) {
      await assertNoLockedPayrollPeriodOverlap({
        restaurantId,
        employeeId: shift.employeeId,
        startDate: oldStartTime,
        endDate: oldEndTime,
        action: "change_published_shift_time",
      });

      const validation = await validateShiftAssignment({
        input: {
          employeeId: shift.employeeId,
          restaurantId,
          shiftType: String(shift.shiftType || "").toUpperCase(),
          startTime: newStartTime,
          endTime: newEndTime,
          ignoreShiftId: shift._id,
          allowOverride: Boolean(input.allowOverride),
          overrideReason,
        },
        ctx,
      });

      if (!validation.ok) {
        const firstError = validation.blockingErrors?.[0];

        throw new Error(
          firstError?.message ||
            "Không thể đổi giờ ca vì có nhân viên vi phạm policy.",
        );
      }

      if (validation.warnings?.length) {
        validationWarnings.push({
          employeeId: String(shift.employeeId),
          warnings: validation.warnings,
        });
      }
    }

    if (validationWarnings.length > 0 && !input.allowOverride) {
      const firstWarning = validationWarnings[0]?.warnings?.[0];

      throw new Error(
        firstWarning?.message
          ? `Có cảnh báo policy: ${firstWarning.message}. Cần override có lý do để tiếp tục.`
          : "Có cảnh báo policy khi đổi giờ ca. Cần override có lý do để tiếp tục.",
      );
    }

    await Shift.updateMany(
      {
        _id: { $in: shiftIds },
        restaurantId,
        status: { $ne: "cancelled" },
      },
      {
        $set: {
          startTime: newStartTime,
          endTime: newEndTime,
        },
      },
    );

    const employeeIds = [
      ...new Set(
        shifts.map((shift) => String(shift.employeeId)).filter(Boolean),
      ),
    ];

    await markScheduleAcknowledgementsNeedReview({
      restaurantId,
      publicationId: publication._id,
      employeeIds,
    });

    if (input.notifyEmployees !== false && employeeIds.length > 0) {
      await Notification.insertMany(
        employeeIds.map((employeeId) => ({
          toUserId: employeeId,
          restaurantId,
          type: "shift_time_changed",
          payload: {
            title: "Ca làm của bạn đã được thay đổi giờ",
            message: buildShiftTimeChangedMessage({
              shiftType,
              oldStartTime,
              oldEndTime,
              newStartTime,
              newEndTime,
              reason,
            }),
            shiftType,
            oldStartTime,
            oldEndTime,
            newStartTime,
            newEndTime,
            reason,
            publicationId: String(publication._id),
            actorUserId: String(actorUserId),
            affectedShiftIds: shifts.map((shift) => String(shift._id)),
          },
          readAt: null,
        })),
      );

      if (ctx?.io) {
        employeeIds.forEach((employeeId) => {
          ctx.io.to(`user_${employeeId}`).emit("notificationCreated", {
            type: "shift_time_changed",
            restaurantId: String(restaurantId),
            message: "Ca làm của bạn đã được thay đổi giờ.",
          });
        });
      }
    }

    await EventLog.create({
      restaurantId,
      actorUserId,
      verb: "schedule.published_shift_time_change",
      object: {
        kind: "ShiftGroup",
        id: shifts[0]._id,
        code: `${shiftType}_${oldStartTime.toISOString()}`,
      },
      source: "schedule-management",
      status: "success",
      meta: {
        reason,
        overrideReason: input.allowOverride ? overrideReason : null,
        allowOverride: Boolean(input.allowOverride),
        notifyEmployees: input.notifyEmployees !== false,
        publicationId: String(publication._id),
        affectedShiftIds: shifts.map((shift) => String(shift._id)),
        affectedEmployeeIds: employeeIds,
        validationWarnings,
      },
      diff: {
        before: {
          startTime: oldStartTime,
          endTime: oldEndTime,
        },
        after: {
          startTime: newStartTime,
          endTime: newEndTime,
        },
      },
      at: new Date(),
    });

    await SchedulePublication.updateOne(
      { _id: publication._id },
      {
        $set: {
          lastChangedAt: new Date(),
        },
      },
    );

    return true;
  },
  deleteStaffShift: async (
    _,
    { shiftId, reason = "", notifyEmployee = true },
    ctx,
  ) => {
    requireAuth(ctx);
    requireRoles(ctx, SCHEDULE_WRITE_ROLES);
    const shift = await Shift.findById(shiftId).populate(
      "employeeId",
      "fullName employeeCode email",
    );

    if (!shift) {
      throw new Error("Shift not found");
    }
    await requireRestaurantAccess(ctx, shift.restaurantId);

    const actorUserId = getActorUserId(ctx);
    if (!actorUserId) throw new Error("Unauthorized.");

    const employeeId = shift.employeeId?._id || shift.employeeId;
    const employeeName =
      shift.employeeId?.fullName ||
      shift.employeeId?.employeeCode ||
      "Nhân viên";

    const startTime = new Date(shift.startTime);
    const endTime = new Date(shift.endTime);
    const safeReason = String(reason || "").trim();

    const publication = await getPublishedScheduleForShift({
      restaurantId: shift.restaurantId,
      shiftTime: startTime,
    });

    if (publication && !safeReason) {
      throw new Error("Cần nhập lý do khi xóa nhân viên khỏi lịch đã công bố.");
    }

    await assertShiftGroupNotStartedOrCheckedIn({
      shiftIds: [shift._id],
      oldStartTime: startTime,
    });

    await assertNoLockedPayrollPeriodOverlap({
      restaurantId: shift.restaurantId,
      employeeId,
      startDate: startTime,
      endDate: endTime,
      action: "remove_staff_from_published_shift",
    });

    await Shift.deleteOne({ _id: shift._id });

    if (publication?._id && employeeId) {
      await markScheduleAcknowledgementsNeedReview({
        restaurantId: shift.restaurantId,
        publicationId: publication._id,
        employeeIds: [employeeId],
      });
    }

    if (notifyEmployee && employeeId) {
      await Notification.create({
        toUserId: employeeId,
        restaurantId: shift.restaurantId,
        type: "shift_removed",
        payload: {
          title: "Bạn đã được gỡ khỏi một ca làm",
          message: buildShiftRemovedMessage({
            shiftType: shift.shiftType,
            startTime,
            endTime,
            reason: safeReason,
          }),
          shiftId: String(shift._id),
          shiftType: shift.shiftType,
          startTime,
          endTime,
          reason: safeReason || null,
          publicationId: publication?._id ? String(publication._id) : null,
          actorUserId: String(actorUserId),
        },
        readAt: null,
      });

      if (ctx?.io) {
        ctx.io.to(`user_${String(employeeId)}`).emit("notificationCreated", {
          type: "shift_removed",
          restaurantId: String(shift.restaurantId),
          message: "Bạn đã được gỡ khỏi một ca làm.",
        });
      }
    }

    await EventLog.create({
      restaurantId: shift.restaurantId,
      actorUserId,
      verb: publication
        ? "schedule.published_shift_remove_employee"
        : "schedule.shift_remove_employee",
      object: {
        kind: "Shift",
        id: shift._id,
        code: String(employeeId),
      },
      source: "schedule-management",
      status: "success",
      meta: {
        reason: safeReason || null,
        publicationId: publication?._id ? String(publication._id) : null,
        employeeId: String(employeeId),
        employeeName,
        notifyEmployee,
      },
      diff: {
        before: {
          employeeId: String(employeeId),
          restaurantId: String(shift.restaurantId),
          shiftType: shift.shiftType,
          startTime,
          endTime,
          status: shift.status,
        },
        after: null,
      },
      at: new Date(),
    });

    if (publication?._id) {
      await SchedulePublication.updateOne(
        { _id: publication._id },
        { $set: { lastChangedAt: new Date() } },
      );
    }

    return true;
  },
  deletePublishedShiftGroup: async (_, { input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, SCHEDULE_WRITE_ROLES);
    const restaurantId = toObjectId(input.restaurantId);
    const actorUserId = getActorUserId(ctx);

    if (!restaurantId) throw new Error("restaurantId không hợp lệ.");
    if (!actorUserId) throw new Error("Unauthorized.");
    await requireRestaurantAccess(ctx, restaurantId);

    const reason = String(input.reason || "").trim();
    if (!reason) {
      throw new Error("Cần nhập lý do khi xóa ca đã công bố.");
    }

    const shiftIds = (input.shiftIds || []).map(toObjectId).filter(Boolean);
    if (!shiftIds.length) {
      throw new Error("Không có phân công ca cần xóa.");
    }

    const shifts = await Shift.find({
      _id: { $in: shiftIds },
      restaurantId,
      status: { $ne: "cancelled" },
    }).lean();

    if (shifts.length !== shiftIds.length) {
      throw new Error(
        "Một số phân công ca không tồn tại hoặc không thuộc nhà hàng hiện tại.",
      );
    }

    const firstShift = shifts[0];
    const shiftType = String(firstShift.shiftType || "").toLowerCase();
    const { oldStartTime, oldEndTime } = getShiftGroupRange(shifts);

    const publication = await getPublishedScheduleForShift({
      restaurantId,
      shiftTime: oldStartTime,
    });

    if (!publication) {
      throw new Error(
        "Không tìm thấy kỳ lịch đã công bố chứa ca này. Vui lòng kiểm tra trạng thái publish.",
      );
    }
    assertPublishedScheduleCanChange(publication);

    await assertShiftGroupNotStartedOrCheckedIn({
      shiftIds,
      oldStartTime,
    });

    for (const shift of shifts) {
      await assertNoLockedPayrollPeriodOverlap({
        restaurantId,
        employeeId: shift.employeeId,
        startDate: oldStartTime,
        endDate: oldEndTime,
        action: "delete_published_shift_group",
      });
    }

    await Shift.deleteMany({
      _id: { $in: shiftIds },
      restaurantId,
    });

    const employeeIds = [
      ...new Set(
        shifts.map((shift) => String(shift.employeeId)).filter(Boolean),
      ),
    ];

    await markScheduleAcknowledgementsNeedReview({
      restaurantId,
      publicationId: publication._id,
      employeeIds,
    });

    if (input.notifyEmployees !== false && employeeIds.length > 0) {
      await Notification.insertMany(
        employeeIds.map((employeeId) => ({
          toUserId: employeeId,
          restaurantId,
          type: "shift_group_deleted",
          payload: {
            title: "Một ca làm đã bị hủy",
            message: `Ca ${shiftType} từ ${formatShiftTimeVi(
              oldStartTime,
            )} đến ${formatShiftTimeVi(oldEndTime)} đã bị hủy. Lý do: ${reason}`,
            shiftType,
            startTime: oldStartTime,
            endTime: oldEndTime,
            reason,
            publicationId: String(publication._id),
            actorUserId: String(actorUserId),
            affectedShiftIds: shifts.map((shift) => String(shift._id)),
          },
          readAt: null,
        })),
      );

      if (ctx?.io) {
        employeeIds.forEach((employeeId) => {
          ctx.io.to(`user_${employeeId}`).emit("notificationCreated", {
            type: "shift_group_deleted",
            restaurantId: String(restaurantId),
            message: "Một ca làm của bạn đã bị hủy.",
          });
        });
      }
    }

    await EventLog.create({
      restaurantId,
      actorUserId,
      verb: "schedule.published_shift_group_delete",
      object: {
        kind: "ShiftGroup",
        id: shifts[0]._id,
        code: `${shiftType}_${oldStartTime.toISOString()}`,
      },
      source: "schedule-management",
      status: "success",
      meta: {
        reason,
        publicationId: String(publication._id),
        notifyEmployees: input.notifyEmployees !== false,
        affectedShiftIds: shifts.map((shift) => String(shift._id)),
        affectedEmployeeIds: employeeIds,
      },
      diff: {
        before: shifts.map((shift) => ({
          id: String(shift._id),
          employeeId: String(shift.employeeId),
          shiftType: shift.shiftType,
          startTime: shift.startTime,
          endTime: shift.endTime,
          status: shift.status,
        })),
        after: null,
      },
      at: new Date(),
    });

    await SchedulePublication.updateOne(
      { _id: publication._id },
      { $set: { lastChangedAt: new Date() } },
    );

    return true;
  },
  addStaffToPublishedShiftGroup: async (_, { input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, SCHEDULE_WRITE_ROLES);
    const restaurantId = toObjectId(input.restaurantId);
    const employeeId = toObjectId(input.employeeId);
    const actorUserId = getActorUserId(ctx);

    if (!restaurantId) throw new Error("restaurantId không hợp lệ.");
    if (!employeeId) throw new Error("employeeId không hợp lệ.");
    if (!actorUserId) throw new Error("Unauthorized.");
    await requireRestaurantAccess(ctx, restaurantId);

    const reason = String(input.reason || "").trim();
    const overrideReason = String(input.overrideReason || reason || "").trim();

    if (!reason) {
      throw new Error("Cần nhập lý do khi thêm nhân viên vào lịch đã công bố.");
    }

    const startTime = toValidDateTime(input.startTime, "Giờ bắt đầu");
    const endTime = toValidDateTime(input.endTime, "Giờ kết thúc");

    if (endTime <= startTime) {
      throw new Error("Giờ kết thúc phải lớn hơn giờ bắt đầu.");
    }

    if (startTime <= new Date()) {
      throw new Error("Không thể thêm nhân viên vào ca đã bắt đầu.");
    }

    const publication = await getPublishedScheduleForShift({
      restaurantId,
      shiftTime: startTime,
    });

    if (!publication) {
      throw new Error(
        "Không tìm thấy kỳ lịch đã công bố chứa ca này. Vui lòng kiểm tra trạng thái publish.",
      );
    }
    assertPublishedScheduleCanChange(publication);

    const staff = await loadStaffForRestaurant(employeeId, restaurantId);

    await assertNoLockedPayrollPeriodOverlap({
      restaurantId,
      employeeId,
      startDate: startTime,
      endDate: endTime,
      action: "add_staff_to_published_shift",
    });

    const validation = await validateShiftAssignment({
      input: {
        employeeId,
        restaurantId,
        shiftType: String(input.shiftType || "").toUpperCase(),
        startTime,
        endTime,
        allowOverride: Boolean(input.allowOverride),
        overrideReason,
      },
      ctx,
    });

    if (!validation.ok) {
      const firstError = validation.blockingErrors?.[0];
      throw new Error(
        firstError?.message ||
          "Không thể thêm nhân viên vì vi phạm policy xếp lịch.",
      );
    }

    if (validation.warnings?.length && !input.allowOverride) {
      const firstWarning = validation.warnings[0];
      throw new Error(
        firstWarning?.message
          ? `Có cảnh báo policy: ${firstWarning.message}. Cần override có lý do để tiếp tục.`
          : "Có cảnh báo policy khi thêm nhân viên. Cần override có lý do để tiếp tục.",
      );
    }

    const existingGroupCount = await Shift.countDocuments({
      restaurantId,
      shiftType: String(input.shiftType || "").toLowerCase(),
      startTime,
      endTime,
      status: { $ne: "cancelled" },
    });
    if (existingGroupCount <= 0) {
      throw new Error(
        "Lịch đã công bố. Không thể tạo ca mới từ khung trống. Chỉ được thêm nhân viên vào ca đã tồn tại.",
      );
    }

    const shift = await Shift.create({
      employeeId,
      restaurantId,
      shiftType: String(input.shiftType || "").toLowerCase(),
      startTime,
      endTime,
      status: "scheduled",
      notes: `Thêm sau khi lịch đã công bố. Lý do: ${reason}`,
    });

    await markScheduleAcknowledgementsNeedReview({
      restaurantId,
      publicationId: publication._id,
      employeeIds: [employeeId],
    });

    await ensureShiftAcknowledgement({
      shift,
      publication,
      actorUserId,
      createdFrom: "manager_assign",
      deadlineAt: buildAcknowledgementDeadline(new Date()),
    });

    if (input.notifyEmployee !== false) {
      await Notification.create({
        toUserId: employeeId,
        restaurantId,
        type: "shift_added",
        payload: {
          title: "Bạn đã được thêm vào một ca làm",
          message: buildShiftAddedMessage({
            shiftType: shift.shiftType,
            startTime,
            endTime,
            reason,
          }),
          shiftId: String(shift._id),
          shiftType: shift.shiftType,
          startTime,
          endTime,
          reason,
          publicationId: String(publication._id),
          actorUserId: String(actorUserId),
        },
        readAt: null,
      });

      if (ctx?.io) {
        ctx.io.to(`user_${String(employeeId)}`).emit("notificationCreated", {
          type: "shift_added",
          restaurantId: String(restaurantId),
          message: "Bạn đã được thêm vào một ca làm.",
        });
      }
    }

    await EventLog.create({
      restaurantId,
      actorUserId,
      verb: "schedule.published_shift_add_employee",
      object: {
        kind: "Shift",
        id: shift._id,
        code: `${shift.shiftType}_${startTime.toISOString()}`,
      },
      source: "schedule-management",
      status: "success",
      meta: {
        reason,
        overrideReason: input.allowOverride ? overrideReason : null,
        allowOverride: Boolean(input.allowOverride),
        notifyEmployee: input.notifyEmployee !== false,
        publicationId: String(publication._id),
        employeeId: String(employeeId),
        employeeName: staff.fullName || staff.employeeCode || null,
        validationWarnings: validation.warnings || [],
      },
      diff: {
        before: null,
        after: {
          employeeId: String(employeeId),
          restaurantId: String(restaurantId),
          shiftType: shift.shiftType,
          startTime,
          endTime,
          status: shift.status,
        },
      },
      at: new Date(),
    });

    await SchedulePublication.updateOne(
      { _id: publication._id },
      { $set: { lastChangedAt: new Date() } },
    );

    return mapStaffScheduleShiftOutput(shift, staff);
  },

  acceptShiftAcknowledgement: async (_, { id, note }, ctx) => {
    const employeeId = toObjectId(ctx?.user?.id || ctx?.user?._id);
    if (!employeeId) throw new Error("UNAUTHENTICATED");
    const doc = await ShiftAcknowledgement.findById(id);
    assertAcknowledgementCanRespond(doc, employeeId);
    doc.status = "accepted";
    doc.reason = String(note || "");
    doc.respondedAt = new Date();
    await doc.save();
    return doc;
  },
  declineShiftAcknowledgement: async (
    _,
    { id, reasonCategory, reason },
    ctx,
  ) => {
    const employeeId = toObjectId(ctx?.user?.id || ctx?.user?._id);
    if (!employeeId) throw new Error("UNAUTHENTICATED");
    const normalizedReason = String(reason || "").trim();
    if (!normalizedReason)
      throw new Error("SHIFT_ACKNOWLEDGEMENT_DECLINE_REASON_REQUIRED");
    const doc = await ShiftAcknowledgement.findById(id);
    assertAcknowledgementCanRespond(doc, employeeId);
    const now = new Date();
    doc.status = "declined";
    doc.reasonCategory = reasonCategory || "other";
    doc.reason = normalizedReason;
    doc.respondedAt = now;
    doc.declineClassification =
      now > new Date(doc.deadlineAt) ? "late" : "unknown";
    await doc.save();
    // ScheduleIncident backend flow is tracked in docs/schedule-incident-roadmap.md;
    // current resolver keeps shift acknowledgement state + EventLog without creating incident records.
    return doc;
  },
  respondShiftAcknowledgement: async (_, { input }, ctx) => {
    const employeeId = toObjectId(ctx?.user?.id || ctx?.user?._id);
    if (!employeeId) throw new Error("UNAUTHENTICATED");
    const shiftId = toObjectId(input?.shiftId);
    if (!shiftId) throw new Error("SHIFT_ID_INVALID");
    const doc = await ShiftAcknowledgement.findOne({ shiftId, employeeId });
    assertAcknowledgementCanRespond(doc, employeeId);
    await assertShiftAcknowledgementPublicationActive(doc);
    const response = String(input?.response || "")
      .trim()
      .toLowerCase();
    if (response === "accept") {
      doc.status = "accepted";
      doc.reason = "";
      doc.reasonCategory = "no_reason";
      doc.respondedAt = new Date();
      doc.declineClassification = "unknown";
      await doc.save();
      return doc;
    }
    if (response === "decline") {
      const reason = String(input?.reason || "").trim();
      if (reason.length < 5)
        throw new Error("SHIFT_ACKNOWLEDGEMENT_DECLINE_REASON_REQUIRED");
      const reasonCategory = String(input?.reasonCategory || "")
        .trim()
        .toLowerCase();
      if (!reasonCategory || reasonCategory === "no_reason") {
        throw new Error(
          "SHIFT_ACKNOWLEDGEMENT_DECLINE_REASON_CATEGORY_REQUIRED",
        );
      }
      const now = new Date();
      doc.status = "declined";
      doc.reason = reason;
      doc.reasonCategory = reasonCategory;
      doc.respondedAt = now;
      doc.declineClassification =
        now > new Date(doc.deadlineAt) ? "late" : "unknown";
      await doc.save();
      return doc;
    }
    throw new Error("SHIFT_ACKNOWLEDGEMENT_RESPONSE_INVALID");
  },
  reviewShiftAcknowledgement: async (_, { input }, ctx) => {
    requireRoles(ctx, SHIFT_ACK_ADMIN_ROLES);
    const actorUserId = getActorUserId(ctx);
    const doc = await ShiftAcknowledgement.findById(input?.acknowledgementId);
    if (!doc) throw new Error("SHIFT_ACKNOWLEDGEMENT_NOT_FOUND");
    await requireRestaurantAccess(ctx, String(doc.restaurantId));
    if (doc.status !== "declined")
      throw new Error("SHIFT_ACKNOWLEDGEMENT_NOT_DECLINED");
    if (doc.declineClassification === "late") {
      throw new Error("SHIFT_ACKNOWLEDGEMENT_LATE_REVIEW_NOT_ALLOWED");
    }
    const classification = String(input?.classification || "")
      .trim()
      .toLowerCase();
    if (!["valid", "invalid"].includes(classification)) {
      throw new Error("SHIFT_ACKNOWLEDGEMENT_REVIEW_CLASSIFICATION_INVALID");
    }
    doc.declineClassification = classification;
    await doc.save();
    await EventLog.create({
      restaurantId: doc.restaurantId,
      actorUserId,
      verb: "schedule.shift_ack_decline_reviewed",
      object: {
        kind: "ShiftAcknowledgement",
        id: doc._id,
        code: String(doc.shiftId),
      },
      status: "success",
      source: "schedule-management",
      meta: { classification, reviewNote: String(input?.reviewNote || "") },
      at: new Date(),
    });
    return doc;
  },
  acknowledgeMySchedule: async (
    _,
    { restaurantId, periodStart, periodEnd },
    ctx,
  ) => {
    requireAuth(ctx);
    await requireRestaurantAccess(ctx, restaurantId);
    const employeeId = toObjectId(ctx?.user?.id || ctx?.user?._id);
    if (!employeeId) throw new Error("Unauthorized.");
    const publication = await SchedulePublication.findOne({
      restaurantId: toObjectId(restaurantId) || restaurantId,
      periodStart: toStartOfDay(periodStart),
      periodEnd: toEndOfDay(periodEnd),
      status: { $in: ["published", "active"] },
    });
    if (!publication)
      throw new Error("Lịch chưa được công bố nên không thể xác nhận.");
    const hasShift = await Shift.exists({
      restaurantId: publication.restaurantId,
      employeeId,
      startTime: { $gte: publication.periodStart, $lte: publication.periodEnd },
      status: { $ne: "cancelled" },
    });
    if (!hasShift) throw new Error("Bạn không có ca trong tuần này.");
    return ScheduleAcknowledgement.findOneAndUpdate(
      {
        restaurantId: publication.restaurantId,
        employeeId,
        schedulePublicationId: publication._id,
      },
      {
        $set: {
          periodStart: publication.periodStart,
          periodEnd: publication.periodEnd,
          status: "acknowledged",
          acknowledgedAt: new Date(),
          changedAfterAcknowledgement: false,
          lastChangedAt: publication.lastChangedAt || null,
        },
        $setOnInsert: {
          restaurantId: publication.restaurantId,
          employeeId,
          schedulePublicationId: publication._id,
        },
      },
      { upsert: true, new: true },
    );
  },
  expirePendingShiftAcknowledgements: async (_, { restaurantId } = {}, ctx) => {
    requireRoles(ctx, SHIFT_ACK_ADMIN_ROLES);
    const now = new Date();
    const filter = { status: "pending", deadlineAt: { $lt: now } };
    if (restaurantId) {
      await requireRestaurantAccess(ctx, restaurantId);
      filter.restaurantId = toObjectId(restaurantId) || restaurantId;
    }
    const res = await ShiftAcknowledgement.updateMany(filter, {
      $set: { status: "expired" },
    });
    return Number(res.modifiedCount || 0);
  },
  updateSchedulingPolicy: async (_, { restaurantId, input }, ctx) => {
    return updateSchedulingPolicy({
      restaurantId,
      input,
      ctx,
    });
  },
  startSchedulingOperations: async (_, { restaurantId }, ctx) => {
    requireAuth(ctx);
    await requireRestaurantAccess(ctx, restaurantId);
    return startSchedulingOperations({ restaurantId });
  },
  upsertStaffPerformanceReview: async (_, { input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, ATTENDANCE_REVIEW_ROLES);
    const staff = await Staff.findById(input.employeeId)
      .select({
        _id: 1,
        userType: 1,
        deletedAt: 1,
        restaurantForStaff: 1,
        refRestaurants: 1,
      })
      .lean();
    if (!staff || staff.userType !== "STAFF" || staff.deletedAt) {
      throw new Error("Staff not found");
    }
    const restaurantId = input.restaurantId || resolveStaffRestaurantId(staff);
    if (!restaurantId || !staffBelongsToRestaurant(staff, restaurantId)) {
      throw new Error("Staff does not belong to this restaurant");
    }
    await requireRestaurantAccess(ctx, restaurantId);
    return upsertStaffPerformanceReview({
      input,
      ctx,
    });
  },

  recalculateStaffPerformanceSnapshots: async (_, { input }, ctx) => {
    return recalculateStaffPerformanceSnapshots({
      input,
      ctx,
    });
  },
  createPayrollPeriod: async (_, { input }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.period.create");
    const actor = ctx?.user || {};
    const rid = payrollToObjectId(
      input.restaurantId || actor.restaurantForStaff || null,
    );
    if (!rid) throw new Error("Restaurant is required");
    await requireRestaurantAccess(ctx, rid);
    const startDate = payrollToStartOfDay(input.startDate);
    const endDate = payrollToEndOfDay(input.endDate);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate < startDate
    ) {
      throw new Error("Invalid payroll period range");
    }

    const payrollSetting = await PayrollSetting.findOne({ restaurantId: rid });
    const currentPeriodId = payrollSetting?.currentPayrollPeriodId
      ? String(payrollSetting.currentPayrollPeriodId)
      : null;
    const currentPeriod = currentPeriodId
      ? await PayrollPeriod.findById(currentPeriodId)
      : null;

    const isSameCurrentRange =
      currentPeriod &&
      currentPeriod.startDate?.getTime?.() === startDate.getTime() &&
      currentPeriod.endDate?.getTime?.() === endDate.getTime();

    if (
      currentPeriod &&
      !isSameCurrentRange &&
      currentPeriod.status !== "paid"
    ) {
      throw new Error(
        "Current payroll period must be fully paid before changing the applied payroll cycle",
      );
    }

    let period = await PayrollPeriod.findOne({
      restaurantId: rid,
      startDate,
      endDate,
    });
    if (!period) {
      const settings = await getPayrollSettings(rid);
      period = await PayrollPeriod.create({
        restaurantId: rid,
        name:
          input.name ||
          `Kỳ lương ${startDate.toISOString().slice(0, 10)} - ${endDate.toISOString().slice(0, 10)}`,
        startDate,
        endDate,
        status: "draft",
        settingsSnapshot: settings,
        policySnapshot: getPayrollPolicyForDate(endDate),
        calculationVersion: "payroll_v1",
        statsSnapshot: {
          totalPayroll: 0,
          paidAmount: 0,
          remaining: 0,
          progress: 0,
        },
      });
    }

    const detail = await upsertPeriodItems(period);
    await PayrollPeriod.findByIdAndUpdate(period._id, {
      $set: { statsSnapshot: detail.stats },
    });
    await logPayrollEvent({
      ctx,
      restaurantId: rid,
      verb: "payroll.period.create",
      objectKind: "PayrollPeriod",
      objectId: period._id,
    });
    await PayrollSetting.findOneAndUpdate(
      { restaurantId: rid },
      {
        $set: {
          currentPayrollPeriodId: period._id,
          updatedBy: payrollToObjectId(actor.id || actor._id),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return {
      id: String(period._id),
      restaurantId: String(period.restaurantId),
      name: period.name || "",
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
      finalizedAt: period.finalizedAt || null,
      lockedAt: period.lockedAt || null,
      paidAt: period.paidAt || null,
      stats: detail.stats,
    };
  },

  recalculatePayrollPeriod: async (_, { periodId }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.period.recalculate");
    const period = await PayrollPeriod.findById(periodId);
    if (!period) throw new Error("Payroll period not found");
    await requireRestaurantAccess(ctx, period.restaurantId);
    if (period.status !== "draft") {
      throw new Error("Chỉ có thể tính lại kỳ lương đang ở trạng thái nháp.");
    }
    const { stats } = await upsertPeriodItems(period);
    period.statsSnapshot = stats;
    period.status = "draft";
    await period.save();
    return getPeriodDetail(periodId);
  },

  finalizePayrollPeriod: async (_, { periodId }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.period.finalize");
    const period = await PayrollPeriod.findById(periodId);
    if (!period) throw new Error("Payroll period not found");
    await requireRestaurantAccess(ctx, period.restaurantId);
    if (period.status !== "draft")
      throw new Error("Chỉ có thể chốt kỳ lương đang ở trạng thái nháp.");
    const validation = await validatePayrollPeriodService(periodId);
    if (hasBlockingPayrollIssues(validation.issues)) {
      await logPayrollEvent({
        ctx,
        restaurantId: period.restaurantId,
        verb: "payroll.validation.failed",
        objectKind: "PayrollPeriod",
        objectId: period._id,
        status: "failed",
        meta: {
          errorCount: validation.errorCount,
          warningCount: validation.warningCount,
        },
      });
      throw new Error(
        "Không thể chốt kỳ lương vì còn lỗi dữ liệu. Vui lòng kiểm tra danh sách lỗi trước khi chốt.",
      );
    }
    const { stats } = await upsertPeriodItems(period);
    period.status = "finalized";
    period.finalizedAt = new Date();
    period.finalizedBy = payrollToObjectId(ctx?.user?.id || ctx?.user?._id);
    period.validationSnapshot = validation;
    period.policySnapshot =
      period.policySnapshot || getPayrollPolicyForDate(period.endDate);
    period.statsSnapshot = stats;
    await PayrollItem.updateMany(
      { periodId: period._id },
      { $set: { status: "finalized" } },
    );
    await period.save();
    await logPayrollEvent({
      ctx,
      restaurantId: period.restaurantId,
      verb: "payroll.period.finalize",
      objectKind: "PayrollPeriod",
      objectId: period._id,
      meta: { warningCount: validation.warningCount },
    });
    return {
      id: String(period._id),
      restaurantId: String(period.restaurantId),
      name: period.name || "",
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
      finalizedAt: period.finalizedAt,
      lockedAt: period.lockedAt || null,
      paidAt: period.paidAt || null,
      stats,
    };
  },

  lockPayrollPeriod: async (_, { periodId }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.period.lock");
    const period = await PayrollPeriod.findById(periodId);
    if (!period) throw new Error("Payroll period not found");
    await requireRestaurantAccess(ctx, period.restaurantId);
    if (period.status !== "paid")
      throw new Error("Chỉ có thể khóa kỳ lương sau khi đã thanh toán đủ toàn bộ kỳ.");
    period.status = "locked";
    period.lockedAt = new Date();
    period.lockedBy = payrollToObjectId(ctx?.user?.id || ctx?.user?._id);
    await PayrollItem.updateMany(
      { periodId: period._id },
      { $set: { status: "locked" } },
    );
    await period.save();
    await logPayrollEvent({
      ctx,
      restaurantId: period.restaurantId,
      verb: "payroll.period.lock",
      objectKind: "PayrollPeriod",
      objectId: period._id,
    });
    return {
      id: String(period._id),
      restaurantId: String(period.restaurantId),
      name: period.name || "",
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
      finalizedAt: period.finalizedAt || null,
      lockedAt: period.lockedAt || null,
      paidAt: period.paidAt || null,
      stats: period.statsSnapshot || {
        totalPayroll: 0,
        paidAmount: 0,
        remaining: 0,
        progress: 0,
      },
    };
  },

  markPayrollPeriodPaid: async (_, { periodId, employeeIds = [] }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.period.markPaid");
    const period = await PayrollPeriod.findById(periodId);
    if (!period) throw new Error("Payroll period not found");
    await requireRestaurantAccess(ctx, period.restaurantId);
    if (period.status === "draft") throw new Error("PAYROLL_PERIOD_NOT_FINALIZED");
    if (period.status === "locked") throw new Error("PAYROLL_PERIOD_LOCKED");
    if (period.status === "paid") throw new Error("PAYROLL_PERIOD_ALREADY_PAID");

    let targetEmployeeIds = Array.isArray(employeeIds) ? employeeIds.filter(Boolean) : [];
    if (!targetEmployeeIds.length) {
      const unpaidItems = await PayrollItem.find({
        periodId: period._id,
        status: { $ne: "paid" },
      })
        .select({ employeeId: 1 })
        .lean();
      targetEmployeeIds = unpaidItems.map((item) => String(item.employeeId));
    }

    const result = await batchMarkPayrollPaidService({
      input: { periodId, employeeIds: targetEmployeeIds },
      actorId: payrollToObjectId(ctx?.user?.id || ctx?.user?._id),
    });
    if (result.failedCount > 0) {
      const firstError = result.errors?.[0];
      throw new Error(firstError?.code || "PAYROLL_BATCH_MARK_PAID_PARTIAL_FAILED");
    }
    const detail = await getPeriodDetail(periodId);
    await logPayrollEvent({
      ctx,
      restaurantId: period.restaurantId,
      verb: "payroll.period.markPaid",
      objectKind: "PayrollPeriod",
      objectId: period._id,
      meta: { employeeIds: targetEmployeeIds },
    });
    return detail.period;
  },

  markPayrollItemPaid: async (_, { input }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.period.markPaid");
    const period = await PayrollPeriod.findById(input.periodId);
    if (!period) throw new Error("PAYROLL_PERIOD_NOT_FOUND");
    await requireRestaurantAccess(ctx, period.restaurantId);
    const item = await markPayrollItemPaidService({
      input,
      actorId: payrollToObjectId(ctx?.user?.id || ctx?.user?._id),
    });
    await logPayrollEvent({
      ctx,
      restaurantId: period.restaurantId,
      verb: "payroll.item.markPaid",
      objectKind: "PayrollPeriod",
      objectId: period._id,
      meta: { employeeId: input.employeeId, amount: input.amount || null },
    });
    return item;
  },

  batchMarkPayrollPaid: async (_, { input }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.period.markPaid");
    const period = await PayrollPeriod.findById(input.periodId);
    if (!period) throw new Error("PAYROLL_PERIOD_NOT_FOUND");
    await requireRestaurantAccess(ctx, period.restaurantId);
    const result = await batchMarkPayrollPaidService({
      input,
      actorId: payrollToObjectId(ctx?.user?.id || ctx?.user?._id),
    });
    await logPayrollEvent({
      ctx,
      restaurantId: period.restaurantId,
      verb: "payroll.batch.markPaid",
      objectKind: "PayrollPeriod",
      objectId: period._id,
      meta: {
        requestedCount: input.employeeIds?.length || 0,
        successCount: result.successCount,
        failedCount: result.failedCount,
      },
    });
    return result;
  },


  createPayrollPayout: async (_, { input }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.payout.execute");
    const period = await PayrollPeriod.findById(input.periodId);
    if (!period) throw new Error("PAYROLL_PERIOD_NOT_FOUND");
    await requireRestaurantAccess(ctx, period.restaurantId);
    const payout = await createPayrollPayoutService({
      input,
      actorId: payrollToObjectId(ctx?.user?.id || ctx?.user?._id),
    });
    await logPayrollEvent({ ctx, restaurantId: period.restaurantId, verb: "payroll.payout.create", objectKind: "PayrollPeriod", objectId: period._id, meta: { employeeId: input.employeeId, amount: input.amount, status: payout.status } });
    return payout;
  },

  createPayrollBatchPayout: async (_, { input }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.payout.execute");
    const period = await PayrollPeriod.findById(input.periodId);
    if (!period) throw new Error("PAYROLL_PERIOD_NOT_FOUND");
    await requireRestaurantAccess(ctx, period.restaurantId);
    const result = await createPayrollBatchPayoutService({
      input,
      actorId: payrollToObjectId(ctx?.user?.id || ctx?.user?._id),
    });
    await logPayrollEvent({ ctx, restaurantId: period.restaurantId, verb: "payroll.payout.create", objectKind: "PayrollPeriod", objectId: period._id, meta: { batchId: result.batch?.id, successCount: result.successCount, failedCount: result.failedCount } });
    return result;
  },

  retryPayrollPayout: async (_, { payoutId, idempotencyKey }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.payout.execute");
    const existing = await PayrollPayout.findById(payoutId).lean();
    if (!existing) throw new Error("PAYROLL_PAYOUT_NOT_FOUND");
    await requireRestaurantAccess(ctx, existing.restaurantId);
    const payout = await retryPayrollPayoutService({ payoutId, idempotencyKey, actorId: payrollToObjectId(ctx?.user?.id || ctx?.user?._id) });
    await logPayrollEvent({ ctx, restaurantId: payout.restaurantId, verb: "payroll.payout.retry", objectKind: "PayrollPayout", objectId: payout.id, meta: { status: payout.status, idempotencyKey } });
    return payout;
  },

  cancelPayrollPayout: async (_, { payoutId, reason }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.payout.execute");
    const existing = await PayrollPayout.findById(payoutId).lean();
    if (!existing) throw new Error("PAYROLL_PAYOUT_NOT_FOUND");
    await requireRestaurantAccess(ctx, existing.restaurantId);
    const payout = await cancelPayrollPayoutService({ payoutId, reason, actorId: payrollToObjectId(ctx?.user?.id || ctx?.user?._id) });
    await logPayrollEvent({ ctx, restaurantId: payout.restaurantId, verb: "payroll.payout.cancel", objectKind: "PayrollPayout", objectId: payout.id, meta: { reason } });
    return payout;
  },

  applyPayrollPayoutResult: async (_, { input }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.payout.execute");
    const existing = input.payoutId
      ? await PayrollPayout.findById(input.payoutId).lean()
      : await PayrollPayout.findOne({ providerTransactionId: input.providerTransactionId }).lean();
    if (!existing) throw new Error("PAYROLL_PAYOUT_NOT_FOUND");
    await requireRestaurantAccess(ctx, existing.restaurantId);
    const payout = await applyPayrollPayoutResultService({ ...input, rawPayload: input.rawPayload || null, actorId: payrollToObjectId(ctx?.user?.id || ctx?.user?._id) });
    await logPayrollEvent({ ctx, restaurantId: payout.restaurantId, verb: payout.status === "success" ? "payroll.payout.success" : payout.status === "failed" ? "payroll.payout.failed" : "payroll.payout.update", objectKind: "PayrollPayout", objectId: payout.id, meta: { status: payout.status, providerTransactionId: payout.providerTransactionId } });
    return payout;
  },

  upsertEmployeeBankAccount: async (_, { input }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.payout.execute");
    await requireRestaurantAccess(ctx, input.restaurantId);
    const row = await upsertEmployeeBankAccountService({ input, actorId: payrollToObjectId(ctx?.user?.id || ctx?.user?._id) });
    await logPayrollEvent({ ctx, restaurantId: input.restaurantId, verb: "payroll.employeeBankAccount.update", objectKind: "User", objectId: input.employeeId, meta: { verificationStatus: row.verificationStatus } });
    return row;
  },

  verifyEmployeeBankAccount: async (_, { employeeId, restaurantId, verificationStatus }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.payout.execute");
    await requireRestaurantAccess(ctx, restaurantId);
    return verifyEmployeeBankAccountService({ employeeId, restaurantId, verificationStatus, actorId: payrollToObjectId(ctx?.user?.id || ctx?.user?._id) });
  },

  upsertRestaurantPayoutAccount: async (_, { input }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.payout.execute");
    await requireRestaurantAccess(ctx, input.restaurantId);
    const row = await upsertRestaurantPayoutAccountService({ input, actorId: payrollToObjectId(ctx?.user?.id || ctx?.user?._id) });
    await logPayrollEvent({ ctx, restaurantId: input.restaurantId, verb: "payroll.restaurantPayoutAccount.update", objectKind: "Restaurant", objectId: input.restaurantId, meta: { status: row.status, payoutEnabled: row.payoutEnabled } });
    return row;
  },

  updatePayrollSettings: async (_, { input }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.settings.update");
    const actor = ctx?.user || {};
    const rid = payrollToObjectId(
      input.restaurantId || actor.restaurantForStaff || null,
    );
    if (!rid) throw new Error("Restaurant is required");
    await requireRestaurantAccess(ctx, rid);

    const existingSettings = await PayrollSetting.findOne({
      restaurantId: rid,
    });
    const nextCurrentPeriodId = input.currentPayrollPeriodId
      ? payrollToObjectId(input.currentPayrollPeriodId)
      : input.currentPayrollPeriodId;
    const existingCurrentPeriodId = existingSettings?.currentPayrollPeriodId
      ? String(existingSettings.currentPayrollPeriodId)
      : null;
    const requestedCurrentPeriodId = nextCurrentPeriodId
      ? String(nextCurrentPeriodId)
      : null;

    if (
      requestedCurrentPeriodId &&
      existingCurrentPeriodId &&
      existingCurrentPeriodId !== requestedCurrentPeriodId
    ) {
      const currentPeriod = await PayrollPeriod.findById(
        existingCurrentPeriodId,
      );
      if (currentPeriod && currentPeriod.status !== "paid") {
        throw new Error(
          "Current payroll period must be fully paid before changing the applied payroll cycle",
        );
      }
    }
    if (nextCurrentPeriodId) {
      const selectedPeriod = await PayrollPeriod.findById(nextCurrentPeriodId);
      if (
        selectedPeriod &&
        String(selectedPeriod.restaurantId) !== String(rid)
      ) {
        throw new Error("Current payroll period does not belong to restaurant");
      }
    }

    const update = {
      currentPayrollPeriodId: nextCurrentPeriodId,
      standardWorkDaysPerMonth: input.standardWorkDaysPerMonth,
      standardHoursPerDay: input.standardHoursPerDay,
      overtimeMultiplierWeekday: input.overtimeMultiplierWeekday,
      overtimeMultiplierWeekend: input.overtimeMultiplierWeekend,
      overtimeMultiplierHoliday: input.overtimeMultiplierHoliday,
      latenessPenaltyPerMinute: input.latenessPenaltyPerMinute,
      earlyLeavePenaltyPerMinute: input.earlyLeavePenaltyPerMinute,
      unpaidLeaveDeductionPerDay: input.unpaidLeaveDeductionPerDay,
      defaultAllowance: input.defaultAllowance,
      allowPaidLeaveInWorkDays: input.allowPaidLeaveInWorkDays,
      defaultBonus: input.defaultBonus,
      defaultDeduction: input.defaultDeduction,
      weekendDays: input.weekendDays,
      holidayDates: input.holidayDates,
      nightShiftStart: input.nightShiftStart,
      nightShiftEnd: input.nightShiftEnd,
      nightShiftAllowanceRate: input.nightShiftAllowanceRate,
      enablePersonalIncomeTax: input.enablePersonalIncomeTax,
      personalIncomeTaxRate: input.personalIncomeTaxRate,
      personalIncomeTaxFreeThreshold: input.personalIncomeTaxFreeThreshold,
      notes: input.notes,
      updatedBy: payrollToObjectId(actor.id || actor._id),
    };
    Object.keys(update).forEach(
      (key) => update[key] === undefined && delete update[key],
    );

    const doc = await PayrollSetting.findOneAndUpdate(
      { restaurantId: rid },
      { $set: update },
      { upsert: true, new: true },
    );

    return {
      ...doc.toObject(),
      restaurantId: String(doc.restaurantId),
    };
  },

  upsertPayrollAdjustment: async (_, { input }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.adjustment.write");
    const period = await PayrollPeriod.findById(input.periodId);
    if (!period) throw new Error("Payroll period not found");
    await requireRestaurantAccess(ctx, period.restaurantId);
    if (period.status !== "draft")
      throw new Error("Chỉ có thể điều chỉnh kỳ lương ở trạng thái nháp.");

    const legacyTypeMap = {
      other: "other_addition",
      penalty: "deduction",
      loan: "advance",
      advance_payment: "advance",
    };
    const rawType = String(input.type || "").toLowerCase();
    const normalizedType = legacyTypeMap[rawType] || rawType;
    const validTypes = [
      "allowance",
      "bonus",
      "deduction",
      "advance",
      "other_addition",
      "other_deduction",
    ];
    if (!validTypes.includes(normalizedType))
      throw new Error("Loại điều chỉnh lương không hợp lệ.");
    const amount = Number(input.amount || 0);
    if (!(amount > 0)) throw new Error("Số tiền điều chỉnh phải lớn hơn 0.");
    if (
      ["deduction", "advance", "other_deduction"].includes(normalizedType) &&
      !String(input.note || "").trim()
    ) {
      throw new Error("Vui lòng nhập ghi chú cho khoản khấu trừ/tạm ứng.");
    }

    const staff = await Staff.findById(input.employeeId)
      .select({
        _id: 1,
        userType: 1,
        deletedAt: 1,
        restaurantForStaff: 1,
        refRestaurants: 1,
      })
      .lean();
    if (!staff || staff.userType !== "STAFF" || staff.deletedAt) {
      throw new Error("Staff not found");
    }
    if (!staffBelongsToRestaurant(staff, period.restaurantId)) {
      throw new Error("Staff does not belong to this restaurant");
    }

    await PayrollAdjustment.create({
      periodId: period._id,
      employeeId: payrollToObjectId(input.employeeId),
      type: normalizedType,
      amount,
      note: input.note || "",
      createdBy: payrollToObjectId(ctx?.user?.id || ctx?.user?._id),
    });

    await upsertPeriodItems(period);
    const detail = await getPeriodDetail(input.periodId);
    return (
      detail.items.find(
        (item) => String(item.id) === String(input.employeeId),
      ) || null
    );
  },

  deletePayrollAdjustment: async (
    _,
    { periodId, employeeId, adjustmentId },
    ctx,
  ) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.adjustment.write");
    const period = await PayrollPeriod.findById(periodId);
    if (!period) throw new Error("Payroll period not found");
    await requireRestaurantAccess(ctx, period.restaurantId);
    if (period.status !== "draft")
      throw new Error("Chỉ có thể điều chỉnh kỳ lương ở trạng thái nháp.");

    await PayrollAdjustment.deleteOne({
      _id: payrollToObjectId(adjustmentId),
      periodId: period._id,
      employeeId: payrollToObjectId(employeeId),
    });

    await upsertPeriodItems(period);
    const detail = await getPeriodDetail(periodId);
    return (
      detail.items.find((item) => String(item.id) === String(employeeId)) ||
      null
    );
  },
  createAttendanceCorrectionRequest: async (_, { input }, ctx) => {
    requireAuth(ctx);
    const employeeId = input?.employeeId;
    const selfRequest = !employeeId || isSelf(ctx, employeeId);
    if (!selfRequest) {
      requireRoles(ctx, [
        ...ATTENDANCE_OPERATION_ROLES,
        ...ATTENDANCE_REVIEW_ROLES,
      ]);
      if (input?.restaurantId) {
        await requireRestaurantAccess(ctx, input.restaurantId);
      }
    }
    return createAttendanceCorrectionRequestService({ input, ctx });
  },

  approveAttendanceCorrectionRequest: async (_, { input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, ATTENDANCE_REVIEW_ROLES);
    const existing = await AttendanceCorrectionRequest.findById(
      input?.requestId,
    ).select({ _id: 1, restaurantId: 1 });
    if (!existing) throw new Error("Attendance correction request not found");
    await requireRestaurantAccess(ctx, existing.restaurantId);
    return approveAttendanceCorrectionRequestService({ input, ctx });
  },

  rejectAttendanceCorrectionRequest: async (_, { input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, ATTENDANCE_REVIEW_ROLES);
    const existing = await AttendanceCorrectionRequest.findById(
      input?.requestId,
    ).select({ _id: 1, restaurantId: 1 });
    if (!existing) throw new Error("Attendance correction request not found");
    await requireRestaurantAccess(ctx, existing.restaurantId);
    return rejectAttendanceCorrectionRequestService({ input, ctx });
  },

  cancelAttendanceCorrectionRequest: async (_, { requestId }, ctx) => {
    requireAuth(ctx);
    const existing = await AttendanceCorrectionRequest.findById(
      requestId,
    ).select({
      _id: 1,
      employeeId: 1,
      restaurantId: 1,
    });
    if (!existing) throw new Error("Attendance correction request not found");
    if (!isSelf(ctx, existing.employeeId)) {
      requireRoles(ctx, [
        ...ATTENDANCE_REVIEW_ROLES,
        ...ATTENDANCE_OPERATION_ROLES,
      ]);
      await requireRestaurantAccess(ctx, existing.restaurantId);
    }
    return cancelAttendanceCorrectionRequestService({ requestId, ctx });
  },
  reviewPerformanceIncident: async (_, { input }, ctx) => {
    requireAuth(ctx);
    const incident = await getPerformanceIncidentById(input.incidentId);
    await requireRestaurantAccess(ctx, incident.restaurantId);
    if (isSelf(ctx, incident.employeeId)) throw new Error("FORBIDDEN");
    return reviewPerformanceIncidentService({ input, ctx });
  },
  waivePerformanceIncident: async (_, { incidentId, reason }, ctx) => {
    requireAuth(ctx);
    const incident = await getPerformanceIncidentById(incidentId);
    await requireRestaurantAccess(ctx, incident.restaurantId);
    return waivePerformanceIncidentService({ incidentId, reason, ctx });
  },
  markPerformanceIncidentEligible: async (_, { input }, ctx) => {
    requireAuth(ctx);
    const incident = await getPerformanceIncidentById(input.incidentId);
    await requireRestaurantAccess(ctx, incident.restaurantId);
    return markPerformanceIncidentEligibleService({ input, ctx });
  },
  applyPerformanceIncidentScore: async (_, { input }, ctx) => {
    requireAuth(ctx);
    const incident = await getPerformanceIncidentById(input.incidentId);
    await requireRestaurantAccess(ctx, incident.restaurantId);
    return applyPerformanceIncidentScoreService({
      incidentId: input.incidentId,
      actor: ctx?.user,
      note: input.note,
    });
  },
  createPerformanceIncidentAppeal: async (_, { input }, ctx) => {
    requireAuth(ctx);
    const incident = await getPerformanceIncidentById(input.incidentId);
    if (!isSelf(ctx, incident.employeeId)) throw new Error("FORBIDDEN");
    await requireRestaurantAccess(ctx, incident.restaurantId);
    return createPerformanceIncidentAppeal(input, ctx?.user);
  },
  cancelPerformanceIncidentAppeal: async (_, { appealId }, ctx) => {
    requireAuth(ctx);
    const appeal = await getPerformanceIncidentAppealById(appealId, ctx?.user);
    if (!isSelf(ctx, appeal.employeeId)) throw new Error("FORBIDDEN");
    await requireRestaurantAccess(ctx, appeal.restaurantId);
    return cancelPerformanceIncidentAppeal(appealId, ctx?.user);
  },
  reviewPerformanceIncidentAppeal: async (_, { input }, ctx) => {
    requireAuth(ctx);
    const appeal = await getPerformanceIncidentAppealById(
      input.appealId,
      ctx?.user,
    );
    await requireRestaurantAccess(ctx, appeal.restaurantId);
    if (isSelf(ctx, appeal.employeeId)) throw new Error("FORBIDDEN");
    return reviewPerformanceIncidentAppeal(input, ctx?.user);
  },
  reverseScoreForAcceptedAppeal: async (_, { input }, ctx) =>
    reverseScoreForAcceptedAppealService({ ...input, actor: ctx?.user }),

  createOvertimeRequest: async (_, { input }, ctx) => {
    requireAuth(ctx);
    const actorId = ctx?.user?.id || ctx?.user?._id;
    const providedEmployeeId = input?.employeeId || null;
    let resolvedEmployeeId = providedEmployeeId;
    let resolvedRestaurantId = input?.restaurantId || null;

    let shift = null;
    if (input?.shiftId) {
      shift = await Shift.findById(input.shiftId)
        .select({ _id: 1, employeeId: 1, restaurantId: 1 })
        .lean();
      if (!shift) throw new Error("Shift not found");
      resolvedEmployeeId = resolvedEmployeeId || String(shift.employeeId);
      resolvedRestaurantId = resolvedRestaurantId || String(shift.restaurantId);
      if (
        providedEmployeeId &&
        String(shift.employeeId) !== String(providedEmployeeId)
      ) {
        throw new Error("SHIFT_EMPLOYEE_MISMATCH");
      }
    }

    let timesheet = null;
    if (input?.timesheetId) {
      timesheet = await Timesheet.findById(input.timesheetId)
        .select({ _id: 1, employeeId: 1, restaurantId: 1, shiftId: 1 })
        .lean();
      if (!timesheet) throw new Error("Timesheet not found");
      resolvedEmployeeId = resolvedEmployeeId || String(timesheet.employeeId);
      resolvedRestaurantId =
        resolvedRestaurantId || String(timesheet.restaurantId);
      if (
        shift &&
        String(shift.restaurantId) !== String(timesheet.restaurantId)
      )
        throw new Error("SHIFT_TIMESHEET_RESTAURANT_MISMATCH");
      if (shift && String(shift.employeeId) !== String(timesheet.employeeId))
        throw new Error("SHIFT_TIMESHEET_EMPLOYEE_MISMATCH");
      if (
        providedEmployeeId &&
        String(timesheet.employeeId) !== String(providedEmployeeId)
      ) {
        throw new Error("TIMESHEET_EMPLOYEE_MISMATCH");
      }
    }

    if (!resolvedEmployeeId) resolvedEmployeeId = actorId;
    if (!resolvedEmployeeId || !resolvedRestaurantId) {
      throw new Error("employeeId hoặc restaurantId không hợp lệ.");
    }
    if (isSelf(ctx, resolvedEmployeeId)) {
      if (shift && String(shift.employeeId) !== String(resolvedEmployeeId)) {
        throw new Error("FORBIDDEN");
      }
      if (
        timesheet &&
        String(timesheet.employeeId) !== String(resolvedEmployeeId)
      ) {
        throw new Error("FORBIDDEN");
      }
    } else {
      requireRoles(ctx, ATTENDANCE_OPERATION_ROLES);
      await requireRestaurantAccess(ctx, resolvedRestaurantId);
    }
    await loadStaffForRestaurant(resolvedEmployeeId, resolvedRestaurantId);
    return createOvertimeRequestService({ input, ctx });
  },

  confirmOvertimeRequest: async (_, { input }, ctx) => {
    requireAuth(ctx);
    const request = await OvertimeRequest.findById(input?.requestId).select({
      _id: 1,
      employeeId: 1,
      restaurantId: 1,
      status: 1,
    });
    if (!request) throw new Error("Không tìm thấy yêu cầu tăng ca.");
    if (!isSelf(ctx, request.employeeId)) throw new Error("FORBIDDEN");
    return confirmOvertimeRequestService({ input, ctx });
  },

  approveOvertimeRequest: async (_, { input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, ATTENDANCE_REVIEW_ROLES);
    const request = await OvertimeRequest.findById(input?.requestId).select({
      _id: 1,
      employeeId: 1,
      restaurantId: 1,
    });
    if (!request) throw new Error("Không tìm thấy yêu cầu tăng ca.");
    if (isSelf(ctx, request.employeeId)) throw new Error("FORBIDDEN");
    await requireRestaurantAccess(ctx, request.restaurantId);
    return approveOvertimeRequestService({ input, ctx });
  },

  rejectOvertimeRequest: async (_, { input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, ATTENDANCE_REVIEW_ROLES);
    const request = await OvertimeRequest.findById(input?.requestId).select({
      _id: 1,
      employeeId: 1,
      restaurantId: 1,
    });
    if (!request) throw new Error("Không tìm thấy yêu cầu tăng ca.");
    if (isSelf(ctx, request.employeeId)) throw new Error("FORBIDDEN");
    await requireRestaurantAccess(ctx, request.restaurantId);
    return rejectOvertimeRequestService({ input, ctx });
  },

  cancelOvertimeRequest: async (_, { input }, ctx) => {
    requireAuth(ctx);
    const request = await OvertimeRequest.findById(input?.requestId).select({
      _id: 1,
      employeeId: 1,
      restaurantId: 1,
    });
    if (!request) throw new Error("Không tìm thấy yêu cầu tăng ca.");
    if (!isSelf(ctx, request.employeeId)) {
      requireRoles(ctx, ATTENDANCE_REVIEW_ROLES);
      await requireRestaurantAccess(ctx, request.restaurantId);
    }
    return cancelOvertimeRequestService({ input, ctx });
  },

  completeOvertimeRequest: async (_, { input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, ATTENDANCE_REVIEW_ROLES);
    const request = await OvertimeRequest.findById(input?.requestId).select({
      _id: 1,
      employeeId: 1,
      restaurantId: 1,
    });
    if (!request) throw new Error("Không tìm thấy yêu cầu tăng ca.");
    if (isSelf(ctx, request.employeeId)) throw new Error("FORBIDDEN");
    await requireRestaurantAccess(ctx, request.restaurantId);
    return completeOvertimeRequestService({ input, ctx });
  },
  checkInShift: async (_, { shiftId }, ctx) => checkShiftAttendanceAction({ shiftId, ctx, action: "check_in" }),
  checkOutShift: async (_, { shiftId }, ctx) => checkShiftAttendanceAction({ shiftId, ctx, action: "check_out" }),
  markShiftAttendanceReviewed: async (_, { attendanceId, note }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, ATTENDANCE_REVIEW_ROLES);

    const attendanceKey = String(attendanceId || "").trim();
    if (attendanceKey.startsWith("shift-")) {
      throw new Error("Ca chưa có bản ghi chấm công để ghi chú xử lý.");
    }

    const trimmedNote = String(note || "").trim();
    if (trimmedNote.length < 5) {
      throw new Error("Ghi chú xử lý phải có ít nhất 5 ký tự.");
    }

    const timesheet = await Timesheet.findById(attendanceKey);
    if (!timesheet) throw new Error("Không tìm thấy bản ghi chấm công.");
    await requireRestaurantAccess(ctx, timesheet.restaurantId);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");
    const reviewPrefix = `[Manager review ${year}-${month}-${day} ${hour}:${minute}]`;
    const reviewLine = `${reviewPrefix} ${trimmedNote}`;

    timesheet.note = timesheet.note?.trim()
      ? `${timesheet.note.trim()}
${reviewLine}`
      : reviewLine;
    await timesheet.save();

    return mapShiftAttendanceMutationResult(timesheet);
  },
  upsertStaffAttendance: async (_, { input }, ctx) => {
    requireAuth(ctx);
    const employeeId = toObjectId(input.employeeId);
    const restaurantId = toObjectId(input.restaurantId);
    if (!employeeId || !restaurantId)
      throw new Error("Invalid employeeId or restaurantId");
    const actorId = toObjectId(ctx?.user?.id || ctx?.user?._id);
    if (isSelf(ctx, employeeId)) {
      requireRoles(ctx, ATTENDANCE_SELF_ROLES);
    } else {
      requireRoles(ctx, ATTENDANCE_OPERATION_ROLES);
      await requireRestaurantAccess(ctx, restaurantId);
    }

    const action = String(input.action || "").toLowerCase();
    if (!["check_in", "check_out", "in", "out"].includes(action)) {
      throw new Error("Invalid attendance action");
    }
    const normalizedAction = ["check_in", "in"].includes(action)
      ? "check_in"
      : "check_out";
    const eventTime = input.timestamp ? new Date(input.timestamp) : new Date();
    const workDate = input.workDate
      ? toStartOfDay(input.workDate)
      : toStartOfDay(eventTime);
    await assertNoLockedPayrollPeriodOverlap({
      restaurantId,
      employeeId,
      startDate: workDate,
      endDate: workDate,
      action: "attendance",
    });
    const note = input.note?.trim() || "";
    const offScheduleReasonCategory = [
      "called_in",
      "manager_requested",
      "emergency_cover",
      "shift_swap",
      "self_initiated",
      "other",
    ].includes(String(input.offScheduleReasonCategory || "").toLowerCase())
      ? String(input.offScheduleReasonCategory).toLowerCase()
      : "other";
    const offScheduleReason = input.offScheduleReason?.trim() || "";
    const source = ["manual", "system", "quick"].includes(
      String(input.source || "").toLowerCase(),
    )
      ? String(input.source).toLowerCase()
      : "quick";

    const staff = await Staff.findById(employeeId).populate("role");
    if (!staff || staff.userType !== "STAFF")
      throw new Error("Staff not found");

    const requestedShiftId = toObjectId(input.shiftId);
    let assignedShift = null;
    if (requestedShiftId) {
      assignedShift = await Shift.findOne({
        _id: requestedShiftId,
        employeeId,
        restaurantId,
        status: { $in: ["scheduled", "pending", "completed"] },
      }).lean();
      if (!assignedShift) {
        throw new Error("Không tìm thấy ca làm phù hợp để chấm công.");
      }
    } else {
      const shiftCandidates = await Shift.find({
        employeeId,
        restaurantId,
        startTime: { $lte: toEndOfDay(workDate) },
        endTime: { $gte: toStartOfDay(workDate) },
        status: { $in: ["scheduled", "pending", "completed"] },
      }).lean();

      assignedShift =
        shiftCandidates
          .map((shift) => ({
            shift,
            distance: Math.min(
              Math.abs(new Date(shift.startTime).getTime() - eventTime.getTime()),
              Math.abs(new Date(shift.endTime).getTime() - eventTime.getTime()),
            ),
          }))
          .sort((a, b) => a.distance - b.distance)[0]?.shift || null;
    }

    const query = assignedShift
      ? { employeeId, workDate, shiftId: assignedShift._id }
      : { employeeId, workDate, isOffSchedule: true };

    const defaults = {
      employeeId,
      restaurantId,
      workDate,
      shiftId: assignedShift?._id || null,
      plannedStartTime: assignedShift?.startTime || null,
      plannedEndTime: assignedShift?.endTime || null,
      source,
      isOffSchedule: !assignedShift,
      note,
      approved: false,
      offScheduleApprovalStatus: assignedShift ? "not_required" : "pending",
      offScheduleReasonCategory,
      offScheduleReason,
    };

    let record = null;
    if (normalizedAction === "check_out") {
      const openTimesheetQuery = {
        employeeId,
        restaurantId,
        actualCheckInAt: { $ne: null },
        actualCheckOutAt: null,
      };
      if (assignedShift?._id) {
        record = await Timesheet.findOne({
          ...openTimesheetQuery,
          shiftId: assignedShift._id,
        });
      }
      if (!record) {
        record = await Timesheet.findOne(openTimesheetQuery);
      }
    }

    if (!record) {
      record = (await Timesheet.findOne(query)) || new Timesheet(defaults);
    }
    record.employeeId = employeeId;
    record.restaurantId = restaurantId;
    record.workDate = workDate;
    record.shiftId = assignedShift?._id || null;
    record.plannedStartTime = assignedShift?.startTime || null;
    record.plannedEndTime = assignedShift?.endTime || null;
    record.isOffSchedule = !assignedShift;
    if (!assignedShift) {
      record.approved = false;
      record.offScheduleApprovalStatus = "pending";
      record.offScheduleReasonCategory = offScheduleReasonCategory;
      if (offScheduleReason) record.offScheduleReason = offScheduleReason;
    } else {
      record.offScheduleApprovalStatus = "not_required";
    }
    record.source = source;
    if (note) record.note = note;

    if (normalizedAction === "check_in") {
      if (record.actualCheckInAt)
        throw new Error("Nhân viên đã check-in trong ngày làm việc này");
      record.actualCheckInAt = eventTime;
    } else {
      if (!record.actualCheckInAt) throw new Error("Nhân viên chưa check-in");
      if (record.actualCheckOutAt) throw new Error("Nhân viên đã check-out");
      if (eventTime < record.actualCheckInAt)
        throw new Error("Thời gian check-out không hợp lệ");
      record.actualCheckOutAt = eventTime;
    }

    const checkInAt = record.actualCheckInAt;
    const checkOutAt = record.actualCheckOutAt;
    const plannedStart = record.plannedStartTime;
    const plannedEnd = record.plannedEndTime;

    record.latenessMinutes =
      plannedStart && checkInAt
        ? toMinutes(new Date(checkInAt) - new Date(plannedStart))
        : 0;
    record.earlyLeaveMinutes =
      plannedEnd && checkOutAt
        ? toMinutes(new Date(plannedEnd) - new Date(checkOutAt))
        : 0;
    record.workedMinutes =
      checkInAt && checkOutAt
        ? toMinutes(new Date(checkOutAt) - new Date(checkInAt))
        : 0;
    record.overtimeMinutes =
      plannedEnd && checkOutAt
        ? toMinutes(new Date(checkOutAt) - new Date(plannedEnd))
        : 0;
    record.hours = Number((record.workedMinutes / 60).toFixed(2));

    await record.save();
    try {
      await syncAttendancePerformanceIncidents(record, {
        actorId,
        actorRole: String(
          ctx?.user?.roleName || ctx?.user?.userType || "",
        ).toLowerCase(),
      });
    } catch (error) {
      console.warn(
        "Failed to sync attendance performance incidents:",
        error.message,
      );
    }
    if (record.isOffSchedule) {
      try {
        await createPerformanceIncidentOnce({
          restaurantId,
          employeeId,
          actorId,
          actorRole: String(
            ctx?.user?.roleName || ctx?.user?.userType || "",
          ).toLowerCase(),
          sourceType: "off_schedule_attendance",
          sourceId: String(record._id),
          eventType: "OFF_SCHEDULE_CREATED",
          severity: "warning",
          responsibilityStatus: "pending_review",
          scoreImpactStatus: "pending",
          metadata: {
            workDate,
            timesheetId: String(record._id),
            reasonCategory: record.offScheduleReasonCategory,
            reason: record.offScheduleReason || "",
          },
        });
      } catch (error) {
        console.warn("Failed to log performance incident:", error.message);
      }
    }
    const populated = await Timesheet.findById(record._id)
      .populate("shiftId")
      .lean();
    return mapAttendanceOutput(populated, staff);
  },

  runAttendanceExceptionDetection: async (_, { input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, ["ADMIN", "MANAGER", "HR"]);
    await requireRestaurantAccess(ctx, input.restaurantId);

    return runAttendanceExceptionDetectionJob({
      restaurantId: input.restaurantId,
      startDate: input.startDate,
      endDate: input.endDate,
      now: input.now,
      noShowGraceMinutes: input.noShowGraceMinutes,
      missedCheckoutGraceMinutes: input.missedCheckoutGraceMinutes,
      actorId: ctx?.user?.id || ctx?.user?._id || null,
      triggeredBy: "manual",
    });
  },
  approveOffScheduleAttendance: async (_, { timesheetId, note }, ctx) => {
    const { record, staff } = await approveOffScheduleAttendanceService({
      timesheetId,
      note,
      ctx,
    });
    return mapAttendanceOutput(record, staff);
  },
  rejectOffScheduleAttendance: async (_, { timesheetId, note }, ctx) => {
    const { record, staff } = await rejectOffScheduleAttendanceService({
      timesheetId,
      note,
      ctx,
    });
    return mapAttendanceOutput(record, staff);
  },

  createLeaveRequest: async (_, { input }, ctx) => {
    requireAuth(ctx);
    const actorIdRaw = ctx?.user?.id || ctx?.user?._id || null;
    const resolvedEmployeeId = input.employeeId || actorIdRaw;
    const employeeId = toObjectId(resolvedEmployeeId);
    if (!employeeId) throw new Error("Invalid employeeId or restaurantId");

    const employee = await Staff.findById(employeeId)
      .populate("role")
      .select({
        _id: 1,
        userType: 1,
        deletedAt: 1,
        restaurantForStaff: 1,
        refRestaurants: 1,
        fullName: 1,
        employeeCode: 1,
        positionTitle: 1,
        roleName: 1,
        avatarUrl: 1,
        avatar: 1,
        department: 1,
      })
      .lean();
    if (!employee || employee.userType !== "STAFF" || employee.deletedAt)
      throw new Error("Staff not found");

    const restaurantId = toObjectId(
      input.restaurantId || resolveStaffRestaurantId(employee),
    );
    if (!restaurantId) throw new Error("Invalid employeeId or restaurantId");
    if (!staffBelongsToRestaurant(employee, restaurantId)) {
      throw new Error("Staff does not belong to restaurant");
    }
    const actorIsSelf = isSelf(ctx, employeeId);
    if (!actorIsSelf) {
      requireRoles(ctx, ATTENDANCE_REVIEW_ROLES);
      await requireRestaurantAccess(ctx, restaurantId);
    }

    const leaveType = fromGraphLeaveType(input.leaveType);
    const startSession = fromGraphSession(input.startSession);
    const endSession = fromGraphSession(input.endSession);
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    const requestedDays = calcLeaveDays(
      startDate,
      endDate,
      startSession,
      endSession,
      leaveType,
    );
    if (requestedDays <= 0) throw new Error("Invalid leave date range");
    const requestedHours = Number((requestedDays * 8).toFixed(2));

    const isManager =
      String(employee.department || "").toLowerCase() === "management" ||
      String(employee.positionTitle || "")
        .toLowerCase()
        .includes("manager") ||
      String(employee.roleName || "")
        .toLowerCase()
        .includes("manager") ||
      String(employee.role?.slug || "")
        .toLowerCase()
        .includes("manager");

    let replacementManagerId = toObjectId(
      input.replacementManagerId || input.replacementEmployeeId,
    );
    let replacementStatus = "not_required";
    let status = "pending";

    if (isManager) {
      if (!replacementManagerId) {
        throw new Error("Manager leave requires replacement manager");
      }
      if (String(replacementManagerId) === String(employeeId)) {
        throw new Error("Replacement manager cannot be requester");
      }
      const replacementManager = await Staff.findById(replacementManagerId)
        .select({ _id: 1, department: 1, positionTitle: 1, roleName: 1 })
        .lean();
      if (!replacementManager) throw new Error("Replacement manager not found");
      replacementStatus = "pending";
      status = "pending_replacement_confirmation";
    }

    const { payrollFlags, quotaImpact } = computeLeaveFlags(
      leaveType,
      requestedDays,
    );
    const actorId = toObjectId(ctx?.user?.id || ctx?.user?._id || null);

    const created = await LeaveRequest.create({
      employeeId,
      restaurantId,
      leaveType,
      startDate: toStartOfDay(startDate),
      endDate: toStartOfDay(endDate),
      startSession,
      endSession,
      requestedDays,
      requestedHours,
      reason: String(input.reason || "").trim(),
      status,
      replacementManagerId: replacementManagerId || null,
      replacementStatus,
      payrollFlags,
      quotaImpact,
      auditLogs: [
        {
          action: "created",
          actorId: actorId || employeeId,
          actorName: null,
          note: "Leave request created",
          at: new Date(),
        },
      ],
    });

    const populated = await LeaveRequest.findById(created._id)
      .populate(
        "employeeId",
        "fullName employeeCode positionTitle roleName avatarUrl avatar",
      )
      .populate("replacementManagerId", "fullName")
      .lean();
    return mapLeaveOutput(populated);
  },

  approveLeaveRequest: async (_, { requestId, approverId, note }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, ATTENDANCE_REVIEW_ROLES);
    const request = await LeaveRequest.findById(requestId)
      .populate(
        "employeeId",
        "fullName employeeCode positionTitle roleName avatarUrl avatar email",
      )
      .populate("replacementManagerId", "fullName")
      .populate("approverId", "fullName");
    if (!request) throw new Error("Leave request not found");
    await requireRestaurantAccess(ctx, request.restaurantId);
    if (isSelf(ctx, request.employeeId?._id || request.employeeId))
      throw new Error("FORBIDDEN");
    await assertNoLockedPayrollPeriodOverlap({
      restaurantId: request.restaurantId,
      employeeId: request.employeeId?._id || request.employeeId,
      startDate: request.startDate,
      endDate: request.endDate,
      action: "leave",
    });
    if (request.status === "rejected")
      return mapLeaveOutput(request.toObject());
    if (request.status === "approved")
      return mapLeaveOutput(request.toObject());
    if (request.replacementStatus === "pending") {
      throw new Error("Replacement manager must confirm before approval");
    }

    request.status = "approved";
    request.approvedAt = new Date();
    request.rejectedAt = null;
    request.rejectionReason = "";
    request.approverId = toObjectId(
      approverId || ctx?.user?.id || ctx?.user?._id || null,
    );
    request.auditLogs.push({
      action: "approved",
      actorId: request.approverId,
      actorName: null,
      note: note || "Approved",
      at: new Date(),
    });
    await request.save();

    await applyLeaveBalanceImpact({
      employeeId: request.employeeId?._id || request.employeeId,
      year: new Date(request.startDate).getFullYear(),
      quotaImpact: request.quotaImpact,
    });

    const populated = await LeaveRequest.findById(request._id)
      .populate(
        "employeeId",
        "fullName employeeCode positionTitle roleName avatarUrl avatar email",
      )
      .populate("replacementManagerId", "fullName")
      .populate("approverId", "fullName")
      .lean();

    try {
      await sendLeaveDecisionMail({
        leaveDoc: populated,
        decision: "approved",
      });
      await LeaveRequest.findByIdAndUpdate(request._id, {
        $push: {
          auditLogs: {
            action: "mail_sent",
            actorId: request.approverId || null,
            actorName: null,
            note: "Sent approval email to employee",
            at: new Date(),
          },
        },
      });
    } catch (mailErr) {
      await LeaveRequest.findByIdAndUpdate(request._id, {
        $push: {
          auditLogs: {
            action: "mail_failed",
            actorId: request.approverId || null,
            actorName: null,
            note: `Approval email failed: ${mailErr.message}`,
            at: new Date(),
          },
        },
      });
      throw new Error(
        `Trạng thái đơn nghỉ đã được duyệt trong DB nhưng gửi email thất bại: ${mailErr.message}`,
      );
    }
    return mapLeaveOutput(populated);
  },

  rejectLeaveRequest: async (_, { requestId, approverId, reason }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, ATTENDANCE_REVIEW_ROLES);
    const request = await LeaveRequest.findById(requestId)
      .populate(
        "employeeId",
        "fullName employeeCode positionTitle roleName avatarUrl avatar email",
      )
      .populate("replacementManagerId", "fullName")
      .populate("approverId", "fullName");
    if (!request) throw new Error("Leave request not found");
    await requireRestaurantAccess(ctx, request.restaurantId);
    if (isSelf(ctx, request.employeeId?._id || request.employeeId))
      throw new Error("FORBIDDEN");
    await assertNoLockedPayrollPeriodOverlap({
      restaurantId: request.restaurantId,
      employeeId: request.employeeId?._id || request.employeeId,
      startDate: request.startDate,
      endDate: request.endDate,
      action: "leave",
    });
    if (request.status === "approved") {
      throw new Error(
        "Đơn nghỉ đã duyệt không thể từ chối. Vui lòng dùng quy trình hủy/điều chỉnh riêng.",
      );
    }
    if (request.status === "rejected") {
      return mapLeaveOutput(request.toObject());
    }

    request.status = "rejected";
    request.rejectedAt = new Date();
    request.approvedAt = null;
    request.rejectionReason = String(reason || "").trim();
    request.approverId = toObjectId(
      approverId || ctx?.user?.id || ctx?.user?._id || null,
    );
    request.auditLogs.push({
      action: "rejected",
      actorId: request.approverId,
      actorName: null,
      note: reason || "Rejected",
      at: new Date(),
    });
    await request.save();

    const populated = await LeaveRequest.findById(request._id)
      .populate(
        "employeeId",
        "fullName employeeCode positionTitle roleName avatarUrl avatar email",
      )
      .populate("replacementManagerId", "fullName")
      .populate("approverId", "fullName")
      .lean();

    try {
      await sendLeaveDecisionMail({
        leaveDoc: populated,
        decision: "rejected",
      });
      await LeaveRequest.findByIdAndUpdate(request._id, {
        $push: {
          auditLogs: {
            action: "mail_sent",
            actorId: request.approverId || null,
            actorName: null,
            note: "Sent rejection email to employee",
            at: new Date(),
          },
        },
      });
    } catch (mailErr) {
      await LeaveRequest.findByIdAndUpdate(request._id, {
        $push: {
          auditLogs: {
            action: "mail_failed",
            actorId: request.approverId || null,
            actorName: null,
            note: `Rejection email failed: ${mailErr.message}`,
            at: new Date(),
          },
        },
      });
      throw new Error(
        `Trạng thái đơn nghỉ đã được từ chối trong DB nhưng gửi email thất bại: ${mailErr.message}`,
      );
    }
    return mapLeaveOutput(populated);
  },

  confirmReplacementLeaveRequest: async (
    _,
    { requestId, managerId, note },
    ctx,
  ) => {
    requireAuth(ctx);
    const actorId = toObjectId(
      managerId || ctx?.user?.id || ctx?.user?._id || null,
    );
    const request = await LeaveRequest.findById(requestId)
      .populate(
        "employeeId",
        "fullName employeeCode positionTitle roleName avatarUrl avatar",
      )
      .populate("replacementManagerId", "fullName")
      .lean();
    if (!request) throw new Error("Leave request not found");
    await requireRestaurantAccess(ctx, request.restaurantId);
    if (isSelf(ctx, request.employeeId?._id || request.employeeId))
      throw new Error("FORBIDDEN");
    await assertNoLockedPayrollPeriodOverlap({
      restaurantId: request.restaurantId,
      employeeId: request.employeeId?._id || request.employeeId,
      startDate: request.startDate,
      endDate: request.endDate,
      action: "leave",
    });
    if (!actorId) throw new Error("Replacement manager is required");
    if (!request.replacementManagerId)
      throw new Error("Leave request does not require replacement");
    const isAssignedReplacement =
      String(
        request.replacementManagerId._id || request.replacementManagerId,
      ) === String(actorId);
    if (!isAssignedReplacement) {
      requireRoles(ctx, ATTENDANCE_REVIEW_ROLES);
      await requireRestaurantAccess(ctx, request.restaurantId);
    } else {
      const actorStaff = await Staff.findById(actorId)
        .select({ restaurantForStaff: 1, refRestaurants: 1 })
        .lean();
      if (!staffBelongsToRestaurant(actorStaff, request.restaurantId)) {
        throw new Error("FORBIDDEN");
      }
    }

    const updated = await LeaveRequest.findByIdAndUpdate(
      requestId,
      {
        $set: {
          replacementStatus: "confirmed",
          replacementConfirmedAt: new Date(),
          replacementConfirmedBy: actorId,
          status: "pending",
        },
        $push: {
          auditLogs: {
            action: "replacement_confirmed",
            actorId,
            actorName: null,
            note: note || "Replacement manager confirmed",
            at: new Date(),
          },
        },
      },
      { new: true },
    )
      .populate(
        "employeeId",
        "fullName employeeCode positionTitle roleName avatarUrl avatar",
      )
      .populate("replacementManagerId", "fullName")
      .lean();

    return mapLeaveOutput(updated);
  },
};

export default mutationResolvers;
