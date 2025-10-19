// src/graphql/order/query.js
import mongoose from "mongoose";
import { Order } from "../../../models/index.js";

function toObjectIdOrNull(id) {
  if (!id) return null;
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
}

export const OrderQuery = {
  async order(_, { id }) {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await Order.findById(id).lean({ virtuals: true });
    return doc || null;
  },

  async ordersByRestaurant(_, { restaurantId, limit = 20, cursor }) {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }
    const f = { restaurantId: new mongoose.Types.ObjectId(restaurantId) };
    const cId = toObjectIdOrNull(cursor);
    if (cId) f._id = { ...(f._id || {}), $gt: cId };

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
    const cId = toObjectIdOrNull(cursor);
    if (cId) f._id = { ...(f._id || {}), $gt: cId };

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
};
