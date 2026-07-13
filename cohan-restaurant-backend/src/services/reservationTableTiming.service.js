import mongoose from "mongoose";

import Order from "../../models/order.model.js";
import Reservation from "../../models/reservation.model.js";
import Table from "../../models/table.model.js";
import { ACTIVE_RESERVATION_STATUSES } from "../../utils/tableStateGuards.js";
import {
  ACTIVE_TABLE_SESSION_SORT,
  activeTableSessionLookupFilter,
} from "../../utils/orderLifecycle.js";

export const RESERVATION_ARRIVAL_GRACE_MINUTES = 15;
const VISIBLE_STATUSES = ["pending_payment", "confirmed", "pending_change"];
const RESERVATION_OWNED_TABLE_STATUSES = ["reserved", "payment_pending"];

const validDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

export function getReservationTimingPhase(reservation, now = new Date()) {
  const arrivalAt = validDate(reservation?.timeTo);
  if (!arrivalAt) return null;
  const graceEndsAt = new Date(
    arrivalAt.getTime() + RESERVATION_ARRIVAL_GRACE_MINUTES * 60_000,
  );
  if (now < arrivalAt) return "upcoming";
  if (now <= graceEndsAt) return "waiting";
  return "expired";
}

async function nextReservation(table, now = new Date()) {
  const tableId = table?._id || table?.id;
  const restaurantId = table?.restaurantId;
  if (!mongoose.isValidObjectId(tableId) || !mongoose.isValidObjectId(restaurantId)) {
    return null;
  }

  const earliestVisible = new Date(
    now.getTime() - RESERVATION_ARRIVAL_GRACE_MINUTES * 60_000,
  );
  return Reservation.findOne({
    restaurantId,
    tableId,
    status: { $in: VISIBLE_STATUSES },
    timeTo: { $gte: earliestVisible },
  })
    .sort({ timeTo: 1, _id: 1 })
    .lean({ virtuals: true });
}

export async function getTableReservationSnapshot(table, ctx, now = new Date()) {
  if (!ctx?.user && !ctx?.auth?.user) return null;
  const reservation = await nextReservation(table, now);
  if (!reservation) return null;

  const arrivalAt = validDate(reservation.timeTo);
  const graceEndsAt = new Date(
    arrivalAt.getTime() + RESERVATION_ARRIVAL_GRACE_MINUTES * 60_000,
  );
  return {
    reservationId: String(reservation._id),
    reservationOrderCode: reservation.orderCode || null,
    reservationStatus: reservation.status || null,
    reservationPhase: getReservationTimingPhase(reservation, now),
    nextReservationAt: arrivalAt,
    reservationGraceEndsAt: graceEndsAt,
    reservationCustomerName: reservation.customerName || null,
    reservationCustomerPhone: reservation.customerPhone || null,
    reservationCustomerEmail: reservation.customerEmail || null,
    reservationPartySize: Number(reservation.partySize || 0) || null,
  };
}

export function getCachedTableReservationSnapshot(table, ctx) {
  if (!table) return Promise.resolve(null);
  if (!Object.prototype.hasOwnProperty.call(table, "__reservationSnapshotPromise")) {
    Object.defineProperty(table, "__reservationSnapshotPromise", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: getTableReservationSnapshot(table, ctx),
    });
  }
  return table.__reservationSnapshotPromise;
}

async function hasActiveSession({ restaurantId, tableId, tableCode }) {
  const session = await Order.findOne(
    activeTableSessionLookupFilter({
      restaurantId,
      tableId,
      tableCode: String(tableCode || "").trim().toUpperCase() || null,
    }),
  )
    .sort(ACTIVE_TABLE_SESSION_SORT)
    .select({ _id: 1 })
    .lean();
  return Boolean(session?._id);
}

export async function synchronizeReservationOwnedTableState(reservation) {
  const tableId = reservation?.tableId;
  const restaurantId = reservation?.restaurantId;
  if (!mongoose.isValidObjectId(tableId) || !mongoose.isValidObjectId(restaurantId)) {
    return;
  }

  const table = await Table.findOne({ _id: tableId, restaurantId })
    .select({ _id: 1, code: 1, status: 1, restaurantId: 1 })
    .lean();
  if (!table || await hasActiveSession({
    restaurantId,
    tableId,
    tableCode: table.code,
  })) {
    return;
  }

  const dueReservation = await Reservation.findOne({
    restaurantId,
    tableId,
    status: { $in: ACTIVE_RESERVATION_STATUSES },
    timeTo: {
      $lte: new Date(),
      $gte: new Date(Date.now() - RESERVATION_ARRIVAL_GRACE_MINUTES * 60_000),
    },
  })
    .sort({ timeTo: 1, _id: 1 })
    .lean();

  if (dueReservation) {
    if (!["offline", "occupied", "cleaning"].includes(String(table.status))) {
      await Table.updateOne({ _id: tableId }, { $set: { status: "reserved" } });
    }
    return;
  }

  if (RESERVATION_OWNED_TABLE_STATUSES.includes(String(table.status))) {
    await Table.updateOne(
      { _id: tableId, status: { $in: RESERVATION_OWNED_TABLE_STATUSES } },
      { $set: { status: "available" } },
    );
  }
}

export function withReservationTableTimingPolicy(mutations = {}) {
  const wrapped = { ...mutations };
  for (const name of [
    "createReservation",
    "submitReservationPayment",
    "updateReservationStatus",
    "cancelReservation",
    "deleteReservation",
    "markReservationNoShow",
    "changeReservationTable",
    "approveReservationChange",
    "rejectReservationChange",
    "checkInReservation",
  ]) {
    const resolver = mutations[name];
    if (typeof resolver !== "function") continue;
    wrapped[name] = async (...args) => {
      const result = await resolver(...args);
      await synchronizeReservationOwnedTableState(result).catch(() => {});
      return result;
    };
  }
  return wrapped;
}
