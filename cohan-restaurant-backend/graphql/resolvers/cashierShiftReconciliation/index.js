import { requireAuth, requireRestaurantAccess } from "../../guards.js";
import {
  addCashierShiftCashMovement,
  enrichCashierPerformanceRecalculationResult,
  listCashierShiftReconciliations,
  openCashierShiftReconciliation,
  refreshCashierShiftReconciliation,
  reviewCashierShiftReconciliation,
  submitCashierShiftReconciliation,
} from "../../../src/services/staffPerformance/cashierShiftReconciliation.service.js";

export function wrapCashierPerformanceRecalculation(resolver) {
  if (typeof resolver !== "function") {
    throw new Error("CASHIER_PERFORMANCE_RECALCULATION_RESOLVER_MISSING");
  }

  return async (parent, args = {}, ctx, info) => {
    requireAuth(ctx);
    const restaurantId = args?.input?.restaurantId;
    if (!restaurantId) throw new Error("restaurantId không hợp lệ.");
    await requireRestaurantAccess(ctx, restaurantId);

    const result = await resolver(parent, args, ctx, info);
    return enrichCashierPerformanceRecalculationResult({ result, restaurantId });
  };
}

export default {
  Query: {
    cashierShiftReconciliations: async (_, { filter }, ctx) => {
      requireAuth(ctx);
      await requireRestaurantAccess(ctx, filter.restaurantId);
      return listCashierShiftReconciliations({ filter, ctx });
    },
  },
  Mutation: {
    openCashierShiftReconciliation: async (_, { input }, ctx) => {
      requireAuth(ctx);
      await requireRestaurantAccess(ctx, input.restaurantId);
      return openCashierShiftReconciliation({ input, ctx });
    },
    addCashierShiftCashMovement: async (_, { input }, ctx) => {
      requireAuth(ctx);
      return addCashierShiftCashMovement({ input, ctx });
    },
    refreshCashierShiftReconciliation: async (_, { id }, ctx) => {
      requireAuth(ctx);
      return refreshCashierShiftReconciliation({ id, ctx });
    },
    submitCashierShiftReconciliation: async (_, { input }, ctx) => {
      requireAuth(ctx);
      return submitCashierShiftReconciliation({ input, ctx });
    },
    reviewCashierShiftReconciliation: async (_, { input }, ctx) => {
      requireAuth(ctx);
      return reviewCashierShiftReconciliation({ input, ctx });
    },
  },
};
