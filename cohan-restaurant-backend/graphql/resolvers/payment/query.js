// src/graphql/order/query.js
import mongoose from "mongoose";
import { Order } from "../../../models/index.js";

const toObjectId = (id) =>
  id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;

function buildFilter(filter = {}) {
  const q = {};

  if (filter.restaurantId) {
    const rid = toObjectId(filter.restaurantId);
    if (rid) q.restaurantId = rid;
  }

  if (filter.tableCode) {
    q.tableCode = filter.tableCode;
  }

  if (filter.orderCode) {
    q.orderCode = filter.orderCode;
  }

  if (
    filter.statuses &&
    Array.isArray(filter.statuses) &&
    filter.statuses.length
  ) {
    q.currentStatus = { $in: filter.statuses };
  } else if (filter.status) {
    q.currentStatus = filter.status;
  }

  // date range
  if (filter.dateFrom || filter.dateTo) {
    q.createdAt = {};
    if (filter.dateFrom) q.createdAt.$gte = new Date(filter.dateFrom);
    if (filter.dateTo) q.createdAt.$lte = new Date(filter.dateTo);
  }

  // keyword: tìm sơ bộ theo orderCode / tableCode
  if (filter.keyword) {
    const kw = filter.keyword.trim();
    q.$or = [
      { orderCode: { $regex: kw, $options: "i" } },
      { tableCode: { $regex: kw, $options: "i" } },
    ];
  }

  return q;
}

export const OrderQuery = {
  // GET /order?id=...
  async order(_, { id }) {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await Order.findById(id).lean({ virtuals: true });
    return doc || null;
  },

  // ✅ cái client của bạn đang gọi đây
  async orders(_, { filter = {}, limit = 50, offset = 0 }) {
    const q = buildFilter(filter);
    const [items, totalCount] = await Promise.all([
      Order.find(q)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean({ virtuals: true }),
      Order.countDocuments(q),
    ]);

    return {
      items,
      totalCount,
    };
  },

  // Giữ nguyên dạng connection cũ
  async ordersByRestaurant(_, { restaurantId, limit = 20, cursor }) {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }
    const f = { restaurantId: new mongoose.Types.ObjectId(restaurantId) };
    if (cursor && mongoose.isValidObjectId(cursor)) {
      f._id = { $gt: new mongoose.Types.ObjectId(cursor) };
    }

    const docs = await Order.find(f)
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

  async ordersByUser(_, { userId, limit = 20, cursor }) {
    if (!mongoose.isValidObjectId(userId)) {
      throw new Error("Invalid userId");
    }
    const f = { userId: new mongoose.Types.ObjectId(userId) };
    if (cursor && mongoose.isValidObjectId(cursor)) {
      f._id = { $gt: new mongoose.Types.ObjectId(cursor) };
    }

    const docs = await Order.find(f)
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

  // 👇 cái bạn hỏi "orderByTableCode khai báo ở schema như thế nào"
  // đây chính là resolver của nó
  async ordersByTableCode(
    _,
    { restaurantId, tableCode, limit = 20, offset = 0 }
  ) {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }
    const q = {
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
      tableCode,
    };
    const [items, totalCount] = await Promise.all([
      Order.find(q)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean({ virtuals: true }),
      Order.countDocuments(q),
    ]);

    return { items, totalCount };
  },
};
