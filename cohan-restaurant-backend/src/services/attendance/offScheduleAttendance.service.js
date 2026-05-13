import mongoose from "mongoose";
import { Staff, Timesheet } from "../../../models/index.js";
import { requireAuth, requireRestaurantAccess, requireRoles } from "../../../graphql/guards.js";
import {
  ATTENDANCE_READ_ROLES,
  ATTENDANCE_REVIEW_ROLES,
  ATTENDANCE_SELF_ROLES,
  resolveUserRoles,
} from "../scheduling/schedulingPermission.service.js";
import { assertNoLockedPayrollPeriodOverlap } from "../payroll/payrollLockGuard.service.js";

function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function actorObjectId(ctx) {
  return toObjectId(ctx?.user?.id || ctx?.user?._id);
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

function hasAnyRole(roles, allowed) {
  return roles.some((role) => allowed.includes(role));
}

function normalizeApprovalStatus(value) {
  return String(value || "").trim().toLowerCase();
}

async function loadStaffMapForRows(rows = []) {
  if (!rows.length) return new Map();
  const employeeIds = [...new Set(rows.map((row) => String(row.employeeId)))]
    .map((id) => toObjectId(id))
    .filter(Boolean);
  if (!employeeIds.length) return new Map();

  const staffs = await Staff.find({ _id: { $in: employeeIds } })
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

  return new Map(staffs.map((staff) => [String(staff._id), staff]));
}

function buildApprovalFilter(query, status, onlyPending) {
  const normalizedStatus = normalizeApprovalStatus(status);
  if (onlyPending || normalizedStatus === "pending") {
    query.approved = { $ne: true };
    query.$or = [
      { offScheduleApprovalStatus: { $exists: false } },
      { offScheduleApprovalStatus: "not_required" },
      { offScheduleApprovalStatus: "pending" },
    ];
    return;
  }

  if (normalizedStatus === "approved") {
    query.$or = [
      { approved: true },
      { offScheduleApprovalStatus: "approved" },
    ];
    return;
  }

  if (normalizedStatus === "rejected") {
    query.approved = { $ne: true };
    query.offScheduleApprovalStatus = "rejected";
  }
}

async function buildSearchEmployeeFilter({ restaurantId, search }) {
  const term = String(search || "").trim();
  if (!term) return null;

  const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const staffs = await Staff.find({
    restaurantForStaff: restaurantId,
    deletedAt: { $exists: false },
    $or: [{ fullName: regex }, { employeeCode: regex }, { roleName: regex }],
  })
    .select({ _id: 1 })
    .lean();

  return staffs.map((staff) => staff._id);
}

export async function listOffScheduleAttendances({ filter = {}, ctx }) {
  requireAuth(ctx);
  const restaurantId = toObjectId(filter.restaurantId || ctx?.user?.restaurantForStaff || ctx?.user?.restaurantId);
  if (!restaurantId) throw new Error("Invalid restaurantId");

  const roles = resolveUserRoles(ctx.user);
  const canSelfRead = hasAnyRole(roles, ATTENDANCE_SELF_ROLES);
  const canQueueRead = hasAnyRole(roles, ATTENDANCE_READ_ROLES);
  if (!canSelfRead && !canQueueRead) throw new Error("FORBIDDEN");

  await requireRestaurantAccess(ctx, restaurantId);

  const query = { restaurantId, isOffSchedule: true };
  const startDate = filter.startDate || filter.fromDate;
  const endDate = filter.endDate || filter.toDate;
  if (startDate || endDate) {
    query.workDate = {};
    if (startDate) query.workDate.$gte = toStartOfDay(startDate);
    if (endDate) query.workDate.$lte = toEndOfDay(endDate);
  }

  const employeeId = toObjectId(filter.employeeId);
  const actorId = actorObjectId(ctx);
  if (canSelfRead && !canQueueRead) {
    if (!actorId) throw new Error("UNAUTHENTICATED");
    query.employeeId = actorId;
  } else if (employeeId) {
    query.employeeId = employeeId;
  }

  buildApprovalFilter(query, filter.approvalStatus || filter.status, Boolean(filter.onlyPending));

  const searchEmployeeIds = await buildSearchEmployeeFilter({ restaurantId, search: filter.search });
  if (searchEmployeeIds) {
    if (!searchEmployeeIds.length) return [];
    if (query.employeeId) {
      if (!searchEmployeeIds.some((id) => String(id) === String(query.employeeId))) return [];
    } else {
      query.employeeId = { $in: searchEmployeeIds };
    }
  }

  const rows = await Timesheet.find(query)
    .populate("shiftId")
    .sort({ workDate: -1, createdAt: -1 })
    .lean();
  const staffById = await loadStaffMapForRows(rows);

  return rows.map((record) => ({
    record,
    staff: staffById.get(String(record.employeeId)) || null,
  }));
}

async function loadReviewableOffScheduleRecord(timesheetId, ctx) {
  requireAuth(ctx);
  requireRoles(ctx, ATTENDANCE_REVIEW_ROLES);
  const id = toObjectId(timesheetId);
  if (!id) throw new Error("Invalid timesheetId");

  const record = await Timesheet.findById(id);
  if (!record) throw new Error("Timesheet not found");
  await requireRestaurantAccess(ctx, record.restaurantId);
  if (!record.isOffSchedule) throw new Error("OFF_SCHEDULE_ATTENDANCE_REQUIRED");

  await assertNoLockedPayrollPeriodOverlap({
    restaurantId: record.restaurantId,
    employeeId: record.employeeId,
    startDate: record.workDate,
    endDate: record.workDate,
    action: "attendance",
  });

  return record;
}

async function loadStaffForRecord(record) {
  return Staff.findById(record.employeeId).populate("role");
}

export async function approveOffScheduleAttendance({ timesheetId, note, ctx }) {
  const record = await loadReviewableOffScheduleRecord(timesheetId, ctx);
  const status = normalizeApprovalStatus(record.offScheduleApprovalStatus);
  if (record.approved || status === "approved") {
    throw new Error("OFF_SCHEDULE_ATTENDANCE_ALREADY_APPROVED");
  }
  if (status === "rejected") {
    throw new Error("OFF_SCHEDULE_ATTENDANCE_ALREADY_REJECTED");
  }

  record.approved = true;
  record.offScheduleApprovalStatus = "approved";
  record.offScheduleReviewedBy = actorObjectId(ctx);
  record.offScheduleReviewedAt = new Date();
  record.offScheduleReviewNote = String(note || "").trim();
  await record.save();

  return { record: record.toObject ? record.toObject() : record, staff: await loadStaffForRecord(record) };
}

export async function rejectOffScheduleAttendance({ timesheetId, note, ctx }) {
  const record = await loadReviewableOffScheduleRecord(timesheetId, ctx);
  const status = normalizeApprovalStatus(record.offScheduleApprovalStatus);
  if (record.approved || status === "approved") {
    throw new Error("OFF_SCHEDULE_ATTENDANCE_ALREADY_APPROVED");
  }

  record.approved = false;
  record.offScheduleApprovalStatus = "rejected";
  record.offScheduleReviewedBy = actorObjectId(ctx);
  record.offScheduleReviewedAt = new Date();
  record.offScheduleReviewNote = String(note || "").trim();
  await record.save();

  return { record: record.toObject ? record.toObject() : record, staff: await loadStaffForRecord(record) };
}
