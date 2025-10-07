import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import createLoaders from "./loaders/index.js"; // nếu bạn có DataLoader
import process from "process";

export default async function buildContext(request, reply) {
  let user = null;

  try {
    // 1) Lấy token từ header Authorization: Bearer <token>
    const auth = request.headers.authorization || request.headers.Authorization;
    let token = null;
    if (auth && auth.startsWith("Bearer ")) {
      token = auth.slice(7).trim();
    }

    // const token = request.cookies?.token || token;

    // 2) Verify JWT
    if (token) {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET || "dev_secret5"
      );
      // payload nên có userId / id khi tạo token
      const userDoc = await User.findById(payload.id)
        .populate("role")
        .lean({ virtuals: true });

      if (userDoc) {
        // 3) Chuẩn hoá roleNames để hasRole/requireRole hoạt động
        const roleName = (
          userDoc.role?.slug ||
          userDoc.role?.name ||
          ""
        ).toLowerCase();
        user = {
          id: String(userDoc._id),
          email: userDoc.email,
          fullName: userDoc.fullName,
          role: userDoc.role, // có thể là array object (đã populate)
          roleName, // array ['admin','manager',...]
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
  } catch (e) {
    request.log?.warn({ err: e }, "JWT verify failed; user = null");
    user = null;
  }
  if (user) {
    request.log.info({ userId: user.id, role: user.roleName }, "Context user");
  } else {
    request.log.info("Context user = null");
  }
  return {
    user,
    loaders: createLoaders?.(), // nếu bạn dùng
    request,
    reply,
  };
}
