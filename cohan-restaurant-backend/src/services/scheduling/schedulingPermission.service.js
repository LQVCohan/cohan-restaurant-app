import { canAccessRestaurant } from "../auth/restaurantScope.service.js";
export const AVAILABILITY_WINDOW_ADMIN_ROLES = ["ADMIN", "MANAGER"];
export const AVAILABILITY_REVIEW_ROLES = ["ADMIN", "MANAGER", "HR"];
export const AVAILABILITY_READ_ROLES = ["ADMIN", "MANAGER", "HR"];
export const SCHEDULE_WRITE_ROLES = ["ADMIN", "MANAGER", "HR"];
export const SCHEDULE_READ_ROLES = ["ADMIN", "MANAGER", "HR", "ACCOUNTANT"];
export const SHIFT_ACK_READ_ROLES = ["ADMIN", "MANAGER", "HR", "ACCOUNTANT"];
export const SHIFT_ACK_ADMIN_ROLES = ["ADMIN", "MANAGER"];
export const ATTENDANCE_SELF_ROLES = ["STAFF"];
export const ATTENDANCE_OPERATION_ROLES = ["ADMIN", "MANAGER"];
export const ATTENDANCE_HR_REVIEW_ROLES = ["HR"];
export const ATTENDANCE_READ_ROLES = ["ADMIN", "MANAGER", "HR", "ACCOUNTANT"];
export const ATTENDANCE_REVIEW_ROLES = ["ADMIN", "MANAGER", "HR"];
export const ATTENDANCE_WRITE_ROLES = ["ADMIN", "MANAGER"];

export function normalizeRole(value) {
  return String(value || "").trim().toUpperCase();
}

export function resolveUserRoles(user = {}) {
  const role = user?.role;
  const rawRoles = [
    user?.userType,
    user?.roleName,
    user?.roleSlug,
    role?.slug,
    role?.name,
    typeof role === "string" ? role : null,
    ...(Array.isArray(user?.roles) ? user.roles : []),
  ];

  return [...new Set(rawRoles.map(normalizeRole).filter(Boolean))];
}

export function userHasAnyRole(user, allowedRoles = []) {
  const allowed = new Set(allowedRoles.map(normalizeRole));
  return resolveUserRoles(user).some((role) => allowed.has(role));
}

export async function userCanAccessRestaurant(user, restaurantId) {
  return canAccessRestaurant(user, restaurantId);
}
