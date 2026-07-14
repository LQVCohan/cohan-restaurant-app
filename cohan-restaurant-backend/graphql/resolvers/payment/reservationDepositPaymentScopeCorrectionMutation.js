import mongoose from "mongoose";
import {
  Cashflow,
  EventLog,
  Invoice,
  Order,
  PaymentTransaction,
  Reservation,
} from "../../../models/index.js";
import {
  INACTIVE_ORDER_STATUSES,
  orderBatchOrLegacyFilter,
} from "../../../utils/orderLifecycle.js";
import {
  buildAuthoritativeInvoiceSnapshot,
  hasRuntimePaymentDiscount,
} from "../../../src/services/payment/posPaymentLineCorrection.service.js";
import {
  reservationDepositPaymentInternals,
  selectionCoversAllActiveOrders,
} from "./reservationDepositPaymentMutation.js";

const { allocateDepositCredit } = reservationDepositPaymentInternals;

const TERMINAL_RESERVATION_STATUSES = new Set([
  "cancelled",
  "completed",
  "no_show",
]);
const NON_SERVICEABLE_RESERVATION_STATUSES = new Set(["pending_payment"]);
const EXCLUDED_ITEM_STATUSES = new Set(["cancelled", "returned"]);

const toId = (value) =>
  value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const uniqueIds = (values = []) => [
  ...new Map(
    (Array.isArray(values) ? values : [])
      .map(toId)
      .filter(Boolean)
      .map((value) => [String(value), value]),
  ).values(),
];

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

function updateResultDocument(document, fields) {
  if (!document) return;
  if (typeof document.set === "function") {
    document.set(fields);
    return;
  }
  Object.assign(document, fields);
}

function selectedSessionIds(orders = []) {
  return uniqueIds(
    orders.flatMap((order) => [order?.parentOrderId, order?.rootOrderId]),
  );
}

function hasBillableItems(order) {
  return (Array.isArray(order?.items) ? order.items : []).some((item) => {
    if (EXCLUDED_ITEM_STATUSES.has(normalizeStatus(item?.status))) return false;
    return (
      Number(item?.quantity || 0) > 0 || Number(item?.lineSubtotal || 0) > 0
    );
  });
}

async function filterOrdersAvailableForCurrentService(
  orders = [],
  { restaurantId = null, now = new Date() } = {},
) {
  const source = (Array.isArray(orders) ? orders : []).filter(hasBillableItems);
  if (!source.length) return [];

  const parentIds = selectedSessionIds(source);
  const parents = parentIds.length
    ? await Order.find({
        _id: { $in: parentIds },
        ...(restaurantId ? { restaurantId } : {}),
      })
        .select({ _id: 1, reservationId: 1 })
        .lean()
    : [];
  const parentReservationById = new Map(
    parents.map((parent) => [String(parent._id), parent.reservationId]),
  );
  const reservationIdForOrder = (order) =>
    order?.reservationId ||
    parentReservationById.get(String(order?.parentOrderId || "")) ||
    parentReservationById.get(String(order?.rootOrderId || "")) ||
    null;

  const reservationIds = uniqueIds(source.map(reservationIdForOrder));
  if (!reservationIds.length) return source;

  const reservations = await Reservation.find({ _id: { $in: reservationIds } })
    .select({ _id: 1, status: 1, timeTo: 1 })
    .lean();
  const reservationById = new Map(
    reservations.map((reservation) => [String(reservation._id), reservation]),
  );
  const nowAt = new Date(now).getTime();

  return source.filter((order) => {
    const reservationId = reservationIdForOrder(order);
    if (!reservationId) return true;
    const reservation = reservationById.get(String(reservationId));
    if (!reservation) return true;

    const status = normalizeStatus(reservation.status);
    if (TERMINAL_RESERVATION_STATUSES.has(status)) return false;
    if (NON_SERVICEABLE_RESERVATION_STATUSES.has(status)) return false;
    if (status === "seated") return true;

    const scheduledAt = new Date(reservation.timeTo).getTime();
    return !Number.isFinite(scheduledAt) || scheduledAt <= nowAt;
  });
}

async function loadActiveOrdersInSelectionScope({
  restaurantId,
  selectedOrders,
}) {
  const sessionIds = selectedSessionIds(selectedOrders);

  if (sessionIds.length) {
    return Order.find({
      $and: [
        {
          restaurantId,
          currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
        },
        orderBatchOrLegacyFilter(),
        {
          $or: [
            { parentOrderId: { $in: sessionIds } },
            { rootOrderId: { $in: sessionIds } },
          ],
        },
      ],
    }).lean();
  }

  const tableIds = uniqueIds(selectedOrders.map((order) => order?.tableId));
  if (!tableIds.length) return selectedOrders;

  return Order.find({
    $and: [
      {
        restaurantId,
        tableId: { $in: tableIds },
        currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
      },
      orderBatchOrLegacyFilter(),
      {
        $or: [
          {
            reservationId: {
              $in: uniqueIds(
                selectedOrders.map((order) => order?.reservationId),
              ),
            },
          },
          { reservationId: { $exists: false } },
          { reservationId: null },
        ],
      },
    ],
  }).lean();
}

async function loadDepositReservations({ restaurantId, orders }) {
  const parentIds = selectedSessionIds(orders);
  const parents = parentIds.length
    ? await Order.find({ _id: { $in: parentIds }, restaurantId })
        .select({ reservationId: 1 })
        .lean()
    : [];

  const reservationIds = uniqueIds([
    ...orders.map((order) => order?.reservationId),
    ...parents.map((order) => order?.reservationId),
  ]);
  if (!reservationIds.length) return [];

  return Reservation.find({
    _id: { $in: reservationIds },
    restaurantId,
    depositStatus: "paid",
    depositAmount: { $gt: 0 },
    depositAppliedAt: null,
  })
    .sort({ timeTo: 1, _id: 1 })
    .lean();
}

async function loadCorrectedDepositContext(input = {}) {
  const restaurantId = toId(input.restaurantId);
  const orderIds = uniqueIds(input.orderIds);
  if (!restaurantId || !orderIds.length) return null;

  const selectedOrders = await Order.find({
    _id: { $in: orderIds },
    restaurantId,
    currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
  }).lean();
  if (!selectedOrders.length) return null;

  const scopedOrders = await loadActiveOrdersInSelectionScope({
    restaurantId,
    selectedOrders,
  });
  const activeOrders = await filterOrdersAvailableForCurrentService(
    scopedOrders,
    { restaurantId },
  );
  if (
    !selectionCoversAllActiveOrders(
      orderIds,
      activeOrders.map((order) => order?._id),
    )
  ) {
    return null;
  }

  const reservations = await loadDepositReservations({
    restaurantId,
    orders: activeOrders,
  });
  if (!reservations.length) return null;

  const snapshot = buildAuthoritativeInvoiceSnapshot(selectedOrders);
  const grossTotal = Number(snapshot?.totals?.grandTotal || 0);
  if (!(grossTotal > 0)) return null;

  const allocation = allocateDepositCredit(reservations, grossTotal);
  if (!allocation?.breakdown?.length) return null;

  return {
    restaurantId,
    grossTotal,
    allocation,
  };
}

function assertCashCoversNetAmount(input, netAmount) {
  if (normalizeStatus(input?.method) !== "cash" || input?.paidAmount == null) {
    return;
  }

  const received = Number(input.paidAmount);
  const due = Math.max(0, Number(netAmount || 0));
  if (!Number.isFinite(received) || received < due) {
    throw new Error(
      `Tiền mặt khách đưa phải tối thiểu ${due.toLocaleString("vi-VN")} đ.`,
    );
  }
}

async function persistCorrectedDeposit({
  result,
  restaurantId,
  grossTotal,
  allocation,
  requestedPaidAmount,
  ctx,
}) {
  if (result?.invoice?.meta?.reservationDepositCredit) return result;

  const invoiceId = toId(result?.invoice?._id || result?.invoice?.id);
  if (!invoiceId) return result;

  const transactionId = toId(
    result?.transaction?._id || result?.transaction?.id,
  );
  const cashflowId = toId(result?.cashflow?._id || result?.cashflow?.id);
  const totalCredit = Number(allocation.totalCredit || 0);
  const netAmount = Math.max(0, Number(grossTotal || 0) - totalCredit);
  const appliedAt = new Date();
  const breakdown = allocation.breakdown;
  const meta = {
    grossTotal: Number(grossTotal || 0),
    depositCredit: totalCredit,
    menuDepositCredit: breakdown.reduce(
      (sum, item) => sum + Number(item.menuDepositApplied || 0),
      0,
    ),
    tableDepositCredit: breakdown.reduce(
      (sum, item) => sum + Number(item.tableDepositApplied || 0),
      0,
    ),
    tableDepositRetained: breakdown.reduce(
      (sum, item) => sum + Number(item.tableDepositRetained || 0),
      0,
    ),
    amountCollectedNow: netAmount,
    requestedPaidAmount:
      requestedPaidAmount == null ? null : Number(requestedPaidAmount),
    reservations: breakdown,
    scopeCorrection: true,
  };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const item of breakdown) {
        const updated = await Reservation.findOneAndUpdate(
          {
            _id: toId(item.reservationId),
            restaurantId,
            depositStatus: "paid",
            depositAppliedAt: null,
          },
          {
            $set: {
              depositAppliedAmount: item.appliedAmount,
              depositAppliedAt: appliedAt,
              depositAppliedInvoiceId: invoiceId,
            },
          },
          { new: true, session },
        );
        if (!updated) {
          throw new Error(
            "Tiền cọc đặt bàn đã được sử dụng trong một lần thanh toán khác.",
          );
        }
      }

      await Invoice.updateOne(
        { _id: invoiceId, restaurantId },
        {
          $set: {
            paid: Number(grossTotal || 0),
            status: "PAID",
            "meta.reservationDepositCredit": meta,
          },
        },
        { session },
      );

      if (transactionId) {
        if (netAmount > 0) {
          await PaymentTransaction.updateOne(
            { _id: transactionId, restaurantId },
            {
              $set: {
                paidAmount: netAmount,
                "meta.reservationDepositCredit": meta,
              },
            },
            { session },
          );
        } else {
          await PaymentTransaction.deleteOne(
            { _id: transactionId, restaurantId },
            { session },
          );
          await Invoice.updateOne(
            { _id: invoiceId, restaurantId },
            { $unset: { refTransactionId: 1 } },
            { session },
          );
        }
      }

      if (cashflowId) {
        if (netAmount > 0) {
          await Cashflow.updateOne(
            { _id: cashflowId, restaurantId },
            {
              $set: {
                amount: netAmount,
                note: `Thanh toán order sau khi trừ cọc ${totalCredit.toLocaleString("vi-VN")}đ`,
                "meta.reservationDepositCredit": meta,
              },
            },
            { session },
          );
        } else {
          await Cashflow.deleteOne(
            { _id: cashflowId, restaurantId },
            { session },
          );
        }
      }

      await EventLog.log(
        {
          restaurantId,
          actorUserId: ctx?.user?.id,
          verb: "reservation.deposit_apply",
          object: { kind: "Invoice", id: invoiceId },
          source: "pos",
          status: "success",
          meta,
        },
        { session },
      ).catch(() => {});
    });
  } finally {
    await session.endSession();
  }

  updateResultDocument(result.invoice, {
    paid: Number(grossTotal || 0),
    status: "PAID",
    meta: {
      ...(result.invoice?.meta || {}),
      reservationDepositCredit: meta,
    },
  });

  if (netAmount > 0) {
    updateResultDocument(result.transaction, {
      paidAmount: netAmount,
      meta: {
        ...(result.transaction?.meta || {}),
        reservationDepositCredit: meta,
      },
    });
    updateResultDocument(result.cashflow, {
      amount: netAmount,
      meta: {
        ...(result.cashflow?.meta || {}),
        reservationDepositCredit: meta,
      },
    });
  } else {
    result.transaction = null;
    result.cashflow = null;
  }

  return result;
}

function wrapSelectedOrderPayment(resolver) {
  if (typeof resolver !== "function") return resolver;

  return async function correctedReservationDepositScope(
    parent,
    args = {},
    ctx,
    info,
  ) {
    const input = args?.input || {};
    if (hasRuntimePaymentDiscount(input)) {
      return resolver(parent, args, ctx, info);
    }

    const context = await loadCorrectedDepositContext(input);
    if (!context) return resolver(parent, args, ctx, info);

    const netAmount = Math.max(
      0,
      context.grossTotal - Number(context.allocation.totalCredit || 0),
    );
    assertCashCoversNetAmount(input, netAmount);

    const result = await resolver(
      parent,
      {
        ...args,
        input: {
          ...input,
          // Settle the gross invoice internally; persist only the newly
          // collected amount after applying the reservation deposit below.
          paidAmount: undefined,
        },
      },
      ctx,
      info,
    );
    if (!result?.invoice) return result;

    return persistCorrectedDeposit({
      result,
      restaurantId: context.restaurantId,
      grossTotal: context.grossTotal,
      allocation: context.allocation,
      requestedPaidAmount: input.paidAmount,
      ctx,
    });
  };
}

export default function withReservationDepositPaymentScopeCorrection(
  mutation = {},
) {
  return {
    ...mutation,
    payOrdersByOrderIds: wrapSelectedOrderPayment(mutation.payOrdersByOrderIds),
  };
}

export const reservationDepositPaymentScopeCorrectionInternals = {
  assertCashCoversNetAmount,
  filterOrdersAvailableForCurrentService,
  hasBillableItems,
  selectedSessionIds,
};
