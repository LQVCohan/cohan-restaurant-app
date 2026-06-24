// Frontend-only route/menu access policy.
// This file is used to hide navigation items, choose landing pages, and
// redirect users away from screens that are not intended for their role.
// It does not enforce data security and must not replace backend guards.
// Restaurant-scoped access must still be checked on the backend, e.g.
// requireRestaurantAccess(ctx, restaurantId).

import { hasAnyPermission, hasPermission } from "./frontendPermissionAccess";

export const ADMIN_ROLES = new Set(["admin"]);
export const MANAGER_ROLES = new Set(["manager"]);
export const HR_ROLES = new Set(["hr"]);
export const ACCOUNTANT_ROLES = new Set(["accountant"]);
export const STAFF_OPERATIONAL_ROLES = new Set([
  "staff",
  "server",
  "supervisor",
  "host",
  "cashier",
  "chef",
  "cook",
  "kitchen_helper",
  "cleaner",
  "shipper",
  "storekeeper",
  "bartender",
]);
export const STAFF_SHARED_ROLES = [
  ...new Set(["admin", "manager", "hr", ...STAFF_OPERATIONAL_ROLES]),
];
export const STAFF_ORDER_ROLES = [
  "admin",
  "manager",
  "server",
  "host",
  "cashier",
  "supervisor",
];
export const STAFF_KITCHEN_ROLES = [
  "admin",
  "manager",
  "chef",
  "cook",
  "kitchen_helper",
];
export const CUSTOMER_ROLES = new Set(["customer"]);

export const normalizeRoleName = (input) => {
  if (typeof input === "string") {
    const normalized = input.trim().toLowerCase();
    return normalized || null;
  }
  return null;
};

export const resolveUserRoleName = (userOrRole) => {
  if (!userOrRole) return null;
  if (typeof userOrRole === "string") return normalizeRoleName(userOrRole);
  if (typeof userOrRole !== "object") return null;

  const candidates = [
    userOrRole.roleName,
    userOrRole.roleSlug,
    userOrRole.userType,
    userOrRole.role?.slug,
    userOrRole.role?.name,
    userOrRole.role?.parentRole?.slug,
    userOrRole.role?.parentRole?.name,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeRoleName(candidate);
    if (normalized) return normalized;
  }

  return null;
};

export const resolveAccessRoleName = (userOrRole) => {
  const resolved = resolveUserRoleName(userOrRole);
  if (!resolved) return null;
  return STAFF_OPERATIONAL_ROLES.has(resolved) ? "staff" : resolved;
};

export const isAdminRole = (role) => ADMIN_ROLES.has(resolveUserRoleName(role));
export const isManagerRole = (role) =>
  MANAGER_ROLES.has(resolveUserRoleName(role));
export const isHrRole = (role) => HR_ROLES.has(resolveUserRoleName(role));
export const isAccountantRole = (role) =>
  ACCOUNTANT_ROLES.has(resolveUserRoleName(role));

export const isStaffOperationalRole = (role) =>
  STAFF_OPERATIONAL_ROLES.has(resolveUserRoleName(role));

export const isRestaurantScopedRole = (role) => {
  const normalized = resolveUserRoleName(role);
  return (
    STAFF_OPERATIONAL_ROLES.has(normalized) ||
    HR_ROLES.has(normalized) ||
    ACCOUNTANT_ROLES.has(normalized)
  );
};
export const isCustomerRole = (role) =>
  CUSTOMER_ROLES.has(resolveUserRoleName(role));

export const hasStaffOrderAccess = (role) =>
  STAFF_ORDER_ROLES.includes(resolveUserRoleName(role));

export const hasStaffKitchenAccess = (role) =>
  STAFF_KITCHEN_ROLES.includes(resolveUserRoleName(role));

export const getDefaultPathForRole = (userOrRole) => {
  const normalized = resolveUserRoleName(userOrRole);
  if (normalized === "pending_verification") return "/verify-email";
  if (isAdminRole(normalized)) return "/manager";
  if (isManagerRole(normalized)) return "/manager";
  if (isHrRole(normalized)) return "/manager";
  if (isAccountantRole(normalized)) return "/manager";
  if (isStaffOperationalRole(normalized)) return "/staff/dashboard";
  return "/";
};

const SHARED_USER_ALLOW = [
  ...new Set([
    "customer",
    "admin",
    "manager",
    "hr",
    ...STAFF_OPERATIONAL_ROLES,
  ]),
];

// NOTE: public customer pages are protected in AppRouter only when wrapped by PrivateRoute.
const ROUTE_ACCESS_RULES = [
  { test: /^\/admin(\/|$)/, allow: ["admin"] },
  { test: /^\/manager(\/|$)/, allow: ["admin", "manager", "hr", "accountant"] },
  {
    test: /^\/staff(\/|$)/,
    allow: STAFF_SHARED_ROLES,
  },
  { test: /^\/(profile|notifications|search)(\/|$)/, allow: SHARED_USER_ALLOW },
  {
    test: /^\/(orders|restaurants|restaurant|checkout|cus-menu|food|coupons|vouchers|favorites|address-book|help-center|track-delivery)(\/|$)/,
    allow: ["customer", "admin", "manager"],
  },
];

// Role-level route gate only. This does not validate restaurantId ownership.
// Any query/mutation involving restaurant data must still be protected by
// backend restaurant-scope guards.
export const canAccessRoute = (userOrRole, pathname) => {
  const normalizedRole = resolveUserRoleName(userOrRole);
  if (!normalizedRole || typeof pathname !== "string") return false;

  for (const rule of ROUTE_ACCESS_RULES) {
    if (rule.test.test(pathname)) {
      return rule.allow.includes(normalizedRole);
    }
  }
  return true;
};

export const filterNavigationByRole = (items, userOrRole) => {
  const normalizedRole = resolveUserRoleName(userOrRole);
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (Array.isArray(item.items)) {
        const childItems = item.items.filter((child) => {
          if (!Array.isArray(child.roles) || child.roles.length === 0)
            return true;
          return child.roles.map(normalizeRoleName).includes(normalizedRole);
        });
        return childItems.length > 0 ? { ...item, items: childItems } : null;
      }

      if (!Array.isArray(item.roles) || item.roles.length === 0) return item;
      return item.roles.map(normalizeRoleName).includes(normalizedRole)
        ? item
        : null;
    })
    .filter(Boolean);
};
export const MENU_MANAGEMENT_ACTIONS = {
  VIEW: "menu.view",
  CREATE_ITEM: "menu.create_item",
  UPDATE_ITEM: "menu.update_item",
  DELETE_ITEM: "menu.delete_item",
  UPDATE_PRICE: "menu.update_price",
  MANAGE_DISH_CATEGORY: "menu.manage_dish_category",
  MANAGE_CATEGORY: "menu.manage_category",
  MANAGE_MENU_GROUP: "menu.manage_menu_group",
  MANAGE_GROUP: "menu.manage_group",
  CREATE_MENU: "menu.create_menu",
  UPDATE_MENU: "menu.update_menu",
  DELETE_MENU: "menu.delete_menu",
  TOGGLE_MENU: "menu.toggle_menu",
  COPY_MENU: "menu.copy_menu",
  SYNC_INVENTORY: "menu.inventory.sync",
  VIEW_AUDIT: "menu.audit.read",
};

const MENU_ACTION_PERMISSION_MAP = {
  [MENU_MANAGEMENT_ACTIONS.VIEW]: ["menu.read"],
  [MENU_MANAGEMENT_ACTIONS.CREATE_ITEM]: ["menu.item.create", "menu.write"],
  [MENU_MANAGEMENT_ACTIONS.UPDATE_ITEM]: ["menu.item.update", "menu.write"],
  [MENU_MANAGEMENT_ACTIONS.DELETE_ITEM]: ["menu.item.delete", "menu.write"],
  [MENU_MANAGEMENT_ACTIONS.UPDATE_PRICE]: ["menu.price.update", "menu.write"],
  [MENU_MANAGEMENT_ACTIONS.MANAGE_DISH_CATEGORY]: ["menu.category.manage", "menu.write"],
  [MENU_MANAGEMENT_ACTIONS.MANAGE_CATEGORY]: ["menu.category.manage", "menu.write"],
  [MENU_MANAGEMENT_ACTIONS.MANAGE_MENU_GROUP]: ["menu.group.manage", "menu.write"],
  [MENU_MANAGEMENT_ACTIONS.MANAGE_GROUP]: ["menu.group.manage", "menu.write"],
  [MENU_MANAGEMENT_ACTIONS.CREATE_MENU]: ["menu.create", "menu.write"],
  [MENU_MANAGEMENT_ACTIONS.UPDATE_MENU]: ["menu.update", "menu.write"],
  [MENU_MANAGEMENT_ACTIONS.DELETE_MENU]: ["menu.delete", "menu.write"],
  [MENU_MANAGEMENT_ACTIONS.TOGGLE_MENU]: ["menu.update", "menu.write"],
  [MENU_MANAGEMENT_ACTIONS.COPY_MENU]: ["menu.copy", "menu.write"],
  [MENU_MANAGEMENT_ACTIONS.SYNC_INVENTORY]: ["menu.inventory.sync", "menu.write", "inventory.write"],
  [MENU_MANAGEMENT_ACTIONS.VIEW_AUDIT]: ["menu.audit.read", "menu.read", "menu.write", "log.read"],
};

export const canPerformMenuAction = (userOrRole, action, userPermissions = []) => {
  const normalized = resolveUserRoleName(userOrRole);
  if (!normalized) return false;
  if (isAdminRole(normalized) || isManagerRole(normalized)) return true;

  const required = MENU_ACTION_PERMISSION_MAP[action] || [];
  if (!required.length) return false;

  return hasAnyPermission(userPermissions, required);
};

export const canViewMenuAction = (userOrRole, action, userPermissions = []) =>
  canPerformMenuAction(userOrRole, action, userPermissions) || hasPermission(userPermissions, action);
