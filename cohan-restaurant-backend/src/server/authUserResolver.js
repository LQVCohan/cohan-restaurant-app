import jwt from "jsonwebtoken";
import { User } from "../../models/index.js";

function permissionCodeOf(permission) {
  const code = permission?.code || permission?.permissionCode || permission?.slug || permission?.name;
  return String(code || "").trim().toLowerCase();
}

function uniquePermissionCodes(permissions = []) {
  return Array.from(
    new Set(
      permissions
        .map(permissionCodeOf)
        .filter(Boolean),
    ),
  );
}

export async function resolveAuthenticatedUserFromRequest(request) {
  const rawAuth = request.headers?.authorization || request.headers?.Authorization || "";
  const parts = String(rawAuth).trim().split(/\s+/);
  const token = parts[0]?.toLowerCase() === "bearer" ? parts[1] : null;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: process.env.JWT_ISSUER || "cohan-system",
    });

    const userId = String(payload.id || payload.sub || payload.userId || "");
    if (!userId) return null;

    const userDoc = await User.findById(userId)
      .populate({
        path: "role",
        populate: [
          { path: "permissions" },
          { path: "parentRole", populate: { path: "permissions" } },
        ],
      })
      .lean({ virtuals: true });
    if (!userDoc || userDoc.status !== "active") return null;

    const rolePermissions = Array.isArray(userDoc.role?.permissions)
      ? userDoc.role.permissions
      : [];
    const parentPermissions = Array.isArray(userDoc.role?.parentRole?.permissions)
      ? userDoc.role.parentRole.permissions
      : [];
    const effectivePermissions = [...parentPermissions, ...rolePermissions];
    const effectivePermissionCodes = uniquePermissionCodes(effectivePermissions);

    return {
      id: String(userDoc._id),
      email: userDoc.email,
      fullName: userDoc.fullName,
      role: userDoc.role,
      roleName: String(userDoc.role?.slug || userDoc.role?.name || "").toLowerCase(),
      userType: userDoc.userType,
      status: userDoc.status,
      emailVerified: userDoc.emailVerified,
      phoneVerified: userDoc.phoneVerified,
      forcePasswordChange: userDoc.forcePasswordChange,
      provider: userDoc.provider,
      refRestaurants: userDoc.refRestaurants,
      permissions: rolePermissions,
      effectivePermissions,
      effectivePermissionCodes,
      point: userDoc.point,
      loyaltyPoints: userDoc.loyaltyPoints,
      customerType: userDoc.customerType,
      totalOrders: userDoc.totalOrders,
      totalSpending: userDoc.totalSpending,
    };
  } catch (err) {
    request.log?.warn({ code: err?.name || "JWT_VERIFY_FAILED" }, "JWT verify failed; user = null");
    return null;
  }
}
