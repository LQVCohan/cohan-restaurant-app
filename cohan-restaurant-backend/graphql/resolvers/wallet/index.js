import { PERMISSIONS } from "../../../src/constants/permissions.js";
import {
  requireRestaurantPermission,
} from "../../../src/services/auth/authorization.service.js";
import { emitPaymentRealtime } from "../../../src/services/payment/paymentRealtime.service.js";
import {
  getPaymentBaseApiUrl,
  getPaymentClientIp,
} from "../../../src/services/payment/paymentRequestContext.js";
import { payOrdersWithWallet } from "../../../src/services/wallet/idempotentWalletPayment.service.js";
import {
  adjustWalletBalance,
  createWalletTopup,
  getWalletSummary,
  listWalletTransactions,
  refundToWallet,
  requireWalletUser,
} from "../../../src/services/wallet/wallet.service.js";

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
        baseApiUrl: getPaymentBaseApiUrl(ctx),
        clientIp: getPaymentClientIp(ctx),
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
        PERMISSIONS.REFUND_WRITE,
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
      await requireRestaurantPermission(
        ctx,
        input.restaurantId,
        PERMISSIONS.PAYMENT_WRITE,
      );
      const actorId = requireWalletUser(ctx);
      return adjustWalletBalance({
        restaurantId: input.restaurantId,
        userId: input.userId,
        amount: input.amount,
        reason: input.reason,
        actorId,
      });
    },
  },
};
