import mongoose from "mongoose";
import Supplier from "../../../models/supplier.model.js";
import { requireRole } from "../../../utils/authz.js";

function escapeRegex(input) {
  return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default {
  suppliers: async (_p, { filter, limit = 6, cursor }, ctx) => {
    requireRole(ctx?.user, ["admin", "manager", "staff"]);
    const lim = Math.min(Math.max(limit || 6, 1), 50);
    const q = {};

    if (filter?.search?.trim()) {
      const rx = new RegExp(escapeRegex(filter.search.trim()), "i");
      q.$or = [{ name: rx }, { contact: rx }, { phone: rx }, { email: rx }];
    }

    if (filter?.tag?.trim()) {
      q.tags = filter.tag.trim();
    }

    if (cursor && mongoose.isValidObjectId(cursor)) {
      q._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const rows = await Supplier.find(q)
      .sort({ reliabilityScore: -1, updatedAt: -1, _id: -1 })
      .limit(lim + 1)
      .lean();

    const hasNextPage = rows.length > lim;
    const slice = hasNextPage ? rows.slice(0, lim) : rows;

    return {
      edges: slice,
      total: await Supplier.countDocuments(q),
      pageInfo: {
        endCursor: slice.length ? String(slice[slice.length - 1]._id) : null,
        hasNextPage,
      },
    };
  },

  supplier: async (_p, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return null;
    requireRole(ctx?.user, ["admin", "manager", "staff"]);
    return Supplier.findById(id).lean();
  },
};
