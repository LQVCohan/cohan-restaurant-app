import { GraphQLError } from "graphql";
import { requireRestaurantAccess } from "../../../graphql/guards.js";
import { hasRole } from "../../../utils/authz.js";
import { getUserBrandMemberships } from "./restaurantScope.service.js";

export const MANAGER_STAFF_PERMISSION_WHITELIST = Object.freeze([
  "menu.read",
  "menu.item.update",
  "menu.price.update",
  "menu.inventory.sync",
  "menu.audit.read",
  "order.read",
  "order.create",
  "order.update",
  "order.cancel",
  "payment.read",
  "payment.write",
  "finance.read",
  "finance.write",
  "finance.export",
  "transaction.read",
  "transaction.write",
  "reconciliation.read",
  "reconciliation.write",
  "refund.read",
  "refund.write",
  "table.read",
  "table.write",
  "staff.read",
  "kitchen.read",
  "kitchen.write",
  "delivery.read",
  "delivery.update",
  "shift.read",
  "reservation.read",
  "reservation.update",
  "cleaning.read",
  "inventory.read",
  "inventory.write",
  "stock.read",
  "stock.write",
  "supplier.read",
  "supplier.write",
  "ai.chatbot.handoff",
]);

export const PROTECTED_SYSTEM_ROLE_SLUGS = Object.freeze([
  "admin",
  "manager",
  "hr",
  "accountant",
]);

const BRAND_RBAC_PERMISSION_CODES = new Set([
  "role.read",
  "role.write",
  "permission.read",
  "staff.read",
  "staff.write",
]);

const AI_CHATBOT_MANAGER_PERMISSIONS = [
  "ai.chatbot.read",
  "ai.chatbot.write",
  "ai.chatbot.moderate",
  "ai.chatbot.evaluate",
  "ai.chatbot.handoff",
  "ai.chatbot.analytics.read",
];

const REVIEW_MANAGER_PERMISSIONS = [
  "review.read",
  "review.reply",
  "review.moderate",
  "review.delete",
  "review.report.read",
  "review.report.resolve",
  "review.export",
  "review.analytics.read",
];

const BACKUP_MANAGER_PERMISSIONS = [
  "backup.read",
  "backup.write",
  "backup.export",
  "backup.import",
];

const LEGACY_ROLE_PERMISSION_MAP = Object.freeze({
  manager: [
    "restaurant.read", "restaurant.write", "menu.read", "menu.write",
    "order.read", "order.create", "order.update", "order.cancel",
    "payment.read", "payment.write", "finance.read", "finance.write", "finance.export", "transaction.read", "transaction.write", "reconciliation.read", "reconciliation.write", "refund.read", "refund.write", "staff.read", "staff.write",
    "shift.read", "shift.manage", "table.read", "table.write",
    "report.read", "dashboard.read", "print.read", "print.write", "inventory.read", "inventory.write",
    "stock.read", "stock.write", "reservation.read", "reservation.create",
    "reservation.update", "reservation.cancel", "promotion.read", "promotion.write",
    "coupon.read", "coupon.write", "customer.read", "customer.update", "role.read", "role.write", "permission.read",
    ...AI_CHATBOT_MANAGER_PERMISSIONS,
    ...REVIEW_MANAGER_PERMISSIONS,
    ...BACKUP_MANAGER_PERMISSIONS,
  ],
  hr: ["staff.read", "shift.read", "report.read", "attendance.read", "performance.read"],
  accountant: ["payment.read", "payment.write", "finance.read", "finance.write", "finance.export", "transaction.read", "transaction.write", "reconciliation.read", "reconciliation.write", "refund.read", "refund.write", "report.read", "report.export", "payroll.read"],
  staff: ["review.read", "review.reply"],
  supervisor: ["review.read", "review.reply", "review.moderate", "review.report.read"],
});

function getLegacyRolePermissionCodes(user) {
  const candidates = [user?.roleName, user?.role?.slug, user?.role?.name, user?.userType]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  const codes = new Set();
  for (const candidate of candidates) {
    for (const code of LEGACY_ROLE_PERMISSION_MAP[candidate] || []) codes.add(code);
  }
  return Array.from(codes);
}

export function normalizePermissionCode(code) {
  return String(code || "").trim().toLowerCase();
}

function permissionKey(permission) {
  if (!permission) return "";
  if (typeof permission === "string") return normalizePermissionCode(permission);
  return normalizePermissionCode(permission.code || permission._id || permission.id);
}

function asPermissionObject(permission) {
  if (!permission) return null;
  if (typeof permission === "string") return { code: normalizePermissionCode(permission) };
  return permission;
}

function dedupePermissions(permissions = []) {
  const map = new Map();
  for (const permission of permissions) {
    const normalized = asPermissionObject(permission);
    const key = permissionKey(normalized);
    if (!key) continue;
    map.set(key, normalized);
  }
  return Array.from(map.values());
}

async function hasActiveBrandRbacRole(user, permissionCode) {
  if (!BRAND_RBAC_PERMISSION_CODES.has(permissionCode)) return false;
  const memberships = await getUserBrandMemberships(user);
  return memberships.some((membership) =>
    membership?.status === "active" && ["owner", "admin"].includes(String(membership?.role || "").trim().toLowerCase())
  );
}

async function loadPopulatedRole(role) {
  if (!role) return null;
  if (typeof role === "object" && Array.isArray(role.permissions)) return role;
  const roleId = typeof role === "object" ? role._id || role.id : role;
  if (!roleId) return null;
  const { Role } = await import("../../../models/index.js");
  return Role.findById(roleId)
    .populate("permissions")
    .populate({ path: "parentRole", populate: { path: "permissions" } })
    .lean();
}

export async function getUserEffectivePermissions(user) {
  if (!user) return [];
  if (hasRole(user, ["admin"])) return [{ code: "*", name: "All permissions" }];

  const role = await loadPopulatedRole(user.role);
  const rolePermissions = Array.isArray(role?.permissions) ? role.permissions : [];
  const parentPermissions = Array.isArray(role?.parentRole?.permissions)
    ? role.parentRole.permissions
    : [];

  const legacyPermissions = getLegacyRolePermissionCodes(user);
  return dedupePermissions([...parentPermissions, ...rolePermissions, ...legacyPermissions]);
}

export async function hasPermission(user, permissionCode) {
  const code = normalizePermissionCode(permissionCode);
  if (!code) return false;
  if (hasRole(user, ["admin"])) return true;
  if (await hasActiveBrandRbacRole(user, code)) return true;

  const permissions = await getUserEffectivePermissions(user);
  const codes = permissions.map(permissionKey);
  return codes.includes("*") || codes.includes("system.manage") || codes.includes(code);
}

export async function hasExplicitPermission(user, permissionCode) {
  const code = normalizePermissionCode(permissionCode);
  if (!user || !code) return false;

  const role = await loadPopulatedRole(user.role);
  const rolePermissions = Array.isArray(role?.permissions) ? role.permissions : [];
  const parentPermissions = Array.isArray(role?.parentRole?.permissions)
    ? role.parentRole.permissions
    : [];
  const directPermissions = Array.isArray(user.permissions) ? user.permissions : [];

  const codes = dedupePermissions([...parentPermissions, ...rolePermissions, ...directPermissions])
    .map(permissionKey)
    .filter((value) => value && value !== "*" && value !== "system.manage");
  return codes.includes(code);
}

export async function hasAnyPermission(user, permissionCodes = []) {
  if (!Array.isArray(permissionCodes) || permissionCodes.length === 0) return false;
  if (hasRole(user, ["admin"])) return true;
  for (const code of permissionCodes) {
    if (await hasPermission(user, code)) return true;
  }
  return false;
}

function forbidden(message = "FORBIDDEN") {
  return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
}

function requireAuth(ctx) {
  if (!ctx?.user?.id && !ctx?.user?._id) {
    const err = new Error("UNAUTHENTICATED");
    err.statusCode = 401;
    throw err;
  }
}

export async function requirePermission(ctx, permissionCode) {
  requireAuth(ctx);
  if (!(await hasPermission(ctx.user, permissionCode))) throw forbidden();
  return true;
}

export async function requireAnyPermission(ctx, permissionCodes) {
  requireAuth(ctx);
  if (!(await hasAnyPermission(ctx.user, permissionCodes))) throw forbidden();
  return true;
}

export async function requireRestaurantPermission(ctx, restaurantId, permissionCode) {
  await requireRestaurantAccess(ctx, restaurantId);
  await requirePermission(ctx, permissionCode);
  return true;
}

export async function requireAnyRestaurantPermission(ctx, restaurantId, permissionCodes) {
  await requireRestaurantAccess(ctx, restaurantId);
  await requireAnyPermission(ctx, permissionCodes);
  return true;
}

export function assertManagerAssignablePermissionCodes(permissionCodes = []) {
  const whitelist = new Set(MANAGER_STAFF_PERMISSION_WHITELIST);
  const denied = permissionCodes.map(normalizePermissionCode).filter((code) => !whitelist.has(code));
  if (denied.length) {
    throw new GraphQLError(`Manager cannot assign permissions: ${denied.join(", ")}`, {
      extensions: { code: "FORBIDDEN" },
    });
  }
}

export function isProtectedSystemRoleSlug(slug) {
  return PROTECTED_SYSTEM_ROLE_SLUGS.includes(String(slug || "").trim().toLowerCase());
}
