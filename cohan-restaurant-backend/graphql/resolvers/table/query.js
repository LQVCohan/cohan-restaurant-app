import mongoose from "mongoose";
import Table from "../../../models/table.model.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

async function requireTableListAccess(ctx, restaurantId) {
  await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.TABLE_READ);
}

async function cleanupExpiredViewLocks(restaurantId) {
  const now = new Date();
  const q = { "viewLock.expiresAt": { $lte: now } };
  if (restaurantId && mongoose.isValidObjectId(restaurantId)) q.restaurantId = restaurantId;
  await Table.updateMany(q, { $unset: { viewLock: 1 } }).catch(() => {});
}

export default {
  tables: async (
    _p,
    { restaurantId, floorId, status, type, search, limit },
    ctx,
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireTableListAccess(ctx, restaurantId);
    await cleanupExpiredViewLocks(restaurantId);
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
      .select({
        viewLock: 1,
        status: 1,
        capacity: 1,
        code: 1,
        floorId: 1,
        floorLevel: 1,
        position: 1,
        restaurantId: 1,
        type: 1,
        deposit: 1,
        vrUrl: 1,
        notes: 1,
        tags: 1,
        isJoinable: 1,
        joinGroupId: 1,
      })
      .sort({ floorLevel: 1, code: 1 })
      .limit(Math.min(limit ?? 200, 500))
      .lean({ virtuals: true });
  },

  tableByCode: async (_p, { restaurantId, floorId, code }, ctx) => {
    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(floorId)
    ) return null;
    await requireTableListAccess(ctx, restaurantId);
    await cleanupExpiredViewLocks(restaurantId);
    return Table.findOne({ restaurantId, floorId, code }).lean({
      virtuals: true,
    });
  },
};
