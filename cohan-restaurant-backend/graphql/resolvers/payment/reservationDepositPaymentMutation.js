import mongoose from "mongoose";
import {
  Cashflow,
  EventLog,
  Invoice,
  Order,
  PaymentTransaction,
  Reservation,
  Table,
} from "../../../models/index.js";
import {
  INACTIVE_ORDER_STATUSES,
  orderBatchOrLegacyFilter,
} from "../../../utils/orderLifecycle.js";

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

function availableDeposit(reservation) {
  return Math.max(
    0,
    Number(reservation?.depositAmount || 0) -
      Number(reservation?.depositAppliedAmount || 0),
  );
}

function allocateDepositCredit(reservations, grossTotal) {
  let remaining = Math.max(0, Number(grossTotal || 0));
  const breakdown = [];

  for (const reservation of reservations || []) {
    if (!(remaining > 0)) break;
    const available = availableDeposit(reservation);
    if (!(available > 0)) continue;

    const appliedAmount = Math.min(available, remaining);
    const menuDeposit = Math.min(
      available,
      Math.max(
        0,
        Number(
          reservation.menuDepositAmount ??
            Math.round(Number(reservation.linkedMenuSubtotal || 0) * 0.5),
        ),
      ),
    );
    const tableDeposit = Math.max(
      0,
      Number(
        reservation.tableDepositAmount ??
          Number(reservation.depositAmount || 0) - menuDeposit,
      ),
    );
    const tableApplied = Math.min(appliedAmount, tableDeposit);
    const menuApplied = Math.min(
      Math.max(0, appliedAmount - tableApplied),
      menuDeposit,
    );

    breakdown.push({
      reservationId: String(reservation._id),
      orderCode: reservation.orderCode || null,
      depositAmount: Number(reservation.depositAmount || 0),
      tableDepositAmount: tableDeposit,
      menuDepositAmount: menuDeposit,
      tableDepositApplied: tableApplied,
      menuDepositApplied: menuApplied,
      appliedAmount,
    });
    remaining -= appliedAmount;
  }

  return {
    totalCredit: breakdown.reduce(
      (sum, item) => sum + Number(item.appliedAmount || 0),
      0,
    ),
    breakdown,
  };
}

async function persistDepositApplication({
  result,
  restaurantId,
  grossTotal,
  totalCredit,
  breakdown,
  requestedPaidAmount,
  ctx,
}) {
  const invoiceId = toId(result?.invoice?._id || result?.invoice?.id);
  if (!invoiceId || !(totalCredit > 0)) return result;

  const transactionId = toId(
    result?.transaction?._id || result?.transaction?.id,
  );
  const cashflowId = toId(result?.cashflow?._id || result?.cashflow?.id);
  const netAmount = Math.max(0, Number(grossTotal || 0) - totalCredit);
  const appliedAt = new Date();
  const meta = {
    grossTotal: Number(grossTotal || 0),
    depositCredit: totalCredit,
    amountCollectedNow: netAmount,
    requestedPaidAmount:
      requestedPaidAmount == null ? null : Number(requestedPaidAmount),
    reservations: breakdown,
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

  result.invoice.paid = Number(grossTotal || 0);
  result.invoice.status = "PAID";
  result.invoice.meta = {
    ...(result.invoice.meta || {}),
    reservationDepositCredit: meta,
  };
  if (netAmount > 0) {
    if (result.transaction) {
      result.transaction.paidAmount = netAmount;
      result.transaction.meta = {
        ...(result.transaction.meta || {}),
        reservationDepositCredit: meta,
      };
    }
    if (result.cashflow) result.cashflow.amount = netAmount;
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
        // The existing resolver settles the gross invoice. Immediately after
        // that commit, this wrapper converts the new transaction/cashflow to
        // only the amount collected now and records the reservation credit.
        paidAmount: undefined,
      },
    },
    ctx,
    info,
  );
  if (!result?.invoice) return result;

  const grossTotal = Number(result.invoice?.totals?.grandTotal || 0);
  const allocation = allocateDepositCredit(reservations, grossTotal);
  if (!(allocation.totalCredit > 0)) return result;

  return persistDepositApplication({
    result,
    restaurantId,
    grossTotal,
    totalCredit: allocation.totalCredit,
    breakdown: allocation.breakdown,
    requestedPaidAmount,
    ctx,
  });
}

export function withReservationDepositPayment(mutation = {}) {
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

export const reservationDepositPaymentInternals = {
  availableDeposit,
  allocateDepositCredit,
  selectionCoversAllActiveOrders,
};

export default withReservationDepositPayment;
