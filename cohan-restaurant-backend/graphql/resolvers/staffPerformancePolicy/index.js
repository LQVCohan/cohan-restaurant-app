import { requireAuth, requireRestaurantAccess } from "../../guards.js";
import {
  applyPerformancePolicyToRecalculationResult,
  getStaffPerformancePolicy,
  updateStaffPerformancePolicy,
} from "../../../src/services/staffPerformance/staffPerformancePolicy.service.js";

export function wrapPerformanceRecalculation(resolver) {
  if (typeof resolver !== "function") {
    throw new Error("STAFF_PERFORMANCE_RECALCULATION_RESOLVER_MISSING");
  }

  return async (parent, args = {}, ctx, info) => {
    requireAuth(ctx);
    const restaurantId = args?.input?.restaurantId;
    if (!restaurantId) throw new Error("restaurantId không hợp lệ.");
    await requireRestaurantAccess(ctx, restaurantId);

    const result = await resolver(parent, args, ctx, info);
    return applyPerformancePolicyToRecalculationResult({
      result,
      restaurantId,
    });
  };
}

export default {
  Query: {
    staffPerformancePolicy: async (_, { restaurantId }, ctx) => {
      requireAuth(ctx);
      await requireRestaurantAccess(ctx, restaurantId);
      return getStaffPerformancePolicy({ restaurantId, ctx });
    },
  },
  Mutation: {
    updateStaffPerformancePolicy: async (_, { input }, ctx) => {
      requireAuth(ctx);
      await requireRestaurantAccess(ctx, input.restaurantId);
      return updateStaffPerformancePolicy({ input, ctx });
    },
  },
};
