import { normalizeRole, resolveUserRoles } from "../src/services/scheduling/schedulingPermission.service.js";

const STAFF_SUBROLES = new Set([
  "STAFF", "SERVER", "SUPERVISOR", "HOST", "CASHIER", "CHEF", "COOK",
  "KITCHEN_HELPER", "CLEANER", "SHIPPER", "STOREKEEPER", "BARTENDER",
]);

function restaurantIdToString(value) {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value._id || value.id || value.value || "");
  }
  return String(value);
}

function hasDirectRestaurantScope(ctx, restaurantId) {
  const user = ctx?.user || {};
  const target = restaurantIdToString(restaurantId);
  if (!target) return false;

  const scopedIds = [
    user.restaurantId,
    user.restaurantForStaff,
    user.primaryRestaurant,
    ...(Array.isArray(user.refRestaurants) ? user.refRestaurants : []),
    ...(Array.isArray(user.restaurantIds) ? user.restaurantIds : []),
  ];

  return scopedIds.some((id) => restaurantIdToString(id) === target);
}

async function managerOwnsRestaurant(ctx, restaurantId) {
  const managerId = ctx?.user?.id || ctx?.user?._id;
  if (!managerId || !restaurantId) return false;

  try {
    const models = await import("../models/index.js");

    if (!Object.prototype.hasOwnProperty.call(models, "Restaurant")) {
      return false;
    }

    const Restaurant = models.Restaurant;
    if (typeof Restaurant?.exists !== "function") {
      return false;
    }

    const managed = await Restaurant.exists({
      _id: restaurantId,
      managerId,
    });

    return Boolean(managed);
  } catch (error) {
    if (String(error?.message || "").includes('No "Restaurant" export')) {
      return false;
    }

    throw error;
  }
}

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

  if (hasDirectRestaurantScope(ctx, restaurantId)) return;

  if (roles.includes("MANAGER") && await managerOwnsRestaurant(ctx, restaurantId)) {
    return;
  }

  // Preserve prior intent that scoped staff-like roles are restaurant-bound.
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
