import mongoose from "mongoose";
import { Staff } from "../../../models/index.js";
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
import { refreshCashierPerformanceSnapshotsForReconciliation } from "../../../src/services/staffPerformance/cashierPerformanceSnapshotRefresh.service.js";

function normalizeRoleText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

async function assertCashierRole(cashierId) {
  if (!mongoose.isValidObjectId(cashierId)) return;
  const staff = await Staff.findById(cashierId)
    .select("department positionTitle roleName")
    .lean();
  if (!staff) return;
  const roleText = normalizeRoleText(
    [staff.department, staff.positionTitle, staff.roleName]
      .filter(Boolean)
      .join(" "),
  );
  if (!roleText.includes("cashier") && !roleText.includes("thu ngan")) {
    throw new Error("Chỉ nhân viên có vai trò thu ngân mới được mở ca chốt quỹ.");
  }
}

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
      await assertCashierRole(input.cashierId);
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
      const reviewed = await reviewCashierShiftReconciliation({ input, ctx });
      await refreshCashierPerformanceSnapshotsForReconciliation(reviewed).catch(
        (error) => {
          console.warn(
            "[cashierShiftReconciliation] performance snapshot refresh failed",
            error?.message || error,
          );
        },
      );
      return reviewed;
    },
  },
};
