import {
  getDefaultPathForRole,
  normalizeRoleName,
  resolveAccessRoleName as resolveAccessRoleNameFromConfig,
  resolveUserRoleName,
} from "@/utils/frontendRoleAccess";
import { isAccountVerified } from "@/utils/accountVerification";

function rememberPendingVerificationContact(user) {
  if (typeof window === "undefined" || !window.sessionStorage || !user) return;
  try {
    if (user.email) window.sessionStorage.setItem("pending_verify_email", user.email);
    if (user.phone) window.sessionStorage.setItem("pending_verify_phone", user.phone);
  } catch {
    // sessionStorage may be unavailable in private/restricted environments.
  }
}

export const resolveRoleName = (me) => {
  if (
    me &&
    typeof me === "object" &&
    (me.forcePasswordChange || me.status === "force_password_change")
  ) {
    return "pending_verification";
  }
  if (me && typeof me === "object" && !isAccountVerified(me)) {
    rememberPendingVerificationContact(me);
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

export const getRoleHomeRoute = (roleName) => {
  const normalizedRole = normalizeRoleName(roleName);
  if (normalizedRole === "pending_verification") return "/verify-email";
  return getDefaultPathForRole(roleName);
};
