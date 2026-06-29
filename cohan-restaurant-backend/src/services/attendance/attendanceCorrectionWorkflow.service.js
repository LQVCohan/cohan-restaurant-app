import mongoose from "mongoose";
import {
  AttendanceCorrectionRequest,
  EventLog,
  Shift,
  Staff,
  Timesheet,
} from "../../../models/index.js";
import { assertNoLockedPayrollPeriodOverlap } from "../payroll/payrollLockGuard.service.js";
import {
  calculateAttendanceMetrics,
  deriveAttendanceStatus,
} from "./attendanceCalculation.service.js";
import {
  applyAttendanceOvertimeState,
  buildAttendanceOvertimeState,
} from "./attendanceOvertimeState.service.js";
import { syncAttendancePerformanceIncidents } from "../performance/attendancePerformanceIntegration.service.js";
import { createPerformanceIncidentOnce } from "../performance/performanceIncident.service.js";
import { notifyReviewers, notifyUser } from "../notification/notificationWorkflow.service.js";
import {
  ATTENDANCE_READ_ROLES,
  ATTENDANCE_REVIEW_ROLES,
  userCanAccessRestaurant,
  userHasAnyRole,
} from "../scheduling/schedulingPermission.service.js";

const { Types } = mongoose;

const ALLOWED_CORRECTION_TYPES = new Set([
  "missing_check_in",
  "missing_check_out",
  "wrong_check_in",
  "wrong_check_out",
  "wrong_check_in_out",
  "off_schedule_work",
  "other",
]);

const ALLOWED_CREATE_WITHOUT_TIMESHEET_TYPES = new Set([
  "off_schedule_work",
  "missing_check_in",
  "missing_check_out",
  "wrong_check_in_out",
]);

const PENDING_FIRST_STATUS_RANK = {
  pending: 0,
  approved: 1,
  applied: 2,
  rejected: 3,
  cancelled: 4,
};

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new Types.ObjectId(value);
}

function toStartOfDay(value) {
  const date = value ? new Date(value) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function toEndOfDay(value) {
  const date = value ? new Date(value) : new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function toValidDate(value, fieldName) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} không hợp lệ.`);
  }
  return date;
}

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getActorId(ctx) {
  return toObjectId(ctx?.user?.id || ctx?.user?._id);
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

function getActorRole(ctx) {
  return normalizeRole(
    ctx?.user?.roleName ||
      ctx?.user?.userType ||
      ctx?.user?.role?.slug ||
      ctx?.user?.role ||
      "",
  );
}

function isAdmin(ctx) {
  return getActorRole(ctx) === "admin";
}

function canReviewAttendanceCorrection(ctx) {
  return userHasAnyRole(ctx?.user, ATTENDANCE_REVIEW_ROLES);
}

function canRequestAnyAttendanceCorrection(ctx) {
  const role = getActorRole(ctx);
  return ["admin", "hr", "manager"].includes(role);
}

function canViewAttendanceCorrection(ctx) {
  return userHasAnyRole(ctx?.user, [...ATTENDANCE_READ_ROLES, "STAFF"]);
}

function assertAuthenticated(ctx) {
  if (!ctx?.user?.id && !ctx?.user?._id) throw new Error("UNAUTHENTICATED");
}

async function assertRestaurantScope(ctx, restaurantId) {
  if (!await userCanAccessRestaurant(ctx?.user, restaurantId)) {
    throw new Error("RESTAURANT_SCOPE_FORBIDDEN");
  }
}

function assertCanView(ctx) {
  if (!canViewAttendanceCorrection(ctx)) {
    throw new Error("Bạn không có quyền xem yêu cầu chỉnh công.");
  }
}

function assertCanReview(ctx) {
  if (!canReviewAttendanceCorrection(ctx)) {
    throw new Error("Bạn không có quyền duyệt yêu cầu chỉnh công.");
  }
}

function assertCanCreateForEmployee(ctx, employeeId) {
  const actorId = getActorId(ctx);
  if (canRequestAnyAttendanceCorrection(ctx)) return;

  if (
    getActorRole(ctx) === "staff" &&
    actorId &&
    String(actorId) === String(employeeId)
  ) {
    return;
  }

  throw new Error("Bạn chỉ có thể tạo yêu cầu chỉnh công cho chính mình.");
}

function assertCanCancel(ctx, request) {
  if (canReviewAttendanceCorrection(ctx)) return;

  const actorId = getActorId(ctx);
  if (
    getActorRole(ctx) === "staff" &&
    actorId &&
    String(request.requestedBy || "") === String(actorId) &&
    request.status === "pending"
  ) {
    return;
  }

  throw new Error("Bạn không có quyền hủy yêu cầu chỉnh công này.");
}

function buildAuditLog(ctx, action, note = "", meta = null) {
  return {
    action,
    actorId: getActorId(ctx),
    actorName: getActorName(ctx),
    note,
    at: new Date(),
    meta,
  };
}

function sameCalendarDay(left, right) {
  if (!left || !right) return false;
  return toStartOfDay(left).getTime() === toStartOfDay(right).getTime();
}

function appendNote(oldNote, nextNote) {
  const oldText = String(oldNote || "").trim();
  const nextText = String(nextNote || "").trim();
  if (!oldText) return nextText;
  if (!nextText) return oldText;
  return `${oldText}\n${nextText}`;
}

function validateCorrectionRequestPayload({
  correctionType,
  requestedCheckInAt,
  requestedCheckOutAt,
  requestedWorkedMinutes,
}) {
  const type = String(correctionType || "").toLowerCase();

  if (
    requestedCheckInAt &&
    requestedCheckOutAt &&
    requestedCheckOutAt <= requestedCheckInAt
  ) {
    throw new Error("Giờ check-out đề xuất phải lớn hơn giờ check-in đề xuất.");
  }

  if (
    requestedWorkedMinutes != null &&
    Number(requestedWorkedMinutes) < 0
  ) {
    throw new Error("Số phút làm việc đề xuất không được âm.");
  }

  const requiresCheckIn = new Set([
    "missing_check_in",
    "wrong_check_in",
    "wrong_check_in_out",
  ]);
  const requiresCheckOut = new Set([
    "missing_check_out",
    "wrong_check_out",
    "wrong_check_in_out",
  ]);

  if (requiresCheckIn.has(type) && !requestedCheckInAt) {
    throw new Error("Loại chỉnh công này yêu cầu giờ check-in đề xuất.");
  }

  if (requiresCheckOut.has(type) && !requestedCheckOutAt) {
    throw new Error("Loại chỉnh công này yêu cầu giờ check-out đề xuất.");
  }
}

function snapshotTimesheet(timesheet) {
  return {
    originalCheckInAt: timesheet?.actualCheckInAt || null,
    originalCheckOutAt: timesheet?.actualCheckOutAt || null,
    originalWorkedMinutes: Number(timesheet?.workedMinutes || 0),
    originalLatenessMinutes: Number(timesheet?.latenessMinutes || 0),
    originalEarlyLeaveMinutes: Number(timesheet?.earlyLeaveMinutes || 0),
    originalOvertimeMinutes: Number(timesheet?.overtimeMinutes || 0),
  };
}

async function logEvent({
  ctx,
  restaurantId,
  verb,
  requestId,
  status = "success",
  meta = {},
  diff = {},
}) {
  try {
    await EventLog.create({
      restaurantId,
      actorUserId: getActorId(ctx),
      verb,
      object: {
        kind: "AttendanceCorrectionRequest",
        id: requestId,
      },
      source: "attendance-correction",
      status,
      meta,
      diff,
      at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to log attendance correction event:", error.message);
  }
}

async function logPerformanceIncident(input) {
  try {
    await createPerformanceIncidentOnce(input);
  } catch (error) {
    console.warn("Failed to log performance incident:", error.message);
  }
}

async function resolveStaff(employeeId) {
  const oid = toObjectId(employeeId);
  if (!oid) throw new Error("employeeId không hợp lệ.");

  const staff = await Staff.findById(oid).populate("role");

  if (!staff || staff.userType !== "STAFF" || staff.deletedAt) {
    throw new Error("Không tìm thấy nhân viên.");
  }

  return staff;
}

function staffBelongsToRestaurant(staff, restaurantId) {
  return String(staff?.restaurantForStaff || "") === String(restaurantId || "");
}

async function resolveExistingTimesheet({
  timesheetId,
  employeeId,
  restaurantId,
  workDate,
  shiftId,
}) {
  const tsid = toObjectId(timesheetId);
  if (tsid) {
    return Timesheet.findById(tsid).populate("shiftId");
  }

  const filter = {
    employeeId: toObjectId(employeeId),
    restaurantId: toObjectId(restaurantId),
    workDate: {
      $gte: toStartOfDay(workDate),
      $lte: toEndOfDay(workDate),
    },
  };

  const sid = toObjectId(shiftId);
  if (sid) {
    filter.shiftId = sid;
  }

  return Timesheet.findOne(filter).populate("shiftId").sort({ createdAt: -1 });
}

async function resolveShift(shiftId) {
  const sid = toObjectId(shiftId);
  if (!sid) return null;
  const query = Shift.findById(sid);
  if (!query) return null;
  if (typeof query.lean === "function") {
    return query.lean();
  }
  return query;
}

function assertTimesheetMatchesRequestScope(
  timesheet,
  { employeeId, restaurantId, workDate, shiftId },
) {
  if (!timesheet) return;

  if (String(timesheet.employeeId || "") !== String(employeeId || "")) {
    throw new Error("Bảng công không thuộc nhân viên đã chọn.");
  }

  if (String(timesheet.restaurantId || "") !== String(restaurantId || "")) {
    throw new Error("Bảng công không thuộc nhà hàng đã chọn.");
  }

  if (!sameCalendarDay(timesheet.workDate, workDate)) {
    throw new Error("Bảng công không khớp ngày công yêu cầu.");
  }

  const requestedShiftId = toObjectId(shiftId);
  if (
    requestedShiftId &&
    String(timesheet.shiftId?._id || timesheet.shiftId || "") !==
      String(requestedShiftId)
  ) {
    throw new Error("Bảng công không khớp ca làm việc đã chọn.");
  }
}

function buildRequestedMetrics(
  existingTimesheet,
  requestedCheckInAt,
  requestedCheckOutAt,
) {
  const plannedStartTime =
    existingTimesheet?.plannedStartTime ||
    existingTimesheet?.shiftId?.startTime ||
    null;
  const plannedEndTime =
    existingTimesheet?.plannedEndTime ||
    existingTimesheet?.shiftId?.endTime ||
    null;

  return calculateAttendanceMetrics({
    plannedStartTime,
    plannedEndTime,
    actualCheckInAt:
      requestedCheckInAt || existingTimesheet?.actualCheckInAt || null,
    actualCheckOutAt:
      requestedCheckOutAt || existingTimesheet?.actualCheckOutAt || null,
  });
}

function mapCorrectionRequest(doc) {
  const employee = doc.employeeId;
  const requestedBy = doc.requestedBy;
  const reviewedBy = doc.reviewedBy;
  const appliedBy = doc.appliedBy;

  return {
    id: String(doc._id),
    employeeId: String(employee?._id || employee),
    employeeName: employee?.fullName || null,
    employeeCode: employee?.employeeCode || null,
    employeeRole: employee?.positionTitle || employee?.roleName || null,
    employeeAvatar: employee?.avatarUrl || employee?.avatar || null,

    restaurantId: String(doc.restaurantId),
    timesheetId: doc.timesheetId ? String(doc.timesheetId) : null,
    shiftId: doc.shiftId ? String(doc.shiftId) : null,
    workDate: doc.workDate,

    correctionType: doc.correctionType,
    status: doc.status,

    originalCheckInAt: doc.originalCheckInAt || null,
    originalCheckOutAt: doc.originalCheckOutAt || null,
    requestedCheckInAt: doc.requestedCheckInAt || null,
    requestedCheckOutAt: doc.requestedCheckOutAt || null,

    originalWorkedMinutes: Number(doc.originalWorkedMinutes || 0),
    requestedWorkedMinutes: Number(doc.requestedWorkedMinutes || 0),

    originalLatenessMinutes: Number(doc.originalLatenessMinutes || 0),
    requestedLatenessMinutes: Number(doc.requestedLatenessMinutes || 0),

    originalEarlyLeaveMinutes: Number(doc.originalEarlyLeaveMinutes || 0),
    requestedEarlyLeaveMinutes: Number(doc.requestedEarlyLeaveMinutes || 0),

    originalOvertimeMinutes: Number(doc.originalOvertimeMinutes || 0),
    requestedOvertimeMinutes: Number(doc.requestedOvertimeMinutes || 0),

    reason: doc.reason || "",
    evidenceNote: doc.evidenceNote || "",
    evidenceUrls: doc.evidenceUrls || [],

    requestedBy: requestedBy?._id
      ? String(requestedBy._id)
      : requestedBy
        ? String(requestedBy)
        : null,
    requestedByName: requestedBy?.fullName || null,
    requestedByRole: doc.requestedByRole || "",
    requestedAt: doc.requestedAt || null,

    reviewedBy: reviewedBy?._id
      ? String(reviewedBy._id)
      : reviewedBy
        ? String(reviewedBy)
        : null,
    reviewedByName: reviewedBy?.fullName || null,
    reviewedAt: doc.reviewedAt || null,
    reviewNote: doc.reviewNote || "",
    rejectionReason: doc.rejectionReason || "",

    appliedBy: appliedBy?._id
      ? String(appliedBy._id)
      : appliedBy
        ? String(appliedBy)
        : null,
    appliedByName: appliedBy?.fullName || null,
    appliedAt: doc.appliedAt || null,

    auditLogs: (doc.auditLogs || []).map((item) => ({
      action: item.action,
      actorId: item.actorId ? String(item.actorId) : null,
      actorName: item.actorName || "",
      note: item.note || "",
      at: item.at || null,
      meta: item.meta || null,
    })),

    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

async function populateRequest(queryOrDoc) {
  if (!queryOrDoc) return null;

  if (typeof queryOrDoc.populate === "function") {
    return queryOrDoc
      .populate(
        "employeeId",
        "fullName employeeCode positionTitle roleName avatarUrl avatar",
      )
      .populate("requestedBy", "fullName email username")
      .populate("reviewedBy", "fullName email username")
      .populate("appliedBy", "fullName email username");
  }

  return queryOrDoc;
}

export async function listAttendanceCorrectionRequests({ filter = {}, ctx }) {
  assertAuthenticated(ctx);
  assertCanView(ctx);

  const actorId = getActorId(ctx);
  const actorRole = getActorRole(ctx);
  const restaurantId = toObjectId(filter.restaurantId);

  if (!restaurantId) {
    throw new Error("restaurantId không hợp lệ.");
  }
  await assertRestaurantScope(ctx, restaurantId);

  const query = { restaurantId };

  if (filter.employeeId) query.employeeId = toObjectId(filter.employeeId);
  if (filter.status) query.status = String(filter.status).toLowerCase();

  if (filter.startDate || filter.endDate) {
    query.workDate = {};
    if (filter.startDate) query.workDate.$gte = toStartOfDay(filter.startDate);
    if (filter.endDate) query.workDate.$lte = toEndOfDay(filter.endDate);
  }

  if (actorRole === "staff") {
    query.employeeId = actorId;
  }

  let rows = await AttendanceCorrectionRequest.find(query)
    .sort({ createdAt: -1, workDate: -1 })
    .limit(500)
    .populate(
      "employeeId",
      "fullName employeeCode positionTitle roleName avatarUrl avatar",
    )
    .populate("requestedBy", "fullName email username")
    .populate("reviewedBy", "fullName email username")
    .populate("appliedBy", "fullName email username");

  if (filter.search) {
    const search = String(filter.search).trim().toLowerCase();
    rows = rows.filter((row) => {
      const employee = row.employeeId;
      return (
        String(employee?.fullName || "")
          .toLowerCase()
          .includes(search) ||
        String(employee?.employeeCode || "")
          .toLowerCase()
          .includes(search) ||
        String(row.reason || "")
          .toLowerCase()
          .includes(search)
      );
    });
  }

  rows.sort((left, right) => {
    const statusDiff =
      (PENDING_FIRST_STATUS_RANK[left.status] ?? 99) -
      (PENDING_FIRST_STATUS_RANK[right.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;

    const rightWorkDate = new Date(right.workDate || 0).getTime();
    const leftWorkDate = new Date(left.workDate || 0).getTime();
    if (rightWorkDate !== leftWorkDate) return rightWorkDate - leftWorkDate;

    return (
      new Date(right.createdAt || 0).getTime() -
      new Date(left.createdAt || 0).getTime()
    );
  });

  return rows.map(mapCorrectionRequest);
}

export async function getAttendanceCorrectionRequest({ id, ctx }) {
  assertAuthenticated(ctx);
  assertCanView(ctx);

  const doc = await AttendanceCorrectionRequest.findById(id)
    .populate(
      "employeeId",
      "fullName employeeCode positionTitle roleName avatarUrl avatar",
    )
    .populate("requestedBy", "fullName email username")
    .populate("reviewedBy", "fullName email username")
    .populate("appliedBy", "fullName email username");

  if (!doc) return null;
  await assertRestaurantScope(ctx, doc.restaurantId);

  const actorRole = getActorRole(ctx);
  const actorId = getActorId(ctx);

  if (
    actorRole === "staff" &&
    String(doc.employeeId?._id || doc.employeeId) !== String(actorId)
  ) {
    throw new Error("Bạn không có quyền xem yêu cầu chỉnh công này.");
  }

  return mapCorrectionRequest(doc);
}

export async function createAttendanceCorrectionRequest({ input, ctx }) {
  assertAuthenticated(ctx);

  const employeeId = toObjectId(input.employeeId);
  const restaurantId = toObjectId(input.restaurantId);
  const timesheetId = toObjectId(input.timesheetId);
  const shiftId = toObjectId(input.shiftId);
  const workDate = toStartOfDay(input.workDate);

  if (!employeeId) throw new Error("employeeId không hợp lệ.");
  if (!restaurantId) throw new Error("restaurantId không hợp lệ.");
  if (
    !ALLOWED_CORRECTION_TYPES.has(
      String(input.correctionType || "").toLowerCase(),
    )
  ) {
    throw new Error("Loại yêu cầu chỉnh công không hợp lệ.");
  }

  const reason = String(input.reason || "").trim();
  if (reason.length < 5) {
    throw new Error("Lý do chỉnh công phải có ít nhất 5 ký tự.");
  }

  const requestedCheckInAt = toValidDate(
    input.requestedCheckInAt,
    "Giờ check-in đề xuất",
  );
  const requestedCheckOutAt = toValidDate(
    input.requestedCheckOutAt,
    "Giờ check-out đề xuất",
  );

  if (!requestedCheckInAt && !requestedCheckOutAt) {
    throw new Error(
      "Cần nhập ít nhất một giờ check-in hoặc check-out đề xuất.",
    );
  }

  validateCorrectionRequestPayload({
    correctionType: input.correctionType,
    requestedCheckInAt,
    requestedCheckOutAt,
    requestedWorkedMinutes: input.requestedWorkedMinutes,
  });

  assertCanCreateForEmployee(ctx, employeeId);
  await assertRestaurantScope(ctx, restaurantId);

  const staff = await resolveStaff(employeeId);
  if (!staffBelongsToRestaurant(staff, restaurantId)) {
    throw new Error("Nhân viên không thuộc nhà hàng đã chọn.");
  }

  await assertNoLockedPayrollPeriodOverlap({
    restaurantId,
    employeeId,
    startDate: workDate,
    endDate: toEndOfDay(workDate),
    action: "attendance_correction",
  });

  const existingTimesheet = await resolveExistingTimesheet({
    timesheetId,
    employeeId,
    restaurantId,
    workDate,
    shiftId,
  });
  assertTimesheetMatchesRequestScope(existingTimesheet, {
    employeeId,
    restaurantId,
    workDate,
    shiftId,
  });

  const pendingFilter = {
    employeeId,
    restaurantId,
    workDate,
    status: "pending",
  };

  if (existingTimesheet?._id) {
    pendingFilter.timesheetId = existingTimesheet._id;
  } else if (timesheetId) {
    pendingFilter.timesheetId = timesheetId;
  }

  const existingPending = await AttendanceCorrectionRequest.findOne(
    pendingFilter,
  );
  if (existingPending) {
    throw new Error("ATTENDANCE_CORRECTION_PENDING_EXISTS");
  }

  const snapshot = snapshotTimesheet(existingTimesheet);
  const requestedMetrics = buildRequestedMetrics(
    existingTimesheet,
    requestedCheckInAt,
    requestedCheckOutAt,
  );

  const actorId = getActorId(ctx);
  const doc = await AttendanceCorrectionRequest.create({
    employeeId,
    restaurantId,
    timesheetId: existingTimesheet?._id || timesheetId || null,
    shiftId:
      existingTimesheet?.shiftId?._id ||
      existingTimesheet?.shiftId ||
      shiftId ||
      null,
    workDate,

    correctionType: String(input.correctionType).toLowerCase(),

    ...snapshot,

    requestedCheckInAt,
    requestedCheckOutAt,
    requestedWorkedMinutes: requestedMetrics.workedMinutes,
    requestedLatenessMinutes: requestedMetrics.latenessMinutes,
    requestedEarlyLeaveMinutes: requestedMetrics.earlyLeaveMinutes,
    requestedOvertimeMinutes: requestedMetrics.overtimeMinutes,

    reason,
    evidenceNote: String(input.evidenceNote || "").trim(),
    evidenceUrls: Array.isArray(input.evidenceUrls)
      ? input.evidenceUrls.filter(Boolean)
      : [],

    status: "pending",
    requestedBy: actorId,
    requestedByRole: getActorRole(ctx),
    requestedAt: new Date(),

    auditLogs: [
      buildAuditLog(ctx, "attendance_correction.create", reason, {
        requestedCheckInAt,
        requestedCheckOutAt,
      }),
    ],
  });

  await logEvent({
    ctx,
    restaurantId,
    verb: "attendance.correction.create",
    requestId: doc._id,
    meta: {
      employeeId: String(employeeId),
      workDate,
      correctionType: doc.correctionType,
    },
  });
  await logPerformanceIncident({
    restaurantId,
    employeeId,
    actorId,
    actorRole: getActorRole(ctx),
    sourceType: "attendance_correction",
    sourceId: String(doc._id),
    eventType: "ATTENDANCE_CORRECTION_CREATED",
    severity: "info",
    responsibilityStatus: "pending_review",
    scoreImpactStatus: "not_applicable",
    occurredAt: new Date(),
    metadata: { correctionType: doc.correctionType, workDate, reason },
  });

  try {
    await notifyReviewers({
      restaurantId,
      type: "attendance_correction_created",
      sourceType: "attendance_correction",
      sourceId: String(doc._id),
      actionUrl: "/manager/performance",
      payload: {
        title: "Có yêu cầu sửa công mới",
        message: "Một nhân viên đã gửi yêu cầu sửa chấm công.",
      },
    });
  } catch (error) {
    console.warn("Failed to create notification:", error.message);
  }

  const populated = await populateRequest(doc);
  return mapCorrectionRequest(populated);
}

async function applyCorrectionToTimesheet({ request, ctx, reviewNote }) {
  let timesheet = await resolveExistingTimesheet({
    timesheetId: request.timesheetId,
    employeeId: request.employeeId,
    restaurantId: request.restaurantId,
    workDate: request.workDate,
    shiftId: request.shiftId,
  });

  const shift = timesheet?.shiftId || (await resolveShift(request.shiftId));

  const actualCheckInAt =
    request.requestedCheckInAt || timesheet?.actualCheckInAt || null;
  const actualCheckOutAt =
    request.requestedCheckOutAt || timesheet?.actualCheckOutAt || null;
  const plannedStartTime =
    timesheet?.plannedStartTime || shift?.startTime || null;
  const plannedEndTime = timesheet?.plannedEndTime || shift?.endTime || null;

  const metrics = calculateAttendanceMetrics({
    plannedStartTime,
    plannedEndTime,
    actualCheckInAt,
    actualCheckOutAt,
  });

  const isOffSchedule = !shift;
  const nextStatus = deriveAttendanceStatus({
    actualCheckInAt,
    actualCheckOutAt,
    isOffSchedule,
    latenessMinutes: metrics.latenessMinutes,
    earlyLeaveMinutes: metrics.earlyLeaveMinutes,
  });

  const before = timesheet
    ? {
        actualCheckInAt: timesheet.actualCheckInAt || null,
        actualCheckOutAt: timesheet.actualCheckOutAt || null,
        workedMinutes: Number(timesheet.workedMinutes || 0),
        latenessMinutes: Number(timesheet.latenessMinutes || 0),
        earlyLeaveMinutes: Number(timesheet.earlyLeaveMinutes || 0),
        overtimeMinutes: Number(timesheet.overtimeMinutes || 0),
        approvedOvertimeMinutes: Number(timesheet.approvedOvertimeMinutes || 0),
        overtimeApprovalStatus: timesheet.overtimeApprovalStatus || null,
        source: timesheet.source || null,
        isOffSchedule: Boolean(timesheet.isOffSchedule),
        offScheduleApprovalStatus: timesheet.offScheduleApprovalStatus || null,
      }
    : null;

  const correctionType = String(request.correctionType || "").toLowerCase();
  if (!timesheet && !ALLOWED_CREATE_WITHOUT_TIMESHEET_TYPES.has(correctionType)) {
    throw new Error("Không tìm thấy bảng công để áp dụng chỉnh công.");
  }

  const noteText = `Chỉnh công đã duyệt: ${reviewNote || request.reason}`;
  const reviewActorId = getActorId(ctx);
  const previousOvertimeMinutes = Number(timesheet?.overtimeMinutes || 0);

  if (!timesheet) {
    const overtimeState = buildAttendanceOvertimeState({
      overtimeMinutes: metrics.overtimeMinutes,
      currentStatus: "not_required",
      approvedOvertimeMinutes: 0,
    });

    timesheet = await Timesheet.create({
      employeeId: request.employeeId,
      restaurantId: request.restaurantId,
      shiftId: request.shiftId || null,
      workDate: toStartOfDay(request.workDate),
      plannedStartTime,
      plannedEndTime,
      actualCheckInAt,
      actualCheckOutAt,
      ...metrics,
      ...overtimeState,
      status: nextStatus,
      isOffSchedule,
      approved: isOffSchedule,
      offScheduleApprovalStatus: isOffSchedule ? "approved" : "not_required",
      offScheduleReviewedBy: isOffSchedule ? reviewActorId : null,
      offScheduleReviewedAt: isOffSchedule ? new Date() : null,
      offScheduleReviewNote: isOffSchedule ? reviewNote || request.reason : "",
      source: "manual_correction",
      note: appendNote("", `Chỉnh công đã duyệt: ${request.reason}`),
    });
    if (timesheet && typeof timesheet.populate === "function") {
      await timesheet.populate("shiftId");
    }
  } else {
    timesheet.actualCheckInAt = actualCheckInAt;
    timesheet.actualCheckOutAt = actualCheckOutAt;
    timesheet.workedMinutes = metrics.workedMinutes;
    timesheet.hours = metrics.hours;
    timesheet.latenessMinutes = metrics.latenessMinutes;
    timesheet.earlyLeaveMinutes = metrics.earlyLeaveMinutes;
    timesheet.overtimeMinutes = metrics.overtimeMinutes;
    timesheet.status = nextStatus;
    timesheet.source = "manual_correction";
    timesheet.note = appendNote(timesheet.note, noteText);

    if (isOffSchedule) {
      timesheet.approved = true;
      timesheet.offScheduleApprovalStatus = "approved";
      timesheet.offScheduleReviewedBy = reviewActorId;
      timesheet.offScheduleReviewedAt = new Date();
      timesheet.offScheduleReviewNote = reviewNote || request.reason;
    }

    applyAttendanceOvertimeState(timesheet, {
      previousOvertimeMinutes,
      preserveApproved: true,
    });

    await timesheet.save();
  }

  const after = {
    actualCheckInAt: timesheet.actualCheckInAt || null,
    actualCheckOutAt: timesheet.actualCheckOutAt || null,
    workedMinutes: Number(timesheet.workedMinutes || 0),
    latenessMinutes: Number(timesheet.latenessMinutes || 0),
    earlyLeaveMinutes: Number(timesheet.earlyLeaveMinutes || 0),
    overtimeMinutes: Number(timesheet.overtimeMinutes || 0),
    approvedOvertimeMinutes: Number(timesheet.approvedOvertimeMinutes || 0),
    overtimeApprovalStatus: timesheet.overtimeApprovalStatus || null,
    source: timesheet.source || null,
    isOffSchedule: Boolean(timesheet.isOffSchedule),
    offScheduleApprovalStatus: timesheet.offScheduleApprovalStatus || null,
  };

  await logEvent({
    ctx,
    restaurantId: request.restaurantId,
    verb: "attendance.correction.apply",
    requestId: request._id,
    diff: {
      before,
      after,
    },
  });

  try {
    await syncAttendancePerformanceIncidents(timesheet, {
      actorId: reviewActorId,
      actorRole: getActorRole(ctx),
    });
  } catch (error) {
    console.warn("Failed to sync attendance performance incidents:", error.message);
  }

  return timesheet;
}

export async function approveAttendanceCorrectionRequest({ input, ctx }) {
  assertAuthenticated(ctx);
  assertCanReview(ctx);

  const request = await AttendanceCorrectionRequest.findById(input.requestId);
  if (!request) throw new Error("Không tìm thấy yêu cầu chỉnh công.");
  await assertRestaurantScope(ctx, request.restaurantId);

  if (request.status !== "pending") {
    if (request.status === "applied") {
      throw new Error("ATTENDANCE_CORRECTION_ALREADY_APPLIED");
    }
    throw new Error("Chỉ có thể duyệt yêu cầu đang chờ xử lý.");
  }

  const actorId = getActorId(ctx);
  if (
    !isAdmin(ctx) &&
    request.requestedBy &&
    String(request.requestedBy) === String(actorId)
  ) {
    throw new Error("Người tạo yêu cầu không được tự duyệt yêu cầu của mình.");
  }

  await assertNoLockedPayrollPeriodOverlap({
    restaurantId: request.restaurantId,
    employeeId: request.employeeId,
    startDate: request.workDate,
    endDate: toEndOfDay(request.workDate),
    action: "attendance_correction",
  });

  const note = String(input.note || "").trim();

  await applyCorrectionToTimesheet({ request, ctx, reviewNote: note });

  request.status = "applied";
  request.reviewedBy = actorId;
  request.reviewedAt = new Date();
  request.reviewNote = note;
  request.appliedBy = actorId;
  request.appliedAt = new Date();
  request.auditLogs.push(
    buildAuditLog(ctx, "attendance_correction.approve", note),
  );
  request.auditLogs.push(
    buildAuditLog(ctx, "attendance_correction.apply", note),
  );
  await request.save();

  await logEvent({
    ctx,
    restaurantId: request.restaurantId,
    verb: "attendance.correction.approve",
    requestId: request._id,
    meta: { employeeId: String(request.employeeId) },
  });
  await logPerformanceIncident({
    restaurantId: request.restaurantId,
    employeeId: request.employeeId,
    actorId,
    actorRole: getActorRole(ctx),
    sourceType: "attendance_correction",
    sourceId: String(request._id),
    eventType: "ATTENDANCE_CORRECTION_APPLIED",
    severity: "info",
    responsibilityStatus: "no_fault",
    scoreImpactStatus: "waived",
    occurredAt: new Date(),
    metadata: {
      reviewNote: note,
      requestedCheckInAt: request.requestedCheckInAt,
      requestedCheckOutAt: request.requestedCheckOutAt,
    },
  });

  try {
    await notifyUser({
      userId: request.employeeId,
      restaurantId: request.restaurantId,
      type: "attendance_correction_applied",
      sourceType: "attendance_correction",
      sourceId: String(request._id),
      actionUrl: "/staff/attendance",
      payload: {
        title: "Yêu cầu sửa công đã được duyệt",
        message: "Yêu cầu sửa công của bạn đã được áp dụng.",
      },
    });
  } catch (error) {
    console.warn("Failed to create notification:", error.message);
  }

  const populated = await AttendanceCorrectionRequest.findById(request._id)
    .populate(
      "employeeId",
      "fullName employeeCode positionTitle roleName avatarUrl avatar",
    )
    .populate("requestedBy", "fullName email username")
    .populate("reviewedBy", "fullName email username")
    .populate("appliedBy", "fullName email username");

  return mapCorrectionRequest(populated);
}

export async function rejectAttendanceCorrectionRequest({ input, ctx }) {
  assertAuthenticated(ctx);
  assertCanReview(ctx);

  const reason = String(input.reason || "").trim();
  if (reason.length < 3) {
    throw new Error("Lý do từ chối là bắt buộc.");
  }

  const request = await AttendanceCorrectionRequest.findById(input.requestId);
  if (!request) throw new Error("Không tìm thấy yêu cầu chỉnh công.");
  await assertRestaurantScope(ctx, request.restaurantId);

  if (request.status !== "pending") {
    throw new Error("Chỉ có thể từ chối yêu cầu đang chờ xử lý.");
  }

  request.status = "rejected";
  request.reviewedBy = getActorId(ctx);
  request.reviewedAt = new Date();
  request.rejectionReason = reason;
  request.auditLogs.push(
    buildAuditLog(ctx, "attendance_correction.reject", reason),
  );
  await request.save();

  await logEvent({
    ctx,
    restaurantId: request.restaurantId,
    verb: "attendance.correction.reject",
    requestId: request._id,
    status: "success",
    meta: { reason },
  });
  await logPerformanceIncident({
    restaurantId: request.restaurantId,
    employeeId: request.employeeId,
    actorId: getActorId(ctx),
    actorRole: getActorRole(ctx),
    sourceType: "attendance_correction",
    sourceId: String(request._id),
    eventType: "ATTENDANCE_CORRECTION_REJECTED",
    severity: "warning",
    responsibilityStatus: "pending_review",
    scoreImpactStatus: "eligible",
    occurredAt: new Date(),
    metadata: { rejectionReason: reason, reviewNote: request.reviewNote || "" },
  });

  try {
    await notifyUser({
      userId: request.employeeId,
      restaurantId: request.restaurantId,
      type: "attendance_correction_rejected",
      sourceType: "attendance_correction",
      sourceId: String(request._id),
      actionUrl: "/staff/attendance",
      payload: {
        title: "Yêu cầu sửa công bị từ chối",
        message: "Yêu cầu sửa công của bạn đã bị từ chối.",
      },
    });
  } catch (error) {
    console.warn("Failed to create notification:", error.message);
  }

  const populated = await AttendanceCorrectionRequest.findById(request._id)
    .populate(
      "employeeId",
      "fullName employeeCode positionTitle roleName avatarUrl avatar",
    )
    .populate("requestedBy", "fullName email username")
    .populate("reviewedBy", "fullName email username")
    .populate("appliedBy", "fullName email username");

  return mapCorrectionRequest(populated);
}

export async function cancelAttendanceCorrectionRequest({ requestId, ctx }) {
  assertAuthenticated(ctx);

  const request = await AttendanceCorrectionRequest.findById(requestId);
  if (!request) throw new Error("Không tìm thấy yêu cầu chỉnh công.");
  await assertRestaurantScope(ctx, request.restaurantId);

  assertCanCancel(ctx, request);

  if (request.status !== "pending") {
    throw new Error("Chỉ có thể hủy yêu cầu đang chờ xử lý.");
  }

  request.status = "cancelled";
  request.auditLogs.push(
    buildAuditLog(ctx, "attendance_correction.cancel", "Hủy yêu cầu"),
  );
  await request.save();

  await logEvent({
    ctx,
    restaurantId: request.restaurantId,
    verb: "attendance.correction.cancel",
    requestId: request._id,
    status: "success",
  });

  const populated = await AttendanceCorrectionRequest.findById(request._id)
    .populate(
      "employeeId",
      "fullName employeeCode positionTitle roleName avatarUrl avatar",
    )
    .populate("requestedBy", "fullName email username")
    .populate("reviewedBy", "fullName email username")
    .populate("appliedBy", "fullName email username");

  return mapCorrectionRequest(populated);
}
