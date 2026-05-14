import mongoose from "mongoose";
import {
  PayrollPeriod,
  PayrollItem,
  PayrollPayment,
  Staff,
} from "../../../models/index.js";
import { mapPayrollDocToGql, summarize } from "./payrollRuntime.service.js";
import { assertPayrollPeriodCanMarkPaid } from "./payrollLockGuard.service.js";

function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function toNumber(value) {
  return Number(value || 0);
}


async function execMaybeLean(query) {
  if (query && typeof query.lean === "function") return query.lean();
  return query;
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function getNetSalary(item) {
  return roundMoney(item?.breakdown?.netSalary || 0);
}

export function mapPayrollPaymentToGql(row) {
  return {
    id: String(row._id || row.id),
    periodId: String(row.periodId),
    restaurantId: String(row.restaurantId),
    employeeId: String(row.employeeId),
    payrollItemId: String(row.payrollItemId),
    amount: toNumber(row.amount),
    method: row.method || "",
    paidAt: row.paidAt || null,
    note: row.note || "",
    referenceCode: row.referenceCode || "",
    createdBy: row.createdBy ? String(row.createdBy) : null,
    createdAt: row.createdAt || null,
  };
}

async function getPaidAmount(periodId, employeeId) {
  const rows = await PayrollPayment.aggregate([
    { $match: { periodId: toObjectId(periodId), employeeId: toObjectId(employeeId) } },
    { $group: { _id: null, amount: { $sum: "$amount" } } },
  ]);
  return roundMoney(rows?.[0]?.amount || 0);
}

async function refreshPeriodPaymentState(period, actorId) {
  const docs = await PayrollItem.find({ periodId: period._id }).lean();
  const items = docs.map(mapPayrollDocToGql);
  const stats = summarize(items);
  const paidRows = await PayrollPayment.aggregate([
    { $match: { periodId: period._id } },
    { $group: { _id: null, amount: { $sum: "$amount" } } },
  ]);
  stats.paidAmount = roundMoney(paidRows?.[0]?.amount || 0);
  stats.remaining = Math.max(roundMoney(stats.totalPayroll - stats.paidAmount), 0);
  stats.progress = stats.totalPayroll > 0 ? Math.min(100, Math.round((stats.paidAmount / stats.totalPayroll) * 100)) : 0;
  const allPaid = docs.length > 0 && docs.every((item) => item.status === "paid");
  const update = { statsSnapshot: stats };
  if (allPaid && period.status !== "paid") {
    update.status = "paid";
    update.paidAt = new Date();
    update.paidBy = actorId || null;
  }
  await PayrollPeriod.findByIdAndUpdate(period._id, { $set: update });
  return { stats, allPaid };
}

async function getPeriodInScope(periodId, restaurantId = null) {
  const periodQuery = PayrollPeriod.findById(periodId);
  const period = await execMaybeLean(periodQuery);
  if (!period) throw new Error("PAYROLL_PERIOD_NOT_FOUND");
  if (restaurantId && String(period.restaurantId) !== String(restaurantId)) {
    throw new Error("FORBIDDEN_SCOPE");
  }
  return period;
}

async function getItemForPayment(period, employeeId) {
  const item = await execMaybeLean(PayrollItem.findOne({
    periodId: period._id,
    restaurantId: period.restaurantId,
    employeeId: toObjectId(employeeId),
  }));
  if (!item) throw new Error("PAYROLL_ITEM_NOT_FOUND");
  return item;
}

export async function listPayrollPayments({ periodId, employeeId = null }) {
  const query = { periodId: toObjectId(periodId) };
  if (employeeId) query.employeeId = toObjectId(employeeId);
  const rows = await PayrollPayment.find(query).sort({ paidAt: -1, createdAt: -1 }).lean();
  return rows.map(mapPayrollPaymentToGql);
}

export async function getPayrollPayslip({ periodId, employeeId }) {
  const periodQuery = PayrollPeriod.findById(periodId);
  const period = await execMaybeLean(periodQuery);
  if (!period) throw new Error("PAYROLL_PERIOD_NOT_FOUND");

  const item = await execMaybeLean(PayrollItem.findOne({
    periodId: period._id,
    restaurantId: period.restaurantId,
    employeeId: toObjectId(employeeId),
  }));
  if (!item) throw new Error("PAYROLL_ITEM_NOT_FOUND");

  const employee = await Staff.findById(employeeId)
    .select({
      _id: 1,
      fullName: 1,
      employeeCode: 1,
      roleName: 1,
      positionTitle: 1,
      department: 1,
      avatarUrl: 1,
      avatar: 1,
    })
    .lean();

  const payments = await listPayrollPayments({ periodId: period._id, employeeId });
  const paidAmount = roundMoney(payments.reduce((sum, row) => sum + toNumber(row.amount), 0));
  const remainingAmount = Math.max(roundMoney(getNetSalary(item) - paidAmount), 0);

  const gqlItem = mapPayrollDocToGql(item);

  return {
    period: {
      id: String(period._id),
      restaurantId: String(period.restaurantId),
      name: period.name || "",
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
      finalizedAt: period.finalizedAt || null,
      lockedAt: period.lockedAt || null,
      paidAt: period.paidAt || null,
      stats: period.statsSnapshot || { totalPayroll: 0, paidAmount: 0, remaining: 0, progress: 0 },
    },
    employee: {
      id: String(employee?._id || item.employeeId),
      name: employee?.fullName || item.employeeName || "Nhân viên",
      code: employee?.employeeCode || item.employeeCode || null,
      role: employee?.positionTitle || employee?.roleName || item.role || null,
      department: employee?.department || item.department || null,
      avatar: employee?.avatarUrl || employee?.avatar || item.avatar || null,
    },
    item: gqlItem,
    breakdown: gqlItem,
    payments,
    remainingAmount,
    canMarkPaid: ["finalized", "paid"].includes(String(period.status)) && remainingAmount > 0,
    canEdit: String(period.status) === "draft",
  };
}

export async function markPayrollItemPaid({ input, actorId = null }) {
  const period = await getPeriodInScope(input.periodId);
  assertPayrollPeriodCanMarkPaid(period);
  const item = await getItemForPayment(period, input.employeeId);
  const paidAmount = await getPaidAmount(period._id, item.employeeId);
  const remainingAmount = Math.max(roundMoney(getNetSalary(item) - paidAmount), 0);

  if (remainingAmount <= 0 || item.status === "paid") {
    throw new Error("ALREADY_PAID");
  }

  const amount = input.amount == null ? remainingAmount : roundMoney(input.amount);
  if (!(amount > 0)) throw new Error("PAYROLL_PAYMENT_AMOUNT_INVALID");
  if (amount > remainingAmount) throw new Error("PAYROLL_PAYMENT_OVERPAY");

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  await PayrollPayment.create({
    periodId: period._id,
    restaurantId: period.restaurantId,
    employeeId: item.employeeId,
    payrollItemId: item._id,
    amount,
    method: input.method || "",
    paidAt,
    note: input.note || "",
    referenceCode: input.referenceCode || "",
    createdBy: actorId,
  });

  const nextPaidAmount = roundMoney(paidAmount + amount);
  const update = {
    paymentMethod: input.method || item.paymentMethod || "",
    paymentNote: input.note || item.paymentNote || "",
  };
  if (nextPaidAmount >= getNetSalary(item)) {
    update.status = "paid";
    update.paidAt = paidAt;
    update.paidBy = actorId || null;
  }
  const updated = await PayrollItem.findByIdAndUpdate(item._id, { $set: update }, { new: true });
  await refreshPeriodPaymentState(period, actorId);
  return mapPayrollDocToGql(updated || item);
}

export async function batchMarkPayrollPaid({ input, actorId = null }) {
  const period = await getPeriodInScope(input.periodId);
  assertPayrollPeriodCanMarkPaid(period);
  const employeeIds = Array.from(new Set((input.employeeIds || []).map(String))).filter(Boolean);
  const items = [];
  const errors = [];

  for (const employeeId of employeeIds) {
    try {
      const item = await markPayrollItemPaid({
        input: {
          periodId: input.periodId,
          employeeId,
          method: input.method,
          paidAt: input.paidAt,
          note: input.note,
        },
        actorId,
      });
      items.push(item);
    } catch (err) {
      errors.push({
        employeeId,
        code: err?.message || "PAYROLL_PAYMENT_FAILED",
        message: err?.message || "Unable to mark payroll item paid",
      });
    }
  }

  return {
    successCount: items.length,
    failedCount: errors.length,
    items,
    errors,
  };
}

export async function buildPayrollExportRows({ periodId }) {
  const items = await PayrollItem.find({ periodId: toObjectId(periodId) }).sort({ employeeName: 1 }).lean();
  const payments = await PayrollPayment.aggregate([
    { $match: { periodId: toObjectId(periodId) } },
    { $group: { _id: "$employeeId", amount: { $sum: "$amount" } } },
  ]);
  const paidByEmployee = new Map(payments.map((row) => [String(row._id), roundMoney(row.amount)]));

  return items.map((item) => {
    const b = item.breakdown || {};
    const paidAmount = paidByEmployee.get(String(item.employeeId)) || 0;
    const netSalary = roundMoney(b.netSalary || 0);
    return {
      employeeId: String(item.employeeId),
      employeeCode: item.employeeCode || null,
      employeeName: item.employeeName || "Nhân viên",
      department: item.department || null,
      role: item.role || null,
      baseSalary: toNumber(b.baseSalary),
      actualWorkDays: toNumber(b.actualWorkDays),
      totalHours: toNumber(b.totalHours),
      overtimeNormalHours: toNumber(b.overtimeNormalHours),
      overtimeWeekendHours: toNumber(b.overtimeWeekendHours),
      overtimeHolidayHours: toNumber(b.overtimeHolidayHours),
      nightHours: toNumber(b.nightHours),
      grossIncome: toNumber(b.grossIncome),
      allowance: toNumber(b.allowance),
      bonus: toNumber(b.bonus),
      deduction: toNumber(b.deduction) + toNumber(b.otherDeduction) + toNumber(b.advance),
      insuranceTotal: toNumber(b.insuranceTotal),
      personalIncomeTax: toNumber(b.personalIncomeTax),
      netSalary,
      paidAmount,
      remainingAmount: Math.max(roundMoney(netSalary - paidAmount), 0),
      status: item.status || "draft",
    };
  });
}
