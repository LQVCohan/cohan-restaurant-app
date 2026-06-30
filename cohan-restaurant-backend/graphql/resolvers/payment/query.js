import mongoose from "mongoose";
import dayjs from "dayjs";
import {
  Invoice,
  PaymentTransaction,
  Cashflow,
  PaymentSession,
  Order,
  BankTransaction,
  PaymentReconciliation,
  PaymentRefund,
  SupplierPayable,
} from "../../../models/index.js";
import { getProviderPublicConfig, sanitizePaymentSessionForClient } from "../../../src/services/payment/paymentSession.service.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import {
  requireFinanceRead,
  requireTransactionRead,
  requireReconciliationRead,
  requireRefundRead,
} from "../../../src/services/finance/financePermission.service.js";

const toObjectId = (id) =>
  id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;

const toRange = (range = "MONTH") => String(range || "MONTH").toUpperCase();
const normalize = (value) => String(value || "").trim().toLowerCase();

function resolveDateRange({ range, dateFrom, dateTo }) {
  if (dateFrom || dateTo) {
    return {
      from: dateFrom ? dayjs(dateFrom).startOf("day").toDate() : null,
      to: dateTo ? dayjs(dateTo).endOf("day").toDate() : null,
      mode: "day",
      format: "DD/MM",
    };
  }

  const now = dayjs();
  const normalized = toRange(range);
  switch (normalized) {
    case "WEEK":
      return { from: now.startOf("week").toDate(), to: now.endOf("week").toDate(), mode: "day", format: "DD/MM" };
    case "QUARTER":
      return {
        from: now.month(Math.floor(now.month() / 3) * 3).startOf("month").toDate(),
        to: now.month(Math.floor(now.month() / 3) * 3 + 2).endOf("month").toDate(),
        mode: "week",
        format: "[W]WW",
      };
    case "YEAR":
      return { from: now.startOf("year").toDate(), to: now.endOf("year").toDate(), mode: "month", format: "MM/YYYY" };
    case "CUSTOM":
    case "MONTH":
    default:
      return { from: now.startOf("month").toDate(), to: now.endOf("month").toDate(), mode: "day", format: "DD/MM" };
  }
}

function safeNote(note) {
  return String(note || "").toLowerCase();
}

export function classifyCost(cashflowOrNote = {}) {
  const isObject = cashflowOrNote && typeof cashflowOrNote === "object";

  const category = isObject ? normalize(cashflowOrNote.category) : "";
  const subcategory = isObject ? normalize(cashflowOrNote.subcategory) : "";
  const refKind = isObject ? normalize(cashflowOrNote.ref?.kind) : "";

  // UC18: ưu tiên dữ liệu chuẩn hóa category/subcategory/ref.kind
  if (
    subcategory === "cogs" ||
    category === "inventory" ||
    refKind.includes("stock")
  ) {
    return "cogs";
  }

  // UC17: payroll/payment/payout phải vào nhóm labor
  if (
    subcategory === "labor" ||
    category === "payroll" ||
    refKind.includes("payroll")
  ) {
    return "labor";
  }

  if (
    ["operations", "supplier_payment"].includes(category) ||
    ["rent", "utility", "maintenance", "marketing", "bank_fee", "tax"].includes(subcategory)
  ) {
    return "operations";
  }

  // Fallback cho dữ liệu cũ chưa có category/subcategory
  const n = safeNote(isObject ? cashflowOrNote.note : cashflowOrNote);

  if (
    n.includes("nguyên liệu") ||
    n.includes("ingredient") ||
    n.includes("supply")
  ) {
    return "cogs";
  }

  if (
    n.includes("lương") ||
    n.includes("nhân sự") ||
    n.includes("salary")
  ) {
    return "labor";
  }

  if (
    n.includes("điện") ||
    n.includes("nước") ||
    n.includes("gas") ||
    n.includes("vận hành") ||
    n.includes("mặt bằng")
  ) {
    return "operations";
  }

  return "other";
}

function isRefundCashflow(cashflow = {}) {
  return normalize(cashflow.category) === "refund" || normalize(cashflow.source) === "refund" || normalize(cashflow.ref?.kind).includes("refund") || safeNote(cashflow.note).includes("refund") || safeNote(cashflow.note).includes("hoàn");
}

function cashflowSource(cashflow = {}) {
  if (cashflow.source) return cashflow.source;
  const refKind = normalize(cashflow.ref?.kind);
  if (refKind.includes("invoice") || refKind.includes("order")) return "order";
  if (refKind.includes("payroll")) return "payroll";
  if (refKind.includes("stock") || refKind.includes("inventory")) return "inventory";
  if (isRefundCashflow(cashflow)) return "refund";
  return "system";
}

function cashflowCategory(cashflow = {}) {
  if (cashflow.category) return normalize(cashflow.category);
  if (cashflow.type === "INFLOW") return "sale";
  if (isRefundCashflow(cashflow)) return "refund";
  return classifyCost(cashflow);
}

function buildBuckets({ from, to, mode, format }) {
  const labels = [];
  let cursor = dayjs(from);
  const end = dayjs(to);
  while (cursor.isBefore(end) || cursor.isSame(end, mode)) {
    labels.push(cursor.format(format));
    if (mode === "month") cursor = cursor.add(1, "month");
    else if (mode === "week") cursor = cursor.add(1, "week");
    else cursor = cursor.add(1, "day");
  }
  return labels;
}


function bankAccountLast4(value) {
  const digits = String(value || "").replace(/\s+/g, "");
  return digits ? digits.slice(-4) : null;
}

function maskBankAccountNumber(value) {
  const last4 = bankAccountLast4(value);
  return last4 ? `****${last4}` : null;
}

function toFinanceTransactionFromCashflow(cf) {
  return {
    id: String(cf._id || cf.id),
    occurredAt: cf.occurredAt,
    description: cf.note || (cf.type === "INFLOW" ? "Thu tiền" : "Chi tiền"),
    category: cashflowCategory(cf),
    type: cf.type,
    amount: Number(cf.amount || 0),
    method: cf.method || null,
    status: cf.status || "completed",
    source: cashflowSource(cf),
    referenceType: cf.ref?.kind || null,
    referenceId: cf.ref?.id ? String(cf.ref.id) : null,
  };
}

function buildCashflowFilter(input = {}) {
  const rid = toObjectId(input.restaurantId);
  if (!rid) throw new Error("Invalid restaurantId");
  const filter = { restaurantId: rid };
  if (input.dateFrom || input.dateTo) {
    filter.occurredAt = {};
    if (input.dateFrom) filter.occurredAt.$gte = dayjs(input.dateFrom).startOf("day").toDate();
    if (input.dateTo) filter.occurredAt.$lte = dayjs(input.dateTo).endOf("day").toDate();
  }
  if (input.type && input.type !== "all") filter.type = String(input.type).toUpperCase();
  if (input.category) filter.category = normalize(input.category);
  if (input.subcategory) filter.subcategory = normalize(input.subcategory);
  if (input.method) filter.method = normalize(input.method);
  if (input.status) filter.status = normalize(input.status);
  if (input.source) filter.source = normalize(input.source);
  if (input.referenceId && mongoose.isValidObjectId(input.referenceId)) filter["ref.id"] = new mongoose.Types.ObjectId(input.referenceId);
  if (input.search) {
    const re = new RegExp(String(input.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ note: re }, { category: re }, { subcategory: re }, { source: re }, { "ref.kind": re }];
  }
  return { rid, filter };
}

export const PaymentQuery = {
  async paymentSession(_, { id }, ctx) {
    if (!mongoose.isValidObjectId(id)) throw new Error("Invalid payment id");
    const session = await PaymentSession.findById(id);
    if (!session) return null;
    if (String(session.userId || "") !== String(ctx?.user?.id || "")) {
      if (!session.restaurantId) throw new Error("Unauthorized");
      await requireRestaurantPermission(ctx, toObjectId(session.restaurantId), PERMISSIONS.PAYMENT_READ);
    }
    if (String(session.status || "").toLowerCase() === "pending" && session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
      session.status = "expired";
      session.cancelledAt = session.cancelledAt || new Date();
      session.cancelReason = session.cancelReason || "expired_by_ttl";
      session.events = Array.isArray(session.events) ? session.events : [];
      session.events.push({ type: "payment_expired", payload: { reason: session.cancelReason } });
      await session.save();
    }
    return sanitizePaymentSessionForClient(session, { includeRaw: false });
  },

  async reservationPaymentSessions(_, { reservationId }, ctx) {
    if (!mongoose.isValidObjectId(reservationId)) throw new Error("Invalid reservationId");
    const q = { reservationId: new mongoose.Types.ObjectId(reservationId) };
    if (ctx?.user?.id && mongoose.isValidObjectId(ctx.user.id)) q.userId = new mongoose.Types.ObjectId(ctx.user.id);
    const rows = await PaymentSession.find(q).sort({ createdAt: -1 }).lean();
    return rows.map((row) => sanitizePaymentSessionForClient(row, { includeRaw: false }));
  },

  async restaurantPaymentPublicConfig(_, { restaurantId }) {
    if (!mongoose.isValidObjectId(restaurantId)) throw new Error("Invalid restaurantId");
    return getProviderPublicConfig(restaurantId);
  },

  async paymentTransactionsByOrder(_, { orderId }, ctx) {
    if (!mongoose.isValidObjectId(orderId)) return [];
    const id = new mongoose.Types.ObjectId(orderId);
    const order = await Order.findById(id).lean();
    if (!order) return [];
    const orderRestaurantId = toObjectId(order.restaurantId);
    if (!orderRestaurantId) throw new Error("Invalid restaurantId");
    await requireRestaurantPermission(ctx, orderRestaurantId, PERMISSIONS.PAYMENT_READ);
    return PaymentTransaction.find({ $or: [{ orderId: id }, { orderIds: id }] }).sort({ paidAt: -1 }).lean();
  },

  async invoicesByOrder(_, { orderId }, ctx) {
    if (!mongoose.isValidObjectId(orderId)) return [];
    const id = new mongoose.Types.ObjectId(orderId);
    const order = await Order.findById(id).lean();
    if (!order) return [];
    const orderRestaurantId = toObjectId(order.restaurantId);
    if (!orderRestaurantId) throw new Error("Invalid restaurantId");
    await requireRestaurantPermission(ctx, orderRestaurantId, PERMISSIONS.PAYMENT_READ);
    return Invoice.find({ $or: [{ orderId: id }, { orderIds: id }] }).sort({ issuedAt: -1 }).lean();
  },

  async financeDashboard(_, { input }, ctx) {
    const { restaurantId, range, dateFrom, dateTo } = input || {};
    const rid = toObjectId(restaurantId);
    if (!rid) throw new Error("Invalid restaurantId");
    await requireFinanceRead(ctx, rid);

    const { from, to, mode, format } = resolveDateRange({ range, dateFrom, dateTo });
    const dateMatch = {};
    if (from) dateMatch.$gte = from;
    if (to) dateMatch.$lte = to;

    const cashflowFilter = { restaurantId: rid, status: { $ne: "voided" } };
    if (Object.keys(dateMatch).length) cashflowFilter.occurredAt = dateMatch;
    const invoiceFilter = { restaurantId: rid };
    if (Object.keys(dateMatch).length) invoiceFilter.issuedAt = dateMatch;
    const transactionFilter = { restaurantId: rid };
    if (Object.keys(dateMatch).length) transactionFilter.paidAt = dateMatch;

    const [cashflows, invoices, debtInvoices, supplierPayables, payments, recentReconciliations, reconciliationAgg, unmatchedAgg] = await Promise.all([
      Cashflow.find(cashflowFilter).sort({ occurredAt: -1 }).lean(),
      Invoice.find(invoiceFilter).sort({ issuedAt: -1 }).lean(),
      Invoice.find({ restaurantId: rid, status: { $in: ["UNPAID", "PARTIAL"] } }).lean(),
      SupplierPayable.find({ restaurantId: rid, status: { $in: ["unpaid", "partial", "overdue"] } }).lean(),
      PaymentTransaction.find(transactionFilter).sort({ paidAt: -1 }).lean(),
      PaymentReconciliation.find({ restaurantId: rid }).sort({ createdAt: -1 }).limit(10).lean(),
      PaymentReconciliation.aggregate([
        { $match: { restaurantId: rid, status: { $in: ["matched", "amount_mismatch", "resolved"] } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      BankTransaction.aggregate([{ $match: { restaurantId: rid, matchStatus: "unmatched" } }, { $count: "count" }]),
    ]);

    const revenue = cashflows
      .filter((x) => x.type === "INFLOW")
      .reduce((s, x) => s + Number(x.amount || 0), 0);

    const expense = cashflows
      .filter((x) => x.type === "OUTFLOW")
      .reduce((s, x) => s + Number(x.amount || 0), 0);

    const payment = payments
      .filter((x) => x.status === "SUCCESS")
      .reduce((s, x) => s + Number(x.paidAmount || 0), 0);

    const refund = cashflows
      .filter((x) => x.type === "OUTFLOW" && isRefundCashflow(x))
      .reduce((s, x) => s + Number(x.amount || 0), 0);

    const receivable = debtInvoices.reduce((s, inv) => {
      const total = Number(inv?.totals?.grandTotal || 0);
      const paid = Number(inv?.paid || 0);
      return s + Math.max(total - paid, 0);
    }, 0);

    const payable = supplierPayables.reduce((s, item) => {
      const amount = Number(item.amount || 0);
      const paidAmount = Number(item.paidAmount || 0);
      const remainingAmount = Number(item.remainingAmount ?? amount - paidAmount);
      return s + Math.max(remainingAmount, 0);
    }, 0);

    const debt = receivable + payable;

    const now = Date.now();

    const overdueReceivable = debtInvoices
      .filter((inv) => inv.dueDate && new Date(inv.dueDate).getTime() < now)
      .reduce((s, inv) => {
        const total = Number(inv?.totals?.grandTotal || 0);
        const paid = Number(inv?.paid || 0);
        return s + Math.max(total - paid, 0);
      }, 0);

    const overduePayable = supplierPayables
      .filter(
        (item) =>
          item.status === "overdue" ||
          (item.dueDate && new Date(item.dueDate).getTime() < now)
      )
      .reduce((s, item) => {
        const amount = Number(item.amount || 0);
        const paidAmount = Number(item.paidAmount || 0);
        const remainingAmount = Number(item.remainingAmount ?? amount - paidAmount);
        return s + Math.max(remainingAmount, 0);
      }, 0);

    const overdue = overdueReceivable + overduePayable;

    const settlement = invoices
      .filter((inv) => inv.status === "PAID")
      .reduce((s, inv) => s + Number(inv.paid || 0), 0);

    const costBreakdown = cashflows
      .filter((x) => x.type === "OUTFLOW")
      .reduce(
        (acc, x) => {
          const bucket = classifyCost(x);
          acc[bucket] += Number(x.amount || 0);
          return acc;
        },
        { cogs: 0, labor: 0, operations: 0, other: 0 }
      );

    const labels = buildBuckets({ from, to, mode, format });
    const trendMap = new Map(labels.map((label) => [label, { key: label, revenue: 0, expense: 0, profit: 0 }]));
    for (const cf of cashflows) {
      const key = dayjs(cf.occurredAt).format(format);
      if (!trendMap.has(key)) continue;
      const entry = trendMap.get(key);
      if (cf.type === "INFLOW") entry.revenue += Number(cf.amount || 0);
      if (cf.type === "OUTFLOW") entry.expense += Number(cf.amount || 0);
      entry.profit = entry.revenue - entry.expense;
    }

    const debts = debtInvoices.map((inv) => ({
      id: String(inv._id),
      supplier: `Hóa đơn ${inv.number || String(inv._id).slice(-6)}`,
      amount: Math.max(Number(inv?.totals?.grandTotal || 0) - Number(inv?.paid || 0), 0),
      dueDate: inv.updatedAt || inv.issuedAt,
      status: inv.status,
    })).filter((x) => x.amount > 0).slice(0, 10);

    const primeCost = costBreakdown.cogs + costBreakdown.labor;
    return {
      summary: {
        revenue,
        expense,
        profit: revenue - expense,
        debt: receivable + payable,
        receivable,
        payable,
        overdue,
        payment,
        refund,
        settlement,
        cashIn: revenue,
        cashOut: expense,
        primeCostRate: revenue > 0 ? (primeCost / revenue) * 100 : 0,
      },
      trend: Array.from(trendMap.values()),
      transactions: cashflows.slice(0, 120).map(toFinanceTransactionFromCashflow).sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)).slice(0, 30),
      debts,
      costBreakdown,
      reconciliations: (recentReconciliations || []).map((item) => ({
        id: String(item._id),
        time: item.matchedAt || item.createdAt,
        amount: Number(item.receivedAmount ?? item.expectedAmount ?? 0),
        reference: item.paymentReference || "",
        status: item.status || "unmatched",
        note: item.note || "",
      })),
      reconciliationSummary: {
        matched: Number(reconciliationAgg.find((x) => x._id === "matched")?.count || 0),
        amountMismatch: Number(reconciliationAgg.find((x) => x._id === "amount_mismatch")?.count || 0),
        unmatched: Number(unmatchedAgg?.[0]?.count || 0),
      },
    };
  },

  async financeTransactions(_, { input }, ctx) {
    const { rid, filter } = buildCashflowFilter(input);
    await requireTransactionRead(ctx, rid);
    const limit = Math.min(250, Math.max(1, Number(input?.limit || 100)));
    const rows = await Cashflow.find(filter).sort({ occurredAt: -1 }).limit(limit).lean();
    return rows.map(toFinanceTransactionFromCashflow);
  },

  async cashflows(_, { input }, ctx) {
    const { rid, filter } = buildCashflowFilter(input);
    await requireFinanceRead(ctx, rid);
    const limit = Math.min(250, Math.max(1, Number(input?.limit || 100)));
    return Cashflow.find(filter).sort({ occurredAt: -1 }).limit(limit).lean();
  },

  async cashflow(_, { id }, ctx) {
    const cf = mongoose.isValidObjectId(id) ? await Cashflow.findById(id).lean() : null;
    if (!cf) return null;
    await requireFinanceRead(ctx, toObjectId(cf.restaurantId));
    return cf;
  },

  async refundRequests(_, { input }, ctx) {
    const rid = toObjectId(input?.restaurantId);
    if (!rid) throw new Error("Invalid restaurantId");
    await requireRefundRead(ctx, rid);
    const filter = { restaurantId: rid };
    if (input?.status) filter.status = normalize(input.status);
    return PaymentRefund.find(filter).sort({ createdAt: -1 }).limit(Math.min(100, Math.max(1, Number(input?.limit || 50)))).lean();
  },

  async refundRequest(_, { id }, ctx) {
    const refund = mongoose.isValidObjectId(id) ? await PaymentRefund.findById(id).lean() : null;
    if (!refund) return null;
    await requireRefundRead(ctx, toObjectId(refund.restaurantId));
    return refund;
  },

  async supplierPayables(_, { input }, ctx) {
    const rid = toObjectId(input?.restaurantId);
    if (!rid) throw new Error("Invalid restaurantId");
    await requireFinanceRead(ctx, rid);
    const filter = { restaurantId: rid };
    if (input?.status && input.status !== "all") filter.status = normalize(input.status);
    if (input?.sourceKind) filter.sourceKind = normalize(input.sourceKind);
    if (input?.search) {
      const escaped = String(input.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ supplierName: new RegExp(escaped, "i") }, { note: new RegExp(escaped, "i") }];
    }
    return SupplierPayable.find(filter)
      .sort({ dueDate: 1, createdAt: -1 })
      .limit(Math.min(100, Math.max(1, Number(input?.limit || 50))))
      .lean();
  },

  async paymentReconciliations(_, { restaurantId, status, limit = 10 }, ctx) {
    const rid = toObjectId(restaurantId);
    if (!rid) throw new Error("Invalid restaurantId");
    await requireReconciliationRead(ctx, rid);
    const filter = { restaurantId: rid };
    if (status) filter.status = normalize(status);
    const docs = await PaymentReconciliation.find(filter).sort({ createdAt: -1 }).limit(Math.min(100, Math.max(1, Number(limit || 10)))).lean();
    return docs.map((doc) => ({ ...doc, id: String(doc._id), restaurantId: doc.restaurantId ? String(doc.restaurantId) : null, paymentSessionId: doc.paymentSessionId ? String(doc.paymentSessionId) : null, bankTransactionId: doc.bankTransactionId ? String(doc.bankTransactionId) : null }));
  },

  async bankTransactions(_, { restaurantId, matchStatus, limit = 10 }, ctx) {
    const rid = toObjectId(restaurantId);
    if (!rid) throw new Error("Invalid restaurantId");
    await requireReconciliationRead(ctx, rid);
    const filter = { restaurantId: rid };
    if (matchStatus) filter.matchStatus = normalize(matchStatus);
    const docs = await BankTransaction.find(filter).sort({ createdAt: -1 }).limit(Math.min(100, Math.max(1, Number(limit || 10)))).lean();
    return docs.map((doc) => {
      const { bankAccountNumber, ...safeDoc } = doc;
      const bankAccountNumberMasked = maskBankAccountNumber(bankAccountNumber);
      return {
        ...safeDoc,
        id: String(doc._id),
        restaurantId: doc.restaurantId ? String(doc.restaurantId) : null,
        matchedPaymentSessionId: doc.matchedPaymentSessionId ? String(doc.matchedPaymentSessionId) : null,
        // Deprecated field intentionally returns masked value for backward compatibility.
        bankAccountNumber: bankAccountNumberMasked,
        bankAccountNumberMasked,
        bankAccountNumberLast4: bankAccountLast4(bankAccountNumber),
      };
    });
  },

  async reconciliationQueue(_, { restaurantId, status, limit = 50 }, ctx) {
    const rid = toObjectId(restaurantId);
    if (!rid) throw new Error("Invalid restaurantId");
    await requireReconciliationRead(ctx, rid);
    const filter = { restaurantId: rid };
    if (status && status !== "all") filter.status = normalize(status);
    else filter.status = { $in: ["unmatched", "amount_mismatch", "duplicate", "matched", "resolved", "ignored"] };
    return PaymentReconciliation.find(filter).sort({ createdAt: -1 }).limit(Math.min(100, Math.max(1, Number(limit || 50)))).lean();
  },
};
