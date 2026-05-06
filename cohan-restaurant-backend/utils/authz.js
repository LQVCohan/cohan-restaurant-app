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
  const current = String(
    user.roleName ||
      user.role?.slug ||
      user.role?.name ||
      ""
  )
    .trim()
    .toLowerCase();

  const normalizedSlugs = slugs.map((s) => String(s).trim().toLowerCase());
  if (normalizedSlugs.includes(current)) return true;

  if (normalizedSlugs.includes("staff") && STAFF_ROLE_SLUGS.has(current)) {
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
