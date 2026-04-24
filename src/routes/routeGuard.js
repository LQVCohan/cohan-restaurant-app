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
  if (role === "staff") return "/staff/orders";
  return "/";
};
