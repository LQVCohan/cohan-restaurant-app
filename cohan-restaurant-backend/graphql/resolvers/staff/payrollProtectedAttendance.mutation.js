import mongoose from "mongoose";
import staffMutation from "./mutation.js";
import { Shift } from "../../../models/index.js";
import { assertNoLockedPayrollPeriodOverlap } from "../../../src/services/payroll/payrollLockGuard.service.js";
import { withFinanceOperationLock } from "../../../src/services/finance/financeOperationLock.service.js";

function toId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
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
  markPayrollItemPaid,
  batchMarkPayrollPaid,
  markPayrollPeriodPaid,
};
