import mongoose from "mongoose";
import staffMutation from "./mutation.js";
import {
  OvertimeRequest,
  Shift,
  Timesheet,
} from "../../../models/index.js";
import { assertNoLockedPayrollPeriodOverlap } from "../../../src/services/payroll/payrollLockGuard.service.js";
import { withFinanceOperationLock } from "../../../src/services/finance/financeOperationLock.service.js";

function toId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function actorId(ctx) {
  return ctx?.user?.id || ctx?.user?._id || null;
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

async function findCompletionTimesheet(request) {
  const baseFilter = {
    employeeId: request.employeeId,
    restaurantId: request.restaurantId,
  };
  if (request.timesheetId) {
    return Timesheet.findOne({
      ...baseFilter,
      _id: request.timesheetId,
    }).lean();
  }

  const { start, end } = dayBounds(request.workDate);
  const filter = {
    ...baseFilter,
    workDate: { $gte: start, $lte: end },
  };
  if (request.shiftId) filter.shiftId = request.shiftId;
  return Timesheet.findOne(filter).sort({ createdAt: -1 }).lean();
}

async function completeOvertimeRequest(parent, args, ctx, info) {
  const suppliedInput = args?.input || {};
  const requestId = suppliedInput.requestId || args?.id;
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
  markPayrollItemPaid,
  batchMarkPayrollPaid,
  markPayrollPeriodPaid,
};
