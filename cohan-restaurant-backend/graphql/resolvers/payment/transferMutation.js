import mongoose from "mongoose";
import {
  EventLog,
  Order,
  PaymentSession,
  PaymentTransaction,
} from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import {
  TRANSFER_PAYMENT_TTL_MS,
  createOrderPayment,
  sanitizePaymentSessionForClient,
  settlePaidOrderPaymentSession,
} from "../../../src/services/payment/paymentSession.service.js";
import { emitCustomerTrackingUpdateIfChanged } from "../../../src/services/orderTracking.service.js";
import { emitOrderEvent, emitRestaurantEvent } from "../order/helper/emitOrderEvent.js";
import { emitPaymentRealtime } from "../../../src/services/payment/paymentRealtime.service.js";
import { cancelDraftTransferOrdersForExpiredPayment } from "../../../src/services/payment/transferExpiry.service.js";

const TRANSFER_MAX_REJECTED_PROOFS = 3;
const REVIEWABLE_TRANSFER_STATUSES = new Set(["SUBMITTED", "VERIFYING"]);

function toId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function actorIdFrom(ctx) {
  const actorId = toId(ctx?.user?.id || ctx?.user?._id);
  if (!actorId) throw new Error("Unauthorized");
  return actorId;
}

function orderIdsFrom(payment) {
  const ids = Array.isArray(payment?.metadata?.orderIds) && payment.metadata.orderIds.length
    ? payment.metadata.orderIds
    : [payment?.orderId].filter(Boolean);
  return ids.map(String).filter((id) => mongoose.isValidObjectId(id));
}

function cleanImages(values = []) {
  const out = Array.isArray(values)
    ? [...new Set(values.map((x) => String(x || "").trim()).filter(Boolean))]
    : [];
  if (!out.length) throw new Error("At least one transfer proof image is required");
  return out;
}

function assertReviewableTransfer(payment) {
  const paymentStatus = String(payment?.status || "").toLowerCase();
  const transferStatus = String(payment?.transfer?.status || "").toUpperCase();
  if (paymentStatus !== "pending" || !REVIEWABLE_TRANSFER_STATUSES.has(transferStatus)) {
    throw new Error("Phiên chuyển khoản không còn ở trạng thái chờ duyệt");
  }
  if (!Array.isArray(payment?.transfer?.proofImages) || !payment.transfer.proofImages.length) {
    throw new Error("Chưa có bằng chứng chuyển khoản để duyệt");
  }
}

function resolveReceivedAmount(inputAmount, expectedAmount) {
  const receivedAmount = Math.round(
    inputAmount == null ? Number(expectedAmount || 0) : Number(inputAmount),
  );
  const expected = Math.round(Number(expectedAmount || 0));
  if (!(receivedAmount > 0) || !(expected > 0) || receivedAmount !== expected) {
    throw new Error("Số tiền thực nhận phải khớp số tiền cần thanh toán");
  }
  return receivedAmount;
}

async function loadTransferPayment(id) {
  const payment = toId(id) ? await PaymentSession.findById(id) : null;
  if (!payment) throw new Error("Payment session not found");
  if (payment.provider !== "bank_transfer" && payment.paymentMethod !== "bank_transfer") {
    throw new Error("Only bank transfer sessions are supported");
  }
  payment.transfer = payment.transfer || {};
  if (!payment.transfer.status || payment.transfer.status === "NOT_REQUIRED") {
    payment.transfer.status = "INSTRUCTIONS_SHOWN";
    payment.transfer.instructionsShownAt = payment.transfer.instructionsShownAt || new Date();
  }
  return payment;
}

async function loadReviewableTransferPayment(paymentId, restaurantId, session) {
  const payment = await PaymentSession.findOne({
    _id: paymentId,
    restaurantId,
    status: "pending",
    "transfer.status": { $in: [...REVIEWABLE_TRANSFER_STATUSES] },
  }).session(session);
  if (!payment) {
    throw new Error("Phiên chuyển khoản đã được xử lý hoặc không còn chờ duyệt");
  }
  payment.transfer = payment.transfer || {};
  assertReviewableTransfer(payment);
  return payment;
}

async function emitTransferUpdate(ctx, payment, eventName) {
  const orders = await Order.find({
    _id: { $in: orderIdsFrom(payment) },
    restaurantId: payment.restaurantId,
  });
  for (const order of orders) {
    await emitOrderEvent(ctx, String(order.restaurantId), eventName, order);
    emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc: order, force: true });
  }
  await emitRestaurantEvent(ctx, String(payment.restaurantId), eventName, {
    paymentSessionId: String(payment._id),
    reference: payment.reference,
    amount: payment.amount,
  }).catch(() => {});
}

export async function createCustomerTransferPayment(_parent, { input }, ctx) {
  const actorId = actorIdFrom(ctx);
  const rid = toId(input?.restaurantId);
  if (!rid) throw new Error("Invalid restaurantId");
  const orderIds = Array.isArray(input?.orderIds)
    ? [...new Set(input.orderIds.map(String).filter(Boolean))]
    : [];
  if (!orderIds.length || orderIds.some((id) => !mongoose.isValidObjectId(id))) {
    throw new Error("Invalid orderIds");
  }
  const ownedCount = await Order.countDocuments({
    _id: { $in: orderIds.map((id) => toId(id)) },
    restaurantId: rid,
    userId: actorId,
    "payment.status": { $ne: "paid" },
  });
  if (ownedCount !== orderIds.length) throw new Error("Order not found or not payable");

  const payment = await createOrderPayment({
    restaurantId: String(rid),
    orderIds,
    provider: "bank_transfer",
    paymentMethod: "bank_transfer",
    pricing: input?.pricing || null,
    promotionIds: input?.promotionIds || [],
    userId: String(actorId),
    baseApiUrl: process.env.PUBLIC_BASE_URL || process.env.APP_PUBLIC_URL || "http://localhost:4000",
    clientIp: ctx?.ip || "127.0.0.1",
  });

  const doc = await PaymentSession.findById(payment._id || payment.id);
  if (doc) {
    doc.transfer = doc.transfer || {};
    const now = new Date();
    doc.transfer.status = "INSTRUCTIONS_SHOWN";
    doc.transfer.instructionsShownAt = doc.transfer.instructionsShownAt || now;
    doc.transfer.rejectedCount = Number(doc.transfer.rejectedCount || 0);
    doc.transfer.maxRejectedCount = Number(doc.transfer.maxRejectedCount || TRANSFER_MAX_REJECTED_PROOFS);
    doc.transfer.proofCycleStartedAt = doc.transfer.proofCycleStartedAt || now;
    doc.events = Array.isArray(doc.events) ? doc.events : [];
    doc.events.push({ type: "transfer_instructions_shown", payload: { by: String(actorId) } });
    await doc.save();
    return sanitizePaymentSessionForClient(doc, { includeRaw: false });
  }
  return sanitizePaymentSessionForClient(payment, { includeRaw: false });
}

export async function submitTransferProof(_parent, { input }, ctx) {
  const actorId = actorIdFrom(ctx);
  const payment = await loadTransferPayment(input?.paymentSessionId);
  if (String(payment.userId) !== String(actorId)) {
    await requireRestaurantPermission(ctx, payment.restaurantId, PERMISSIONS.PAYMENT_WRITE);
  }
  const currentTransferStatus = String(payment.transfer?.status || "").toUpperCase();
  const rejectedCount = Number(payment.transfer?.rejectedCount || 0);
  const maxRejectedCount = Number(payment.transfer?.maxRejectedCount || TRANSFER_MAX_REJECTED_PROOFS);
  const isRejectedResubmission = currentTransferStatus === "REJECTED" && rejectedCount < maxRejectedCount;
  if (["VERIFIED", "EXPIRED", "FAILED"].includes(currentTransferStatus) || rejectedCount >= maxRejectedCount) {
    throw new Error("Proof submission is closed for this transfer payment");
  }
  if (payment.status !== "pending" && !isRejectedResubmission) {
    throw new Error("Only pending or rejected transfer can receive proof");
  }

  const now = new Date();
  payment.status = "pending";
  payment.callbackStatus = "received";
  payment.transfer.status = "SUBMITTED";
  payment.transfer.submittedAt = now;
  payment.transfer.submittedBy = actorId;
  payment.transfer.proofImages = cleanImages(input?.proofImages || []);
  payment.transfer.proofNote = String(input?.proofNote || "").trim();
  payment.transfer.customerClaimedPaidAt = input?.customerClaimedPaidAt
    ? new Date(input.customerClaimedPaidAt)
    : now;
  payment.transfer.pausedAt = now;
  payment.transfer.maxRejectedCount = maxRejectedCount;
  payment.transfer.rejectedAt = undefined;
  payment.transfer.rejectedBy = undefined;
  payment.transfer.rejectReason = undefined;
  payment.events = Array.isArray(payment.events) ? payment.events : [];
  payment.events.push({
    type: isRejectedResubmission ? "transfer_proof_resubmitted" : "transfer_proof_submitted",
    payload: { by: String(actorId) },
  });
  await payment.save();

  const orderIds = orderIdsFrom(payment);
  if (orderIds.length) {
    await Order.updateMany(
      {
        _id: { $in: orderIds },
        restaurantId: payment.restaurantId,
        "payment.status": { $ne: "paid" },
      },
      {
        $set: {
          "payment.method": "bank_transfer",
          "payment.provider": "bank_transfer",
          "payment.status": "pending",
          "payment.requestNote": "Khách đã gửi bằng chứng chuyển khoản, đang chờ xác minh.",
          customerVisibleNote: "Đã nhận bằng chứng chuyển khoản. Đơn đang chờ xác minh thanh toán.",
        },
      },
    );
  }
  await EventLog.log({
    restaurantId: payment.restaurantId,
    actorUserId: actorId,
    verb: "payment.transfer.submit_proof",
    object: { kind: "PaymentSession", id: payment._id },
    source: "web",
    status: "success",
  }).catch(() => {});
  await emitTransferUpdate(ctx, payment, "PAYMENT_TRANSFER_SUBMITTED");
  await emitPaymentRealtime({
    io: ctx?.io,
    payment,
    eventType: "transfer_proof_submitted",
    message: "Đã nhận minh chứng chuyển khoản. Nhà hàng đang kiểm tra.",
  }).catch(() => {});
  return sanitizePaymentSessionForClient(payment, { includeRaw: false });
}

export async function verifyTransferPayment(_parent, { input }, ctx) {
  const actorId = actorIdFrom(ctx);
  const existing = await loadTransferPayment(input?.paymentSessionId);
  await requireRestaurantPermission(ctx, existing.restaurantId, PERMISSIONS.PAYMENT_WRITE);
  if (existing.status === "success") {
    return sanitizePaymentSessionForClient(existing, { includeRaw: false });
  }
  assertReviewableTransfer(existing);
  const receivedAmount = resolveReceivedAmount(input?.receivedAmount, existing.amount);
  const providerTransactionId = String(
    input?.providerTransactionId || existing.providerTransactionId || existing.reference || "",
  ).trim();

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const payment = await loadReviewableTransferPayment(
        existing._id,
        existing.restaurantId,
        session,
      );
      const duplicateTransaction = await PaymentTransaction.findOne({
        restaurantId: payment.restaurantId,
        txnRef: providerTransactionId,
        externalRef: { $ne: payment.reference },
      }).session(session);
      if (duplicateTransaction) {
        throw new Error("Mã giao dịch ngân hàng đã được dùng cho thanh toán khác");
      }

      const now = new Date();
      payment.status = "success";
      payment.callbackStatus = "verified";
      payment.providerTransactionId = providerTransactionId;
      payment.reconciledAt = now;
      payment.transfer.status = "VERIFIED";
      payment.transfer.verifiedAt = now;
      payment.transfer.verifiedBy = actorId;
      payment.transfer.providerTransactionId = providerTransactionId;
      payment.transfer.rejectReason = undefined;
      payment.transfer.rejectedAt = undefined;
      payment.transfer.rejectedBy = undefined;
      payment.transfer.receivedAmount = receivedAmount;
      payment.transfer.varianceAmount = 0;
      payment.events = Array.isArray(payment.events) ? payment.events : [];
      payment.events.push({
        type: "transfer_verified",
        payload: { by: String(actorId), note: input?.note || "" },
      });
      await payment.save({ session });
      await settlePaidOrderPaymentSession({
        payment,
        source: "manual_transfer_verification",
        session,
      });
    });
  } finally {
    await session.endSession();
  }

  const updated = await PaymentSession.findById(existing._id);
  await EventLog.log({
    restaurantId: existing.restaurantId,
    actorUserId: actorId,
    verb: "payment.transfer.verify",
    object: { kind: "PaymentSession", id: existing._id },
    source: "web",
    status: "success",
  }).catch(() => {});
  await emitTransferUpdate(ctx, updated, "PAYMENT_VERIFIED");
  await emitPaymentRealtime({
    io: ctx?.io,
    payment: updated,
    eventType: "payment_verified",
    message: "Thanh toán chuyển khoản đã được xác minh.",
  }).catch(() => {});
  if (Array.isArray(updated?.metadata?.release?.orderIds) && updated.metadata.release.orderIds.length) {
    await emitTransferUpdate(ctx, updated, "ORDER_CREATED");
  }
  return sanitizePaymentSessionForClient(updated, { includeRaw: false });
}

export async function rejectTransferPayment(_parent, { input }, ctx) {
  const actorId = actorIdFrom(ctx);
  const existing = await loadTransferPayment(input?.paymentSessionId);
  await requireRestaurantPermission(ctx, existing.restaurantId, PERMISSIONS.PAYMENT_WRITE);
  assertReviewableTransfer(existing);
  const reason = String(input?.reason || "").trim();
  if (reason.length < 3) throw new Error("Reject reason must be at least 3 characters");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const payment = await loadReviewableTransferPayment(
        existing._id,
        existing.restaurantId,
        session,
      );
      const now = new Date();
      const maxRejectedCount = Number(
        payment.transfer?.maxRejectedCount || TRANSFER_MAX_REJECTED_PROOFS,
      );
      const rejectedCount = Number(payment.transfer?.rejectedCount || 0) + 1;
      const terminal = rejectedCount >= maxRejectedCount;

      payment.status = "failed";
      payment.callbackStatus = "rejected";
      payment.expiresAt = terminal
        ? payment.expiresAt
        : new Date(now.getTime() + TRANSFER_PAYMENT_TTL_MS);
      payment.cancelledAt = terminal ? now : payment.cancelledAt;
      payment.cancelReason = terminal
        ? "Transfer proof rejected too many times."
        : payment.cancelReason;
      payment.transfer.status = terminal ? "FAILED" : "REJECTED";
      payment.transfer.rejectedCount = rejectedCount;
      payment.transfer.maxRejectedCount = maxRejectedCount;
      payment.transfer.rejectedAt = now;
      payment.transfer.lastRejectedAt = now;
      payment.transfer.rejectedBy = actorId;
      payment.transfer.rejectReason = reason;
      payment.transfer.lastRejectedReason = reason;
      payment.transfer.resumedAt = terminal ? payment.transfer.resumedAt : now;
      payment.events = Array.isArray(payment.events) ? payment.events : [];
      payment.events.push({
        type: terminal ? "transfer_proof_max_rejected" : "transfer_proof_rejected",
        payload: {
          by: String(actorId),
          reason,
          rejectedCount,
          maxRejectedCount,
        },
      });

      if (terminal) {
        await cancelDraftTransferOrdersForExpiredPayment({
          payment,
          now,
          session,
          io: null,
        });
      } else {
        const orderIds = orderIdsFrom(payment);
        if (orderIds.length) {
          await Order.updateMany(
            {
              _id: { $in: orderIds },
              restaurantId: payment.restaurantId,
              "payment.status": { $ne: "paid" },
            },
            {
              $set: {
                "payment.status": "failed",
                "payment.requestNote": reason,
                customerVisibleNote: `Chuyển khoản chưa được xác minh: ${reason}`,
              },
            },
            { session },
          );
        }
      }
      await payment.save({ session });
    });
  } finally {
    await session.endSession();
  }

  const updated = await PaymentSession.findById(existing._id);
  await EventLog.log({
    restaurantId: existing.restaurantId,
    actorUserId: actorId,
    verb: "payment.transfer.reject",
    object: { kind: "PaymentSession", id: existing._id },
    source: "web",
    status: "success",
    meta: { reason },
  }).catch(() => {});
  await emitTransferUpdate(
    ctx,
    updated,
    updated.transfer.status === "FAILED" ? "PAYMENT_FAILED" : "PAYMENT_TRANSFER_REJECTED",
  );
  await emitPaymentRealtime({
    io: ctx?.io,
    payment: updated,
    eventType: updated.transfer.status === "FAILED" ? "proof_max_rejected" : "proof_rejected",
    message: reason,
  }).catch(() => {});
  return sanitizePaymentSessionForClient(updated, { includeRaw: false });
}

export const __testables = {
  assertReviewableTransfer,
  resolveReceivedAmount,
};

export default {
  createCustomerTransferPayment,
  submitTransferProof,
  verifyTransferPayment,
  rejectTransferPayment,
};
