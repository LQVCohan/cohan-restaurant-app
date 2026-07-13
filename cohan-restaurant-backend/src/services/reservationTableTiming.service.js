import mongoose from "mongoose";

import { Order, Reservation, Table } from "../../models/index.js";
import { ACTIVE_RESERVATION_STATUSES } from "../../utils/tableStateGuards.js";
import {
  ACTIVE_TABLE_SESSION_SORT,
  activeTableSessionLookupFilter,
} from "../../utils/orderLifecycle.js";

export const RESERVATION_ARRIVAL_GRACE_MINUTES = 15;
const STAFF_VISIBLE_RESERVATION_STATUSES = [
  "pending_payment",
  "confirmed",
  "pending_change",
];
const TABLE_OWNED_RESERVATION_STATUSES = ["reserved", "payment_pending"];

const toDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const reservationGraceEndsAt = (reservation) => {
  const arrival = toDate(reservation?.timeTo);
  if (!arrival) return null;
  return new Date(arrival.getTime() + RESERVATION_ARRIVAL_GRACE_MINUTES * 60_000);
};

export function getReservationTimingPhase(reservation, now = new Date()) {
  const arrival = toDate(reservation?.timeTo);
  if (!arrival) return null;
  const graceEndsAt = reservationGraceEndsAt(reservation);
  if (now < arrival) return "upcoming";
  if (graceEndsAt && now <= graceEndsAt) return "waiting";
  return "overdue";
}

export function reservationShouldOwnPhysicalTable(reservation, now = new Date()) {
  const phase = getReservationTimingPhase(reservation, now);
  return phase === "waiting" || phase === "overdue";
}

async function findNextStaffVisibleReservation(tableId, restaurantId, now = new Date()) {
  if (!mongoose.isValidObjectId(tableId) || !mongoose.isValidObjectId(restaurantId)) {
    return null;
  }

  const graceFloor = new Date(
    now.getTime() - RESERVATION_ARRIVAL_GRACE_MINUTES * 60_000,
  );

  return Reservation.findOne({
    restaurantId,
    tableId,
    status: { $in: STAFF_VISIBLE_RESERVATION_STATUSES },
    timeTo: { $gte: graceFloor },
  })
    .sort({ timeTo: 1, _id: 1 })
    .lean({ virtuals: true });
}

async function hasActiveTableSession({ restaurantId, tableId, tableCode }) {
  const safeCode = String(tableCode || "").trim().toUpperCase();
  const session = await Order.findOne(
    activeTableSessionLookupFilter({
      restaurantId,
      tableId,
      tableCode: safeCode || null,
    }),
  )
    .sort(ACTIVE_TABLE_SESSION_SORT)
    .select({ _id: 1 })
    .lean();
  return Boolean(session?._id);
}

export async function getTableReservationSnapshot(table, ctx = null, now = new Date()) {
  const actor = ctx?.auth?.user || ctx?.user || null;
  if (!actor) return null;

  const tableId = table?._id || table?.id;
  const restaurantId = table?.restaurantId;
  const reservation = await findNextStaffVisibleReservation(
    tableId,
    restaurantId,
    now,
  );
  if (!reservation) return null;

  const phase = getReservationTimingPhase(reservation, now);
  const graceEndsAt = reservationGraceEndsAt(reservation);

  return {
    reservationId: String(reservation._id),
    reservationOrderCode: reservation.orderCode || null,
    reservationStatus: reservation.status || null,
    reservationPhase: phase,
    nextReservationAt: reservation.timeTo || null,
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

export async function synchronizeReservationOwnedTableState(reservation) {
  const tableId = reservation?.tableId;
  const restaurantId = reservation?.restaurantId;
  if (!mongoose.isValidObjectId(tableId) || !mongoose.isValidObjectId(restaurantId)) {
    return;
  }

  const table = await Table.findOne({ _id: tableId, restaurantId })
    .select({ _id: 1, code: 1, status: 1, restaurantId: 1 })
    .lean();
  if (!table) return;

  const sessionActive = await hasActiveTableSession({
    restaurantId,
    tableId,
    tableCode: table.code,
  });
  if (sessionActive) return;

  const dueReservation = await Reservation.findOne({
    restaurantId,
    tableId,
    status: { $in: ACTIVE_RESERVATION_STATUSES },
    timeTo: { $lte: new Date() },
  })
    .sort({ timeTo: 1, _id: 1 })
    .lean();

  if (dueReservation && reservationShouldOwnPhysicalTable(dueReservation)) {
    if (!["offline", "occupied", "cleaning"].includes(String(table.status))) {
      await Table.updateOne({ _id: tableId }, { $set: { status: "reserved" } });
    }
    return;
  }

  if (TABLE_OWNED_RESERVATION_STATUSES.includes(String(table.status))) {
    await Table.updateOne(
      { _id: tableId, status: { $in: TABLE_OWNED_RESERVATION_STATUSES } },
      { $set: { status: "available" } },
    );
  }
}

export function withReservationTableTimingPolicy(mutations = {}) {
  const wrapped = { ...mutations };
  const names = [
    "createReservation",
    "submitReservationPayment",
    "updateReservationStatus",
    "cancelReservation",
    "deleteReservation",
    "markReservationNoShow",
    "changeReservationTable",
    "requestReservationChange",
    "approveReservationChange",
    "rejectReservationChange",
    "checkInReservation",
  ];

  for (const name of names) {
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
