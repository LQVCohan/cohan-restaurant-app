import mongoose from "mongoose";
import dayjs from "dayjs";
import { Cashflow } from "../../../models/index.js";
import {
  requireFinanceRead,
  requireTransactionRead,
} from "../../../src/services/finance/financePermission.service.js";

const toObjectId = (value) =>
  value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const normalize = (value) => String(value || "").trim().toLowerCase();

const resolveBoundary = (value, { endOfDay = false } = {}) => {
  if (!value) return null;
  const text = String(value).trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  if (dateOnly) {
    return (endOfDay ? dayjs(text).endOf("day") : dayjs(text).startOf("day")).toDate();
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid transaction date boundary");
  }
  return date;
};

const isRefundCashflow = (cashflow = {}) =>
  normalize(cashflow.category) === "refund" ||
  normalize(cashflow.source) === "refund" ||
  normalize(cashflow.ref?.kind).includes("refund") ||
  normalize(cashflow.note).includes("refund") ||
  normalize(cashflow.note).includes("hoàn");

const classifyFallbackCategory = (cashflow = {}) => {
  if (cashflow.category) return normalize(cashflow.category);
  if (cashflow.type === "INFLOW") return "sale";
  if (isRefundCashflow(cashflow)) return "refund";
  return "other";
};

const resolveSource = (cashflow = {}) => {
  if (cashflow.source) return cashflow.source;
  const kind = normalize(cashflow.ref?.kind);
  if (kind.includes("invoice") || kind.includes("order")) return "order";
  if (kind.includes("payroll")) return "payroll";
  if (kind.includes("stock") || kind.includes("inventory")) return "inventory";
  if (isRefundCashflow(cashflow)) return "refund";
  return "system";
};

const toFinanceTransaction = (cashflow) => ({
  id: String(cashflow._id || cashflow.id),
  occurredAt: cashflow.occurredAt,
  description:
    cashflow.note || (cashflow.type === "INFLOW" ? "Thu tiền" : "Chi tiền"),
  category: classifyFallbackCategory(cashflow),
  type: cashflow.type,
  amount: Number(cashflow.amount || 0),
  method: cashflow.method || null,
  status: cashflow.status || "completed",
  source: resolveSource(cashflow),
  referenceType: cashflow.ref?.kind || null,
  referenceId: cashflow.ref?.id ? String(cashflow.ref.id) : null,
});

const buildCashflowFilter = (input = {}) => {
  const restaurantId = toObjectId(input.restaurantId);
  if (!restaurantId) throw new Error("Invalid restaurantId");

  const filter = { restaurantId };
  const dateFrom = resolveBoundary(input.dateFrom);
  const dateTo = resolveBoundary(input.dateTo, { endOfDay: true });
  if (dateFrom || dateTo) {
    filter.occurredAt = {};
    if (dateFrom) filter.occurredAt.$gte = dateFrom;
    if (dateTo) filter.occurredAt.$lte = dateTo;
  }
  if (input.type && input.type !== "all") {
    filter.type = String(input.type).toUpperCase();
  }
  if (input.category) filter.category = normalize(input.category);
  if (input.subcategory) filter.subcategory = normalize(input.subcategory);
  if (input.method) filter.method = normalize(input.method);
  if (input.status) filter.status = normalize(input.status);
  if (input.source) filter.source = normalize(input.source);
  if (input.referenceId && mongoose.isValidObjectId(input.referenceId)) {
    filter["ref.id"] = new mongoose.Types.ObjectId(input.referenceId);
  }
  if (input.search) {
    const escaped = String(input.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp(escaped, "i");
    filter.$or = [
      { note: expression },
      { category: expression },
      { subcategory: expression },
      { source: expression },
      { "ref.kind": expression },
    ];
  }

  return { restaurantId, filter };
};

const financeTransactions = async (_, { input = {} }, ctx) => {
  const { restaurantId, filter } = buildCashflowFilter(input);
  await requireTransactionRead(ctx, restaurantId);
  const limit = Math.min(250, Math.max(1, Number(input.limit || 100)));
  const rows = await Cashflow.find(filter)
    .sort({ occurredAt: -1 })
    .limit(limit)
    .lean();
  return rows.map(toFinanceTransaction);
};

const cashflows = async (_, { input = {} }, ctx) => {
  const { restaurantId, filter } = buildCashflowFilter(input);
  await requireFinanceRead(ctx, restaurantId);
  const limit = Math.min(250, Math.max(1, Number(input.limit || 100)));
  return Cashflow.find(filter)
    .sort({ occurredAt: -1 })
    .limit(limit)
    .lean();
};

export { buildCashflowFilter, resolveBoundary };

export default {
  financeTransactions,
  cashflows,
};
