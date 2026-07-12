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
  completeOvertimeRequest,
  rejectOvertimeRequest,
  markPayrollItemPaid,
  batchMarkPayrollPaid,
  markPayrollPeriodPaid,
};
