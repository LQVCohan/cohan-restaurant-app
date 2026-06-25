import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { Reservation } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

function badInput(msg) {
  return new GraphQLError(msg, { extensions: { code: "BAD_USER_INPUT" } });
}
function unauth(msg = "Unauthorized") {
  return new GraphQLError(msg, { extensions: { code: "UNAUTHENTICATED" } });
}

function toObjectId(id) {
  if (!id || !mongoose.isValidObjectId(id)) throw badInput("Invalid ID");
  return new mongoose.Types.ObjectId(id);
}

function isAdminOrStaffLike(ctx) {
  const role = String(ctx?.user?.roleName || ctx?.user?.role || "").toLowerCase();
  return role.includes("staff") || role.includes("manager") || role.includes("admin");
}

function isReservationOwner(ctx, reservation) {
  const userId = ctx?.auth?.user?.id || ctx?.user?.id;
  return userId && String(reservation?.userId) === String(userId);
}

export const ReservationQuery = {
  async activeReservationByTable(_, { restaurantId, tableId }, ctx) {
    if (!restaurantId || !tableId)
      throw badInput("restaurantId and tableId are required");
    const rId = toObjectId(restaurantId);
    const tId = toObjectId(tableId);
    await requireRestaurantPermission(ctx, rId, PERMISSIONS.RESERVATION_READ);
    const activeStatuses = ["pending_payment", "confirmed", "seated", "pending_change"];
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const pendingChange = await Reservation.findOne({
      restaurantId: rId,
      tableId: tId,
      status: "pending_change",
      timeTo: { $gte: twoHoursAgo },
    }).sort({ timeTo: 1, _id: 1 }).lean({ virtuals: true });
    if (pendingChange) return pendingChange;
    let doc = await Reservation.findOne({
      restaurantId: rId,
      tableId: tId,
      status: { $in: activeStatuses },
      timeTo: { $gte: twoHoursAgo },
    }).sort({ timeTo: 1, _id: 1 }).lean({ virtuals: true });
    if (!doc) {
      doc = await Reservation.findOne({
        restaurantId: rId,
        tableId: tId,
        status: { $in: activeStatuses },
      }).sort({ timeTo: -1, _id: -1 }).lean({ virtuals: true });
    }
    return doc || null;
  },
  async reservation(_, { id, orderCode }, ctx) {
    const authorize = async (doc) => {
      if (!doc) return null;
      if (isReservationOwner(ctx, doc)) return doc;
      if (isAdminOrStaffLike(ctx)) {
        await requireRestaurantPermission(ctx, doc.restaurantId, PERMISSIONS.RESERVATION_READ);
        return doc;
      }
      throw new GraphQLError("Unauthorized", { extensions: { code: "FORBIDDEN" } });
    };

    if (id) {
      if (!mongoose.isValidObjectId(id)) throw badInput("Invalid ID");
      const doc = await Reservation.findById(id).lean({ virtuals: true });
      return authorize(doc);
    }
    if (orderCode) {
      const doc = await Reservation.findOne({ orderCode: String(orderCode).trim() })
        .sort({ createdAt: -1 })
        .lean({ virtuals: true });
      return authorize(doc);
    }
    return null;
  },

  async myReservations(_, { limit = 20, cursor }, ctx) {
    const userId = ctx?.auth?.user?.id || ctx?.user?.id;
    if (!userId) throw unauth();

    const f = { userId: toObjectId(userId) };
    if (cursor && mongoose.isValidObjectId(cursor)) {
      f._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    return Reservation.find(f)
      .sort({ _id: -1 })
      .limit(Math.max(1, Math.min(Number(limit || 20), 100)))
      .lean({ virtuals: true });
  },

  async pendingReservationChanges(_, { restaurantId, limit = 50 }, ctx) {
    const rId = toObjectId(restaurantId);
    await requireRestaurantPermission(ctx, rId, PERMISSIONS.RESERVATION_READ);
    return Reservation.find({
      restaurantId: rId,
      status: "pending_change",
      changeRequestStatus: "requested",
    })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(Math.max(1, Math.min(Number(limit || 50), 100)))
      .lean({ virtuals: true });
  },

  async confirmedReservationByTable(_, { restaurantId, tableId }, ctx) {
    return ReservationQuery.activeReservationByTable(_, { restaurantId, tableId }, ctx);
  },
};
