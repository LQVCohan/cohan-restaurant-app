import { PERMISSIONS } from "../../../src/constants/permissions.js";
import {
  requirePermission,
  requireRestaurantPermission,
} from "../../../src/services/auth/authorization.service.js";
import { emitPaymentRealtime } from "../../../src/services/payment/paymentRealtime.service.js";
import {
  adjustWalletBalance,
  createWalletTopup,
  getWalletSummary,
  listWalletTransactions,
  payOrdersWithWallet,
  refundToWallet,
  requireWalletUser,
} from "../../../src/services/wallet/wallet.service.js";

function getBaseApiUrl(ctx) {
  if (process.env.API_PUBLIC_BASE_URL) {
    return process.env.API_PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  const req = ctx?.req || ctx?.request;
  const headers = req?.headers || {};
  const host = headers["x-forwarded-host"] || headers.host;
  if (host) {
    return `${
      headers["x-forwarded-proto"] || req?.protocol || "http"
    }://${host}`.replace(/\/$/, "");
  }
  return "http://localhost:5000";
}

function getClientIp(ctx) {
  const req = ctx?.req || ctx?.request;
  return String(
    req?.headers?.["x-forwarded-for"] ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      "127.0.0.1",
  )
    .split(",")[0]
    .trim();
}

export default {
  Query: {
    myWallet: async (_, __, ctx) => {
      const userId = requireWalletUser(ctx);
      return getWalletSummary(userId);
    },
    myWalletTransactions: async (_, { input }, ctx) => {
      const userId = requireWalletUser(ctx);
      return listWalletTransactions(userId, input || {});
    },
  },
  Mutation: {
    createWalletTopup: async (_, { input }, ctx) => {
      const userId = requireWalletUser(ctx);
      return createWalletTopup({
        userId,
        amount: input.amount,
        provider: input.provider,
        reference: input.reference,
        metadata: input.metadata || {},
        baseApiUrl: getBaseApiUrl(ctx),
        clientIp: getClientIp(ctx),
      });
    },
    payOrdersWithWallet: async (_, { input }, ctx) => {
      const userId = requireWalletUser(ctx);
      const result = await payOrdersWithWallet({
        userId,
        restaurantId: input.restaurantId,
        orderIds: input.orderIds || [],
        idempotencyKey: input.idempotencyKey,
      });
      await emitPaymentRealtime({
        io: ctx?.io,
        payment: result?.paymentSession,
        eventType: "PAYMENT_VERIFIED",
      });
      return result;
    },
    refundToWallet: async (_, { input }, ctx) => {
      await requireRestaurantPermission(
        ctx,
        input.restaurantId,
        PERMISSIONS.PAYMENT_WRITE,
      );
      const actorId = requireWalletUser(ctx);
      return refundToWallet({
        userId: input.userId,
        restaurantId: input.restaurantId,
        orderIds: input.orderIds || [],
        amount: input.amount,
        reason: input.reason,
        referenceType: input.referenceType || "RESTAURANT_REFUND",
        referenceId: input.referenceId,
        processedBy: actorId,
      });
    },
    adjustWalletBalance: async (_, { input }, ctx) => {
      await requirePermission(ctx, PERMISSIONS.PAYMENT_WRITE);
      const actorId = requireWalletUser(ctx);
      return adjustWalletBalance({
        userId: input.userId,
        amount: input.amount,
        reason: input.reason,
        actorId,
      });
    },
  },
};
