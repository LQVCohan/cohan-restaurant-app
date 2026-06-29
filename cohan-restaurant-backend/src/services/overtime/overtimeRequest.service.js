import mongoose from "mongoose";
import {
  EventLog,
  OvertimeRequest,
  Shift,
  Staff,
  Timesheet,
} from "../../../models/index.js";
import { assertNoLockedPayrollPeriodOverlap } from "../payroll/payrollLockGuard.service.js";
import {
  ATTENDANCE_READ_ROLES,
  ATTENDANCE_REVIEW_ROLES,
  userCanAccessRestaurant,
  userHasAnyRole,
} from "../scheduling/schedulingPermission.service.js";
import { createPerformanceIncidentOnce } from "../performance/performanceIncident.service.js";
import { notifyReviewers, notifyUser } from "../notification/notificationWorkflow.service.js";

const { Types } = mongoose;

const OVERTIME_TYPES = new Set([
  "weekday",
  "weekend",
  "holiday",
  "night",
  "emergency",
  "other",
]);

const BLOCKING_PAYROLL_STATUSES = new Set([
  "pending_employee_confirmation",
  "pending_approval",
  "approved",
]);

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new Types.ObjectId(value);
}

function toValidDate(value, fieldName) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} không hợp lệ.`);
  }
  return date;
}

function toStartOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toEndOfDay(value) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function minutesBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s)
    return 0;
  return Math.round((e.getTime() - s.getTime()) / 60000);
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

function isReviewer(ctx) {
  return userHasAnyRole(ctx?.user, ATTENDANCE_REVIEW_ROLES);
}

function assertCanView(ctx) {
  if (!userHasAnyRole(ctx?.user, [...ATTENDANCE_READ_ROLES, "STAFF"])) {
    throw new Error("Bạn không có quyền xem yêu cầu tăng ca.");
  }
}
async function assertRestaurantScope(ctx, restaurantId) {
  if (!await userCanAccessRestaurant(ctx?.user, restaurantId)) {
    throw new Error("RESTAURANT_SCOPE_FORBIDDEN");
  }
}

function assertCanReview(ctx) {
  if (!isReviewer(ctx)) {
    throw new Error("Bạn không có quyền duyệt yêu cầu tăng ca.");
  }
}

function assertCanCreate(ctx, employeeId) {
  const role = getActorRole(ctx);
  const actorId = getActorId(ctx);

  if (isReviewer(ctx)) return;

  if (role === "staff" && actorId && String(actorId) === String(employeeId)) {
    return;
  }

  throw new Error("Bạn không có quyền tạo yêu cầu tăng ca cho nhân viên này.");
}

function assertCanConfirm(ctx, request) {
  const actorId = getActorId(ctx);
  if (actorId && String(actorId) === String(request.employeeId)) return;
  throw new Error("Bạn không có quyền xác nhận yêu cầu tăng ca này.");
}

function assertCanCancel(ctx, request) {
  if (isReviewer(ctx)) return;

  const actorId = getActorId(ctx);
  if (actorId && String(actorId) === String(request.employeeId)) return;

  throw new Error("Bạn không có quyền hủy yêu cầu tăng ca này.");
}

function buildAudit(ctx, action, note = "", meta = null) {
  return {
    action,
    actorId: getActorId(ctx),
    actorName: getActorName(ctx),
    note,
    at: new Date(),
    meta,
  };
}

async function logOvertimeEvent({
  ctx,
  restaurantId,
  requestId,
  verb,
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
        kind: "OvertimeRequest",
        id: requestId,
      },
      source: "overtime-request",
      status,
      meta,
      diff,
      at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to log overtime event:", error.message);
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

  const staff = await Staff.findById(oid).lean();

  if (!staff || staff.userType !== "STAFF" || staff.deletedAt) {
    throw new Error("Không tìm thấy nhân viên.");
  }

  return staff;
}

function staffBelongsToRestaurant(staff, restaurantId) {
  return String(staff?.restaurantForStaff || "") === String(restaurantId || "");
}

async function findTimesheetForRequest(request) {
  if (request.timesheetId) {
    return Timesheet.findOne({
      _id: request.timesheetId,
      employeeId: request.employeeId,
      restaurantId: request.restaurantId,
      workDate: {
        $gte: toStartOfDay(request.workDate),
        $lte: toEndOfDay(request.workDate),
      },
    });
  }

  const filter = {
    employeeId: request.employeeId,
    restaurantId: request.restaurantId,
    workDate: {
      $gte: toStartOfDay(request.workDate),
      $lte: toEndOfDay(request.workDate),
    },
  };

  if (request.shiftId) {
    filter.shiftId = request.shiftId;
  }

  return Timesheet.findOne(filter).sort({ createdAt: -1 });
}

async function mapRequest(docOrQuery) {
  const doc = await Promise.resolve(docOrQuery);
  if (!doc) return null;

  const populatePaths = [
    {
      path: "employeeId",
      select: "fullName employeeCode positionTitle roleName avatarUrl avatar",
    },
    {
      path: "requestedBy",
      select: "fullName email username",
    },
    {
      path: "employeeConfirmedBy",
      select: "fullName email username",
    },
    {
      path: "approvedBy",
      select: "fullName email username",
    },
    {
      path: "rejectedBy",
      select: "fullName email username",
    },
    {
      path: "cancelledBy",
      select: "fullName email username",
    },
    {
      path: "completedBy",
      select: "fullName email username",
    },
  ];

  let row = doc;

  if (typeof row.populate === "function") {
    row = await row.populate(populatePaths);
  }

  const employee = row.employeeId;

  return {
    id: String(row._id),

    employeeId: String(employee?._id || employee),
    employeeName: employee?.fullName || null,
    employeeCode: employee?.employeeCode || null,
    employeeRole: employee?.positionTitle || employee?.roleName || null,
    employeeAvatar: employee?.avatarUrl || employee?.avatar || null,

    restaurantId: String(row.restaurantId),
    shiftId: row.shiftId ? String(row.shiftId) : null,
    timesheetId: row.timesheetId ? String(row.timesheetId) : null,
    workDate: row.workDate,

    plannedStartTime: row.plannedStartTime,
    plannedEndTime: row.plannedEndTime,
    plannedOvertimeMinutes: Number(row.plannedOvertimeMinutes || 0),

    actualStartTime: row.actualStartTime || null,
    actualEndTime: row.actualEndTime || null,
    actualOvertimeMinutes: Number(row.actualOvertimeMinutes || 0),

    approvedOvertimeMinutes: Number(row.approvedOvertimeMinutes || 0),

    overtimeType: row.overtimeType || "weekday",
    reason: row.reason || "",
    status: row.status || "pending_approval",

    employeeConfirmationRequired: Boolean(row.employeeConfirmationRequired),
    employeeConfirmedAt: row.employeeConfirmedAt || null,
    employeeConfirmedBy: row.employeeConfirmedBy?._id
      ? String(row.employeeConfirmedBy._id)
      : row.employeeConfirmedBy
        ? String(row.employeeConfirmedBy)
        : null,
    employeeConfirmedByName: row.employeeConfirmedBy?.fullName || null,
    employeeConfirmationNote: row.employeeConfirmationNote || "",

    requestedBy: row.requestedBy?._id
      ? String(row.requestedBy._id)
      : row.requestedBy
        ? String(row.requestedBy)
        : null,
    requestedByName: row.requestedBy?.fullName || null,
    requestedByRole: row.requestedByRole || "",
    requestedAt: row.requestedAt || null,

    approvedBy: row.approvedBy?._id
      ? String(row.approvedBy._id)
      : row.approvedBy
        ? String(row.approvedBy)
        : null,
    approvedByName: row.approvedBy?.fullName || null,
    approvedAt: row.approvedAt || null,
    approvalNote: row.approvalNote || "",

    rejectedBy: row.rejectedBy?._id
      ? String(row.rejectedBy._id)
      : row.rejectedBy
        ? String(row.rejectedBy)
        : null,
    rejectedByName: row.rejectedBy?.fullName || null,
    rejectedAt: row.rejectedAt || null,
    rejectionReason: row.rejectionReason || "",

    cancelledBy: row.cancelledBy?._id
      ? String(row.cancelledBy._id)
      : row.cancelledBy
        ? String(row.cancelledBy)
        : null,
    cancelledByName: row.cancelledBy?.fullName || null,
    cancelledAt: row.cancelledAt || null,
    cancelReason: row.cancelReason || "",

    completedBy: row.completedBy?._id
      ? String(row.completedBy._id)
      : row.completedBy
        ? String(row.completedBy)
        : null,
    completedByName: row.completedBy?.fullName || null,
    completedAt: row.completedAt || null,
    completionNote: row.completionNote || "",

    payrollPeriodId: row.payrollPeriodId ? String(row.payrollPeriodId) : null,

    auditLogs: (row.auditLogs || []).map((log) => ({
      action: log.action,
      actorId: log.actorId ? String(log.actorId) : null,
      actorName: log.actorName || "",
      note: log.note || "",
      at: log.at || null,
      meta: log.meta || null,
    })),

    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

export async function listOvertimeRequests({ filter = {}, ctx }) {
  assertCanView(ctx);

  const query = {};
  const actorRole = getActorRole(ctx);
  const actorId = getActorId(ctx);

  if (filter.restaurantId) query.restaurantId = toObjectId(filter.restaurantId);
  if (filter.restaurantId) await assertRestaurantScope(ctx, filter.restaurantId);
  if (filter.employeeId) query.employeeId = toObjectId(filter.employeeId);
  if (filter.status && filter.status !== "all")
    query.status = String(filter.status);
  if (filter.overtimeType && filter.overtimeType !== "all")
    query.overtimeType = String(filter.overtimeType);

  if (filter.startDate || filter.endDate) {
    query.workDate = {};
    if (filter.startDate) query.workDate.$gte = toStartOfDay(filter.startDate);
    if (filter.endDate) query.workDate.$lte = toEndOfDay(filter.endDate);
  }

  if (actorRole === "staff") {
    query.employeeId = actorId;
  }

  let rows = await OvertimeRequest.find(query)
    .sort({ workDate: -1, createdAt: -1 })
    .limit(500)
    .populate(
      "employeeId",
      "fullName employeeCode positionTitle roleName avatarUrl avatar",
    )
    .populate("requestedBy", "fullName email username")
    .populate("employeeConfirmedBy", "fullName email username")
    .populate("approvedBy", "fullName email username")
    .populate("rejectedBy", "fullName email username")
    .populate("cancelledBy", "fullName email username")
    .populate("completedBy", "fullName email username");

  if (filter.search) {
    const needle = String(filter.search).toLowerCase();
    rows = rows.filter((row) => {
      const employee = row.employeeId;
      return (
        String(employee?.fullName || "")
          .toLowerCase()
          .includes(needle) ||
        String(employee?.employeeCode || "")
          .toLowerCase()
          .includes(needle) ||
        String(row.reason || "")
          .toLowerCase()
          .includes(needle)
      );
    });
  }

  return Promise.all(rows.map(mapRequest));
}

export async function getOvertimeRequest({ id, ctx }) {
  assertCanView(ctx);

  const row = await OvertimeRequest.findById(id)
    .populate(
      "employeeId",
      "fullName employeeCode positionTitle roleName avatarUrl avatar",
    )
    .populate("requestedBy", "fullName email username")
    .populate("employeeConfirmedBy", "fullName email username")
    .populate("approvedBy", "fullName email username")
    .populate("rejectedBy", "fullName email username")
    .populate("cancelledBy", "fullName email username")
    .populate("completedBy", "fullName email username");

  if (!row) return null;
  await assertRestaurantScope(ctx, row.restaurantId);

  const actorRole = getActorRole(ctx);
  const actorId = getActorId(ctx);

  if (
    actorRole === "staff" &&
    String(row.employeeId?._id || row.employeeId) !== String(actorId)
  ) {
    throw new Error("Bạn không có quyền xem yêu cầu tăng ca này.");
  }

  return mapRequest(row);
}

export async function createOvertimeRequest({ input, ctx }) {
  const employeeId = toObjectId(input.employeeId);
  const restaurantId = toObjectId(input.restaurantId);
  const shiftId = toObjectId(input.shiftId);
  const timesheetId = toObjectId(input.timesheetId);

  if (!employeeId) throw new Error("employeeId không hợp lệ.");
  if (!restaurantId) throw new Error("restaurantId không hợp lệ.");
  await assertRestaurantScope(ctx, restaurantId);

  assertCanCreate(ctx, employeeId);

  const staff = await resolveStaff(employeeId);
  if (!staffBelongsToRestaurant(staff, restaurantId)) {
    throw new Error("Nhân viên không thuộc nhà hàng đã chọn.");
  }

  const plannedStartTime = toValidDate(
    input.plannedStartTime,
    "Giờ bắt đầu tăng ca",
  );
  const plannedEndTime = toValidDate(
    input.plannedEndTime,
    "Giờ kết thúc tăng ca",
  );

  if (plannedEndTime <= plannedStartTime) {
    throw new Error("Giờ kết thúc tăng ca phải lớn hơn giờ bắt đầu.");
  }

  const workDate = toStartOfDay(input.workDate || plannedStartTime);
  const plannedMinutes =
    Number(input.plannedOvertimeMinutes || 0) > 0
      ? Number(input.plannedOvertimeMinutes)
      : minutesBetween(plannedStartTime, plannedEndTime);

  if (plannedMinutes < 0) {
    throw new Error("Số phút tăng ca dự kiến không hợp lệ.");
  }

  if (plannedMinutes === 0) {
    throw new Error("Số phút tăng ca dự kiến phải lớn hơn 0.");
  }

  if (plannedMinutes > 12 * 60) {
    throw new Error("Tăng ca dự kiến không được vượt quá 12 giờ.");
  }

  const overtimeType = String(input.overtimeType || "weekday").toLowerCase();
  if (!OVERTIME_TYPES.has(overtimeType)) {
    throw new Error("Loại tăng ca không hợp lệ.");
  }

  const reason = String(input.reason || "").trim();
  if (reason.length < 5) {
    throw new Error("Lý do tăng ca phải có ít nhất 5 ký tự.");
  }

  await assertNoLockedPayrollPeriodOverlap({
    restaurantId,
    employeeId,
    startDate: workDate,
    endDate: toEndOfDay(workDate),
    action: "overtime_request",
  });

  const duplicateFilter = {
    employeeId,
    restaurantId,
    workDate,
    status: {
      $in: ["pending_employee_confirmation", "pending_approval", "approved"],
    },
  };
  if (shiftId) duplicateFilter.shiftId = shiftId;
  if (timesheetId) duplicateFilter.timesheetId = timesheetId;

  const duplicate = await OvertimeRequest.findOne(duplicateFilter);

  if (duplicate) {
    throw new Error("OVERTIME_REQUEST_PENDING_EXISTS");
  }

  const employeeConfirmationRequired = Boolean(
    input.employeeConfirmationRequired,
  );
  const actorRole = getActorRole(ctx);
  const actorId = getActorId(ctx);

  const isSelfStaffRequest =
    actorRole === "staff" && String(actorId) === String(employeeId);

  const status =
    employeeConfirmationRequired && !isSelfStaffRequest
      ? "pending_employee_confirmation"
      : "pending_approval";

  const doc = await OvertimeRequest.create({
    employeeId,
    restaurantId,
    shiftId,
    timesheetId,
    workDate,

    plannedStartTime,
    plannedEndTime,
    plannedOvertimeMinutes: plannedMinutes,

    overtimeType,
    reason,

    status,
    employeeConfirmationRequired,

    requestedBy: actorId,
    requestedByRole: actorRole,
    requestedAt: new Date(),

    auditLogs: [
      buildAudit(ctx, "overtime.create", reason, {
        plannedOvertimeMinutes: plannedMinutes,
        overtimeType,
      }),
    ],
  });

  await logOvertimeEvent({
    ctx,
    restaurantId,
    requestId: doc._id,
    verb: "overtime.create",
    meta: {
      employeeId: String(employeeId),
      plannedOvertimeMinutes: plannedMinutes,
      overtimeType,
      status,
    },
  });
  await logPerformanceIncident({ restaurantId, employeeId, actorId, actorRole, sourceType: "overtime_request", sourceId: String(doc._id), eventType: "OVERTIME_REQUEST_CREATED", severity: "info", responsibilityStatus: "pending_review", scoreImpactStatus: "not_applicable", metadata: { overtimeType, plannedOvertimeMinutes: plannedMinutes } });

  try { await notifyReviewers({ restaurantId, type: "overtime_request_created", sourceType: "overtime_request", sourceId: String(doc._id), actionUrl: "/manager/performance", payload: { title: "Có yêu cầu tăng ca mới", message: "Một nhân viên đã gửi yêu cầu tăng ca." } }); } catch (error) { console.warn("Failed to create notification:", error.message); }

  return mapRequest(doc);
}

export async function confirmOvertimeRequest({ input, ctx }) {
  const request = await OvertimeRequest.findById(input.requestId);
  if (!request) throw new Error("Không tìm thấy yêu cầu tăng ca.");
  await assertRestaurantScope(ctx, request.restaurantId);

  assertCanConfirm(ctx, request);

  if (request.status !== "pending_employee_confirmation") {
    throw new Error("Chỉ có thể xác nhận yêu cầu đang chờ nhân viên xác nhận.");
  }

  request.status = "pending_approval";
  request.employeeConfirmedAt = new Date();
  request.employeeConfirmedBy = getActorId(ctx);
  request.employeeConfirmationNote = String(input.note || "").trim();
  request.auditLogs.push(
    buildAudit(
      ctx,
      "overtime.employee_confirm",
      request.employeeConfirmationNote,
    ),
  );
  await request.save();

  await logOvertimeEvent({
    ctx,
    restaurantId: request.restaurantId,
    requestId: request._id,
    verb: "overtime.employee_confirm",
  });
  return mapRequest(request);
}

export async function approveOvertimeRequest({ input, ctx }) {
  assertCanReview(ctx);

  const request = await OvertimeRequest.findById(input.requestId);
  if (!request) throw new Error("Không tìm thấy yêu cầu tăng ca.");
  await assertRestaurantScope(ctx, request.restaurantId);

  if (request.status !== "pending_approval") {
    throw new Error("Chỉ có thể duyệt yêu cầu đang chờ duyệt.");
  }

  await assertNoLockedPayrollPeriodOverlap({
    restaurantId: request.restaurantId,
    employeeId: request.employeeId,
    startDate: request.workDate,
    endDate: toEndOfDay(request.workDate),
    action: "overtime_approval",
  });

  const approvedMinutes =
    Number(input.approvedOvertimeMinutes || 0) > 0
      ? Number(input.approvedOvertimeMinutes)
      : Number(request.plannedOvertimeMinutes || 0);

  if (approvedMinutes <= 0) {
    throw new Error("Số phút tăng ca được duyệt phải lớn hơn 0.");
  }

  const actualMinutes = Number(request.actualOvertimeMinutes || 0);
  const plannedMinutes = Number(request.plannedOvertimeMinutes || 0);
  const upperBound = actualMinutes > 0 ? Math.min(actualMinutes, plannedMinutes || actualMinutes) : plannedMinutes;
  if (upperBound > 0 && approvedMinutes > upperBound) {
    throw new Error("OVERTIME_APPROVED_MINUTES_EXCEED_REQUESTED");
  }

  request.status = "approved";
  request.approvedOvertimeMinutes = approvedMinutes;
  request.approvedBy = getActorId(ctx);
  request.approvedAt = new Date();
  request.approvalNote = String(input.note || "").trim();
  request.auditLogs.push(
    buildAudit(ctx, "overtime.approve", request.approvalNote, {
      approvedOvertimeMinutes: approvedMinutes,
    }),
  );
  await request.save();

  await logOvertimeEvent({
    ctx,
    restaurantId: request.restaurantId,
    requestId: request._id,
    verb: "overtime.approve",
    meta: { approvedOvertimeMinutes: approvedMinutes },
  });
  await logPerformanceIncident({ restaurantId: request.restaurantId, employeeId: request.employeeId, actorId: getActorId(ctx), actorRole: getActorRole(ctx), sourceType: "overtime_request", sourceId: String(request._id), eventType: "OVERTIME_REQUEST_APPROVED", severity: "info", responsibilityStatus: "no_fault", scoreImpactStatus: "not_applicable", metadata: { approvedOvertimeMinutes: approvedMinutes } });

  try { await notifyUser({ userId: request.employeeId, restaurantId: request.restaurantId, type: "overtime_request_approved", sourceType: "overtime_request", sourceId: String(request._id), actionUrl: "/staff/attendance", payload: { title: "Yêu cầu tăng ca đã được duyệt", message: "Yêu cầu tăng ca của bạn đã được duyệt." } }); } catch (error) { console.warn("Failed to create notification:", error.message); }

  return mapRequest(request);
}

export async function rejectOvertimeRequest({ input, ctx }) {
  assertCanReview(ctx);

  const reason = String(input.reason || "").trim();
  if (reason.length < 3) {
    throw new Error("Lý do từ chối là bắt buộc.");
  }

  const request = await OvertimeRequest.findById(input.requestId);
  if (!request) throw new Error("Không tìm thấy yêu cầu tăng ca.");
  await assertRestaurantScope(ctx, request.restaurantId);

  if (
    !["pending_employee_confirmation", "pending_approval", "approved"].includes(
      request.status,
    )
  ) {
    throw new Error("Không thể từ chối yêu cầu ở trạng thái hiện tại.");
  }

  request.status = "rejected";
  request.rejectedBy = getActorId(ctx);
  request.rejectedAt = new Date();
  request.rejectionReason = reason;
  request.auditLogs.push(buildAudit(ctx, "overtime.reject", reason));
  await request.save();

  await logOvertimeEvent({
    ctx,
    restaurantId: request.restaurantId,
    requestId: request._id,
    verb: "overtime.reject",
    meta: { reason },
  });
  await logPerformanceIncident({ restaurantId: request.restaurantId, employeeId: request.employeeId, actorId: getActorId(ctx), actorRole: getActorRole(ctx), sourceType: "overtime_request", sourceId: String(request._id), eventType: "OVERTIME_REQUEST_REJECTED", severity: "warning", responsibilityStatus: "pending_review", scoreImpactStatus: "eligible", metadata: { reason } });

  try { await notifyUser({ userId: request.employeeId, restaurantId: request.restaurantId, type: "overtime_request_rejected", sourceType: "overtime_request", sourceId: String(request._id), actionUrl: "/staff/attendance", payload: { title: "Yêu cầu tăng ca bị từ chối", message: "Yêu cầu tăng ca của bạn đã bị từ chối." } }); } catch (error) { console.warn("Failed to create notification:", error.message); }

  return mapRequest(request);
}

export async function cancelOvertimeRequest({ input, ctx }) {
  const request = await OvertimeRequest.findById(input.requestId);
  if (!request) throw new Error("Không tìm thấy yêu cầu tăng ca.");
  await assertRestaurantScope(ctx, request.restaurantId);

  assertCanCancel(ctx, request);

  if (["completed", "payroll_locked"].includes(request.status)) {
    throw new Error("Không thể hủy yêu cầu tăng ca đã hoàn tất hoặc đã khóa payroll.");
  }

  if (
    !["pending_employee_confirmation", "pending_approval", "approved"].includes(
      request.status,
    )
  ) {
    throw new Error("Không thể hủy yêu cầu tăng ca ở trạng thái hiện tại.");
  }

  request.status = "cancelled";
  request.cancelledBy = getActorId(ctx);
  request.cancelledAt = new Date();
  request.cancelReason = String(input.reason || "").trim();
  request.auditLogs.push(
    buildAudit(ctx, "overtime.cancel", request.cancelReason),
  );
  await request.save();

  await logOvertimeEvent({
    ctx,
    restaurantId: request.restaurantId,
    requestId: request._id,
    verb: "overtime.cancel",
    meta: { reason: request.cancelReason },
  });
  await logPerformanceIncident({ restaurantId: request.restaurantId, employeeId: request.employeeId, actorId: getActorId(ctx), actorRole: getActorRole(ctx), sourceType: "overtime_request", sourceId: String(request._id), eventType: "OVERTIME_REQUEST_CANCELLED", severity: "info", responsibilityStatus: "pending_review", scoreImpactStatus: "pending", metadata: { reason: request.cancelReason } });

  return mapRequest(request);
}

export async function completeOvertimeRequest({ input, ctx }) {
  assertCanReview(ctx);

  const request = await OvertimeRequest.findById(input.requestId);
  if (!request) throw new Error("Không tìm thấy yêu cầu tăng ca.");
  await assertRestaurantScope(ctx, request.restaurantId);

  if (request.status !== "approved") {
    throw new Error("Chỉ có thể hoàn tất yêu cầu tăng ca đã duyệt.");
  }

  await assertNoLockedPayrollPeriodOverlap({
    restaurantId: request.restaurantId,
    employeeId: request.employeeId,
    startDate: request.workDate,
    endDate: toEndOfDay(request.workDate),
    action: "overtime_complete",
  });

  const timesheet = await findTimesheetForRequest(request);
  if (!timesheet) {
    throw new Error("TIMESHEET_NOT_FOUND_FOR_OVERTIME");
  }

  const inputActualOvertimeMinutes = Number(input.actualOvertimeMinutes);
  const actualOvertimeMinutes =
    Number.isFinite(inputActualOvertimeMinutes) && inputActualOvertimeMinutes >= 0
      ? inputActualOvertimeMinutes
      : Number(timesheet.overtimeMinutes || 0);

  const hasApprovedMinutesInput =
    input.approvedOvertimeMinutes !== undefined &&
    input.approvedOvertimeMinutes !== null &&
    input.approvedOvertimeMinutes !== "";

  const approvedOvertimeMinutes = hasApprovedMinutesInput
    ? Number(input.approvedOvertimeMinutes)
    : Math.min(
        Number(request.approvedOvertimeMinutes || 0),
        Number(actualOvertimeMinutes || 0),
      );

  if (
    !Number.isFinite(actualOvertimeMinutes) ||
    !Number.isFinite(approvedOvertimeMinutes) ||
    actualOvertimeMinutes < 0 ||
    approvedOvertimeMinutes < 0
  ) {
    throw new Error("Số phút tăng ca không hợp lệ.");
  }

  if (
    approvedOvertimeMinutes > actualOvertimeMinutes &&
    !String(input.note || "").trim()
  ) {
    throw new Error(
      "Cần nhập ghi chú nếu số phút duyệt trả cao hơn số phút thực tế.",
    );
  }

  const before = {
    overtimeMinutes: Number(timesheet.overtimeMinutes || 0),
    approvedOvertimeMinutes: Number(timesheet.approvedOvertimeMinutes || 0),
    overtimeApprovalStatus: timesheet.overtimeApprovalStatus || "none",
  };

  timesheet.approvedOvertimeMinutes = approvedOvertimeMinutes;
  timesheet.overtimeApprovalStatus = "approved";
  timesheet.overtimeRequestId = request._id;
  timesheet.overtimeApprovalNote = String(input.note || "").trim();
  await timesheet.save();

  request.status = "completed";
  request.timesheetId = timesheet._id;
  request.actualStartTime = timesheet.actualCheckInAt || null;
  request.actualEndTime = timesheet.actualCheckOutAt || null;
  request.actualOvertimeMinutes = actualOvertimeMinutes;
  request.approvedOvertimeMinutes = approvedOvertimeMinutes;
  request.completedBy = getActorId(ctx);
  request.completedAt = new Date();
  request.completionNote = String(input.note || "").trim();
  request.auditLogs.push(
    buildAudit(ctx, "overtime.complete", request.completionNote, {
      actualOvertimeMinutes,
      approvedOvertimeMinutes,
    }),
  );
  request.auditLogs.push(
    buildAudit(ctx, "overtime.apply_to_timesheet", request.completionNote, {
      timesheetId: String(timesheet._id),
    }),
  );
  await request.save();

  await logOvertimeEvent({
    ctx,
    restaurantId: request.restaurantId,
    requestId: request._id,
    verb: "overtime.complete",
    meta: {
      actualOvertimeMinutes,
      approvedOvertimeMinutes,
      timesheetId: String(timesheet._id),
    },
    diff: {
      before,
      after: {
        overtimeMinutes: Number(timesheet.overtimeMinutes || 0),
        approvedOvertimeMinutes: Number(timesheet.approvedOvertimeMinutes || 0),
        overtimeApprovalStatus: timesheet.overtimeApprovalStatus || "none",
      },
    },
  });
  await logPerformanceIncident({ restaurantId: request.restaurantId, employeeId: request.employeeId, actorId: getActorId(ctx), actorRole: getActorRole(ctx), sourceType: "overtime_request", sourceId: String(request._id), eventType: "OVERTIME_REQUEST_COMPLETED", severity: "info", responsibilityStatus: "no_fault", scoreImpactStatus: "not_applicable", metadata: { approvedOvertimeMinutes, actualOvertimeMinutes, timesheetId: String(timesheet._id) } });

  try { await notifyUser({ userId: request.employeeId, restaurantId: request.restaurantId, type: "overtime_request_completed", sourceType: "overtime_request", sourceId: String(request._id), actionUrl: "/staff/attendance", payload: { title: "Tăng ca đã được hoàn tất", message: "Yêu cầu tăng ca của bạn đã được hoàn tất và ghi nhận." } }); } catch (error) { console.warn("Failed to create notification:", error.message); }

  return mapRequest(request);
}

export function isBlockingOvertimeStatus(status) {
  return BLOCKING_PAYROLL_STATUSES.has(String(status || ""));
}
