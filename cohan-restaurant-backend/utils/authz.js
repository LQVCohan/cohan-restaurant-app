// src/utils/authz.js
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

export function hasRole(user, slugs = []) {
  if (!user) return false;

  const currentRoles = [
    user.userType,
    user.roleName,
    user.role?.slug,
    user.role?.name,
    user.role?.parentRole?.slug,
    user.role?.parentRole?.name,
    ...(Array.isArray(user.roles) ? user.roles : []),
  ]
    .map((role) => String(role || "").trim().toLowerCase())
    .filter(Boolean);
  const normalizedSlugs = slugs.map((slug) =>
    String(slug || "").trim().toLowerCase(),
  );

  if (normalizedSlugs.some((slug) => currentRoles.includes(slug))) return true;

  if (
    normalizedSlugs.includes("staff") &&
    currentRoles.some((role) => STAFF_ROLE_SLUGS.has(role))
  ) {
    return true;
  }

  return false;
}

export function requireRole(user, slugs = []) {
  if (!hasRole(user, slugs)) {
    const err = new Error("FORBIDDEN");
    err.code = "FORBIDDEN";
    throw err;
  }
}
