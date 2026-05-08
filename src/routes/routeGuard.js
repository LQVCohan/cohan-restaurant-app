import {
  getDefaultPathForRole,
  normalizeRoleName,
  resolveAccessRoleName as resolveAccessRoleNameFromConfig,
  resolveUserRoleName,
} from "@/utils/roleAccess";

export const resolveRoleName = (me) => resolveUserRoleName(me);

export const resolveAccessRoleName = (me) => resolveAccessRoleNameFromConfig(me);

export const hasAllowedRole = (allowedRoles, roleName) => {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return true;

  const normalizedRole = normalizeRoleName(roleName);
  if (!normalizedRole) return false;

  return allowedRoles
    .map((role) => normalizeRoleName(role))
    .filter(Boolean)
    .includes(normalizedRole);
};

export const getRoleHomeRoute = (roleName) => getDefaultPathForRole(roleName);
