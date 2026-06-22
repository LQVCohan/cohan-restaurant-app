import { normalizeRole, resolveUserRoles } from "../src/services/scheduling/schedulingPermission.service.js";

const RESTAURANT_SCOPED_ROLES = new Set([
  "HR", "ACCOUNTANT", "STAFF", "SERVER", "SUPERVISOR", "HOST", "CASHIER",
  "CHEF", "COOK", "KITCHEN_HELPER", "CLEANER", "SHIPPER", "STOREKEEPER",
  "BARTENDER",
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
  const roles = resolveUserRoles(user);
  const isRestaurantScopedRole = roles.some((role) => RESTAURANT_SCOPED_ROLES.has(role));
  const target = restaurantIdToString(restaurantId);
  if (!target || !isRestaurantScopedRole) return false;

  const scopedIds = [
    user.restaurantForStaff,
    user.restaurantId,
    ...(Array.isArray(user.restaurantIds) ? user.restaurantIds : []),
  ];

  return scopedIds.some((id) => restaurantIdToString(id) === target);
}

async function managerOwnsRestaurant(ctx, restaurantId) {
  const managerId = ctx?.user?.id || ctx?.user?._id;
  if (!managerId || !restaurantId) return false;

  try {
    const models = await import("../models/index.js");
    const Restaurant = models.Restaurant;
    if (typeof Restaurant?.exists !== "function") return false;

    return Boolean(await Restaurant.exists({ _id: restaurantId, managerId }));
  } catch (error) {
    if (error?.name === "CastError") return false;
    throw error;
  }
}

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
  const roles = resolveUserRoles(ctx.user);
  if (roles.includes("ADMIN")) return;
  if (hasDirectRestaurantScope(ctx, restaurantId)) return;
  if (roles.includes("MANAGER") && await managerOwnsRestaurant(ctx, restaurantId)) return;

  const err = new Error("FORBIDDEN_SCOPE");
  err.statusCode = 403;
  throw err;
}

// Compatibility alias for legacy imports. New and updated call sites must await it.
export async function requireRestaurantScope(ctx, restaurantId) {
  return requireRestaurantAccess(ctx, restaurantId);
}
