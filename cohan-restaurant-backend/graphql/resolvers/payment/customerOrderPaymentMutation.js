import mongoose from "mongoose";
import { Order, PaymentSession } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { getPaymentPublicBaseUrl } from "../../../src/services/payment/paymentIntegrationConfig.service.js";
import {
  createOrderPayment,
  sanitizePaymentSessionForClient,
} from "../../../src/services/payment/paymentSession.service.js";

const EXTERNAL_PAYMENT_PROVIDERS = new Set(["momo", "vnpay"]);

const toId = (value) =>
  value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const normalizeOrderIds = (values = []) =>
  [...new Set((values || []).map(String).filter(Boolean))].sort();

const sameOrderSet = (payment, expectedOrderIds) => {
  const paymentOrderIds = normalizeOrderIds(payment?.metadata?.orderIds || []);
  return (
    paymentOrderIds.length === expectedOrderIds.length &&
    paymentOrderIds.every((id, index) => id === expectedOrderIds[index])
  );
};

/**
 * POS retries may find a pending order-payment session created before callback
 * credential snapshots were introduced. Reusing that old payUrl makes VNPAY
 * return with a valid gateway signature that COHAN can no longer verify.
 * Cancel only matching legacy external sessions so createOrderPayment builds a
 * fresh URL with the exact encrypted credential snapshot.
 */
export async function cancelLegacyExternalOrderPaymentSessions({
  restaurantId,
  orderIds = [],
  provider,
  paymentMethod,
  now = new Date(),
}) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  const expectedOrderIds = normalizeOrderIds(orderIds);
  const restaurantObjectId = toId(restaurantId);

  if (
    !restaurantObjectId ||
    !expectedOrderIds.length ||
    !EXTERNAL_PAYMENT_PROVIDERS.has(normalizedProvider)
  ) {
    return 0;
  }

  const candidates = await PaymentSession.find({
    restaurantId: restaurantObjectId,
    provider: normalizedProvider,
    paymentMethod: paymentMethod || normalizedProvider,
    status: "pending",
    "metadata.source": "order_payment",
  })
    .select("+callbackCredentialCiphertext")
    .sort({ createdAt: -1 });

  let cancelled = 0;
  for (const payment of candidates || []) {
    if (!sameOrderSet(payment, expectedOrderIds)) continue;

    const hasCredentialSnapshot = Boolean(
      String(payment?.callbackCredentialCiphertext || "").trim(),
    );
    const hasProviderUrl = Boolean(String(payment?.payUrl || "").trim());
    if (hasCredentialSnapshot && hasProviderUrl) continue;

    const reason = !hasCredentialSnapshot
      ? "legacy_session_missing_callback_credential_snapshot"
      : "legacy_session_missing_provider_url";

    payment.status = "cancelled";
    payment.cancelledAt = now;
    payment.cancelReason = reason;
    payment.events = Array.isArray(payment.events) ? payment.events : [];
    payment.events.push({
      type: "payment_cancelled",
      payload: { reason, source: "pos_retry_guard" },
    });
    await payment.save();
    cancelled += 1;
  }

  return cancelled;
}

export async function canCustomerPayOwnOrders({ userId, restaurantId, orderIds = [] }) {
  const uid = toId(userId);
  const rid = toId(restaurantId);
  const ids = [...new Set((orderIds || []).map(String))]
    .map(toId)
    .filter(Boolean);
  if (!uid || !rid || !ids.length || ids.length !== new Set(orderIds.map(String)).size) {
    return false;
  }

  const ownedCount = await Order.countDocuments({
    _id: { $in: ids },
    restaurantId: rid,
    userId: uid,
  });
  return ownedCount === ids.length;
}

export async function createCustomerOwnedOrderPayment(parent, { input }, ctx) {
  const userId = ctx?.user?.id || ctx?.user?._id;
  const restaurantId = input?.restaurantId;
  if (!userId) throw new Error("Unauthorized");
  if (!toId(restaurantId)) throw new Error("Invalid restaurantId");

  const ownsAllOrders = await canCustomerPayOwnOrders({
    userId,
    restaurantId,
    orderIds: input?.orderIds,
  });
  if (!ownsAllOrders) {
    await requireRestaurantPermission(
      ctx,
      toId(restaurantId),
      PERMISSIONS.PAYMENT_WRITE,
    );
  }

  const baseApiUrl = getPaymentPublicBaseUrl({
    request: ctx?.request || ctx?.req || null,
  });
  if (!baseApiUrl) {
    throw new Error("PAYMENT_PUBLIC_BASE_URL_REQUIRED");
  }
  const clientIp =
    ctx?.request?.ip || ctx?.req?.ip || ctx?.request?.headers?.["x-forwarded-for"] || "127.0.0.1";

  await cancelLegacyExternalOrderPaymentSessions({
    restaurantId,
    orderIds: input?.orderIds,
    provider: input?.provider,
    paymentMethod: input?.paymentMethod,
  });

  const payment = await createOrderPayment({
    ...input,
    userId: String(userId),
    baseApiUrl,
    clientIp: String(clientIp).split(",")[0].trim(),
  });
  return sanitizePaymentSessionForClient(payment, { includeRaw: false });
}

export default {
  createOrderPayment: createCustomerOwnedOrderPayment,
};
