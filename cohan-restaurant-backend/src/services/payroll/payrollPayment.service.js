import mongoose from "mongoose";
import {
  PayrollPeriod,
  PayrollItem,
  PayrollPayment,
  Cashflow,
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

function applySession(query, session) {
  if (session && query && typeof query.session === "function") {
    return query.session(session);
  }
  return query;
}

async function execMaybeLean(query, session = null) {
  const scopedQuery = applySession(query, session);
  if (scopedQuery && typeof scopedQuery.lean === "function") {
    return scopedQuery.lean();
  }
  return scopedQuery;
}

async function execAggregate(aggregate, session = null) {
  if (session && aggregate && typeof aggregate.session === "function") {
    return aggregate.session(session);
  }
  return aggregate;
}

async function createOne(Model, payload, session = null) {
  if (!session) return Model.create(payload);
  const rows = await Model.create([payload], { session });
  return rows[0];
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function normalizePaymentMethod(method) {
  return ["cash", "bank_transfer", "card", "e_wallet", "other"].includes(
    String(method || ""),
  )
    ? String(method)
    : "cash";
}

function getNetSalary(item) {
  return roundMoney(item?.breakdown?.netSalary || 0);
}

function assertValidPaidAt(value) {
  const paidAt = value ? new Date(value) : new Date();
  if (Number.isNaN(paidAt.getTime())) {
    throw new Error("PAYROLL_PAYMENT_DATE_INVALID");
  }
  return paidAt;
}

function assertExistingPaymentScope(existingPayment, period, item) {
  if (
    String(existingPayment.periodId) !== String(period._id) ||
    String(existingPayment.employeeId) !== String(item.employeeId) ||
    String(existingPayment.payrollItemId) !== String(item._id)
  ) {
    throw new Error("PAYROLL_PAYMENT_IDEMPOTENCY_CONFLICT");
  }
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
    idempotencyKey: row.idempotencyKey || "",
    payoutId: row.payoutId ? String(row.payoutId) : null,
    createdBy: row.createdBy ? String(row.createdBy) : null,
    createdAt: row.createdAt || null,
  };
}

async function getPaidAmount(periodId, employeeId, session = null) {
  const rows = await execAggregate(
    PayrollPayment.aggregate([
      {
        $match: {
          periodId: toObjectId(periodId),
          employeeId: toObjectId(employeeId),
        },
      },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
    session,
  );
  return roundMoney(rows?.[0]?.amount || 0);
}

async function createPayrollCashflow({
  payment,
  period,
  note = "",
  session = null,
}) {
  if (!payment?._id) return null;
  const existing = await execMaybeLean(
    Cashflow.findOne({
      "ref.kind": "PayrollPayment",
      "ref.id": payment._id,
    }),
    session,
  );
  if (existing) return existing;

  return createOne(
    Cashflow,
    {
      restaurantId: payment.restaurantId,
      type: "OUTFLOW",
      amount: payment.amount,
      currency: "VND",
      occurredAt: payment.paidAt || new Date(),
      note:
        note || `Chi lương kỳ ${period?.name || period?._id || ""}`.trim(),
      ref: { kind: "PayrollPayment", id: payment._id },
      category: "payroll",
      subcategory: "labor",
      meta: {
        payrollPeriodId: String(payment.periodId),
        payrollItemId: String(payment.payrollItemId),
        employeeId: String(payment.employeeId),
        method: payment.method || "cash",
      },
    },
    session,
  );
}

async function refreshPeriodPaymentState(period, actorId, session = null) {
  const docs = await execMaybeLean(
    PayrollItem.find({ periodId: period._id }),
    session,
  );
  const items = (docs || []).map(mapPayrollDocToGql);
  const stats = summarize(items);
  const paidRows = await execAggregate(
    PayrollPayment.aggregate([
      { $match: { periodId: period._id } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
    session,
  );
  stats.paidAmount = roundMoney(paidRows?.[0]?.amount || 0);
  stats.remaining = Math.max(
    roundMoney(stats.totalPayroll - stats.paidAmount),
    0,
  );
  stats.progress =
    stats.totalPayroll > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round((stats.paidAmount / stats.totalPayroll) * 100),
          ),
        )
      : 0;

  const allPaid =
    (docs || []).length > 0 &&
    docs.every((item) => ["paid", "locked"].includes(String(item.status)));
  const update = { statsSnapshot: stats };
  if (allPaid && !["paid", "locked"].includes(String(period.status))) {
    update.status = "paid";
    update.paidAt = new Date();
    update.paidBy = actorId || null;
  } else if (
    !allPaid &&
    String(period.status) === "finalized" &&
    stats.paidAmount > 0
  ) {
    update.status = "paying";
  }

  await PayrollPeriod.findByIdAndUpdate(
    period._id,
    { $set: update },
    { session },
  );
  return { stats, allPaid };
}

async function getPeriodInScope(
  periodId,
  restaurantId = null,
  session = null,
) {
  const period = await execMaybeLean(
    PayrollPeriod.findById(periodId),
    session,
  );
  if (!period) throw new Error("PAYROLL_PERIOD_NOT_FOUND");
  if (restaurantId && String(period.restaurantId) !== String(restaurantId)) {
    throw new Error("FORBIDDEN_SCOPE");
  }
  return period;
}

async function getItemForPayment(period, employeeId, session = null) {
  const item = await execMaybeLean(
    PayrollItem.findOne({
      periodId: period._id,
      restaurantId: period.restaurantId,
      employeeId: toObjectId(employeeId),
    }),
    session,
  );
  if (!item) throw new Error("PAYROLL_ITEM_NOT_FOUND");
  return item;
}

async function getExistingPayment(
  { idempotencyKey, payoutId },
  session = null,
) {
  if (idempotencyKey) {
    const existing = await execMaybeLean(
      PayrollPayment.findOne({ idempotencyKey }),
      session,
    );
    if (existing) return existing;
  }
  if (payoutId) {
    const existing = await execMaybeLean(
      PayrollPayment.findOne({ payoutId }),
      session,
    );
    if (existing) return existing;
  }
  return null;
}

async function getLatestPayrollItem(itemId, session = null) {
  return execMaybeLean(PayrollItem.findById(itemId), session);
}

export async function listPayrollPayments({ periodId, employeeId = null }) {
  const query = { periodId: toObjectId(periodId) };
  if (employeeId) query.employeeId = toObjectId(employeeId);
  const rows = await PayrollPayment.find(query)
    .sort({ paidAt: -1, createdAt: -1 })
    .lean();
  return rows.map(mapPayrollPaymentToGql);
}

export async function getPayrollPayslip({ periodId, employeeId }) {
  const period = await getPeriodInScope(periodId);
  const item = await getItemForPayment(period, employeeId);

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

  const payments = await listPayrollPayments({
    periodId: period._id,
    employeeId,
  });
  const paidAmount = roundMoney(
    payments.reduce((sum, row) => sum + toNumber(row.amount), 0),
  );
  const remainingAmount = Math.max(
    roundMoney(getNetSalary(item) - paidAmount),
    0,
  );
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
      stats: period.statsSnapshot || {
        totalPayroll: 0,
        paidAmount: 0,
        remaining: 0,
        progress: 0,
      },
    },
    employee: {
      id: String(employee?._id || item.employeeId),
      name: employee?.fullName || item.employeeName || "Nhân viên",
      code: employee?.employeeCode || item.employeeCode || null,
      role:
        employee?.positionTitle || employee?.roleName || item.role || null,
      department: employee?.department || item.department || null,
      avatar: employee?.avatarUrl || employee?.avatar || item.avatar || null,
    },
    item: gqlItem,
    breakdown: gqlItem,
    payments,
    remainingAmount,
    canMarkPaid:
      ["finalized", "paying"].includes(String(period.status)) &&
      remainingAmount > 0,
    canEdit: String(period.status) === "draft",
  };
}

export async function markPayrollItemPaid({
  input,
  actorId = null,
  refreshPeriod = true,
}) {
  const idempotencyKey = String(
    input.idempotencyKey || input.requestId || "",
  ).trim();
  const payoutId = toObjectId(input.payoutId);
  const session = await mongoose.startSession();
  let updatedItem = null;

  try {
    await session.withTransaction(async () => {
      const period = await getPeriodInScope(
        input.periodId,
        null,
        session,
      );
      assertPayrollPeriodCanMarkPaid(period);
      const item = await getItemForPayment(
        period,
        input.employeeId,
        session,
      );

      const existingPayment = await getExistingPayment(
        { idempotencyKey, payoutId },
        session,
      );
      if (existingPayment) {
        assertExistingPaymentScope(existingPayment, period, item);
        updatedItem = (await getLatestPayrollItem(item._id, session)) || item;
        return;
      }

      const paidAmount = await getPaidAmount(
        period._id,
        item.employeeId,
        session,
      );
      const netSalary = getNetSalary(item);
      const remainingAmount = Math.max(
        roundMoney(netSalary - paidAmount),
        0,
      );
      if (remainingAmount <= 0 || item.status === "paid") {
        throw new Error("ALREADY_PAID");
      }

      const amount =
        input.amount == null ? remainingAmount : roundMoney(input.amount);
      if (!(amount > 0)) {
        throw new Error("PAYROLL_PAYMENT_AMOUNT_INVALID");
      }
      if (amount > remainingAmount) {
        throw new Error("PAYROLL_PAYMENT_OVERPAY");
      }

      const paidAt = assertValidPaidAt(input.paidAt);
      const method = normalizePaymentMethod(input.method);
      if (String(period.status) === "finalized") {
        await PayrollPeriod.findByIdAndUpdate(
          period._id,
          { $set: { status: "paying" } },
          { session },
        );
        period.status = "paying";
      }

      const paymentPayload = {
        periodId: period._id,
        restaurantId: period.restaurantId,
        employeeId: item.employeeId,
        payrollItemId: item._id,
        amount,
        method,
        paidAt,
        note: input.note || "",
        referenceCode: input.referenceCode || "",
        createdBy: actorId,
        ...(idempotencyKey ? { idempotencyKey } : {}),
        ...(payoutId ? { payoutId } : {}),
      };
      const payment = await createOne(
        PayrollPayment,
        paymentPayload,
        session,
      );
      await createPayrollCashflow({
        payment,
        period,
        session,
        note: `Chi lương kỳ ${period.name || ""} - ${item.employeeName || "Nhân viên"}`.trim(),
      });

      const nextPaidAmount = roundMoney(paidAmount + amount);
      const remainingAfterPayment = Math.max(
        roundMoney(netSalary - nextPaidAmount),
        0,
      );
      const update = {
        paymentMethod: method || item.paymentMethod || "",
        paymentNote: input.note || item.paymentNote || "",
        "breakdown.paidAmount": nextPaidAmount,
        "breakdown.remainingAmount": remainingAfterPayment,
        status: nextPaidAmount >= netSalary ? "paid" : "pending_payment",
      };
      if (nextPaidAmount >= netSalary) {
        update.paidAt = paidAt;
        update.paidBy = actorId || null;
      } else {
        update.paidAt = null;
        update.paidBy = null;
      }

      updatedItem = await execMaybeLean(
        PayrollItem.findOneAndUpdate(
          {
            _id: item._id,
            periodId: period._id,
            restaurantId: period.restaurantId,
            status: { $nin: ["paid", "locked"] },
          },
          { $set: update },
          { new: true, session },
        ),
        session,
      );
      if (!updatedItem) {
        throw new Error("PAYROLL_PAYMENT_WRITE_CONFLICT");
      }

      if (refreshPeriod) {
        await refreshPeriodPaymentState(period, actorId, session);
      }
    });
  } catch (error) {
    if (error?.code === 11000 && (idempotencyKey || payoutId)) {
      const period = await getPeriodInScope(input.periodId);
      const item = await getItemForPayment(period, input.employeeId);
      const existingPayment = await getExistingPayment({
        idempotencyKey,
        payoutId,
      });
      if (existingPayment) {
        assertExistingPaymentScope(existingPayment, period, item);
        const latestItem = await getLatestPayrollItem(item._id);
        return mapPayrollDocToGql(latestItem || item);
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }

  return mapPayrollDocToGql(updatedItem);
}

export async function batchMarkPayrollPaid({ input, actorId = null }) {
  const period = await getPeriodInScope(input.periodId);
  assertPayrollPeriodCanMarkPaid(period);
  let employeeIds = Array.from(
    new Set((input.employeeIds || []).map(String)),
  ).filter(Boolean);
  if (!employeeIds.length) {
    const unpaidItems = await PayrollItem.find({
      periodId: period._id,
      status: { $nin: ["paid", "locked"] },
    })
      .select({ employeeId: 1 })
      .lean();
    employeeIds = unpaidItems.map((row) => String(row.employeeId));
  }
  if (!employeeIds.length) throw new Error("PAYROLL_NO_UNPAID_ITEMS");

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
          referenceCode: input.referenceCode,
        },
        actorId,
        refreshPeriod: false,
      });
      items.push(item);
    } catch (error) {
      errors.push({
        employeeId,
        code: error?.message || "PAYROLL_PAYMENT_FAILED",
        message: error?.message || "Unable to mark payroll item paid",
      });
    }
  }

  const refreshedPeriod = await getPeriodInScope(input.periodId);
  await refreshPeriodPaymentState(refreshedPeriod, actorId);
  return {
    successCount: items.length,
    failedCount: errors.length,
    items,
    errors,
  };
}

export async function buildPayrollExportRows({ periodId }) {
  const periodObjectId = toObjectId(periodId);
  const items = await PayrollItem.find({ periodId: periodObjectId })
    .sort({ employeeName: 1 })
    .lean();
  const payments = await PayrollPayment.aggregate([
    { $match: { periodId: periodObjectId } },
    { $group: { _id: "$employeeId", amount: { $sum: "$amount" } } },
  ]);
  const paidByEmployee = new Map(
    payments.map((row) => [String(row._id), roundMoney(row.amount)]),
  );

  return items.map((item) => {
    const breakdown = item.breakdown || {};
    const paidAmount =
      paidByEmployee.get(String(item.employeeId)) || 0;
    const netSalary = roundMoney(breakdown.netSalary || 0);
    return {
      employeeId: String(item.employeeId),
      employeeCode: item.employeeCode || null,
      employeeName: item.employeeName || "Nhân viên",
      department: item.department || null,
      role: item.role || null,
      baseSalary: toNumber(breakdown.baseSalary),
      actualWorkDays: toNumber(breakdown.actualWorkDays),
      totalHours: toNumber(breakdown.totalHours),
      overtimeNormalHours: toNumber(breakdown.overtimeNormalHours),
      overtimeWeekendHours: toNumber(breakdown.overtimeWeekendHours),
      overtimeHolidayHours: toNumber(breakdown.overtimeHolidayHours),
      nightHours: toNumber(breakdown.nightHours),
      grossIncome: toNumber(breakdown.grossIncome),
      allowance: toNumber(breakdown.allowance),
      bonus: toNumber(breakdown.bonus),
      deduction:
        toNumber(breakdown.deduction) +
        toNumber(breakdown.otherDeduction) +
        toNumber(breakdown.advance),
      insuranceTotal: toNumber(breakdown.insuranceTotal),
      personalIncomeTax: toNumber(breakdown.personalIncomeTax),
      netSalary,
      paidAmount,
      remainingAmount: Math.max(roundMoney(netSalary - paidAmount), 0),
      status: item.status || "draft",
    };
  });
}
