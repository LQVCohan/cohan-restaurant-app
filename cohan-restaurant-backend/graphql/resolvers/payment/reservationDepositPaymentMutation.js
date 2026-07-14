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
import { RESERVATION_ARRIVAL_GRACE_MINUTES } from "../../../src/services/reservationTableTiming.service.js";

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

function isTableDepositCreditEligible(reservation) {
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

  // Legacy reservations created before arrival auditing existed should not lose
  // a deposit credit solely because they do not have the new audit fields.
  return true;
}

function deriveDepositComponents(reservation) {
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

function getDepositDisposition(reservation) {
  const { total, menu, table } = deriveDepositComponents(reservation);
  const alreadyApplied = Math.min(
    total,
    Math.max(0, Number(reservation?.depositAppliedAmount || 0)),
  );
  const menuPreviouslyApplied = Math.min(menu, alreadyApplied);
  const tablePreviouslyApplied = Math.min(
    table,
    Math.max(0, alreadyApplied - menuPreviouslyApplied),
  );
  const tableRemaining = Math.max(0, table - tablePreviouslyApplied);
  const menuRemaining = Math.max(0, menu - menuPreviouslyApplied);
  const tableDepositEligible = isTableDepositCreditEligible(reservation);

  return {
    total,
    table,
    menu,
    tableDepositEligible,
    tableCreditAvailable: tableDepositEligible ? tableRemaining : 0,
    menuCreditAvailable: menuRemaining,
    tableDepositRetained: tableDepositEligible ? 0 : tableRemaining,
  };
}

function availableDeposit(reservation) {
  const disposition = getDepositDisposition(reservation);
  return disposition.tableCreditAvailable + disposition.menuCreditAvailable;
}

function allocateDepositCredit(reservations, grossTotal) {
  let remaining = Math.max(0, Number(grossTotal || 0));
  const breakdown = [];

  for (const reservation of reservations || []) {
    const disposition = getDepositDisposition(reservation);
    const available =
      disposition.tableCreditAvailable + disposition.menuCreditAvailable;
    if (!(available > 0) && !(disposition.tableDepositRetained > 0)) continue;

    const appliedAmount = Math.min(available, remaining);
    const menuApplied = Math.min(
      appliedAmount,
      disposition.menuCreditAvailable,
    );
    const tableApplied = Math.min(
      Math.max(0, appliedAmount - menuApplied),
      disposition.tableCreditAvailable,
    );

    breakdown.push({
      reservationId: String(reservation._id),
      orderCode: reservation.orderCode || null,
      depositAmount: disposition.total,
      tableDepositAmount: disposition.table,
      menuDepositAmount: disposition.menu,
      tableDepositEligible: disposition.tableDepositEligible,
      tableDepositRetained: disposition.tableDepositRetained,
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
    totalTableDepositRetained: breakdown.reduce(
      (sum, item) => sum + Number(item.tableDepositRetained || 0),
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
  if (!invoiceId || !breakdown.length) return result;

  const transactionId = toId(
    result?.transaction?._id || result?.transaction?.id,
  );
  const cashflowId = toId(result?.cashflow?._id || result?.cashflow?.id);
  const netAmount = Math.max(0, Number(grossTotal || 0) - totalCredit);
  const appliedAt = new Date();
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
                ...(totalCredit > 0
                  ? {
                      note: `Thanh toán order sau khi trừ cọc ${totalCredit.toLocaleString("vi-VN")}đ`,
                    }
                  : {}),
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
    if (result.cashflow) {
      result.cashflow.amount = netAmount;
      result.cashflow.meta = {
        ...(result.cashflow.meta || {}),
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
  if (!allocation.breakdown.length) return result;

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
  deriveDepositComponents,
  getDepositDisposition,
  isTableDepositCreditEligible,
  selectionCoversAllActiveOrders,
};

export default withReservationDepositPayment;
