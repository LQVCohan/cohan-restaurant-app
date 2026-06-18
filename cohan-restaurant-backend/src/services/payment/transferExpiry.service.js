import mongoose from "mongoose";
import { Order, PaymentSession } from "../../../models/index.js";
import { emitCustomerTrackingUpdateIfChanged } from "../orderTracking.service.js";
import { emitPaymentRealtime } from "./paymentRealtime.service.js";

const EXPIRY_NOTE = "Phiên thanh toán đã hết hạn vì hệ thống chưa ghi nhận giao dịch và chưa có minh chứng thanh toán. Đơn của bạn đã được hủy.";
const EXPIRE_REASON = "Transfer payment expired before payment proof or bank confirmation.";
const EXPIRABLE_TRANSFER_STATUSES = ["INSTRUCTIONS_SHOWN", "REJECTED"];
const EXPIRABLE_PAYMENT_STATUSES = ["pending", "failed"];

function orderIdsFrom(payment = {}) {
  const ids = Array.isArray(payment?.metadata?.orderIds) && payment.metadata.orderIds.length
    ? payment.metadata.orderIds
    : [payment?.orderId].filter(Boolean);
  return [...new Set(ids.map(String).filter((id) => mongoose.isValidObjectId(id)))];
}

function isTransferPayment(payment = {}) {
  const provider = String(payment.provider || "").toLowerCase();
  const method = String(payment.paymentMethod || "").toLowerCase();
  return [provider, method].some((x) => ["bank_transfer", "transfer"].includes(x));
}

export async function cancelDraftTransferOrdersForExpiredPayment({ payment, now = new Date(), session = null, io = null } = {}) {
  const ids = orderIdsFrom(payment);
  if (!ids.length) return [];
  const orders = await Order.find({
    _id: { $in: ids },
    restaurantId: payment.restaurantId,
    currentStatus: "draft",
    "payment.status": { $ne: "paid" },
  }).session(session);
  const cancelled = [];
  for (const order of orders) {
    order.currentStatus = "cancelled";
    order.customerVisibleNote = EXPIRY_NOTE;
    order.statusTimeline = Array.isArray(order.statusTimeline) ? order.statusTimeline : [];
    order.statusTimeline.push({ status: "cancelled", at: now, byUserId: payment.userId || undefined, note: EXPIRY_NOTE });
    order.payment = { ...(order.payment || {}), status: "cancelled", requestNote: EXPIRE_REASON };
    await order.save({ session });
    // Inventory is intentionally untouched here. The cancellation path does not have the
    // warehouseId + normalized inventory lines required by cancelReservationForOrderTx,
    // and this helper must not guess or mutate onHand/reserved balances blindly.
    emitCustomerTrackingUpdateIfChanged({ ctx: { io }, orderDoc: order, force: true });
    cancelled.push(String(order._id));
  }
  return cancelled;
}

export async function expireStaleTransferPayments({ now = new Date(), paymentId = null, limit = 100, session = null, io = null } = {}) {
  const filter = paymentId ? { _id: paymentId } : {
    provider: "bank_transfer",
    expiresAt: { $lte: now },
    status: { $in: EXPIRABLE_PAYMENT_STATUSES },
    "transfer.status": { $in: EXPIRABLE_TRANSFER_STATUSES },
    "metadata.release": { $exists: false },
  };
  const rows = await PaymentSession.find(filter).limit(Math.min(Math.max(Number(limit || 100), 1), 500)).session(session);
  const expired = [];
  for (const payment of rows) {
    const tStatus = String(payment?.transfer?.status || "").toUpperCase();
    if (!isTransferPayment(payment) || payment.status === "success" || ["SUBMITTED", "VERIFYING", "VERIFIED"].includes(tStatus)) continue;
    if (payment?.metadata?.release) continue;
    if (!EXPIRABLE_TRANSFER_STATUSES.includes(tStatus)) continue;
    if (!payment.expiresAt || new Date(payment.expiresAt).getTime() > now.getTime()) continue;
    payment.status = "expired";
    payment.cancelledAt = payment.cancelledAt || now;
    payment.cancelReason = payment.cancelReason || EXPIRE_REASON;
    payment.transfer = { ...(payment.transfer || {}), status: "EXPIRED" };
    payment.events = Array.isArray(payment.events) ? payment.events : [];
    payment.events.push({ type: "transfer_payment_expired", at: now, payload: { reason: EXPIRE_REASON } });
    await cancelDraftTransferOrdersForExpiredPayment({ payment, now, session, io });
    await payment.save({ session });
    await emitPaymentRealtime({ io, payment, eventType: "transfer_payment_expired", message: EXPIRY_NOTE }).catch(() => {});
    expired.push(payment);
  }
  return expired;
}
