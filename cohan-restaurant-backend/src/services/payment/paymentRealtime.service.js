import mongoose from "mongoose";
import { Order } from "../../../models/index.js";
import { emitCustomerTrackingUpdateIfChanged } from "../orderTracking.service.js";

function normalizePayment(payment) {
  if (!payment) return null;
  return typeof payment.toObject === "function" ? payment.toObject() : { ...payment };
}

function stringId(value) {
  return value == null ? null : String(value);
}

function orderIdsFromPayment(payment = {}) {
  const ids = Array.isArray(payment?.metadata?.orderIds) && payment.metadata.orderIds.length
    ? payment.metadata.orderIds
    : [payment?.orderId].filter(Boolean);
  return [...new Set(ids.map(String).filter((id) => mongoose.isValidObjectId(id)))];
}

function isBankTransferPayment(payment = {}) {
  const provider = String(payment.provider || "").toLowerCase();
  const paymentMethod = String(payment.paymentMethod || "").toLowerCase();
  return ["bank_transfer", "transfer"].includes(provider)
    || ["bank_transfer", "transfer"].includes(paymentMethod);
}

function buildPaymentEventPayload(payment, eventType, message = null) {
  return {
    type: eventType,
    paymentSessionId: stringId(payment._id || payment.id),
    reference: payment.reference || null,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    callbackStatus: payment.callbackStatus,
    provider: payment.provider,
    providerTransactionId: payment.providerTransactionId || null,
    transfer: payment.transfer || null,
    expiresAt: payment.expiresAt || null,
    message,
  };
}

async function emitPaymentRealtimeUnsafe({ io, payment, eventType, message }) {
  if (!io || !payment) return { ok: true, skipped: true };

  const paymentPayload = normalizePayment(payment);
  if (!paymentPayload) return { ok: true, skipped: true };

  if (paymentPayload.userId) {
    io.to(`user_${paymentPayload.userId}`).emit(
      "paymentEvents",
      buildPaymentEventPayload(paymentPayload, eventType, message),
    );
  }

  const orderIds = orderIdsFromPayment(paymentPayload);
  if (!orderIds.length) return { ok: true, skipped: false };

  const orders = await Order.find({
    _id: { $in: orderIds },
    restaurantId: paymentPayload.restaurantId,
  });

  for (const order of orders) {
    const restaurantId = stringId(order.restaurantId);
    if (!restaurantId) continue;

    const orderPayload = typeof order.toObject === "function" ? order.toObject() : order;
    io.to(`restaurant_${restaurantId}`).emit("orderEvents", {
      type: "PAYMENT_VERIFIED",
      order: orderPayload,
    });
    const releasedOrderIds = Array.isArray(paymentPayload?.metadata?.release?.orderIds)
      ? paymentPayload.metadata.release.orderIds.map(String)
      : [];
    if (
      isBankTransferPayment(paymentPayload)
      && releasedOrderIds.includes(String(order._id))
    ) {
      io.to(`restaurant_${restaurantId}`).emit("orderEvents", {
        type: "ORDER_CREATED",
        order: orderPayload,
      });
    }
    emitCustomerTrackingUpdateIfChanged({ ctx: { io }, orderDoc: order, force: true });
  }

  return { ok: true, skipped: false };
}

/**
 * Realtime delivery is a best-effort side effect after the durable payment
 * state has already been settled. A disconnected socket adapter or malformed
 * legacy tracking row must never bubble up to the VNPAY ReturnURL and make a
 * successful transaction look like an invalid checksum.
 */
export async function emitPaymentRealtime({
  io,
  payment,
  eventType = "PAYMENT_VERIFIED",
  message = null,
}) {
  try {
    return await emitPaymentRealtimeUnsafe({ io, payment, eventType, message });
  } catch (error) {
    // Do not log callback payloads or credentials here. The reference and a
    // stable error label are enough to trace the failed notification attempt.
    // eslint-disable-next-line no-console
    console.warn("[payment] realtime emission failed", {
      eventType,
      paymentSessionId: stringId(payment?._id || payment?.id),
      reference: payment?.reference || null,
      errorCode: String(error?.code || error?.name || "PAYMENT_REALTIME_ERROR"),
    });
    return {
      ok: false,
      errorCode: "PAYMENT_REALTIME_EMIT_FAILED",
    };
  }
}

export default { emitPaymentRealtime };
