import mongoose from "mongoose";

import {
  ACTIVE_TABLE_SESSION_SORT,
  activeTableSessionLookupFilter,
} from "../../utils/orderLifecycle.js";

export const RESERVATION_EARLY_CHECK_IN_MINUTES = 15;
export const RESERVATION_ARRIVAL_GRACE_MINUTES = 15;
const ACTIVE_RESERVATION_STATUSES = [
  "pending_payment",
  "confirmed",
  "seated",
  "pending_change",
];
const VISIBLE_STATUSES = ["pending_payment", "confirmed", "pending_change"];
const RESERVATION_OWNED_TABLE_STATUSES = ["reserved", "payment_pending"];

const validDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

export function getReservationEarliestCheckInAt(reservation) {
  const arrivalAt = validDate(reservation?.timeTo);
  if (!arrivalAt) return null;
  return new Date(
    arrivalAt.getTime() - RESERVATION_EARLY_CHECK_IN_MINUTES * 60_000,
  );
}

export function isReservationCheckInOpen(reservation, now = new Date()) {
  const earliestCheckInAt = getReservationEarliestCheckInAt(reservation);
  return Boolean(earliestCheckInAt && now >= earliestCheckInAt);
}

const loadRegisteredModel = async (modelName, modulePath) => {
  // Focused resolver tests replace mongoose with a deliberately small mock.
  // In that environment reservation enrichment is optional, so do not load a
  // complete model graph that the test did not request.
  if (!mongoose?.models) return null;
  if (mongoose.models[modelName]) return mongoose.models[modelName];
  const module = await import(modulePath);
  return module.default || mongoose.models[modelName] || null;
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

  const Reservation = await loadRegisteredModel(
    "Reservation",
    "../../models/reservation.model.js",
  );
  if (!Reservation) return null;

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
  const earliestCheckInAt = getReservationEarliestCheckInAt(reservation);
  const graceEndsAt = new Date(
    arrivalAt.getTime() + RESERVATION_ARRIVAL_GRACE_MINUTES * 60_000,
  );
  const depositAmount = Math.max(0, Number(reservation.depositAmount || 0));
  const linkedMenuSubtotal = Math.max(
    0,
    Number(reservation.linkedMenuSubtotal || 0),
  );
  const menuDepositAmount = Math.min(
    depositAmount,
    Math.max(0, Math.round(linkedMenuSubtotal * 0.5)),
  );
  const tableDepositAmount = Math.max(0, depositAmount - menuDepositAmount);

  return {
    reservationId: String(reservation._id),
    reservationOrderCode: reservation.orderCode || null,
    reservationStatus: reservation.status || null,
    reservationPhase: getReservationTimingPhase(reservation, now),
    nextReservationAt: arrivalAt,
    reservationEarliestCheckInAt: earliestCheckInAt,
    reservationCanCheckIn: Boolean(
      reservation.status === "confirmed" &&
        earliestCheckInAt &&
        now >= earliestCheckInAt,
    ),
    reservationGraceEndsAt: graceEndsAt,
    reservationCustomerName: reservation.customerName || null,
    reservationCustomerPhone: reservation.customerPhone || null,
    reservationCustomerEmail: reservation.customerEmail || null,
    reservationPartySize: Number(reservation.partySize || 0) || null,
    reservationDepositAmount: depositAmount,
    reservationTableDepositAmount: tableDepositAmount,
    reservationMenuDepositAmount: menuDepositAmount,
    reservationDepositStatus: reservation.depositStatus || null,
    reservationDepositAppliedAmount: Math.max(
      0,
      Number(reservation.depositAppliedAmount || 0),
    ),
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
  const Order = await loadRegisteredModel("Order", "../../models/order.model.js");
  if (!Order) return false;
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

  const [Table, Reservation] = await Promise.all([
    loadRegisteredModel("Table", "../../models/table.model.js"),
    loadRegisteredModel("Reservation", "../../models/reservation.model.js"),
  ]);
  if (!Table || !Reservation) return;

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
