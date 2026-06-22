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

async function resolveManagedRestaurantIds(userId, roleName) {
  if (roleName !== "manager") return [];
  const models = await import("../../models/index.js");
  const Restaurant = models.Restaurant;
  if (typeof Restaurant?.find !== "function") return [];
  const restaurants = await Restaurant.find({ managerId: userId })
    .select({ _id: 1 })
    .lean();
  return restaurants.map((restaurant) => restaurant._id);
}

export async function resolveAuthenticatedUserFromRequest(request) {
  const rawAuth = request.headers?.authorization || request.headers?.Authorization || "";
  const parts = String(rawAuth).trim().split(/\s+/);
  const token = parts[0]?.toLowerCase() === "bearer" ? parts[1] : null;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: process.env.JWT_ISSUER || "foodhub-system",
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
    const roleName = String(userDoc.role?.slug || userDoc.role?.name || "").toLowerCase();
    const managedRestaurantIds = await resolveManagedRestaurantIds(userDoc._id, roleName);

    return {
      id: String(userDoc._id),
      email: userDoc.email,
      fullName: userDoc.fullName,
      role: userDoc.role,
      roleName,
      userType: userDoc.userType,
      status: userDoc.status,
      provider: userDoc.provider,
      refRestaurants: userDoc.refRestaurants,
      restaurantForStaff: userDoc.restaurantForStaff,
      restaurantId: userDoc.restaurantId,
      managedRestaurantIds,
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
