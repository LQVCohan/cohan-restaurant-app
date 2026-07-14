import mongoose from "mongoose";
import {
  Cashflow,
  Invoice,
  Order,
  PaymentTransaction,
} from "../../../models/index.js";
import {
  buildAuthoritativeInvoiceSnapshot,
  hasRuntimePaymentDiscount,
} from "../../../src/services/payment/posPaymentLineCorrection.service.js";

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

const resultOrderIds = (input = {}, result = {}) =>
  uniqueIds([
    ...(Array.isArray(input.orderIds) ? input.orderIds : []),
    ...(Array.isArray(result?.invoice?.orderIds)
      ? result.invoice.orderIds
      : []),
    ...(Array.isArray(result?.transaction?.orderIds)
      ? result.transaction.orderIds
      : []),
  ]);

async function loadOrders({ restaurantId, orderIds }) {
  const rid = toId(restaurantId);
  const ids = uniqueIds(orderIds);
  if (!rid || !ids.length) return [];

  return Order.find({
    _id: { $in: ids },
    restaurantId: rid,
  }).lean();
}

function updateResultDocument(document, fields) {
  if (!document) return;
  if (typeof document.set === "function") {
    document.set(fields);
    return;
  }
  Object.assign(document, fields);
}

async function persistCorrectedPayment({ result, snapshot, restaurantId }) {
  const rid = toId(restaurantId);
  const invoiceId = toId(result?.invoice?._id || result?.invoice?.id);
  if (!rid || !invoiceId || !(snapshot?.totals?.grandTotal > 0)) return result;

  const transactionId = toId(
    result?.transaction?._id || result?.transaction?.id,
  );
  const cashflowId = toId(result?.cashflow?._id || result?.cashflow?.id);
  const correctedAmount = Number(snapshot.totals.grandTotal);
  const correctionMetadata = {
    source: "order_line_subtotal",
    correctedAt: new Date(),
  };

  const writes = [
    Invoice.updateOne(
      { _id: invoiceId, restaurantId: rid },
      {
        $set: {
          lines: snapshot.lines,
          totals: snapshot.totals,
          paid: correctedAmount,
          status: "PAID",
          "meta.posPaymentLineCorrection": correctionMetadata,
        },
      },
    ),
  ];

  if (transactionId) {
    writes.push(
      PaymentTransaction.updateOne(
        { _id: transactionId, restaurantId: rid },
        {
          $set: {
            paidAmount: correctedAmount,
            "meta.posPaymentLineCorrection": correctionMetadata,
          },
        },
      ),
    );
  }

  if (cashflowId) {
    writes.push(
      Cashflow.updateOne(
        { _id: cashflowId, restaurantId: rid },
        {
          $set: {
            amount: correctedAmount,
            "meta.posPaymentLineCorrection": correctionMetadata,
          },
        },
      ),
    );
  }

  await Promise.all(writes);

  updateResultDocument(result.invoice, {
    lines: snapshot.lines,
    totals: snapshot.totals,
    paid: correctedAmount,
    status: "PAID",
    meta: {
      ...(result.invoice?.meta || {}),
      posPaymentLineCorrection: correctionMetadata,
    },
  });
  updateResultDocument(result.transaction, {
    paidAmount: correctedAmount,
    meta: {
      ...(result.transaction?.meta || {}),
      posPaymentLineCorrection: correctionMetadata,
    },
  });
  updateResultDocument(result.cashflow, {
    amount: correctedAmount,
  });

  return result;
}

function wrapPaymentResolver(resolver) {
  if (typeof resolver !== "function") return resolver;

  return async function correctedPosPayment(parent, args = {}, ctx, info) {
    const input = args?.input || {};

    // Runtime coupon/promotion calculation has its own backend total source.
    // This compatibility correction only targets the standard POS payment
    // path where order item snapshots are already authoritative.
    if (hasRuntimePaymentDiscount(input)) {
      return resolver(parent, args, ctx, info);
    }

    let selectedOrders = await loadOrders({
      restaurantId: input.restaurantId,
      orderIds: input.orderIds,
    });
    let snapshot = selectedOrders.length
      ? buildAuthoritativeInvoiceSnapshot(selectedOrders)
      : null;

    if (
      snapshot?.totals?.grandTotal > 0 &&
      String(input.method || "").toLowerCase() === "cash" &&
      input.paidAmount != null &&
      Number(input.paidAmount) < Number(snapshot.totals.grandTotal)
    ) {
      throw new Error(
        `Tiền mặt khách đưa phải tối thiểu ${Number(snapshot.totals.grandTotal).toLocaleString("vi-VN")} đ.`,
      );
    }

    const normalizedArgs = snapshot?.totals?.grandTotal
      ? {
          ...args,
          input: {
            ...input,
            // Record actual sale revenue, not the customer's tendered cash.
            // Change remains a UI concern and must not inflate cashflow.
            paidAmount: Number(snapshot.totals.grandTotal),
          },
        }
      : args;

    const result = await resolver(parent, normalizedArgs, ctx, info);
    if (!result?.invoice) return result;

    if (!snapshot) {
      const orderIds = resultOrderIds(input, result);
      selectedOrders = await loadOrders({
        restaurantId: input.restaurantId,
        orderIds,
      });
      snapshot = selectedOrders.length
        ? buildAuthoritativeInvoiceSnapshot(selectedOrders)
        : null;
    }

    if (!snapshot?.totals?.grandTotal) return result;

    return persistCorrectedPayment({
      result,
      snapshot,
      restaurantId: input.restaurantId,
    });
  };
}

export default function withPosPaymentLineCorrection(mutation = {}) {
  return {
    ...mutation,
    payOrdersByTableId: wrapPaymentResolver(mutation.payOrdersByTableId),
    payOrdersByOrderIds: wrapPaymentResolver(mutation.payOrdersByOrderIds),
  };
}
