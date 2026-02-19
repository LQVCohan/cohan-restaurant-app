// src/graphql/context.js
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { createLoaders } from "./loaders/index.js"; // DataLoader per-request

export default async function buildContext(request, reply) {
  let user = null;

  // 1) Lấy Bearer token từ header
  const rawAuth =
    request.headers?.authorization || request.headers?.Authorization || "";
  const parts = rawAuth.trim().split(/\s+/); // ["Bearer", "<token>"]
  const token = parts[0]?.toLowerCase() === "bearer" ? parts[1] : null;

  // 2) Verify & tải user
  if (token) {
    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      // chấp nhận id ở nhiều key: id | sub | userId
      const userId = String(payload.id || payload.sub || payload.userId || "");
      if (userId) {
        const userDoc = await User.findById(userId)
          .populate("role")
          .lean({ virtuals: true });

        if (userDoc) {
          const roleName = (
            userDoc.role?.slug ||
            userDoc.role?.name ||
            ""
          ).toLowerCase();

          user = {
            id: String(userDoc._id),
            email: userDoc.email,
            fullName: userDoc.fullName,
            role: userDoc.role, // object đã populate
            roleName, // string, ví dụ "admin"
            status: userDoc.status,
            provider: userDoc.provider,
            refRestaurants: userDoc.refRestaurants,
            point: userDoc.point,
            loyaltyPoints: userDoc.loyaltyPoints,
            customerType: userDoc.customerType,
            totalOrders: userDoc.totalOrders,
            totalSpending: userDoc.totalSpending,
          };
        }
      }
    } catch (err) {
      // token không hợp lệ/hết hạn → user = null
      request.log?.warn({ err }, "JWT verify failed; user = null");
    }
  }


  if (user?.id) {
    request.userId = user.id;
  }
  if (user) {
    request.log?.info({ userId: user.id, role: user.roleName }, "Context user");
  } else {
    request.log?.info("Context user = null");
  }

  return {
    user,
    loaders: createLoaders ? createLoaders() : undefined, // per-request
    request,
    reply,
  };
}
