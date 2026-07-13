import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import {
  Reservation,
  ReservationSlotLock,
  Restaurant,
  Table,
} from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { calcReservationEnd } from "../../../src/services/reservationAvailability.service.js";
import { computeRestaurantAvailability } from "../../../src/services/restaurantAvailability.service.js";

const PUBLIC_ACTIVE_RESERVATION_STATUSES = [
  "pending_payment",
  "confirmed",
  "seated",
  "pending_change",
];
const PUBLIC_ACTIVE_LOCK_STATUSES = ["holding", "confirmed"];
const MAX_PUBLIC_SLOT_RANGE_MS = 48 * 60 * 60 * 1000;

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

function parsePublicSlotRange(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start ||
    end.getTime() - start.getTime() > MAX_PUBLIC_SLOT_RANGE_MS
  ) {
    throw badInput("Invalid availability range");
  }
  return { start, end };
}

async function requirePublicBookingTable(restaurantId, tableId) {
  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    businessStatus: "active",
    publicationStatus: "published",
  }).lean();
  const availability = restaurant
    ? computeRestaurantAvailability(restaurant)
    : null;
  if (!restaurant || availability?.canView === false) {
    throw new GraphQLError("Restaurant is not available", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  const table = await Table.exists({
    _id: tableId,
    restaurantId,
    mergedIntoTableId: null,
    status: { $ne: "offline" },
  });
  if (!table) {
    throw new GraphQLError("Table is not available", {
      extensions: { code: "NOT_FOUND" },
    });
  }
}

export function mergePublicReservationIntervals(intervals = []) {
  const normalized = intervals
    .map((interval) => {
      const start = new Date(interval?.start);
      const end = new Date(interval?.end);
      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
      ) {
        return null;
      }
      return { start, end };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged = [];
  for (const interval of normalized) {
    const previous = merged[merged.length - 1];
    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval });
      continue;
    }
    if (interval.end > previous.end) previous.end = interval.end;
  }
  return merged;
}

export const ReservationQuery = {
  async publicTableReservationSlots(_, { restaurantId, tableId, from, to }) {
    const rId = toObjectId(restaurantId);
    const tId = toObjectId(tableId);
    const { start: rangeStart, end: rangeEnd } = parsePublicSlotRange(from, to);
    await requirePublicBookingTable(rId, tId);

    const now = new Date();
    const [reservations, locks] = await Promise.all([
      Reservation.find({
        restaurantId: rId,
        tableId: tId,
        status: { $in: PUBLIC_ACTIVE_RESERVATION_STATUSES },
        timeTo: { $lt: rangeEnd },
      })
        .select({
          timeTo: 1,
          durationMinutes: 1,
          isUnlimitedTime: 1,
          status: 1,
          pendingPaymentExpiresAt: 1,
        })
        .lean(),
      ReservationSlotLock.find({
        restaurantId: rId,
        tableId: tId,
        status: { $in: PUBLIC_ACTIVE_LOCK_STATUSES },
        slotStart: { $lt: rangeEnd },
        slotEnd: { $gt: rangeStart },
        $or: [{ status: "confirmed" }, { expiresAt: { $gt: now } }],
      })
        .select({ slotStart: 1, slotEnd: 1 })
        .lean(),
    ]);

    const intervals = [];
    for (const reservation of reservations) {
      if (
        reservation.status === "pending_payment" &&
        reservation.pendingPaymentExpiresAt &&
        new Date(reservation.pendingPaymentExpiresAt) <= now
      ) {
        continue;
      }

      const reservationStart = new Date(reservation.timeTo);
      const calculatedEnd = calcReservationEnd(
        reservationStart,
        Number(reservation.durationMinutes || 60),
        Boolean(reservation.isUnlimitedTime),
      );
      const reservationEnd = calculatedEnd || rangeEnd;
      if (reservationEnd <= rangeStart) continue;

      intervals.push({
        start: reservationStart < rangeStart ? rangeStart : reservationStart,
        end: reservationEnd > rangeEnd ? rangeEnd : reservationEnd,
      });
    }

    for (const lock of locks) {
      const lockStart = new Date(lock.slotStart);
      const lockEnd = new Date(lock.slotEnd);
      intervals.push({
        start: lockStart < rangeStart ? rangeStart : lockStart,
        end: lockEnd > rangeEnd ? rangeEnd : lockEnd,
      });
    }

    return mergePublicReservationIntervals(intervals);
  },

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
