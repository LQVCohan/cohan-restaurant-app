import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { Reservation, ReservationSlotLock, Table } from "../../models/index.js";

const ACTIVE_RESERVATION_STATUSES = ["pending_payment", "confirmed", "seated", "pending_change"];
const ACTIVE_LOCK_STATUSES = ["holding", "confirmed"];

function toObjectId(value, fieldName) {
  if (!value || !mongoose.isValidObjectId(value)) {
    throw new GraphQLError(`Invalid ${fieldName}`, { extensions: { code: "BAD_USER_INPUT" } });
  }
  return new mongoose.Types.ObjectId(value);
}

function overlapQuery(slotStart, slotEnd) {
  return {
    slotStart: { $lt: slotEnd },
    slotEnd: { $gt: slotStart },
  };
}

function emitReservationExpiryEvents(io, expiredReservations, now) {
  if (!io?.to || !expiredReservations?.length) return;

  const byRestaurant = new Map();
  for (const reservation of expiredReservations) {
    const restaurantId = String(reservation.restaurantId || "");
    if (!restaurantId) continue;
    if (!byRestaurant.has(restaurantId)) byRestaurant.set(restaurantId, []);
    byRestaurant.get(restaurantId).push(reservation);
  }

  for (const [restaurantId, reservations] of byRestaurant.entries()) {
    io.to(`restaurant_${restaurantId}`).emit("reservationEvents", {
      type: "RESERVATION_PAYMENT_EXPIRED",
      restaurantId,
      reservationIds: reservations.map((item) => String(item._id)),
      reservations: reservations.map((item) => ({
        id: String(item._id),
        _id: String(item._id),
        restaurantId: String(item.restaurantId),
        tableId: item.tableId ? String(item.tableId) : null,
        userId: item.userId ? String(item.userId) : null,
        status: "cancelled",
        depositStatus: "cancelled",
      })),
      emittedAt: now.toISOString(),
    });
  }
}

export function calcReservationEnd(start, durationMinutes, isUnlimitedTime) {
  if (isUnlimitedTime) return null;
  return new Date(start.getTime() + Number(durationMinutes || 60) * 60 * 1000);
}

export async function checkTableReservationConflict({ tableId, slotStart, slotEnd, exceptReservationId = null, session = null }) {
  const now = new Date();
  const tableObjectId = toObjectId(tableId, "tableId");
  const start = new Date(slotStart);
  const end = new Date(slotEnd);

  const reservationQuery = {
    tableId: tableObjectId,
    status: { $in: ACTIVE_RESERVATION_STATUSES },
    timeTo: { $lt: end },
  };
  if (exceptReservationId) reservationQuery._id = { $ne: toObjectId(exceptReservationId, "reservationId") };

  const activeReservations = await Reservation.find(
    reservationQuery,
    { _id: 1, timeTo: 1, durationMinutes: 1, isUnlimitedTime: 1 },
    session ? { session } : undefined
  ).lean();

  for (const reservation of activeReservations) {
    const reservationStart = new Date(reservation.timeTo);
    const reservationEnd = calcReservationEnd(
      reservationStart,
      Number(reservation.durationMinutes || 60),
      !!reservation.isUnlimitedTime
    );

    if (!reservationEnd || reservationStart < end) {
      if (!reservationEnd || reservationEnd > start) {
        throw new GraphQLError("Table has conflicting reservation time", {
          extensions: { code: "TABLE_TIME_CONFLICT" },
        });
      }
    }
  }

  const lockQuery = {
    tableId: tableObjectId,
    status: { $in: ACTIVE_LOCK_STATUSES },
    ...overlapQuery(start, end),
    $or: [{ expiresAt: { $gt: now } }, { status: "confirmed" }],
  };
  if (exceptReservationId) lockQuery.reservationId = { $ne: toObjectId(exceptReservationId, "reservationId") };

  const existingLock = await ReservationSlotLock.findOne(lockQuery, { _id: 1, status: 1 }, session ? { session } : undefined).lean();
  if (existingLock) {
    throw new GraphQLError("Table slot is already held", {
      extensions: { code: "TABLE_SLOT_HELD" },
    });
  }
}

export async function holdReservationSlot({
  restaurantId,
  tableId,
  userId,
  customerKey,
  reservationId,
  slotStart,
  slotEnd,
  holdMinutes = 10,
  session = null,
}) {
  const start = new Date(slotStart);
  const end = new Date(slotEnd);
  await checkTableReservationConflict({
    tableId,
    slotStart: start,
    slotEnd: end,
    exceptReservationId: reservationId,
    session,
  });

  const expiresAt = new Date(Date.now() + Number(holdMinutes || 10) * 60 * 1000);
  return ReservationSlotLock.findOneAndUpdate(
    { reservationId: toObjectId(reservationId, "reservationId") },
    {
      $set: {
        restaurantId: toObjectId(restaurantId, "restaurantId"),
        tableId: toObjectId(tableId, "tableId"),
        reservationId: toObjectId(reservationId, "reservationId"),
        userId: userId && mongoose.isValidObjectId(userId) ? toObjectId(userId, "userId") : undefined,
        customerKey: customerKey || undefined,
        slotStart: start,
        slotEnd: end,
        status: "holding",
        expiresAt,
      },
    },
    { upsert: true, new: true, session }
  );
}

export async function confirmReservationSlot({ reservationId, session = null }) {
  return ReservationSlotLock.updateMany(
    { reservationId: toObjectId(reservationId, "reservationId"), status: { $in: ["holding", "confirmed"] } },
    { $set: { status: "confirmed" }, $unset: { expiresAt: 1 } },
    session ? { session } : undefined
  );
}

export async function releaseReservationSlot({ reservationId, reason = "released", session = null }) {
  const status = reason === "cancelled" || reason === "no_show" ? "cancelled" : reason === "expired" ? "expired" : "released";
  return ReservationSlotLock.updateMany(
    { reservationId: toObjectId(reservationId, "reservationId"), status: { $in: ["holding", "confirmed"] } },
    { $set: { status, expiresAt: new Date() } },
    session ? { session } : undefined
  );
}

export async function expirePendingReservationPayments({ io } = {}) {
  const now = new Date();
  const expiredReservations = await Reservation.find({
    status: "pending_payment",
    pendingPaymentExpiresAt: { $lte: now },
  }).select({ _id: 1, tableId: 1, restaurantId: 1, userId: 1 }).lean();

  if (!expiredReservations.length) return { modifiedCount: 0 };

  const reservationIds = expiredReservations.map((item) => item._id);
  const tableIds = [...new Set(expiredReservations.map((item) => String(item.tableId)))];

  const updateResult = await Reservation.updateMany(
    { _id: { $in: reservationIds }, status: "pending_payment" },
    {
      $set: { status: "cancelled", depositStatus: "cancelled" },
      $unset: { pendingPaymentExpiresAt: 1 },
    }
  );

  for (const reservationId of reservationIds) {
    await releaseReservationSlot({ reservationId, reason: "expired" });
  }

  for (const tableId of tableIds) {
    const hasActive = await Reservation.exists({ tableId, status: { $in: ["pending_payment", "confirmed", "seated"] } });
    if (!hasActive) await Table.updateOne({ _id: tableId }, { $set: { status: "available" } }).catch(() => {});
  }

  emitReservationExpiryEvents(io, expiredReservations, now);

  return updateResult;
}