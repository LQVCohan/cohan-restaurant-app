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
  PayrollPeriod,
  PayrollItem,
  SchedulePublication,
  EventLog,
  ShiftAcknowledgement,
  ScheduleAcknowledgement,
  EmployeeBankAccount,
  RestaurantPayoutAccount,
} from "../../../models/index.js";
import { listStaffPerformanceSnapshots } from "../../../src/services/staffPerformance/staffPerformance.service.js";
import { getSchedulingPolicy } from "../../../src/services/scheduling/schedulingPolicy.service.js";
import { validateShiftAssignment } from "../../../src/services/scheduling/shiftAssignmentValidation.service.js";
import {
  getOvertimeRequest,
  listOvertimeRequests,
} from "../../../src/services/overtime/overtimeRequest.service.js";
import {
  getAttendanceCorrectionRequest,
  listAttendanceCorrectionRequests,
} from "../../../src/services/attendance/attendanceCorrectionWorkflow.service.js";
import { listPerformanceIncidents as listPerformanceIncidentsService } from "../../../src/services/performance/performanceIncident.service.js";
import {
  listManagerIncidentReviewQueue,
  getManagerIncidentReviewQueueSummary,
} from "../../../src/services/performance/performanceIncidentQueue.service.js";
import {
  getStaffPerformanceSummary,
  listStaffPerformanceSummaries,
  listStaffPerformanceScoreAdjustments,
  getStaffPerformanceScoreTimeline,
} from "../../../src/services/performance/staffPerformanceReporting.service.js";
import { getManagerPerformanceDashboard } from "../../../src/services/performance/managerPerformanceDashboard.service.js";
import { listPerformanceIncidentAppeals } from "../../../src/services/performance/performanceAppeal.service.js";
import { listOffScheduleAttendances as listOffScheduleAttendancesService } from "../../../src/services/attendance/offScheduleAttendance.service.js";
import { buildStaffSchedulingAssistant } from "../../../src/services/ai/staffSchedulingAssistant.service.js";
import { buildAiSchedulePlannerPreview } from "../../../src/services/scheduling/aiSchedulePlanner.service.js";
import { buildPayrollItem } from "../../../src/services/payroll/payrollCalculator.service.js";
import {
  sanitizeAdminUserListItem,
  sanitizeStaffPrivateProfile,
} from "../../../src/security/userDtos.js";
import {
  buildPayrollItemsForRange,
  getPayrollSettings,
  getPeriodDetail,
  mapPayrollDocToGql,
  summarize,
  toObjectId as payrollToObjectId,
} from "../../../src/services/payroll/payrollRuntime.service.js";
import { validatePayrollPeriod as validatePayrollPeriodService } from "../../../src/services/payroll/payrollValidation.service.js";
import { assertPayrollPermission } from "../../../src/services/payroll/payrollPermission.service.js";
import {
  getPayrollPayoutBatch as getPayrollPayoutBatchService,
  listPayrollPayouts as listPayrollPayoutsService,
  mapEmployeeBankAccount,
  mapRestaurantPayoutAccount,
} from "../../../src/services/payroll/payrollPayout.service.js";
import { logPayrollEvent } from "../../../src/services/payroll/payrollEventLog.service.js";
import {
  buildPayrollExportRows,
  getPayrollPayslip,
  listPayrollPayments,
} from "../../../src/services/payroll/payrollPayment.service.js";
import { mapSchedulePublicationOutput } from "../../../src/services/scheduling/scheduleLifecycle.service.js";
import {
  requireAuth,
  requireRestaurantAccess,
  requireRoles,
} from "../../guards.js";
import {
  ATTENDANCE_READ_ROLES,
  ATTENDANCE_SELF_ROLES,
  SHIFT_ACK_READ_ROLES,
  SCHEDULE_READ_ROLES,
  SCHEDULE_WRITE_ROLES,
  resolveUserRoles,
  userCanAccessRestaurant,
} from "../../../src/services/scheduling/schedulingPermission.service.js";

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

function mapShiftAttendanceStatus(timesheet) {
  if (timesheet?.actualCheckOutAt) return "checked_out";
  if (timesheet?.actualCheckInAt) return "checked_in";
  return "scheduled";
}

function mapAttendanceRecord(timesheet, staff) {
  const isOffSchedule = Boolean(timesheet.isOffSchedule);
  const legacyStatus = String(
    timesheet.offScheduleApprovalStatus || "",
  ).toLowerCase();
  const approvalStatus = !isOffSchedule
    ? "not_required"
    : Boolean(timesheet.approved) || legacyStatus === "approved"
      ? "approved"
      : legacyStatus === "rejected"
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
    shiftType: timesheet?.shiftId?.shiftType || null,
    plannedStartTime:
      timesheet.plannedStartTime || timesheet?.shiftId?.startTime || null,
    plannedEndTime:
      timesheet.plannedEndTime || timesheet?.shiftId?.endTime || null,
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
    offScheduleApprovalStatus: approvalStatus,
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

function toGraphEmploymentType(value) {
  const map = {
    full_time: "FULL_TIME",
    part_time: "PART_TIME",
    probation: "PROBATION",
    seasonal: "SEASONAL",
    contract: "CONTRACT",
  };
  return map[String(value || "").toLowerCase()] || null;
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

function normalizeShiftAckStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  const allowed = ["pending", "accepted", "declined", "expired", "cancelled"];
  return allowed.includes(normalized) ? normalized : null;
}

function mapScheduleChangeLog(row) {
  const meta = row.meta || {};
  const diff = row.diff || {};
  const before = diff.before || {};
  const after = diff.after || {};

  return {
    id: String(row._id),
    restaurantId: row.restaurantId ? String(row.restaurantId) : null,
    actorUserId: row.actorUserId ? String(row.actorUserId) : null,
    verb: row.verb,
    source: row.source || null,
    status: row.status || null,
    objectKind: row.object?.kind || null,
    objectId: row.object?.id ? String(row.object.id) : null,
    objectCode: row.object?.code || null,
    reason: meta.reason || null,
    affectedShiftIds: (meta.affectedShiftIds || [])
      .map((id) => String(id))
      .filter(Boolean),
    affectedEmployeeIds: (meta.affectedEmployeeIds || [])
      .map((id) => String(id))
      .filter(Boolean),
    notifyEmployees:
      typeof meta.notifyEmployees === "boolean"
        ? meta.notifyEmployees
        : typeof meta.notifyEmployee === "boolean"
          ? meta.notifyEmployee
          : null,
    oldStartTime: before.startTime || null,
    oldEndTime: before.endTime || null,
    newStartTime: after.startTime || null,
    newEndTime: after.endTime || null,
    meta,
    diff,
    createdAt: row.createdAt || null,
    at: row.at || row.createdAt || null,
  };
}

function _inferRegionCodeFromRestaurant(restaurant) {
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

async function resolveStaffDoc(staffId, ctx) {
  const fallbackId = ctx?.user?.id;
  const targetId = staffId || fallbackId;
  const oid = toObjectId(targetId);
  if (!oid) return null;

  return Staff.findById(oid).populate("role");
}


async function resolvePayrollPeriodRestaurantOrThrow(periodId, select = {}) {
  const period = await PayrollPeriod.findById(periodId)
    .select({ _id: 1, restaurantId: 1, status: 1, ...select })
    .lean();
  if (!period) throw new Error("PAYROLL_PERIOD_NOT_FOUND");
  return period;
}

async function requirePayrollViewForRestaurant(ctx, restaurantId) {
  requireAuth(ctx);
  assertPayrollPermission(ctx, "payroll.view");
  await requireRestaurantAccess(ctx, restaurantId);
}

async function requirePayrollExportForRestaurant(ctx, restaurantId) {
  requireAuth(ctx);
  assertPayrollPermission(ctx, "payroll.export");
  await requireRestaurantAccess(ctx, restaurantId);
}

async function requirePayrollValidateForRestaurant(ctx, restaurantId) {
  requireAuth(ctx);
  assertPayrollPermission(ctx, "payroll.validate");
  await requireRestaurantAccess(ctx, restaurantId);
}

async function requireStaffReportAccessForRestaurant(ctx, restaurantId) {
  requireAuth(ctx);
  requireRoles(ctx, ATTENDANCE_READ_ROLES);
  await requireRestaurantAccess(ctx, restaurantId);
}

async function findPayrollItemInPeriodRestaurant(period, employeeId) {
  return PayrollItem.findOne({
    periodId: period._id,
    restaurantId: period.restaurantId,
    employeeId: payrollToObjectId(employeeId),
  })
    .select({ _id: 1 })
    .lean();
}

async function requireLeaveBalanceAccess(ctx, employeeId) {
  requireAuth(ctx);
  const staff = await Staff.findById(employeeId)
    .select({ _id: 1, restaurantForStaff: 1, userType: 1 })
    .lean();
  if (!staff) return null;

  const actorId = String(ctx?.user?.id || ctx?.user?._id || "");
  const isSelf = actorId && actorId === String(staff._id);
  if (isSelf) return staff;

  requireRoles(ctx, ATTENDANCE_READ_ROLES);
  await requireRestaurantAccess(ctx, staff.restaurantForStaff);
  return staff;
}

export default {
  // =========================
  // GET ONE STAFF
  // =========================
  staff: async (_, { id }, ctx) => {
    requireAuth(ctx);
    const minimal = await Staff.findById(id)
      .select({
        userType: 1,
        deletedAt: 1,
        restaurantForStaff: 1,
        refRestaurants: 1,
      })
      .lean();
    if (!minimal || minimal.userType !== "STAFF" || minimal.deletedAt) {
      throw new Error("Staff not found");
    }
    if (String(ctx?.user?.id || ctx?.user?._id || "") !== String(id)) {
      const targetRestaurantId = minimal?.restaurantForStaff || null;
      await requireRestaurantAccess(ctx, targetRestaurantId);
    }
    const user = await Staff.findById(id)
      .populate("role")
      .populate("refRestaurants");
    if (String(ctx?.user?.id || ctx?.user?._id || "") === String(id)) {
      return sanitizeAdminUserListItem(user);
    }
    return sanitizeStaffPrivateProfile(user, ctx, { restaurantId: minimal?.restaurantForStaff });
  },

  // =========================
  // PUBLIC RESTAURANT STAFF OPTIONS
  // =========================

  publicRestaurantStaff: async (_, { restaurantId }) => {
    const rid = toObjectId(restaurantId);
    if (!rid && !restaurantId) return [];

    const filter = {
      userType: "STAFF",
      deletedAt: null,
      restaurantForStaff: rid || restaurantId,
    };

    const list = await Staff.find(filter)
      .select({ _id: 1, fullName: 1, positionTitle: 1, avatarUrl: 1 })
      .sort({ fullName: 1 })
      .lean();

    return list.map((item) => ({
      id: String(item._id),
      fullName: item.fullName || "",
      positionTitle: item.positionTitle || "",
      avatarUrl: item.avatarUrl || "",
    }));
  },

  // =========================
  // GET STAFF LIST
  // =========================
  staffList: async (
    _,
    { restaurantId, roleId, search, employmentStatus },
    ctx,
  ) => {
    requireAuth(ctx);
    const filter = { userType: "STAFF", deletedAt: null };

    if (restaurantId) {
      await requireRestaurantAccess(ctx, restaurantId);
      const rid = toObjectId(restaurantId);
      const restaurantScopeFilter = {
        $or: [
          ...(rid ? [{ restaurantForStaff: rid }, { refRestaurants: rid }] : []),
          { restaurantForStaff: restaurantId },
          { refRestaurants: restaurantId },
        ],
      };
      filter.$and = [...(filter.$and || []), restaurantScopeFilter];
    } else {
      requireRoles(ctx, ["ADMIN"]);
    }
    if (roleId) filter.role = roleId;
    if (employmentStatus) filter.employmentStatus = employmentStatus;

    if (search) {
      const regex = new RegExp(search, "i");
      const searchFilter = [
        { fullName: regex },
        { email: regex },
        { phone: regex },
        { username: regex },
        { employeeCode: regex },
      ];
      if (filter.$and) {
        filter.$and = [...filter.$and, { $or: searchFilter }];
      } else if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchFilter }];
        delete filter.$or;
      } else {
        filter.$or = searchFilter;
      }
    }

    const staff = await Staff.find(filter)
      .populate("role")
      .populate("refRestaurants")
      .sort({ fullName: 1 });

    return Promise.all(staff.map((item) => sanitizeStaffPrivateProfile(item, ctx, { restaurantId: item?.restaurantForStaff || restaurantId })));
  },
  shiftAcknowledgements: async (
    _,
    { restaurantId, periodStart, periodEnd, employeeId, status },
    ctx,
  ) => {
    requireAuth(ctx);
    await requireRestaurantAccess(ctx, restaurantId);
    requireRoles(ctx, SHIFT_ACK_READ_ROLES);

    const filter = { restaurantId: toObjectId(restaurantId) || restaurantId };

    if (employeeId) {
      filter.employeeId = toObjectId(employeeId) || employeeId;
    }

    const start = periodStart ? new Date(periodStart) : null;
    const end = periodEnd ? new Date(periodEnd) : null;
    if (
      (start && !Number.isNaN(start.getTime())) ||
      (end && !Number.isNaN(end.getTime()))
    ) {
      filter.$and = [];
      if (start && !Number.isNaN(start.getTime())) {
        filter.$and.push({ periodEnd: { $gte: start } });
      }
      if (end && !Number.isNaN(end.getTime())) {
        filter.$and.push({ periodStart: { $lte: end } });
      }
      if (!filter.$and.length) delete filter.$and;
    }

    const normalizedStatus = normalizeShiftAckStatus(status);
    if (normalizedStatus) {
      filter.status = normalizedStatus;
    }

    return ShiftAcknowledgement.find(filter).sort({
      deadlineAt: 1,
      createdAt: -1,
    });
  },
  myShiftAttendances: async (_, { restaurantId, periodStart, periodEnd }, ctx) => {
    requireAuth(ctx);
    if (restaurantId) await requireRestaurantAccess(ctx, restaurantId);
    const employeeId = ctx?.user?.id || ctx?.user?._id;
    const actorOid = toObjectId(employeeId) || employeeId;
    const filter = { employeeId: actorOid, shiftId: { $ne: null }, isOffSchedule: { $ne: true } };
    if (restaurantId) filter.restaurantId = toObjectId(restaurantId) || restaurantId;
    if (periodStart || periodEnd) {
      const start = periodStart ? new Date(periodStart) : null;
      const end = periodEnd ? new Date(periodEnd) : null;
      if (start && !Number.isNaN(start.getTime())) filter.workDate = { ...(filter.workDate || {}), $gte: toStartOfDay(start) };
      if (end && !Number.isNaN(end.getTime())) filter.workDate = { ...(filter.workDate || {}), $lte: toEndOfDay(end) };
    }
    const rows = await Timesheet.find(filter).select({ _id:1, restaurantId:1, employeeId:1, shiftId:1, actualCheckInAt:1, actualCheckOutAt:1, createdAt:1, updatedAt:1 }).lean();
    return rows.map((row) => ({
      id: String(row._id),
      restaurantId: String(row.restaurantId),
      employeeId: String(row.employeeId),
      shiftId: String(row.shiftId),
      checkInAt: row.actualCheckInAt || null,
      checkOutAt: row.actualCheckOutAt || null,
      status: row.actualCheckOutAt ? "checked_out" : row.actualCheckInAt ? "checked_in" : "scheduled",
      createdAt: row.createdAt || null,
      updatedAt: row.updatedAt || null,
    }));
  },
  managerShiftAttendances: async (
    _,
    { restaurantId, periodStart, periodEnd },
    ctx,
  ) => {
    requireAuth(ctx);
    await requireRestaurantAccess(ctx, restaurantId);
    requireRoles(ctx, ATTENDANCE_READ_ROLES);

    const restaurantOid = toObjectId(restaurantId) || restaurantId;
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
    const activePublication = await SchedulePublication.findOne({
      restaurantId: restaurantOid,
      periodStart: { $lte: start },
      periodEnd: { $gte: end },
      status: { $in: ["published", "active"] },
    })
      .select({ _id: 1 })
      .lean();
    if (!activePublication) return [];

    const [shiftRows, timesheetRows] = await Promise.all([
      Shift.find({
        restaurantId: restaurantOid,
        startTime: { $lte: end },
        endTime: { $gte: start },
      })
        .select({
          _id: 1,
          restaurantId: 1,
          employeeId: 1,
          shiftType: 1,
          startTime: 1,
          endTime: 1,
        })
        .lean(),
      Timesheet.find({
        restaurantId: restaurantOid,
        shiftId: { $ne: null },
        isOffSchedule: { $ne: true },
        workDate: { $gte: toStartOfDay(start), $lte: toEndOfDay(end) },
      })
        .select({
          _id: 1,
          restaurantId: 1,
          employeeId: 1,
          shiftId: 1,
          actualCheckInAt: 1,
          actualCheckOutAt: 1,
          status: 1,
          latenessMinutes: 1,
          note: 1,
          createdAt: 1,
          updatedAt: 1,
        })
        .lean(),
    ]);

    const staffRows = await Staff.find({
      restaurantForStaff: restaurantOid,
      _id: { $in: [...new Set(shiftRows.map((s) => String(s.employeeId)).filter(Boolean))] },
    })
      .select({ _id: 1, fullName: 1, employeeCode: 1, restaurantForStaff: 1 })
      .lean();

    const staffById = new Map(staffRows.map((row) => [String(row._id), row]));
    const shiftById = new Map(shiftRows.map((row) => [String(row._id), row]));
    const timesheetByShiftId = new Map(
      timesheetRows
        .filter((row) => row.shiftId && shiftById.has(String(row.shiftId)))
        .map((row) => [String(row.shiftId), row]),
    );

    return shiftRows.map((shift) => {
      const timesheet = timesheetByShiftId.get(String(shift._id));
      const employee = staffById.get(String(shift.employeeId));
      const checkInAt = timesheet?.actualCheckInAt || null;
      const checkOutAt = timesheet?.actualCheckOutAt || null;
      const status = mapShiftAttendanceStatus(timesheet);
      const isLateFromStatus = ["late", "late_early_leave"].includes(
        String(timesheet?.status || "").toLowerCase(),
      );
      const isLateFromTime =
        checkInAt && shift.startTime
          ? new Date(checkInAt).getTime() > new Date(shift.startTime).getTime()
          : false;
      return {
        id: timesheet?._id ? String(timesheet._id) : `shift-${String(shift._id)}`,
        restaurantId: String(shift.restaurantId),
        employeeId: String(shift.employeeId),
        shiftId: String(shift._id),
        checkInAt,
        checkOutAt,
        status,
        employeeName: employee?.fullName || null,
        employeeCode: employee?.employeeCode || null,
        shiftStartTime: shift.startTime || null,
        shiftEndTime: shift.endTime || null,
        shiftType: shift.shiftType || null,
        displayStatus: timesheet?.status || status,
        isLate: Boolean(isLateFromStatus || isLateFromTime),
        reviewNote: timesheet?.note || null,
        createdAt: timesheet?.createdAt || shift.createdAt || null,
        updatedAt: timesheet?.updatedAt || shift.updatedAt || null,
      };
    });
  },
  myShiftAcknowledgements: async (
    _,
    { restaurantId, periodStart, periodEnd, status },
    ctx,
  ) => {
    requireAuth(ctx);
    if (restaurantId) await requireRestaurantAccess(ctx, restaurantId);
    const employeeId = ctx?.user?.id || ctx?.user?._id;
    const filter = { employeeId: toObjectId(employeeId) || employeeId };
    if (restaurantId) {
      filter.restaurantId = toObjectId(restaurantId) || restaurantId;
    }

    const start = periodStart ? new Date(periodStart) : null;
    const end = periodEnd ? new Date(periodEnd) : null;
    if (
      (start && !Number.isNaN(start.getTime())) ||
      (end && !Number.isNaN(end.getTime()))
    ) {
      filter.$and = [];
      if (start && !Number.isNaN(start.getTime())) {
        filter.$and.push({ periodEnd: { $gte: start } });
      }
      if (end && !Number.isNaN(end.getTime())) {
        filter.$and.push({ periodStart: { $lte: end } });
      }
      if (!filter.$and.length) delete filter.$and;
    }

    const normalizedStatus = normalizeShiftAckStatus(status);
    if (normalizedStatus) {
      filter.status = normalizedStatus;
    }

    return ShiftAcknowledgement.find(filter).sort({ deadlineAt: 1 });
  },

  myScheduleAcknowledgement: async (
    _,
    { restaurantId, periodStart, periodEnd },
    ctx,
  ) => {
    requireAuth(ctx);
    await requireRestaurantAccess(ctx, restaurantId);
    const employeeId = ctx?.user?.id || ctx?.user?._id;
    const publication = await SchedulePublication.findOne({
      restaurantId: toObjectId(restaurantId) || restaurantId,
      periodStart: toStartOfDay(periodStart),
      periodEnd: toEndOfDay(periodEnd),
      status: { $in: ["published", "active"] },
    }).lean();
    if (!publication) return null;
    return ScheduleAcknowledgement.findOne({
      restaurantId: publication.restaurantId,
      employeeId: toObjectId(employeeId) || employeeId,
      schedulePublicationId: publication._id,
    });
  },
  scheduleAcknowledgementSummary: async (
    _,
    { restaurantId, periodStart, periodEnd },
    ctx,
  ) => {
    requireAuth(ctx);
    await requireRestaurantAccess(ctx, restaurantId);
    requireRoles(ctx, SCHEDULE_READ_ROLES);
    const publication = await SchedulePublication.findOne({
      restaurantId: toObjectId(restaurantId) || restaurantId,
      periodStart: toStartOfDay(periodStart),
      periodEnd: toEndOfDay(periodEnd),
    }).lean();
    if (!publication || !["published", "active"].includes(publication.status))
      return {
        totalAssignedStaff: 0,
        acknowledgedCount: 0,
        pendingCount: 0,
        changedAfterAcknowledgementCount: 0,
        employees: [],
      };
    const shifts = await Shift.find({
      restaurantId: publication.restaurantId,
      startTime: { $gte: publication.periodStart, $lte: publication.periodEnd },
      status: { $ne: "cancelled" },
    }).lean();
    const employeeIds = [
      ...new Set(shifts.map((s) => String(s.employeeId)).filter(Boolean)),
    ];
    const acks = await ScheduleAcknowledgement.find({
      restaurantId: publication.restaurantId,
      schedulePublicationId: publication._id,
      employeeId: { $in: employeeIds.map(toObjectId).filter(Boolean) },
    }).lean();
    const map = new Map(acks.map((a) => [String(a.employeeId), a]));
    const employees = employeeIds.map((id) => {
      const a = map.get(id);
      return {
        employeeId: id,
        status: a?.status || null,
        changedAfterAcknowledgement: Boolean(a?.changedAfterAcknowledgement),
        acknowledgedAt: a?.acknowledgedAt || null,
      };
    });
    const acknowledgedCount = employees.filter(
      (e) => e.status === "acknowledged" && !e.changedAfterAcknowledgement,
    ).length;
    const changedAfterAcknowledgementCount = employees.filter(
      (e) => e.changedAfterAcknowledgement || e.status === "needs_review",
    ).length;
    const pendingCount =
      employees.length - acknowledgedCount - changedAfterAcknowledgementCount;
    return {
      totalAssignedStaff: employees.length,
      acknowledgedCount,
      pendingCount,
      changedAfterAcknowledgementCount,
      employees,
    };
  },
  schedulingPolicy: async (_, { restaurantId }, ctx) => {
    requireAuth(ctx);
    await requireRestaurantAccess(ctx, restaurantId);
    return getSchedulingPolicy({ restaurantId });
  },
  staffPerformanceSnapshots: async (_, { filter }, ctx) => {
    return listStaffPerformanceSnapshots({
      filter: filter || {},
      ctx,
    });
  },
  validateShiftAssignment: async (_, { input }, ctx) => {
    return validateShiftAssignment({ input, ctx });
  },
  staffAccountOverview: async (_, { staffId }, ctx) => {
    requireAuth(ctx);
    const staff = await resolveStaffDoc(staffId, ctx);
    if (!staff || staff.userType !== "STAFF") return null;
    const isSelf =
      String(ctx?.user?.id || ctx?.user?._id || "") === String(staff._id);
    if (!isSelf) {
      const targetRestaurantId = staff?.restaurantForStaff || null;
      await requireRestaurantAccess(ctx, targetRestaurantId);
    }

    const restaurantId = staff?.restaurantForStaff || null;
    const rid = toObjectId(restaurantId);

    let floorAssigned = [];
    let tableList = [];
    let tableCount = 0;
    let floorCount = 0;
    let categoryCount = 0;
    let promotionCount = 0;

    if (rid) {
      const [tables, categoryAgg, promoAgg] = await Promise.all([
        Table.find({ restaurantId: rid })
          .select({ code: 1, floorLevel: 1 })
          .lean(),
        Category.countDocuments({ restaurantId: rid }),
        Promotion.countDocuments({ restaurantId: rid, isActive: true }),
      ]);
      tableCount = tables.length;
      tableList = tables.map((t) => t.code).filter(Boolean);
      floorAssigned = Array.from(
        new Set(
          tables
            .map((t) =>
              t?.floorLevel != null ? `Tầng ${Number(t.floorLevel)}` : null,
            )
            .filter(Boolean),
        ),
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

    const shiftsWorkedCount = await Shift.countDocuments({
      employeeId: staff._id,
    });

    return {
      staffId: String(staff._id),
      fullName: staff.fullName || null,
      email: staff.email || null,
      phone: staff.phone || null,
      avatarUrl: staff.avatarUrl || staff.avatar || null,
      roleName:
        staff?.positionTitle ||
        staff?.roleName ||
        staff?.role?.name ||
        "Nhân viên",
      positionTitle: staff.positionTitle || null,
      employeeCode: staff.employeeCode || null,
      employmentType: toGraphEmploymentType(staff.employmentType),
      employmentStatus: String(
        staff.employmentStatus || "working",
      ).toUpperCase(),
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
    requireAuth(ctx);
    const staff = await resolveStaffDoc(staffId, ctx);
    if (!staff || staff.userType !== "STAFF") return null;
    const isSelf =
      String(ctx?.user?.id || ctx?.user?._id || "") === String(staff._id);
    if (!isSelf) {
      const targetRestaurantId = staff?.restaurantForStaff || null;
      await requireRestaurantAccess(ctx, targetRestaurantId);
      assertPayrollPermission(ctx, "payroll.view");
    }

    const shifts = await Shift.find({ employeeId: staff._id })
      .select({ _id: 1 })
      .lean();
    const shiftIds = shifts.map((s) => s._id);

    if (!shiftIds.length) {
      const baseSalary = Number(staff.baseSalary || 0);
      const payroll = buildPayrollItem({
        staff,
        period: { start: new Date(), end: new Date(), calendarDays: 0 },
        aggregate: {
          workedDateCount: 0,
          totalHours: 0,
          totalWage: 0,
          totalAmount: 0,
        },
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
      warningMessages: payroll.minimumWageViolation
        ? ["Lương cơ bản thấp hơn mức tối thiểu vùng"]
        : [],
      coefficient: Number(coefficient.toFixed(2)),
      timesheetCount: Number(row.timesheetCount || 0),
    };
  },

  staffShiftHistory: async (_, { staffId, limit = 20 }, ctx) => {
    requireAuth(ctx);
    const staff = await resolveStaffDoc(staffId, ctx);
    if (!staff || staff.userType !== "STAFF") return [];
    const isSelf =
      String(ctx?.user?.id || ctx?.user?._id || "") === String(staff._id);
    if (!isSelf) {
      const targetRestaurantId = staff?.restaurantForStaff || null;
      await requireRestaurantAccess(ctx, targetRestaurantId);
    }

    const rows = await Shift.find({ employeeId: staff._id })
      .sort({ startTime: -1 })
      .limit(Math.max(1, Math.min(Number(limit || 20), 100)))
      .populate("restaurantId", "name")
      .lean();

    return rows.map((r) => ({
      id: String(r._id),
      restaurant: r.restaurantId
        ? {
            id: String(r.restaurantId._id || r.restaurantId.id),
            name: r.restaurantId.name,
          }
        : null,
      shiftType: r.shiftType || null,
      startTime: r.startTime || null,
      endTime: r.endTime || null,
      status: r.status || null,
      notes: r.notes || null,
    }));
  },

  staffPayrollOverview: async (
    _,
    { startDate, endDate, restaurantId, periodId },
    ctx,
  ) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.view");
    if (periodId && mongoose.isValidObjectId(periodId)) {
      const period = await resolvePayrollPeriodRestaurantOrThrow(periodId);
      await requireRestaurantAccess(ctx, period.restaurantId);
      const docs = await PayrollItem.find({
        periodId: payrollToObjectId(periodId),
        restaurantId: period.restaurantId,
      }).lean();
      const items = docs.map(mapPayrollDocToGql);
      return { stats: summarize(items), items };
    }

    const start = toStartOfDay(startDate);
    const end = toEndOfDay(endDate);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end < start
    ) {
      return {
        stats: { totalPayroll: 0, paidAmount: 0, remaining: 0, progress: 0 },
        items: [],
      };
    }

    const authUser = ctx?.user || null;
    const fallbackRestaurantId =
      restaurantId || authUser?.restaurantForStaff || null;
    const rid = toObjectId(fallbackRestaurantId);
    if (!rid) {
      return {
        stats: { totalPayroll: 0, paidAmount: 0, remaining: 0, progress: 0 },
        items: [],
      };
    }
    await requireRestaurantAccess(ctx, rid);
    const rows = await buildPayrollItemsForRange({
      start,
      end,
      restaurantId: rid,
      forceStatus: "draft",
    });
    const items = rows.map((row) => mapPayrollDocToGql(row));
    return { stats: summarize(items), items };
  },

  payrollPeriods: async (_, { restaurantId, limit = 12 }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.view");
    const authUser = ctx?.user || null;
    const rid = toObjectId(restaurantId || authUser?.restaurantForStaff || null);
    if (!rid) return [];
    await requireRestaurantAccess(ctx, rid);
    const rows = await PayrollPeriod.find({ restaurantId: rid })
      .sort({ startDate: -1 })
      .limit(Math.max(1, Math.min(Number(limit || 12), 52)))
      .lean();
    return rows.map((row) => ({
      id: String(row._id),
      restaurantId: String(row.restaurantId),
      name: row.name || "",
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      finalizedAt: row.finalizedAt || null,
      lockedAt: row.lockedAt || null,
      paidAt: row.paidAt || null,
      stats: row.statsSnapshot || {
        totalPayroll: 0,
        paidAmount: 0,
        remaining: 0,
        progress: 0,
      },
    }));
  },

  payrollPeriodDetail: async (_, { periodId }, ctx) => {
    requireAuth(ctx);
    const period = await resolvePayrollPeriodRestaurantOrThrow(periodId);
    await requirePayrollViewForRestaurant(ctx, period.restaurantId);
    return getPeriodDetail(periodId);
  },

  payrollPayslip: async (_, { periodId, employeeId }, ctx) => {
    requireAuth(ctx);
    const actorId = String(ctx?.user?.id || ctx?.user?._id || "");
    const isSelf = actorId && String(employeeId) === actorId;
    const period = await resolvePayrollPeriodRestaurantOrThrow(periodId);

    if (isSelf) {
      assertPayrollPermission(ctx, "payroll.payslip.self");
      if (!["finalized", "paying", "locked", "paid"].includes(period.status)) {
        throw new Error("PAYROLL_PERIOD_NOT_AVAILABLE");
      }
    } else {
      assertPayrollPermission(ctx, "payroll.view");
    }

    await requireRestaurantAccess(ctx, period.restaurantId);
    const item = await findPayrollItemInPeriodRestaurant(period, employeeId);
    if (!item) throw new Error("PAYROLL_ITEM_NOT_FOUND");

    const payslip = await getPayrollPayslip({ periodId, employeeId });
    await logPayrollEvent({
      ctx,
      restaurantId: period.restaurantId,
      verb: "payroll.payslip.view",
      objectKind: "PayrollPeriod",
      objectId: period._id,
      meta: { employeeId: String(employeeId) },
    });
    return payslip;
  },

  payrollPayments: async (_, { periodId, employeeId }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, employeeId ? "payroll.view" : "payroll.export");
    const period = await resolvePayrollPeriodRestaurantOrThrow(periodId);
    await requireRestaurantAccess(ctx, period.restaurantId);
    if (employeeId) {
      const item = await findPayrollItemInPeriodRestaurant(period, employeeId);
      if (!item) throw new Error("PAYROLL_ITEM_NOT_FOUND");
    }
    return listPayrollPayments({ periodId, employeeId });
  },


  payrollPayouts: async (_, { periodId, employeeId, status }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, employeeId ? "payroll.view" : "payroll.export");
    const period = await resolvePayrollPeriodRestaurantOrThrow(periodId);
    await requireRestaurantAccess(ctx, period.restaurantId);
    return listPayrollPayoutsService({ periodId, employeeId, status });
  },

  payrollPayoutBatch: async (_, { batchId }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.view");
    const batch = await getPayrollPayoutBatchService(batchId);
    if (!batch) return null;
    await requireRestaurantAccess(ctx, batch.restaurantId);
    return batch;
  },

  employeeBankAccount: async (_, { employeeId, restaurantId }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.view");
    await requireRestaurantAccess(ctx, restaurantId);
    const row = await EmployeeBankAccount.findOne({ employeeId: payrollToObjectId(employeeId), restaurantId: payrollToObjectId(restaurantId), isDefault: true }).lean();
    return mapEmployeeBankAccount(row);
  },

  restaurantPayoutAccounts: async (_, { restaurantId }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.view");
    await requireRestaurantAccess(ctx, restaurantId);
    const rows = await RestaurantPayoutAccount.find({ restaurantId: payrollToObjectId(restaurantId) }).sort({ createdAt: -1 }).lean();
    return rows.map(mapRestaurantPayoutAccount);
  },

  payrollExportRows: async (_, { periodId }, ctx) => {
    requireAuth(ctx);
    const period = await resolvePayrollPeriodRestaurantOrThrow(periodId);
    await requirePayrollExportForRestaurant(ctx, period.restaurantId);
    return buildPayrollExportRows({ periodId });
  },

  payrollSettings: async (_, { restaurantId }, ctx) => {
    requireAuth(ctx);
    assertPayrollPermission(ctx, "payroll.view");
    const authUser = ctx?.user || null;
    const rid = restaurantId || authUser?.restaurantForStaff || null;
    if (!rid) return null;
    await requireRestaurantAccess(ctx, rid);
    const settings = await getPayrollSettings(rid);
    if (!settings) return null;
    return {
      ...settings,
      restaurantId: String(settings.restaurantId),
    };
  },
  overtimeRequests: async (_, { filter }, ctx) => {
    return listOvertimeRequests({
      filter: filter || {},
      ctx,
    });
  },

  overtimeRequest: async (_, { id }, ctx) => {
    return getOvertimeRequest({
      id,
      ctx,
    });
  },
  validatePayrollPeriod: async (_, { periodId }, ctx) => {
    requireAuth(ctx);
    const period = await resolvePayrollPeriodRestaurantOrThrow(periodId);
    await requirePayrollValidateForRestaurant(ctx, period.restaurantId);
    return validatePayrollPeriodService(periodId);
  },

  myPayslips: async (_, { limit = 12 }, ctx) => {
    assertPayrollPermission(ctx, "payroll.payslip.self");
    const actorId = payrollToObjectId(ctx?.user?.id || ctx?.user?._id);
    if (!actorId) return [];
    const items = await PayrollItem.find({ employeeId: actorId })
      .sort({ updatedAt: -1 })
      .limit(Math.max(1, Math.min(Number(limit || 12), 24)))
      .lean();
    if (!items.length) return [];
    const periodIds = items.map((i) => i.periodId);
    const periods = await PayrollPeriod.find({
      _id: { $in: periodIds },
      status: { $in: ["finalized", "paying", "locked", "paid"] },
    })
      .select({ _id: 1, name: 1, startDate: 1, endDate: 1, status: 1, finalizedAt: 1, paidAt: 1 })
      .lean();
    const periodById = new Map(periods.map((p) => [String(p._id), p]));
    return items
      .filter((i) => periodById.has(String(i.periodId)))
      .map((item) => {
        const period = periodById.get(String(item.periodId));
        return mapPayrollDocToGql({
          ...item,
          periodName: period?.name || "",
          periodStartDate: period?.startDate || null,
          periodEndDate: period?.endDate || null,
          periodStatus: period?.status || null,
          periodFinalizedAt: period?.finalizedAt || null,
        });
      });
  },

  myPayslip: async (_, { periodId }, ctx) => {
    assertPayrollPermission(ctx, "payroll.payslip.self");
    const actorId = payrollToObjectId(ctx?.user?.id || ctx?.user?._id);
    if (!actorId) return null;

    const period = await PayrollPeriod.findById(periodId).lean();
    if (!period || !["finalized", "paying", "locked", "paid"].includes(period.status))
      return null;

    const item = await PayrollItem.findOne({
      periodId: period._id,
      employeeId: actorId,
    }).lean();
    await logPayrollEvent({
      ctx,
      restaurantId: period.restaurantId,
      verb: "payroll.payslip.view",
      objectKind: "PayrollPeriod",
      objectId: period._id,
      status: item ? "success" : "info",
      meta: { employeeId: String(actorId) },
    });
    if (!item) return null;
    return getPayrollPayslip({ periodId: period._id, employeeId: actorId });
  },

  staffSchedulingAssistant: async (
    _,
    { restaurantId, horizonDays = 2, timezone = "Asia/Ho_Chi_Minh" },
    ctx,
  ) => {
    requireAuth(ctx);
    requireRoles(ctx, SCHEDULE_READ_ROLES);
    await requireRestaurantAccess(ctx, restaurantId);
    return buildStaffSchedulingAssistant({
      restaurantId,
      horizonDays,
      timezone,
      actor: ctx?.user || null,
    });
  },
  aiSchedulePlannerPreview: async (_, { input }, ctx) => {
    requireAuth(ctx);
    requireRoles(ctx, SCHEDULE_WRITE_ROLES);
    const restaurantId = toObjectId(input?.restaurantId);
    if (!restaurantId) throw new Error("restaurantId không hợp lệ.");
    await requireRestaurantAccess(ctx, restaurantId);
    return buildAiSchedulePlannerPreview(input, ctx);
  },
  schedulePublication: async (
    _,
    { restaurantId, periodStart, periodEnd },
    ctx,
  ) => {
    requireAuth(ctx);
    await requireRestaurantAccess(ctx, restaurantId);

    const rid = toObjectId(restaurantId);
    if (!rid) throw new Error("restaurantId không hợp lệ.");

    const doc = await SchedulePublication.findOne({
      restaurantId: rid,
      periodStart: toStartOfDay(periodStart),
      periodEnd: toEndOfDay(periodEnd),
    }).lean();

    if (!doc) return null;
    return mapSchedulePublicationOutput(doc);
  },
  scheduleChangeLogs: async (
    _,
    { restaurantId, shiftIds = [], periodStart, periodEnd, limit = 50 },
    ctx,
  ) => {
    requireAuth(ctx);
    requireRoles(ctx, SCHEDULE_READ_ROLES);
    await requireRestaurantAccess(ctx, restaurantId);
    const rid = toObjectId(restaurantId);
    if (!rid) {
      throw new Error("restaurantId không hợp lệ.");
    }

    const safeLimit = Math.max(1, Math.min(Number(limit || 50), 200));
    const scheduleVerbs = [
      "schedule.publish",
      "schedule.published_shift_time_change",
      "schedule.published_shift_add_employee",
      "schedule.published_shift_remove_employee",
      "schedule.shift_remove_employee",
      "schedule.published_shift_group_delete",
      "schedule.lock",
      "schedule.close",
      "schedule.reopen",
      "schedule.republish",
    ];
    const filter = {
      restaurantId: rid,
      verb: { $in: scheduleVerbs },
    };
    const normalizedShiftIds = (shiftIds || [])
      .filter(Boolean)
      .map((id) => String(id));

    if (normalizedShiftIds.length > 0) {
      filter.$or = [
        { "meta.affectedShiftIds": { $in: normalizedShiftIds } },
        { "object.id": { $in: normalizedShiftIds } },
      ];
    }

    if (periodStart || periodEnd) {
      const timeFilter = {};
      if (periodStart) timeFilter.$gte = new Date(periodStart);
      if (periodEnd) timeFilter.$lte = new Date(periodEnd);
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [{ at: timeFilter }, { createdAt: timeFilter }],
        },
      ];
    }

    const rows = await EventLog.find(filter)
      .sort({ at: -1, createdAt: -1 })
      .limit(safeLimit)
      .lean();

    return rows.map(mapScheduleChangeLog);
  },
  staffShifts: async (
    _,
    { restaurantId, employeeId, startDate, endDate, status, limit = 500 },
    ctx,
  ) => {
    requireAuth(ctx);
    const filter = {};
    const authUser = ctx?.user || null;
    const authUserId = String(authUser?.id || authUser?._id || "");
    const requestedEmployeeId = String(employeeId || authUserId || "");
    const userRoles = resolveUserRoles(authUser);
    const isStaffSelfView =
      userRoles.some((role) => ATTENDANCE_SELF_ROLES.includes(role)) &&
      authUserId &&
      requestedEmployeeId === authUserId;
    const fallbackRestaurantId =
      restaurantId || authUser?.restaurantForStaff || null;
    const rid = toObjectId(fallbackRestaurantId);
    const eid = toObjectId(employeeId);
    if (!rid) return [];

    if (isStaffSelfView) {
      if (!eid || String(eid) !== String(authUserId)) {
        throw new Error("FORBIDDEN");
      }
      await requireRestaurantAccess(ctx, rid);
    } else {
      requireRoles(ctx, SCHEDULE_READ_ROLES);
      await requireRestaurantAccess(ctx, rid);
    }
    if (rid) filter.restaurantId = rid;
    if (eid) filter.employeeId = eid;
    if (status) filter.status = status;

    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) filter.startTime.$gte = toStartOfDay(startDate);
      if (endDate) filter.startTime.$lte = toEndOfDay(endDate);
    }

    if (isStaffSelfView && rid) {
      const periodStart = startDate ? toStartOfDay(startDate) : null;
      const periodEnd = endDate ? toEndOfDay(endDate) : null;
      const publicationFilter = {
        restaurantId: rid,
        status: { $in: ["published", "active"] },
      };

      if (periodStart || periodEnd) {
        publicationFilter.$and = [];
        if (periodStart)
          publicationFilter.$and.push({ periodEnd: { $gte: periodStart } });
        if (periodEnd)
          publicationFilter.$and.push({ periodStart: { $lte: periodEnd } });
      }

      const publications = await SchedulePublication.find(publicationFilter)
        .select({ periodStart: 1, periodEnd: 1 })
        .lean();

      if (!publications.length) return [];

      const publicationRanges = publications
        .map((publication) => ({
          startTime: {
            $gte: publication.periodStart,
            $lte: publication.periodEnd,
          },
        }))
        .filter((range) => range.startTime.$gte && range.startTime.$lte);

      if (!publicationRanges.length) return [];

      filter.$and = [...(filter.$and || []), { $or: publicationRanges }];

      if (!status) {
        filter.status = { $ne: "cancelled" };
      }
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

  staffAttendanceRecords: async (
    _,
    { restaurantId, startDate, endDate, employeeId, status, search },
    ctx,
  ) => {
    requireAuth(ctx);

    const start = toStartOfDay(startDate);
    const end = toEndOfDay(endDate);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end < start
    ) {
      return [];
    }

    const authUser = ctx?.user || null;
    const actorId = authUser?.id || authUser?._id || null;
    const fallbackRestaurantId =
      restaurantId || authUser?.restaurantForStaff || null;

    const rid = toObjectId(fallbackRestaurantId);
    if (!rid) return [];

    await requireRestaurantAccess(ctx, rid);

    const roles = resolveUserRoles(authUser);
    const canReadAttendance = roles.some((role) =>
      ATTENDANCE_READ_ROLES.includes(role),
    );
    const canSelfAttendance = roles.some((role) =>
      ATTENDANCE_SELF_ROLES.includes(role),
    );

    const requestedEmployeeId = employeeId ? String(employeeId) : "";
    const actorEmployeeId = actorId ? String(actorId) : "";

    const isSelfRequest =
      canSelfAttendance &&
      actorEmployeeId &&
      (!requestedEmployeeId || requestedEmployeeId === actorEmployeeId);

    if (!canReadAttendance && !isSelfRequest) {
      const err = new Error("FORBIDDEN");
      err.statusCode = 403;
      throw err;
    }

    const effectiveEmployeeId = isSelfRequest
      ? actorEmployeeId
      : requestedEmployeeId;

    const staffFilter = {
      userType: "STAFF",
      deletedAt: null,
      restaurantForStaff: rid,
    };

    const eid = toObjectId(effectiveEmployeeId);
    if (eid) {
      staffFilter._id = eid;
    }

    if (!isSelfRequest && search) {
      const regex = new RegExp(search, "i");
      staffFilter.$or = [
        { fullName: regex },
        { employeeCode: regex },
        { phone: regex },
        { email: regex },
      ];
    }

    const staffs = await Staff.find(staffFilter)
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

    if (!staffs.length) return [];

    const staffById = new Map(staffs.map((s) => [String(s._id), s]));
    const staffIds = staffs.map((s) => s._id);

    const shifts = await Shift.find({
      employeeId: { $in: staffIds },
      restaurantId: rid,
      startTime: { $lte: end },
      endTime: { $gte: start },
    })
      .select({
        _id: 1,
        employeeId: 1,
        shiftType: 1,
        startTime: 1,
        endTime: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .lean();

    const timesheets = await Timesheet.find({
      restaurantId: rid,
      employeeId: { $in: staffIds },
      workDate: { $gte: start, $lte: end },
    })
      .populate("shiftId")
      .sort({ workDate: -1, createdAt: -1 })
      .lean();

    const existingShiftIds = new Set(
      timesheets
        .map((ts) => ts.shiftId?._id || ts.shiftId)
        .filter(Boolean)
        .map((id) => String(id)),
    );

    const existingKey = new Set(
      timesheets.map((ts) => {
        const day = new Date(ts.workDate).toISOString().slice(0, 10);
        return `${String(ts.employeeId)}|${day}|${
          ts.shiftId ? String(ts.shiftId._id || ts.shiftId) : "off"
        }`;
      }),
    );

    const records = [...timesheets];

    for (const shift of shifts) {
      if (existingShiftIds.has(String(shift._id))) continue;

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
      .map((record) =>
        mapAttendanceRecord(record, staffById.get(String(record.employeeId))),
      )
      .sort(
        (a, b) =>
          new Date(b.workDate).getTime() - new Date(a.workDate).getTime(),
      );

    if (!status || status === "all") return mapped;
    return mapped.filter((record) => record.status === status);
  },
  offScheduleAttendances: async (_, { input }, ctx) => {
    const entries = await listOffScheduleAttendancesService({
      filter: input || {},
      ctx,
    });
    return entries.map(({ record, staff }) =>
      mapAttendanceRecord(record, staff),
    );
  },
  attendanceCorrectionRequests: async (_, { filter }, ctx) => {
    return listAttendanceCorrectionRequests({
      filter: filter || {},
      ctx,
    });
  },

  attendanceCorrectionRequest: async (_, { id }, ctx) => {
    return getAttendanceCorrectionRequest({
      id,
      ctx,
    });
  },

  staffPerformanceSummary: async (_, { input }, ctx) => {
    return getStaffPerformanceSummary(input, ctx?.user);
  },
  staffPerformanceSummaries: async (_, { input }, ctx) => {
    return listStaffPerformanceSummaries(input, ctx?.user);
  },
  staffPerformanceScoreAdjustments: async (_, { input }, ctx) => {
    return listStaffPerformanceScoreAdjustments(input, ctx?.user);
  },
  staffPerformanceScoreTimeline: async (_, { input }, ctx) => {
    return getStaffPerformanceScoreTimeline(input, ctx?.user);
  },
  performanceIncidents: async (_, { filter }, ctx) => {
    requireAuth(ctx);
    const input = { ...(filter || {}) };
    const restaurantId = input.restaurantId;
    if (!restaurantId || !await userCanAccessRestaurant(ctx.user, restaurantId)) {
      throw new Error("FORBIDDEN");
    }
    const roles = resolveUserRoles(ctx.user);
    const actorId = String(ctx?.user?.id || ctx?.user?._id || "");
    if (roles.some((role) => ATTENDANCE_SELF_ROLES.includes(role))) {
      if (input.employeeId && String(input.employeeId) !== actorId)
        throw new Error("FORBIDDEN");
      input.employeeId = actorId;
    } else if (!roles.some((role) => ATTENDANCE_READ_ROLES.includes(role))) {
      throw new Error("FORBIDDEN");
    }
    return listPerformanceIncidentsService(input);
  },
  performanceIncidentAppeals: async (_, { filter }, ctx) => {
    requireAuth(ctx);
    return listPerformanceIncidentAppeals(filter || {}, ctx.user);
  },
  managerIncidentReviewQueue: async (_, { input }, ctx) => {
    requireAuth(ctx);
    return listManagerIncidentReviewQueue(input, ctx.user);
  },
  managerIncidentReviewQueueSummary: async (_, { input }, ctx) => {
    requireAuth(ctx);
    return getManagerIncidentReviewQueueSummary(input, ctx.user);
  },
  managerPerformanceDashboard: async (_, { input }, ctx) => {
    requireAuth(ctx);
    return getManagerPerformanceDashboard(input, ctx.user);
  },
  leaveRequests: async (_, { filter = {} }, ctx) => {
    requireAuth(ctx);

    const authUser = ctx?.user || null;
    const fallbackRestaurantId =
      filter.restaurantId || authUser?.restaurantForStaff || null;

    const rid = toObjectId(fallbackRestaurantId);
    if (!rid) return [];

    await requireRestaurantAccess(ctx, rid);

    const query = { restaurantId: rid };
    const roles = resolveUserRoles(authUser);
    const canReadLeave = roles.some((role) =>
      ATTENDANCE_READ_ROLES.includes(role),
    );
    const canSelfLeave = roles.some((role) =>
      ATTENDANCE_SELF_ROLES.includes(role),
    );
    const actorId = authUser?.id || authUser?._id || null;
    const requestedEmployeeId = filter.employeeId
      ? String(filter.employeeId)
      : "";
    const actorEmployeeId = actorId ? String(actorId) : "";
    const isSelfRequest =
      canSelfLeave &&
      actorEmployeeId &&
      (!requestedEmployeeId || requestedEmployeeId === actorEmployeeId);

    if (!canReadLeave && !isSelfRequest) {
      const err = new Error("FORBIDDEN");
      err.statusCode = 403;
      throw err;
    }

    const eid = toObjectId(filter.employeeId);
    if (isSelfRequest) {
      query.employeeId = toObjectId(actorEmployeeId);
    } else if (eid) {
      query.employeeId = eid;
    }
    if (filter.status) query.status = String(filter.status).toLowerCase();
    if (filter.startDate || filter.endDate) {
      query.startDate = {};
      if (filter.startDate)
        query.startDate.$gte = toStartOfDay(filter.startDate);
      if (filter.endDate) query.startDate.$lte = toEndOfDay(filter.endDate);
    }

    const rows = await LeaveRequest.find(query)
      .populate(
        "employeeId",
        "fullName employeeCode positionTitle roleName avatarUrl avatar role",
      )
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
            String(row.employeeId?.fullName || "")
              .toLowerCase()
              .includes(needle) ||
            String(row.employeeId?.employeeCode || "")
              .toLowerCase()
              .includes(needle)
          );
        });

    return searched.map((row) => ({
      id: String(row._id),
      employeeId: String(row.employeeId?._id || row.employeeId),
      employeeName: row.employeeId?.fullName || null,
      employeeCode: row.employeeId?.employeeCode || null,
      employeeRole:
        row.employeeId?.positionTitle || row.employeeId?.roleName || null,
      employeeAvatar:
        row.employeeId?.avatarUrl || row.employeeId?.avatar || null,
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
      replacementManagerId: row.replacementManagerId?._id
        ? String(row.replacementManagerId._id)
        : null,
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
        deductCompensatoryDays: Number(
          row.quotaImpact?.deductCompensatoryDays || 0,
        ),
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
    return (
      await LeaveRequest.find({
        replacementManagerId: uid,
        ...(restaurantId ? { restaurantId: toObjectId(restaurantId) } : {}),
        ...(status ? { replacementStatus: String(status).toLowerCase() } : {}),
      })
        .populate("employeeId", "fullName employeeCode")
        .sort({ createdAt: -1 })
        .lean()
    ).map((row) => ({
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
      replacementManagerId: row.replacementManagerId
        ? String(row.replacementManagerId)
        : null,
      replacementManagerName: null,
      replacementStatus: toGraphReplacementStatus(row.replacementStatus),
      replacementConfirmedAt: row.replacementConfirmedAt || null,
      replacementConfirmedBy: row.replacementConfirmedBy
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
      auditLogs: [],
      createdAt: row.createdAt || null,
      updatedAt: row.updatedAt || null,
    }));
  },

  leaveBalance: async (_, { employeeId, year }, ctx) => {
    const staff = await requireLeaveBalanceAccess(ctx, employeeId);
    if (!staff) return null;
    const y = Number(year || new Date().getFullYear());
    const row = await LeaveBalance.findOne({
      employeeId: toObjectId(employeeId),
      year: y,
    }).lean();
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
    requireAuth(ctx);
    const start = toStartOfDay(input.startDate);
    const end = toEndOfDay(input.endDate);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end < start
    ) {
      throw new Error("Invalid report period");
    }

    const authUser = ctx?.user || null;
    const fallbackRestaurantId =
      input.restaurantId || authUser?.restaurantForStaff || null;
    const rid = toObjectId(fallbackRestaurantId);
    if (!rid) throw new Error("Missing restaurantId for staff report");
    await requireStaffReportAccessForRestaurant(ctx, rid);

    const periodDays = Math.max(
      Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
      1,
    );
    const compareStart = input.compareStartDate
      ? toStartOfDay(input.compareStartDate)
      : toStartOfDay(new Date(start.getTime() - periodDays * 86400000));
    const compareEnd = input.compareEndDate
      ? toEndOfDay(input.compareEndDate)
      : toEndOfDay(new Date(start.getTime() - 1));

    const staffDocs = await Staff.find({
      userType: "STAFF",
      $or: [{ restaurantForStaff: rid }],
    })
      .select({
        _id: 1,
        fullName: 1,
        employeeCode: 1,
        employmentStatus: 1,
        dateJoined: 1,
        dateLeft: 1,
        createdAt: 1,
      })
      .lean();

    const [timesheets, leaveRequests, leaveBalances] =
      await Promise.all([
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

    const activeEmployees = staffDocs.filter(
      (s) => String(s.employmentStatus || "").toLowerCase() !== "resigned",
    ).length;
    const terminatedEmployees = staffDocs.filter(
      (s) => String(s.employmentStatus || "").toLowerCase() === "resigned",
    ).length;
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

    const presentCount = timesheets.filter((t) =>
      Boolean(t.actualCheckInAt),
    ).length;
    const absentCount = timesheets.filter(
      (t) => !t.actualCheckInAt && !t.isOffSchedule,
    ).length;
    const lateCount = timesheets.filter(
      (t) => toNumber(t.latenessMinutes) > 0,
    ).length;
    const earlyLeaveCount = timesheets.filter(
      (t) => toNumber(t.earlyLeaveMinutes) > 0,
    ).length;

    const leaveApproved = leaveRequests.filter(
      (r) => String(r.status) === "approved",
    );
    const leaveRejected = leaveRequests.filter(
      (r) => String(r.status) === "rejected",
    );
    const leavePending = leaveRequests.filter((r) =>
      String(r.status).startsWith("pending"),
    );
    const paidLeaveDays = leaveApproved.reduce(
      (sum, row) =>
        sum +
        (row?.payrollFlags?.isPaidLeave ? toNumber(row.requestedDays) : 0),
      0,
    );
    const unpaidLeaveDays = leaveApproved.reduce(
      (sum, row) =>
        sum +
        (!row?.payrollFlags?.isPaidLeave ? toNumber(row.requestedDays) : 0),
      0,
    );

    const remainingLeaveBalanceDays = leaveBalances.reduce(
      (sum, row) =>
        sum +
        toNumber(row.annualRemainingDays) +
        toNumber(row.sickRemainingDays) +
        toNumber(row.compensatoryRemainingDays),
      0,
    );

    const attendanceTrendMap = new Map();
    for (const row of timesheets) {
      const key = toYmd(row.workDate);
      if (!attendanceTrendMap.has(key)) {
        attendanceTrendMap.set(key, {
          date: key,
          present: 0,
          absent: 0,
          late: 0,
          earlyLeave: 0,
        });
      }
      const bucket = attendanceTrendMap.get(key);
      if (row.actualCheckInAt) bucket.present += 1;
      if (!row.actualCheckInAt && !row.isOffSchedule) bucket.absent += 1;
      if (toNumber(row.latenessMinutes) > 0) bucket.late += 1;
      if (toNumber(row.earlyLeaveMinutes) > 0) bucket.earlyLeave += 1;
    }
    const attendanceTrend = [...attendanceTrendMap.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );

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
    const attendanceByShift = [...attendanceByShiftMap.values()].sort((a, b) =>
      a.shiftType.localeCompare(b.shiftType),
    );

    const leaveByTypeMap = new Map();
    for (const row of leaveRequests) {
      const key = String(row.leaveType || "unknown");
      if (!leaveByTypeMap.has(key))
        leaveByTypeMap.set(key, { leaveType: key, count: 0, days: 0 });
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
      leaveDaysUsed: Number(
        leaveApproved
          .reduce((s, r) => s + toNumber(r.requestedDays), 0)
          .toFixed(2),
      ),
      paidLeaveDays: Number(paidLeaveDays.toFixed(2)),
      unpaidLeaveDays: Number(unpaidLeaveDays.toFixed(2)),
      remainingLeaveBalanceDays: Number(remainingLeaveBalanceDays.toFixed(2)),
    };

    const [prevTimesheets, prevLeaves] = await Promise.all([
      Timesheet.find({
        restaurantId: rid,
        workDate: { $gte: compareStart, $lte: compareEnd },
      })
        .select({
          actualCheckInAt: 1,
          latenessMinutes: 1,
          earlyLeaveMinutes: 1,
          isOffSchedule: 1,
        })
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
      presentCount: prevTimesheets.filter((r) => Boolean(r.actualCheckInAt))
        .length,
      lateCount: prevTimesheets.filter((r) => toNumber(r.latenessMinutes) > 0)
        .length,
      earlyLeaveCount: prevTimesheets.filter(
        (r) => toNumber(r.earlyLeaveMinutes) > 0,
      ).length,
      absentCount: prevTimesheets.filter(
        (r) => !r.actualCheckInAt && !r.isOffSchedule,
      ).length,
      leaveTotal: prevLeaves.length,
      leaveApproved: prevLeaves.filter((r) => String(r.status) === "approved")
        .length,
      leaveRejected: prevLeaves.filter((r) => String(r.status) === "rejected")
        .length,
      leavePending: prevLeaves.filter((r) =>
        String(r.status).startsWith("pending"),
      ).length,
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
      const deltaPct =
        previous === 0
          ? current === 0
            ? 0
            : 100
          : Number(((delta / previous) * 100).toFixed(2));
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
