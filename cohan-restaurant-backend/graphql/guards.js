import { normalizeRole, resolveUserRoles } from "../src/services/scheduling/schedulingPermission.service.js";
import { Restaurant } from "../models/index.js";

const STAFF_SUBROLES = new Set([
  "STAFF", "SERVER", "SUPERVISOR", "HOST", "CASHIER", "CHEF", "COOK",
  "KITCHEN_HELPER", "CLEANER", "SHIPPER", "STOREKEEPER", "BARTENDER",
]);

export function requireAuth(ctx) {
  if (!ctx?.user?.id) {
    const err = new Error("UNAUTHENTICATED");
    err.statusCode = 401;
    throw err;
  }
}

export function requireRoles(ctx, allowed = []) {
  requireAuth(ctx);
  const userRoles = resolveUserRoles(ctx.user);
  const normalizedAllowed = allowed.map(normalizeRole);
  if (!normalizedAllowed.some((r) => userRoles.includes(r))) {
    const err = new Error("FORBIDDEN");
    err.statusCode = 403;
    throw err;
  }
}

export function requireRestaurantScope(ctx, restaurantId) {
  requireAuth(ctx);
  // tuỳ mô hình: admin bỏ qua; manager cần đúng restaurantId
  const roles = resolveUserRoles(ctx.user);
  if (roles.includes("ADMIN")) return;
  if (
    !ctx.user.restaurantId ||
    String(ctx.user.restaurantId) !== String(restaurantId)
  ) {
    const err = new Error("FORBIDDEN_SCOPE");
    err.statusCode = 403;
    throw err;
  }
}

export async function requireRestaurantAccess(ctx, restaurantId) {
  requireAuth(ctx);
  const roles = resolveUserRoles(ctx.user);
  if (roles.includes("ADMIN")) return;

  if (roles.includes("MANAGER")) {
    const managerId = ctx?.user?.id || ctx?.user?._id;
    const managed = await Restaurant.exists({
      _id: restaurantId,
      managerId,
    });
    if (managed) return;
  }

  // restaurantForStaff is the staff restaurant scope source-of-truth.
  const isStaffLike = roles.some((role) => STAFF_SUBROLES.has(role));
  if (isStaffLike) {
    const scopedRestaurantId = ctx?.user?.restaurantForStaff;
    if (!scopedRestaurantId) {
      const err = new Error("FORBIDDEN_SCOPE");
      err.statusCode = 403;
      throw err;
    }
    if (String(scopedRestaurantId) === String(restaurantId || "")) return;
  }

  const err = new Error("FORBIDDEN_SCOPE");
  err.statusCode = 403;
  throw err;
}
