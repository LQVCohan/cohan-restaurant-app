import mongoose from "mongoose";
import dayjs from "dayjs";
import {
  Invoice,
  PaymentTransaction,
  Cashflow,
  PaymentSession,
  Restaurant,
  Order,
  BankTransaction,
  PaymentReconciliation,
} from "../../../models/index.js";
import { getProviderPublicConfig } from "../../../src/services/payment/paymentSession.service.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

const toObjectId = (id) =>
  id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;

const toRange = (range = "MONTH") => String(range || "MONTH").toUpperCase();

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
      return {
        from: now.startOf("week").toDate(),
        to: now.endOf("week").toDate(),
        mode: "day",
        format: "DD/MM",
      };
    case "QUARTER":
      return {
        from: now.month(Math.floor(now.month() / 3) * 3).startOf("month").toDate(),
        to: now.month(Math.floor(now.month() / 3) * 3 + 2).endOf("month").toDate(),
        mode: "week",
        format: "[W]WW",
      };
    case "YEAR":
      return {
        from: now.startOf("year").toDate(),
        to: now.endOf("year").toDate(),
        mode: "month",
        format: "MM/YYYY",
      };
    case "CUSTOM":
      return {
        from: now.startOf("month").toDate(),
        to: now.endOf("month").toDate(),
        mode: "day",
        format: "DD/MM",
      };
    case "MONTH":
    default:
      return {
        from: now.startOf("month").toDate(),
        to: now.endOf("month").toDate(),
        mode: "day",
        format: "DD/MM",
      };
  }
}

function safeNote(note) {
  return String(note || "").toLowerCase();
}

function classifyCost(note = "") {
  const n = safeNote(note);
  if (
    n.includes("nguyên liệu") ||
    n.includes("ingredient") ||
    n.includes("supply")
  )
    return "cogs";
  if (n.includes("lương") || n.includes("nhân sự") || n.includes("salary"))
    return "labor";
  if (
    n.includes("điện") ||
    n.includes("nước") ||
    n.includes("gas") ||
    n.includes("vận hành") ||
    n.includes("mặt bằng")
  )
    return "operations";
  return "other";
}

function buildBuckets({ from, to, mode, format }) {
  const labels = [];
  const cursor = dayjs(from);
  const end = dayjs(to);

  while (cursor.isBefore(end) || cursor.isSame(end, mode)) {
    labels.push(cursor.format(format));
    if (mode === "month") cursor.add(1, "month");
    else if (mode === "week") cursor.add(1, "week");
    else cursor.add(1, "day");
  }

  return labels;
}

export const PaymentQuery = {


  async paymentSession(_, { id }, ctx) {
    if (!mongoose.isValidObjectId(id)) throw new Error("Invalid payment id");
    const session = await PaymentSession.findById(id).lean();
    if (!session) return null;
    if (String(session.userId || "") === String(ctx?.user?.id || "")) return session;
    await requireRestaurantPermission(ctx, toObjectId(session.restaurantId), PERMISSIONS.PAYMENT_READ);
    return session;
  },

  async reservationPaymentSessions(_, { reservationId }, ctx) {
    if (!mongoose.isValidObjectId(reservationId)) throw new Error("Invalid reservationId");
    const q = { reservationId: new mongoose.Types.ObjectId(reservationId) };
    if (ctx?.user?.id && mongoose.isValidObjectId(ctx.user.id)) {
      q.userId = new mongoose.Types.ObjectId(ctx.user.id);
    }
    return PaymentSession.find(q).sort({ createdAt: -1 }).lean();
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

    return PaymentTransaction.find({
      $or: [{ orderId: id }, { orderIds: id }],
    })
      .sort({ paidAt: -1 })
      .lean();
  },

  async invoicesByOrder(_, { orderId }, ctx) {
    if (!mongoose.isValidObjectId(orderId)) return [];
    const id = new mongoose.Types.ObjectId(orderId);
    const order = await Order.findById(id).lean();
    if (!order) return [];
    const orderRestaurantId = toObjectId(order.restaurantId);
    if (!orderRestaurantId) throw new Error("Invalid restaurantId");
    await requireRestaurantPermission(ctx, orderRestaurantId, PERMISSIONS.PAYMENT_READ);

    return Invoice.find({
      $or: [{ orderId: id }, { orderIds: id }],
    })
      .sort({ issuedAt: -1 })
      .lean();
  },

  async financeDashboard(_, { input }, ctx) {
    const { restaurantId, range, dateFrom, dateTo } = input || {};
    const rid = toObjectId(restaurantId);
    if (!rid) throw new Error("Invalid restaurantId");
    await requireRestaurantPermission(ctx, rid, PERMISSIONS.PAYMENT_READ);

    const { from, to, mode, format } = resolveDateRange({ range, dateFrom, dateTo });
    const cashflowFilter = {
      restaurantId: rid,
      occurredAt: {},
    };
    if (from) cashflowFilter.occurredAt.$gte = from;
    if (to) cashflowFilter.occurredAt.$lte = to;

    const invoiceFilter = {
      restaurantId: rid,
      issuedAt: {},
    };
    if (from) invoiceFilter.issuedAt.$gte = from;
    if (to) invoiceFilter.issuedAt.$lte = to;

    const transactionFilter = {
      restaurantId: rid,
      paidAt: {},
    };
    if (from) transactionFilter.paidAt.$gte = from;
    if (to) transactionFilter.paidAt.$lte = to;

    const [cashflows, invoices, debtInvoices, payments, recentReconciliations, reconciliationAgg, unmatchedAgg] = await Promise.all([
      Cashflow.find(cashflowFilter).sort({ occurredAt: -1 }).lean(),
      Invoice.find(invoiceFilter).sort({ issuedAt: -1 }).lean(),
      Invoice.find({ restaurantId: rid, status: { $in: ["UNPAID", "PARTIAL"] } }).lean(),
      PaymentTransaction.find(transactionFilter).sort({ paidAt: -1 }).lean(),
      PaymentReconciliation.find({ restaurantId: rid }).sort({ createdAt: -1 }).limit(10).lean(),
      PaymentReconciliation.aggregate([
        { $match: { restaurantId: rid, status: { $in: ["matched", "amount_mismatch"] } } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      BankTransaction.aggregate([
        { $match: { restaurantId: rid, matchStatus: "unmatched" } },
        { $count: "count" }
      ]),
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
      .filter((x) => x.type === "OUTFLOW")
      .filter(
        (x) =>
          safeNote(x.note).includes("refund") ||
          safeNote(x.note).includes("hoàn") ||
          safeNote(x.ref?.kind).includes("refund")
      )
      .reduce((s, x) => s + Number(x.amount || 0), 0);

    const debt = debtInvoices.reduce((s, inv) => {
      const total = Number(inv?.totals?.grandTotal || 0);
      const paid = Number(inv?.paid || 0);
      return s + Math.max(total - paid, 0);
    }, 0);

    const settlement = invoices
      .filter((inv) => inv.status === "PAID")
      .reduce((s, inv) => s + Number(inv.paid || 0), 0);

    const costBreakdown = cashflows
      .filter((x) => x.type === "OUTFLOW")
      .reduce(
        (acc, x) => {
          const bucket = classifyCost(x.note);
          acc[bucket] += Number(x.amount || 0);
          return acc;
        },
        { cogs: 0, labor: 0, operations: 0, other: 0 }
      );

    const labels = buildBuckets({ from, to, mode, format });
    const trendMap = new Map(
      labels.map((label) => [label, { key: label, revenue: 0, expense: 0, profit: 0 }])
    );

    for (const cf of cashflows) {
      const key = dayjs(cf.occurredAt).format(format);
      if (!trendMap.has(key)) continue;
      const entry = trendMap.get(key);
      if (cf.type === "INFLOW") entry.revenue += Number(cf.amount || 0);
      if (cf.type === "OUTFLOW") entry.expense += Number(cf.amount || 0);
      entry.profit = entry.revenue - entry.expense;
    }

    const transactionMap = new Map();
    for (const cf of cashflows.slice(0, 120)) {
      transactionMap.set(String(cf._id), {
        id: String(cf._id),
        occurredAt: cf.occurredAt,
        description: cf.note || (cf.type === "INFLOW" ? "Thu tiền" : "Chi tiền"),
        category: classifyCost(cf.note),
        type: cf.type,
        amount: Number(cf.amount || 0),
        method: null,
        status: "completed",
        source: "Hệ thống",
        referenceType: cf.ref?.kind || null,
        referenceId: cf.ref?.id ? String(cf.ref.id) : null,
      });
    }

    const transactions = Array.from(transactionMap.values())
      .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
      .slice(0, 30);

    const debts = debtInvoices
      .map((inv) => ({
        id: String(inv._id),
        supplier: `Hóa đơn ${inv.number || String(inv._id).slice(-6)}`,
        amount: Math.max(
          Number(inv?.totals?.grandTotal || 0) - Number(inv?.paid || 0),
          0
        ),
        dueDate: inv.updatedAt || inv.issuedAt,
        status: inv.status,
      }))
      .filter((x) => x.amount > 0)
      .slice(0, 10);

    return {
      summary: {
        revenue,
        expense,
        profit: revenue - expense,
        debt,
        payment,
        refund,
        settlement,
        cashIn: revenue,
        cashOut: expense,
      },
      trend: Array.from(trendMap.values()),
      transactions,
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
  async paymentReconciliations(_, { restaurantId, status, limit = 10 }, ctx) {
    const rid = toObjectId(restaurantId);
    if (!rid) throw new Error("Invalid restaurantId");
    await requireRestaurantPermission(ctx, rid, PERMISSIONS.PAYMENT_READ);
    const filter = { restaurantId: rid };
    if (status) filter.status = String(status).toLowerCase();
    const docs = await PaymentReconciliation.find(filter).sort({ createdAt: -1 }).limit(Math.min(100, Math.max(1, Number(limit || 10)))).lean();
    return docs.map((doc) => ({
      ...doc,
      id: String(doc._id),
      restaurantId: doc.restaurantId ? String(doc.restaurantId) : null,
      paymentSessionId: doc.paymentSessionId ? String(doc.paymentSessionId) : null,
      bankTransactionId: doc.bankTransactionId ? String(doc.bankTransactionId) : null,
    }));
  },
  async bankTransactions(_, { restaurantId, matchStatus, limit = 10 }, ctx) {
    const rid = toObjectId(restaurantId);
    if (!rid) throw new Error("Invalid restaurantId");
    await requireRestaurantPermission(ctx, rid, PERMISSIONS.PAYMENT_READ);
    const filter = { restaurantId: rid };
    if (matchStatus) filter.matchStatus = String(matchStatus).toLowerCase();
    const docs = await BankTransaction.find(filter).sort({ createdAt: -1 }).limit(Math.min(100, Math.max(1, Number(limit || 10)))).lean();
    return docs.map((doc) => ({
      ...doc,
      id: String(doc._id),
      restaurantId: doc.restaurantId ? String(doc.restaurantId) : null,
      matchedPaymentSessionId: doc.matchedPaymentSessionId ? String(doc.matchedPaymentSessionId) : null,
    }));
  },
};
