import { Role } from "../../../models/index.js";

export function mergeEffectivePermissions(roleObject) {
  const permMap = new Map();
  for (const p of roleObject.parentRole?.permissions || []) {
    const key = String(p?._id || p?.id || p?.code || "");
    if (key) permMap.set(key, p);
  }
  for (const p of roleObject.permissions || []) {
    const key = String(p?._id || p?.id || p?.code || "");
    if (key) permMap.set(key, p);
  }
  return Array.from(permMap.values());
}

export function normalizeRoleForRbacResponse(roleObject) {
  if (!roleObject) return null;
  const role = { ...roleObject };
  role.directPermissions = role.permissions || [];
  role.permissions = mergeEffectivePermissions(role);
  return role;
}

export async function loadRoleForRbacResponse(id) {
  const role = await Role.findById(id)
    .populate("permissions")
    .populate({ path: "parentRole", populate: { path: "permissions" } })
    .lean({ virtuals: true });

  return normalizeRoleForRbacResponse(role);
}
