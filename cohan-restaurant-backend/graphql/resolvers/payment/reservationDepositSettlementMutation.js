import mongoose from "mongoose";
import {
  Cashflow,
  EventLog,
  Invoice,
  Order,
  PaymentRefund,
  PaymentTransaction,
  Reservation,
  Table,
} from "../../../models/index.js";
import {
  INACTIVE_ORDER_STATUSES,
  orderBatchOrLegacyFilter,
} from "../../../utils/orderLifecycle.js";
import { RESERVATION_ARRIVAL_GRACE_MINUTES } from "../../../src/services/reservationTableTiming.service.js";

const REFUND_METHODS = new Set([
  "cash",
  "bank_transfer",
  "e_wallet",
  "provider",
  "momo",
  "vnpay",
  "card",
  "other",
]);

const toId = (value) =>
  value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const uniqueIds = (values = []) => [
  ...new Map(
    values
      .map(toId)
      .filter(Boolean)
      .map((value) => [String(value), value]),
  ).values(),
];

const activeOrderFilter = ({ restaurantId, tableIds }) => ({
  $and: [
    {
      restaurantId,
      tableId: { $in: tableIds },
      currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
    },
    orderBatchOrLegacyFilter(),
  ],
});

async function loadReservationCandidatesFromOrders({
  restaurantId,
  orders = [],
}) {
  const parentIds = uniqueIds(
    orders.flatMap((order) => [order.parentOrderId, order.rootOrderId]),
  );
  const parents = parentIds.length
    ? await Order.find({ _id: { $in: parentIds }, restaurantId })
        .select({ reservationId: 1 })
        .lean()
    : [];
  const reservationIds = uniqueIds([
    ...orders.map((order) => order.reservationId),
    ...parents.map((order) => order.reservationId),
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

async function loadReservationCandidatesForTable(input = {}) {
  const restaurantId = toId(input.restaurantId);
  const tableId = toId(input.tableId);
  if (!restaurantId || !tableId) return [];

  const table = await Table.findOne({ _id: tableId, restaurantId })
    .select({ _id: 1, mergedFromTableIds: 1 })
    .lean();
  if (!table) return [];

  const tableIds = uniqueIds([
    table._id,
    ...(Array.isArray(table.mergedFromTableIds)
      ? table.mergedFromTableIds
      : []),
  ]);
  const orders = await Order.find(
    activeOrderFilter({ restaurantId, tableIds }),
  )
    .select({ reservationId: 1, parentOrderId: 1, rootOrderId: 1 })
    .lean();

  return loadReservationCandidatesFromOrders({ restaurantId, orders });
}

export function selectionCoversAllActiveOrders(
  selectedOrderIds = [],
  activeOrderIds = [],
) {
  const selected = new Set(
    selectedOrderIds.map((value) => String(value || "")).filter(Boolean),
  );
  const active = [
    ...new Set(
      activeOrderIds.map((value) => String(value || "")).filter(Boolean),
    ),
  ];
  return active.length > 0 && active.every((id) => selected.has(id));
}

async function loadFinalSelectionDepositContext(input = {}) {
  const restaurantId = toId(input.restaurantId);
  const selectedOrderIds = uniqueIds(
    Array.isArray(input.orderIds) ? input.orderIds : [],
  );
  if (!restaurantId || !selectedOrderIds.length) {
    return { restaurantId, reservations: [], isFinalSelection: false };
  }

  const selectedOrders = await Order.find({
    _id: { $in: selectedOrderIds },
    restaurantId,
    currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
  })
    .select({
      _id: 1,
      tableId: 1,
      reservationId: 1,
      parentOrderId: 1,
      rootOrderId: 1,
    })
    .lean();
  if (!selectedOrders.length) {
    return { restaurantId, reservations: [], isFinalSelection: false };
  }

  const tableIds = uniqueIds(selectedOrders.map((order) => order.tableId));
  if (!tableIds.length) {
    return { restaurantId, reservations: [], isFinalSelection: false };
  }

  const allActiveOrders = await Order.find(
    activeOrderFilter({ restaurantId, tableIds }),
  )
    .select({
      _id: 1,
      tableId: 1,
      reservationId: 1,
      parentOrderId: 1,
      rootOrderId: 1,
    })
    .lean();
  const isFinalSelection = selectionCoversAllActiveOrders(
    selectedOrderIds,
    allActiveOrders.map((order) => order._id),
  );
  if (!isFinalSelection) {
    return { restaurantId, reservations: [], isFinalSelection: false };
  }

  const reservations = await loadReservationCandidatesFromOrders({
    restaurantId,
    orders: allActiveOrders,
  });
  return { restaurantId, reservations, isFinalSelection: true };
}

const toValidDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

export function isTableDepositRefundEligible(reservation) {
  if (typeof reservation?.tableDepositRefundEligible === "boolean") {
    return reservation.tableDepositRefundEligible;
  }

  const checkedInAt = toValidDate(reservation?.checkedInAt);
  const reservationAt = toValidDate(reservation?.timeTo);
  if (checkedInAt && reservationAt) {
    const graceEndsAt = new Date(
      reservationAt.getTime() + RESERVATION_ARRIVAL_GRACE_MINUTES * 60 * 1000,
    );
    return checkedInAt.getTime() <= graceEndsAt.getTime();
  }

  // Preserve the refundable behavior for legacy reservations that predate
  // arrival-audit fields.
  return true;
}

export function deriveDepositComponents(reservation) {
  const total = Math.max(0, Number(reservation?.depositAmount || 0));
  const storedMenu = Math.max(0, Number(reservation?.menuDepositAmount || 0));
  const storedTable = Math.max(0, Number(reservation?.tableDepositAmount || 0));
  const storedBreakdownIsComplete =
    total === 0 || Math.abs(storedMenu + storedTable - total) < 0.5;

  if (storedBreakdownIsComplete) {
    return {
      total,
      menu: Math.min(total, storedMenu),
      table: Math.min(total, storedTable),
    };
  }

  const menu = Math.min(
    total,
    Math.max(0, Math.round(Number(reservation?.linkedMenuSubtotal || 0) * 0.5)),
  );
  return {
    total,
    menu,
    table: Math.max(0, total - menu),
  };
}

function getRemainingDepositComponents(reservation) {
  const { total, menu, table } = deriveDepositComponents(reservation);
  const alreadySettled = Math.min(
    total,
    Math.max(0, Number(reservation?.depositAppliedAmount || 0)),
  );
  const menuPreviouslySettled = Math.min(menu, alreadySettled);
  const tablePreviouslySettled = Math.min(
    table,
    Math.max(0, alreadySettled - menuPreviouslySettled),
  );

  return {
    total,
    menu,
    table,
    menuRemaining: Math.max(0, menu - menuPreviouslySettled),
    tableRemaining: Math.max(0, table - tablePreviouslySettled),
  };
}

/**
 * The food deposit is a prepayment against the invoice. The table deposit is
 * not revenue and is returned independently when the guest arrived within the
 * configured grace period. Keeping both flows separate prevents the table
 * deposit from incorrectly erasing the unpaid half of pre-ordered dishes.
 */
export function allocateReservationDepositSettlement(
  reservations = [],
  grossTotal = 0,
) {
  let invoiceRemaining = Math.max(0, Number(grossTotal || 0));
  const breakdown = [];

  for (const reservation of reservations || []) {
    const components = getRemainingDepositComponents(reservation);
    const tableDepositEligible = isTableDepositRefundEligible(reservation);
    if (!(components.menuRemaining > 0) && !(components.tableRemaining > 0)) {
      continue;
    }

    const menuDepositApplied = Math.min(
      components.menuRemaining,
      invoiceRemaining,
    );
    const menuDepositRefunded = Math.max(
      0,
      components.menuRemaining - menuDepositApplied,
    );
    const tableDepositRefunded = tableDepositEligible
      ? components.tableRemaining
      : 0;
    const tableDepositRetained = tableDepositEligible
      ? 0
      : components.tableRemaining;
    const refundAmount = menuDepositRefunded + tableDepositRefunded;
    const settledAmount =
      menuDepositApplied +
      menuDepositRefunded +
      tableDepositRefunded +
      tableDepositRetained;

    breakdown.push({
      reservationId: String(reservation._id),
      depositTransactionId: reservation.depositTxnId
        ? String(reservation.depositTxnId)
        : null,
      orderCode: reservation.orderCode || null,
      depositAmount: components.total,
      tableDepositAmount: components.table,
      menuDepositAmount: components.menu,
      tableDepositEligible,
      menuDepositApplied,
      menuDepositRefunded,
      tableDepositRefunded,
      tableDepositRetained,
      refundAmount,
      settledAmount,
    });
    invoiceRemaining -= menuDepositApplied;
  }

  const menuDepositCredit = breakdown.reduce(
    (sum, item) => sum + Number(item.menuDepositApplied || 0),
    0,
  );
  const refundAmount = breakdown.reduce(
    (sum, item) => sum + Number(item.refundAmount || 0),
    0,
  );
  const tableDepositRefund = breakdown.reduce(
    (sum, item) => sum + Number(item.tableDepositRefunded || 0),
    0,
  );
  const menuDepositRefund = breakdown.reduce(
    (sum, item) => sum + Number(item.menuDepositRefunded || 0),
    0,
  );
  const tableDepositRetained = breakdown.reduce(
    (sum, item) => sum + Number(item.tableDepositRetained || 0),
    0,
  );
  const amountToCollect = Math.max(
    0,
    Number(grossTotal || 0) - menuDepositCredit,
  );
  const customerNet = amountToCollect - refundAmount;

  return {
    menuDepositCredit,
    menuDepositRefund,
    tableDepositRefund,
    tableDepositRetained,
    refundAmount,
    amountToCollect,
    customerNet,
    customerPays: Math.max(0, customerNet),
    customerReceives: Math.max(0, -customerNet),
    breakdown,
  };
}

const normalizeRefundMethod = (value) => {
  const normalized = String(value || "cash").trim().toLowerCase();
  if (normalized === "transfer") return "bank_transfer";
  return REFUND_METHODS.has(normalized) ? normalized : "cash";
};

function refundReason(item) {
  const parts = [];
  if (Number(item.tableDepositRefunded || 0) > 0) {
    parts.push("hoàn cọc bàn");
  }
  if (Number(item.menuDepositRefunded || 0) > 0) {
    parts.push("hoàn phần cọc món dư");
  }
  const suffix = item.orderCode ? ` (${item.orderCode})` : "";
  return `Quyết toán đặt bàn: ${parts.join(" và ")}${suffix}`;
}

async function persistReservationDepositSettlement({
  result,
  restaurantId,
  grossTotal,
  settlement,
  requestedPaidAmount,
  paymentMethod,
  ctx,
}) {
  const invoiceId = toId(result?.invoice?._id || result?.invoice?.id);
  if (!invoiceId || !settlement.breakdown.length) return result;

  const transactionId = toId(
    result?.transaction?._id || result?.transaction?.id,
  );
  const cashflowId = toId(result?.cashflow?._id || result?.cashflow?.id);
  const settledAt = new Date();
  const refundMethod = normalizeRefundMethod(
    paymentMethod || result?.transaction?.method,
  );
  const meta = {
    grossTotal: Number(grossTotal || 0),
    depositCredit: settlement.menuDepositCredit,
    menuDepositCredit: settlement.menuDepositCredit,
    menuDepositRefund: settlement.menuDepositRefund,
    tableDepositCredit: 0,
    tableDepositRefund: settlement.tableDepositRefund,
    tableDepositRetained: settlement.tableDepositRetained,
    totalRefund: settlement.refundAmount,
    amountCollectedNow: settlement.amountToCollect,
    customerNet: settlement.customerNet,
    customerPays: settlement.customerPays,
    customerReceives: settlement.customerReceives,
    requestedPaidAmount:
      requestedPaidAmount == null ? null : Number(requestedPaidAmount),
    reservations: settlement.breakdown,
  };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const item of settlement.breakdown) {
        const reservationId = toId(item.reservationId);
        const updated = await Reservation.findOneAndUpdate(
          {
            _id: reservationId,
            restaurantId,
            depositStatus: "paid",
            depositAppliedAt: null,
          },
          {
            $set: {
              // This field now represents the amount fully settled, either as
              // food prepayment, refund, or a retained late-arrival deposit.
              depositAppliedAmount: item.settledAmount,
              depositAppliedAt: settledAt,
              depositAppliedInvoiceId: invoiceId,
            },
          },
          { new: true, session },
        );
        if (!updated) {
          throw new Error(
            "Tiền cọc đặt bàn đã được quyết toán trong một lần thanh toán khác.",
          );
        }

        if (Number(item.refundAmount || 0) > 0) {
          const refund = new PaymentRefund({
            restaurantId,
            invoiceId,
            paymentTransactionId: toId(item.depositTransactionId),
            amount: Number(item.refundAmount || 0),
            currency: "VND",
            reason: refundReason(item),
            method: refundMethod,
            status: "success",
            createdBy: ctx?.user?.id || null,
            approvedBy: ctx?.user?.id || null,
            approvedAt: settledAt,
            processedBy: ctx?.user?.id || null,
            processedAt: settledAt,
            meta: {
              source: "reservation_deposit_settlement",
              reservationId: item.reservationId,
              orderCode: item.orderCode,
              tableDepositRefund: item.tableDepositRefunded,
              menuDepositRefund: item.menuDepositRefunded,
              invoiceId: String(invoiceId),
            },
            auditTrail: [
              {
                action: "auto_refund_on_pos_settlement",
                actorId: ctx?.user?.id || null,
                previousStatus: "paid",
                nextStatus: "refunded",
                note: refundReason(item),
                at: settledAt,
              },
            ],
          });
          refund.$session(session);
          await refund.save({ session });
        }
      }

      await Invoice.updateOne(
        { _id: invoiceId, restaurantId },
        {
          $set: {
            paid: Number(grossTotal || 0),
            status: "PAID",
            "meta.reservationDepositSettlement": meta,
            // Keep the old metadata key populated for reporting clients that
            // have not migrated yet.
            "meta.reservationDepositCredit": meta,
          },
        },
        { session },
      );

      if (transactionId) {
        if (settlement.amountToCollect > 0) {
          await PaymentTransaction.updateOne(
            { _id: transactionId, restaurantId },
            {
              $set: {
                paidAmount: settlement.amountToCollect,
                "meta.reservationDepositSettlement": meta,
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
        if (settlement.amountToCollect > 0) {
          await Cashflow.updateOne(
            { _id: cashflowId, restaurantId },
            {
              $set: {
                amount: settlement.amountToCollect,
                note: `Thu phần tiền món còn lại sau cọc ${settlement.menuDepositCredit.toLocaleString("vi-VN")}đ`,
                "meta.reservationDepositSettlement": meta,
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
          verb: "reservation.deposit_settle",
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

  result.invoice.paid = Number(grossTotal || 0);
  result.invoice.status = "PAID";
  result.invoice.meta = {
    ...(result.invoice.meta || {}),
    reservationDepositSettlement: meta,
    reservationDepositCredit: meta,
  };
  if (settlement.amountToCollect > 0) {
    if (result.transaction) {
      result.transaction.paidAmount = settlement.amountToCollect;
      result.transaction.meta = {
        ...(result.transaction.meta || {}),
        reservationDepositSettlement: meta,
        reservationDepositCredit: meta,
      };
    }
    if (result.cashflow) {
      result.cashflow.amount = settlement.amountToCollect;
      result.cashflow.meta = {
        ...(result.cashflow.meta || {}),
        reservationDepositSettlement: meta,
        reservationDepositCredit: meta,
      };
    }
  } else {
    result.transaction = null;
    result.cashflow = null;
  }
  return result;
}

async function settleWithReservationDeposit({
  baseResolver,
  mutation,
  parent,
  args,
  ctx,
  info,
  restaurantId,
  reservations,
}) {
  if (!restaurantId || !reservations.length) {
    return baseResolver.call(mutation, parent, args, ctx, info);
  }

  const input = args?.input || {};
  const requestedPaidAmount = input.paidAmount;
  const result = await baseResolver.call(
    mutation,
    parent,
    {
      ...args,
      input: {
        ...input,
        // Let the canonical resolver close the gross invoice. The wrapper then
        // rewrites only the newly collected amount and records deposit refunds.
        paidAmount: undefined,
      },
    },
    ctx,
    info,
  );
  if (!result?.invoice) return result;

  const grossTotal = Number(result.invoice?.totals?.grandTotal || 0);
  const settlement = allocateReservationDepositSettlement(
    reservations,
    grossTotal,
  );
  if (!settlement.breakdown.length) return result;

  return persistReservationDepositSettlement({
    result,
    restaurantId,
    grossTotal,
    settlement,
    requestedPaidAmount,
    paymentMethod: input.method,
    ctx,
  });
}

export function withReservationDepositSettlement(mutation = {}) {
  const basePayByTable = mutation.payOrdersByTableId;
  const basePayByOrderIds = mutation.payOrdersByOrderIds;
  const wrapped = { ...mutation };

  if (typeof basePayByTable === "function") {
    wrapped.payOrdersByTableId = async function payOrdersByTableId(
      parent,
      args,
      ctx,
      info,
    ) {
      const input = args?.input || {};
      const restaurantId = toId(input.restaurantId);
      const reservations = await loadReservationCandidatesForTable(input);
      return settleWithReservationDeposit({
        baseResolver: basePayByTable,
        mutation,
        parent,
        args,
        ctx,
        info,
        restaurantId,
        reservations,
      });
    };
  }

  if (typeof basePayByOrderIds === "function") {
    wrapped.payOrdersByOrderIds = async function payOrdersByOrderIds(
      parent,
      args,
      ctx,
      info,
    ) {
      const context = await loadFinalSelectionDepositContext(args?.input || {});
      if (!context.isFinalSelection) {
        return basePayByOrderIds.call(mutation, parent, args, ctx, info);
      }
      return settleWithReservationDeposit({
        baseResolver: basePayByOrderIds,
        mutation,
        parent,
        args,
        ctx,
        info,
        restaurantId: context.restaurantId,
        reservations: context.reservations,
      });
    };
  }

  return wrapped;
}

export const reservationDepositSettlementInternals = {
  allocateReservationDepositSettlement,
  deriveDepositComponents,
  isTableDepositRefundEligible,
  selectionCoversAllActiveOrders,
};

export default withReservationDepositSettlement;
