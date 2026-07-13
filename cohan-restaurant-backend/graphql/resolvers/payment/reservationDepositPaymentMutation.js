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
import { INACTIVE_ORDER_STATUSES } from "../../../utils/orderLifecycle.js";

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
  const orders = await Order.find({
    restaurantId,
    tableId: { $in: tableIds },
    currentStatus: { $nin: INACTIVE_ORDER_STATUSES },
  })
    .select({ reservationId: 1, parentOrderId: 1, rootOrderId: 1 })
    .lean();

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

export function withReservationDepositPayment(mutation = {}) {
  const basePayByTable = mutation.payOrdersByTableId;
  if (typeof basePayByTable !== "function") return mutation;

  return {
    ...mutation,
    async payOrdersByTableId(parent, args, ctx, info) {
      const input = args?.input || {};
      const restaurantId = toId(input.restaurantId);
      const reservations = await loadReservationCandidatesForTable(input);
      if (!restaurantId || !reservations.length) {
        return basePayByTable.call(mutation, parent, args, ctx, info);
      }

      const requestedPaidAmount = input.paidAmount;
      const result = await basePayByTable.call(
        mutation,
        parent,
        {
          ...args,
          input: {
            ...input,
            // The original payment resolver settles the gross invoice. We
            // reconcile the already-recorded reservation deposit immediately
            // afterwards so the new transaction/cashflow contains only the
            // amount that must be collected at POS.
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
    },
  };
}

export const reservationDepositPaymentInternals = {
  availableDeposit,
  allocateDepositCredit,
};

export default withReservationDepositPayment;
