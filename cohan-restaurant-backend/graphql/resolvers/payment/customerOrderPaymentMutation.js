import mongoose from "mongoose";
import { Order } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import {
  createOrderPayment,
  sanitizePaymentSessionForClient,
} from "../../../src/services/payment/paymentSession.service.js";

const toId = (value) =>
  value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

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

  const baseApiUrl =
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_PUBLIC_URL ||
    "http://localhost:4000";
  const clientIp =
    ctx?.request?.ip || ctx?.req?.ip || ctx?.request?.headers?.["x-forwarded-for"] || "127.0.0.1";
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
