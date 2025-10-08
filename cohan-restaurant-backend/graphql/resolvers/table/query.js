import mongoose from "mongoose";
import Table from "../../../models/table.model.js";

export default {
  tables: async (
    _p,
    { restaurantId, floorId, status, type, search, limit }
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    const q = { restaurantId };

    if (floorId && mongoose.isValidObjectId(floorId)) q.floorId = floorId;
    if (status) q.status = status;
    if (type) q.type = type;
    if (search?.trim()) {
      q.$or = [
        { code: new RegExp(search.trim(), "i") },
        { notes: new RegExp(search.trim(), "i") },
        { tags: { $in: [new RegExp(search.trim(), "i")] } },
      ];
    }

    return Table.find(q)
      .select({ __v: 0 })
      .sort({ floorLevel: 1, code: 1 })
      .limit(Math.min(limit ?? 200, 500))
      .lean({ virtuals: true });
  },

  tableByCode: async (_p, { restaurantId, floorId, code }) => {
    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(floorId)
    )
      return null;
    return Table.findOne({ restaurantId, floorId, code }).lean({
      virtuals: true,
    });
  },
};
