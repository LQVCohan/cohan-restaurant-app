import jwt from "jsonwebtoken";
import { User } from "../../models/index.js";

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

    const userDoc = await User.findById(userId).populate("role").lean({ virtuals: true });
    if (!userDoc || userDoc.status !== "active") return null;

    return {
      id: String(userDoc._id),
      email: userDoc.email,
      fullName: userDoc.fullName,
      role: userDoc.role,
      roleName: String(userDoc.role?.slug || userDoc.role?.name || "").toLowerCase(),
      userType: userDoc.userType,
      status: userDoc.status,
      provider: userDoc.provider,
      refRestaurants: userDoc.refRestaurants,
      restaurantForStaff: userDoc.restaurantForStaff,
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
