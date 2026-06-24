import {
  getDefaultPathForRole,
  normalizeRoleName,
  resolveAccessRoleName as resolveAccessRoleNameFromConfig,
  resolveUserRoleName,
} from "@/utils/frontendRoleAccess";
import { isAccountVerified } from "@/utils/accountVerification";

export const resolveRoleName = (me) => {
  if (me && typeof me === "object" && !isAccountVerified(me)) {
    return "pending_verification";
  }
  return resolveUserRoleName(me);
};

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

export const getRoleHomeRoute = (roleName) =>
  normalizeRoleName(roleName) === "pending_verification"
    ? "/verify-email"
    : getDefaultPathForRole(roleName);
