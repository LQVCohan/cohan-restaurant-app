// Frontend-only permission access helpers.
// These helpers hide/disable UI affordances for better UX only.
// Backend resolvers remain the source of truth for authorization.

const ADMIN_ROLES = new Set(["admin"]);

const AI_CHATBOT_MANAGER_PERMISSIONS = [
  "ai.chatbot.read",
  "ai.chatbot.write",
  "ai.chatbot.moderate",
  "ai.chatbot.evaluate",
  "ai.chatbot.handoff",
  "ai.chatbot.analytics.read",
];

const BACKUP_MANAGER_PERMISSIONS = [
  "backup.read",
  "backup.write",
  "backup.export",
  "backup.import",
];

const LEGACY_ROLE_PERMISSION_MAP = Object.freeze({
  manager: [
    "restaurant.read",
    "restaurant.write",
    "dashboard.read",
    "menu.read",
    "menu.write",
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
    "staff.read",
    "staff.write",
    "customer.read",
    "customer.update",
    "shift.read",
    "shift.manage",
    "table.read",
    "table.write",
    "report.read",
    "print.read",
    "print.write",
    "inventory.read",
    "inventory.write",
    "stock.read",
    "stock.write",
    "reservation.read",
    "reservation.create",
    "reservation.update",
    "reservation.cancel",
    "promotion.read",
    "promotion.write",
    "coupon.read",
    "coupon.write",
    "role.read",
    "role.write",
    "permission.read",
    "review.read",
    "review.write",
    "review.reply",
    "review.moderate",
    "review.delete",
    "review.report.read",
    "review.report.resolve",
    "review.export",
    "review.analytics.read",
    "payroll.read",
    "payroll.validate",
    "payroll.payment.record",
    "payroll.export",
    ...AI_CHATBOT_MANAGER_PERMISSIONS,
    ...BACKUP_MANAGER_PERMISSIONS,
  ],
  hr: [
    "staff.read",
    "shift.read",
    "report.read",
    "attendance.read",
    "performance.read",
    "payroll.read",
    "payroll.validate",
    "payroll.payment.record",
    "payroll.export",
  ],

  accountant: [
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

    "report.read",
    "report.export",

    "payroll.read",
    "payroll.validate",
    "payroll.period.create",
    "payroll.settings.update",
    "payroll.period.recalculate",
    "payroll.period.finalize",
    "payroll.period.lock",
    "payroll.adjustment.write",
    "payroll.payment.record",
    "payroll.payout.execute",
    "payroll.export",
  ],
});

export const NO_PERMISSION_MESSAGE = "Bạn không có quyền thực hiện thao tác này.";

const normalize = (value) => String(value || "").trim().toLowerCase();

const getRoleCandidates = (user) => {
  if (!user) return [];
  if (typeof user === "string") return [normalize(user)].filter(Boolean);
  return [
    user.roleName,
    user.roleSlug,
    user.userType,
    user.role?.slug,
    user.role?.name,
    user.role?.parentRole?.slug,
    user.role?.parentRole?.name,
  ]
    .map(normalize)
    .filter(Boolean);
};

const isAdmin = (user) => getRoleCandidates(user).some((role) => ADMIN_ROLES.has(role));

const addPermissionCode = (set, permission) => {
  if (!permission) return;
  if (typeof permission === "string") {
    const code = normalize(permission);
    if (code) set.add(code);
    return;
  }

  const code = normalize(permission.code || permission.permissionCode || permission.slug || permission.name);
  if (code) set.add(code);
};

const addPermissionList = (set, permissions) => {
  if (!Array.isArray(permissions)) return;
  permissions.forEach((permission) => addPermissionCode(set, permission));
};

export function getPermissionCodes(user) {
  if (!user) return [];
  if (isAdmin(user)) return ["*"];

  const codes = new Set();

  addPermissionList(codes, user.permissions);
  addPermissionList(codes, user.permissionCodes);
  addPermissionList(codes, user.effectivePermissions);
  addPermissionList(codes, user.effectivePermissionCodes);

  addPermissionList(codes, user.role?.permissions);
  addPermissionList(codes, user.role?.directPermissions);
  addPermissionList(codes, user.role?.parentRole?.permissions);

  getRoleCandidates(user).forEach((role) => {
    addPermissionList(codes, LEGACY_ROLE_PERMISSION_MAP[role]);
  });

  return Array.from(codes);
}

export function hasPermission(user, code) {
  const normalizedCode = normalize(code);
  if (!normalizedCode) return false;
  if (isAdmin(user)) return true;

  const codes = getPermissionCodes(user);
  return codes.includes("*") || codes.includes("system.manage") || codes.includes(normalizedCode);
}

export function hasAnyPermission(user, codes = []) {
  if (!Array.isArray(codes) || codes.length === 0) return false;
  if (isAdmin(user)) return true;
  return codes.some((code) => hasPermission(user, code));
}

export function canAccessRestaurantModule(user, code) {
  const codes = Array.isArray(code) ? code : [code];
  return hasAnyPermission(user, codes);
}

const roleAllowed = (user, roles) => {
  if (!Array.isArray(roles) || roles.length === 0) return true;
  const normalizedRoles = roles.map(normalize).filter(Boolean);
  return getRoleCandidates(user).some((role) => normalizedRoles.includes(role));
};

export function canAccessPermissionAwareItem(user, item = {}) {
  if (isAdmin(user)) return true;
  const permissions = item.permissions || item.permissionCodes || item.permission;
  const requiredPermissions = Array.isArray(permissions)
    ? permissions
    : permissions
      ? [permissions]
      : [];

  if (requiredPermissions.length > 0) {
    return hasAnyPermission(user, requiredPermissions);
  }

  return roleAllowed(user, item.roles);
}

export function filterNavigationByPermissionAccess(items, user) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (Array.isArray(item.items)) {
        const childItems = item.items.filter((child) => canAccessPermissionAwareItem(user, child));
        return childItems.length > 0 ? { ...item, items: childItems } : null;
      }

      return canAccessPermissionAwareItem(user, item) ? item : null;
    })
    .filter(Boolean);
}
