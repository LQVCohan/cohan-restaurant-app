// src/graphql/order/query.js
import mongoose from "mongoose";
import { Order, User } from "../../../models/index.js";

function toObjectIdOrNull(id) {
  if (!id) return null;
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
}

export const OrderQuery = {
  // Lấy 1 order theo id
  async order(_, { id }) {
    if (!mongoose.isValidObjectId(id)) return null;
    // dùng lean để nhanh, field con sẽ được resolver Order.customer xử lý tiếp
    const doc = await Order.findById(id).lean({ virtuals: true });
    return doc || null;
  },

  // Lấy danh sách order theo nhà hàng (phân trang cursor)
  async ordersByRestaurant(_, { restaurantId, limit = 20, cursor }) {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }

    const filter = {
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
    };

    const cursorId = toObjectIdOrNull(cursor);
    if (cursorId) {
      filter._id = { ...(filter._id || {}), $gt: cursorId };
    }

    const docs = await Order.find(filter)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .lean({ virtuals: true });

    const hasNextPage = docs.length > limit;
    const slice = hasNextPage ? docs.slice(0, -1) : docs;

    return {
      edges: slice.map((d) => ({ node: d, cursor: String(d._id) })),
      pageInfo: {
        endCursor: slice.length ? String(slice[slice.length - 1]._id) : null,
        hasNextPage,
      },
    };
  },

  // Lấy danh sách order theo user
  async ordersByUser(_, { userId, limit = 20, cursor }) {
    if (!mongoose.isValidObjectId(userId)) {
      throw new Error("Invalid userId");
    }

    const filter = {
      userId: new mongoose.Types.ObjectId(userId),
    };

    const cursorId = toObjectIdOrNull(cursor);
    if (cursorId) {
      filter._id = { ...(filter._id || {}), $gt: cursorId };
    }

    const docs = await Order.find(filter)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .lean({ virtuals: true });

    const hasNextPage = docs.length > limit;
    const slice = hasNextPage ? docs.slice(0, -1) : docs;

    return {
      edges: slice.map((d) => ({ node: d, cursor: String(d._id) })),
      pageInfo: {
        endCursor: slice.length ? String(slice[slice.length - 1]._id) : null,
        hasNextPage,
      },
    };
  },

  // 👉 tiện cho POS: lấy order hiện tại theo restaurant + tableCode
  // (nếu bạn muốn dùng ở client thay vì query orders(filter:{tableCode}))
  async orderByTableCode(_, { restaurantId, tableCode, onlyActive = true }) {
    if (!restaurantId) throw new Error("restaurantId is required");
    if (!tableCode) throw new Error("tableCode is required");

    const filter = {
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
      tableCode, // bạn đã thêm field này vào model Order
    };

    if (onlyActive) {
      filter.currentStatus = { $in: ["confirmed", "preparing", "served"] };
    }

    const doc = await Order.findOne(filter)
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    return doc || null;
  },
};

/**
 * Các field-level resolvers cho type Order
 * để bạn có thể query:
 *
 *   order(id: "...") {
 *     id
 *     tableCode
 *     customer {
 *       id
 *       fullName
 *       phone
 *       email
 *     }
 *   }
 *
 * mà KHÔNG cần thay đổi cấu trúc MongoDB (vẫn dùng chung collection User).
 */
export const OrderResolvers = {
  Order: {
    // 👉 bổ sung field "customer" cho Order
    // Ưu tiên: userId -> User
    // Fallback: shipping.phone / shipping.email -> User
    async customer(order) {
      // 1. ưu tiên userId
      const userId = order.userId || order.user?.id;
      if (userId && mongoose.isValidObjectId(userId)) {
        const u = await User.findById(userId).lean();
        if (u) return u;
      }

      // 2. fallback: theo phone / email từ shipping
      const phone = order?.shipping?.phone?.trim();
      const rawEmail = order?.shipping?.email?.trim();
      const email = rawEmail ? rawEmail.toLowerCase() : null;

      if (phone || email) {
        const $or = [];
        if (phone) $or.push({ phone });
        if (email) $or.push({ email });

        const u = await User.findOne({ $or }).lean();
        if (u) return u;
      }

      // 3. không có => null
      return null;
    },
  },
};
