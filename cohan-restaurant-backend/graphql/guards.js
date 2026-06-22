import { normalizeRole, resolveUserRoles } from "../src/services/scheduling/schedulingPermission.service.js";
import { REVIEW_ROLE_PERMISSION_DEFAULTS } from "../src/services/auth/reviewPermissionDefaults.js";

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
  const isManager = roles.includes("MANAGER");
  const target = restaurantIdToString(restaurantId);
  if (!target) return false;

  const scopedIds = [
    user.restaurantId,
    ...(isRestaurantScopedRole ? [user.restaurantForStaff] : []),
    ...(isManager && Array.isArray(user.managedRestaurantIds)
      ? user.managedRestaurantIds
      : []),
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
    if (String(error?.message || "").includes('No "Restaurant" export') || error?.name === "CastError") {
      return false;
    }

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
  if (!ctx.user.id && ctx.user._id) {
    ctx.user.id = ctx.user._id;
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

// Compatibility guard for legacy synchronous resolver paths. Manager scope is
// limited to the owned restaurant ids resolved into the authenticated context.
export function requireRestaurantScope(ctx, restaurantId) {
  requireAuth(ctx);
  const roles = resolveUserRoles(ctx.user);
  if (roles.includes("ADMIN")) return;
  if (hasDirectRestaurantScope(ctx, restaurantId)) return;

  const err = new Error("FORBIDDEN_SCOPE");
  err.statusCode = 403;
  throw err;
}

export async function requireRestaurantAccess(ctx, restaurantId) {
  requireAuth(ctx);
  const roles = resolveUserRoles(ctx.user);
  if (roles.includes("ADMIN")) return;

  if (hasDirectRestaurantScope(ctx, restaurantId)) return;

  if (roles.includes("MANAGER") && await managerOwnsRestaurant(ctx, restaurantId)) {
    return;
  }

  const err = new Error("FORBIDDEN_SCOPE");
  err.statusCode = 403;
  throw err;
}

function normalizePermissionCode(value) {
  return String(value || "").trim().toLowerCase();
}

function collectPermissionCodes(user = {}) {
  const set = new Set();
  const add = (permission) => {
    if (!permission) return;
    if (typeof permission === "string") set.add(normalizePermissionCode(permission));
    else set.add(normalizePermissionCode(permission.code || permission.permissionCode || permission.slug || permission.name));
  };
  [user.permissions, user.permissionCodes, user.effectivePermissions, user.effectivePermissionCodes, user.role?.permissions, user.role?.directPermissions, user.role?.parentRole?.permissions]
    .forEach((list) => Array.isArray(list) && list.forEach(add));
  return Array.from(set).filter(Boolean);
}

const LEGACY_ROLE_PERMISSION_MAP = {
  ...REVIEW_ROLE_PERMISSION_DEFAULTS,
  admin: ["*"],
};

export function hasPermission(ctx, permission) {
  requireAuth(ctx);
  const code = normalizePermissionCode(permission);
  const roles = resolveUserRoles(ctx.user);
  if (roles.includes("ADMIN")) return true;
  const direct = collectPermissionCodes(ctx.user);
  if (direct.includes("*") || direct.includes("system.manage") || direct.includes(code)) return true;
  return roles.some((role) => (LEGACY_ROLE_PERMISSION_MAP[String(role).toLowerCase()] || []).includes(code));
}

export function requirePermission(ctx, permission) {
  if (!hasPermission(ctx, permission)) {
    const err = new Error("FORBIDDEN");
    err.statusCode = 403;
    throw err;
  }
}
