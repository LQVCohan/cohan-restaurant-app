// src/graphql/staff/mutation.js
import mongoose from "mongoose";
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
  AttendanceCorrectionRequest,
  OvertimeRequest,
} from "../../../models/index.js";
import { mailer } from "../../../lib/mailer.js";
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
  requireRestaurantScope,
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

  await assertShiftAssignmentValid({
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
  const staff = await loadStaffForRestaurant(input.employeeId, restaurantId);

  const created = await Shift.create({
    employeeId: input.employeeId,
    restaurantId,
    shiftType: input.shiftType.toString().toLowerCase(),
    startTime,
    endTime,
    status: input.status || "scheduled",
    notes: input.notes || "",
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

async function getSchedulePublicationForShift({ restaurantId, shiftTime }) {
  if (!restaurantId || !shiftTime) return null;
  return SchedulePublication.findOne({
    restaurantId,
    periodStart: { $lte: shiftTime },
    periodEnd: { $gte: shiftTime },
  }).lean();
}

function buildUpdatedShiftResponse(shift, staff) {
  return {
    id: String(shift._id),
    employeeId: String(shift.employeeId),
    employeeName: staff?.fullName || null,
    restaurantId: String(shift.restaurantId),
    shiftType: shift.shiftType,
    startTime: shift.startTime,
    endTime: shift.endTime,
    status: shift.status,
    notes: shift.notes || "",
  };
}

function toValidDateTime(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} không hợp lệ.`);
  return date;
}

function addHours(date, hours) {
  return new Date(new Date(date).getTime() + hours * 60 * 60 * 1000);
}

function buildShiftSignature(shift) {
  return [
    shift.shiftType,
    new Date(shift.startTime).toISOString(),
    new Date(shift.endTime).toISOString(),
    shift.status,
  ].join("|");
}

function collectChangedAcknowledgementEmployeeIds(oldShifts = [], newShifts = []) {
  const oldMap = new Map();
  for (const shift of oldShifts) {
    if (!shift?._id) continue;
    oldMap.set(String(shift._id), buildShiftSignature(shift));
  }
  const changed = [];
  for (const shift of newShifts) {
    if (!shift?._id) continue;
    if (oldMap.get(String(shift._id)) !== buildShiftSignature(shift)) {
      changed.push(String(shift.employeeId));
    }
  }
  return [...new Set(changed)];
}

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
    return assignStaffRoleWithinRestaurant({
      actor: ctx.user,
      staffUserId: input.staffUserId,
      roleId: input.roleId,
      restaurantId: input.restaurantId,
      ctx,
    });
  },

  assignStaffRoleWithinRestaurant: async (_, args, ctx) => {
    requireAuth(ctx);
    return assignStaffRoleWithinRestaurant({
      actor: ctx.user,
      staffUserId: args.staffUserId,
      roleId: args.roleId,
      restaurantId: args.restaurantId,
      ctx,
    });
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