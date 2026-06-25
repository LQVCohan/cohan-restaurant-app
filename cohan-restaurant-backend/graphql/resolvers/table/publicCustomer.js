import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import Table from "../../../models/table.model.js";
import { Restaurant } from "../../../models/index.js";
import { computeRestaurantAvailability } from "../../../src/services/restaurantAvailability.service.js";

async function requirePublicRestaurant(restaurantId) {
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw new GraphQLError("Invalid restaurantId", { extensions: { code: "BAD_USER_INPUT" } });
  }

  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    businessStatus: "active",
    publicationStatus: "published",
  }).lean();

  if (!restaurant) {
    throw new GraphQLError("Restaurant is not available", { extensions: { code: "NOT_FOUND" } });
  }

  const availability = computeRestaurantAvailability(restaurant || {});
  if (availability.canReserve !== true && availability.canView === false) {
    throw new GraphQLError("Restaurant is not available for table booking", {
      extensions: { code: "RESTAURANT_NOT_RESERVABLE" },
    });
  }

  return restaurant;
}

function resolveViewerId(ctx, input = {}) {
  const uid = input.userId || ctx?.auth?.user?.id || ctx?.user?.id || ctx?.user?._id;
  if (uid && mongoose.isValidObjectId(uid)) return new mongoose.Types.ObjectId(uid);

  const sessionId = String(input.sessionId || "").trim();
  if (!sessionId) {
    throw new GraphQLError("Missing userId or sessionId", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return null;
}

function buildLockOwnerMatch({ uid, sessionId }) {
  const or = [
    { "viewLock.expiresAt": { $lte: new Date() } },
    { viewLock: { $exists: false } },
  ];
  if (uid) or.unshift({ "viewLock.userId": uid });
  if (sessionId) or.unshift({ "viewLock.sessionId": sessionId });
  return or;
}

export const CustomerPublicTableMutation = {
  async acquireTableViewLock(_p, { input }, ctx) {
    const { tableId, sessionId, viewerName } = input || {};
    if (!mongoose.isValidObjectId(tableId)) {
      throw new GraphQLError("Invalid tableId", { extensions: { code: "BAD_USER_INPUT" } });
    }

    const table = await Table.findById(tableId).lean();
    if (!table) throw new GraphQLError("Table not found", { extensions: { code: "NOT_FOUND" } });
    await requirePublicRestaurant(table.restaurantId);

    const uid = resolveViewerId(ctx, input);
    const safeSessionId = String(sessionId || "").trim() || null;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    const lock = table.viewLock || null;
    const lockActive = lock?.expiresAt && new Date(lock.expiresAt) > now;
    const sameViewer =
      (uid && lock?.userId && String(lock.userId) === String(uid)) ||
      (safeSessionId && lock?.sessionId && String(lock.sessionId) === safeSessionId);

    if (lockActive && !sameViewer) {
      throw new GraphQLError("Bàn đang được khách khác xem trong 5 phút.", {
        extensions: { code: "TABLE_VIEW_LOCKED" },
      });
    }

    const updated = await Table.findOneAndUpdate(
      {
        _id: tableId,
        $or: buildLockOwnerMatch({ uid, sessionId: safeSessionId }),
      },
      {
        $set: {
          viewLock: {
            ...(uid ? { userId: uid } : {}),
            expiresAt,
            sessionId: safeSessionId,
            viewerName: viewerName || "Khách",
          },
        },
      },
      { new: true },
    ).lean({ virtuals: true });

    if (!updated) {
      throw new GraphQLError("Bàn đang được khách khác xem trong 5 phút.", {
        extensions: { code: "TABLE_VIEW_LOCKED" },
      });
    }

    if (ctx?.io) {
      ctx.io.to(`restaurant_${updated.restaurantId}`).emit("tableViewEvents", {
        type: "TABLE_VIEW_LOCKED",
        tableId: String(updated._id),
        userId: uid ? String(uid) : null,
        sessionId: safeSessionId,
        expiresAt: expiresAt.toISOString(),
      });
    }

    return updated;
  },

  async releaseTableViewLock(_p, { input }, ctx) {
    const { tableId, sessionId } = input || {};
    if (!mongoose.isValidObjectId(tableId)) {
      throw new GraphQLError("Invalid tableId", { extensions: { code: "BAD_USER_INPUT" } });
    }

    const table = await Table.findById(tableId).select({ restaurantId: 1, viewLock: 1 }).lean();
    if (!table) return null;
    await requirePublicRestaurant(table.restaurantId);

    const uid = resolveViewerId(ctx, input);
    const safeSessionId = String(sessionId || "").trim() || null;
    const ownerFilter = uid
      ? { "viewLock.userId": uid }
      : { "viewLock.sessionId": safeSessionId };

    const updated = await Table.findOneAndUpdate(
      { _id: tableId, ...ownerFilter },
      { $unset: { viewLock: 1 } },
      { new: true },
    ).lean({ virtuals: true });

    const result = updated || (await Table.findById(tableId).lean({ virtuals: true }));
    if (ctx?.io && result?.restaurantId) {
      ctx.io.to(`restaurant_${result.restaurantId}`).emit("tableViewEvents", {
        type: "TABLE_VIEW_RELEASED",
        tableId: String(tableId),
        userId: uid ? String(uid) : null,
        sessionId: safeSessionId,
      });
    }

    return result;
  },
};
