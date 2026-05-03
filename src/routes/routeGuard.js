const STAFF_ROLE_SLUGS = new Set([
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

const normalizeRole = (role) => {
  if (typeof role !== "string") return null;
  const normalized = role.trim().toLowerCase();
  return normalized || null;
};

export const resolveRoleName = (me) => {
  if (!me || typeof me !== "object") return null;

  const directRole = normalizeRole(me.roleName);
  if (directRole) return directRole;

  const slugRole = normalizeRole(me.role?.slug);
  if (slugRole) return slugRole;

  const nameRole = normalizeRole(me.role?.name);
  if (nameRole) return nameRole;

  return null;
};

export const resolveAccessRoleName = (me) => {
  if (!me || typeof me !== "object") return null;

  const directRole = normalizeRole(me.roleName);
  const roleSlug = normalizeRole(me.role?.slug);
  const roleName = normalizeRole(me.role?.name);
  const parentSlug = normalizeRole(me.role?.parentRole?.slug);
  const parentName = normalizeRole(me.role?.parentRole?.name);

  if (parentSlug) return parentSlug;
  if (parentName) return parentName;

  if (directRole && STAFF_ROLE_SLUGS.has(directRole)) return "staff";
  if (roleSlug && STAFF_ROLE_SLUGS.has(roleSlug)) return "staff";
  if (roleName && STAFF_ROLE_SLUGS.has(roleName)) return "staff";

  return directRole || roleSlug || roleName || null;
};

export const hasAllowedRole = (allowedRoles, roleName) => {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return true;
  }

  const normalizedRole = normalizeRole(roleName);
  if (!normalizedRole) {
    return false;
  }

  return allowedRoles
    .map((role) => normalizeRole(role))
    .filter(Boolean)
    .includes(normalizedRole);
};

export const getRoleHomeRoute = (roleName) => {
  const role = normalizeRole(roleName);
  if (["admin", "manager", "hr", "accountant"].includes(role)) return "/manager";
  if (role && STAFF_ROLE_SLUGS.has(role)) return "/staff/orders";
  return "/";
};
