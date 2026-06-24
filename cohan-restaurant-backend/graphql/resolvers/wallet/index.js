import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission, requirePermission } from "../../../src/services/auth/authorization.service.js";
import {
  adjustWalletBalance,
  createWalletTopup,
  getWalletSummary,
  listWalletTransactions,
  payOrdersWithWallet,
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
      });
    },
    payOrdersWithWallet: async (_, { input }, ctx) => {
      const userId = requireWalletUser(ctx);
      return payOrdersWithWallet({
        userId,
        restaurantId: input.restaurantId,
        orderIds: input.orderIds || [],
        idempotencyKey: input.idempotencyKey,
      });
    },
    refundToWallet: async (_, { input }, ctx) => {
      await requireRestaurantPermission(ctx, input.restaurantId, PERMISSIONS.PAYMENT_WRITE);
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
