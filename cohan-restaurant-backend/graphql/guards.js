import { normalizeRole, resolveUserRoles } from "../src/services/scheduling/schedulingPermission.service.js";
import { canAccessRestaurant } from "../src/services/auth/restaurantScope.service.js";

export function requireAuth(ctx) {
  const userId = ctx?.user?.id || ctx?.user?._id;
  if (!userId) {
    const err = new Error("UNAUTHENTICATED");
    err.statusCode = 401;
    throw err;
  }
  if (!ctx.user.id && ctx.user._id) ctx.user.id = ctx.user._id;
}

export function requireRoles(ctx, allowed = []) {
  requireAuth(ctx);
  const userRoles = resolveUserRoles(ctx.user);
  const normalizedAllowed = allowed.map(normalizeRole);
  if (!normalizedAllowed.some((role) => userRoles.includes(role))) {
    const err = new Error("FORBIDDEN");
    err.statusCode = 403;
    throw err;
  }
}

export async function requireRestaurantAccess(ctx, restaurantId) {
  requireAuth(ctx);
  if (await canAccessRestaurant(ctx.user, restaurantId)) return;
  const err = new Error("FORBIDDEN_SCOPE");
  err.statusCode = 403;
  throw err;
}

// Compatibility alias for legacy imports. New and updated call sites must await it.
export async function requireRestaurantScope(ctx, restaurantId) {
  return requireRestaurantAccess(ctx, restaurantId);
}
