// src/utils/authz.js
export function hasRole(user, slugs = []) {
  if (!user) return false;
  const current = (
    user.roleName ||
    user.role?.slug ||
    user.role?.name ||
    ""
  ).toLowerCase();
  return slugs.map((s) => String(s).toLowerCase()).includes(current);
}

export function requireRole(user, slugs = []) {
  if (!hasRole(user, slugs)) {
    const err = new Error("FORBIDDEN");
    err.code = "FORBIDDEN";
    throw err;
  }
}
