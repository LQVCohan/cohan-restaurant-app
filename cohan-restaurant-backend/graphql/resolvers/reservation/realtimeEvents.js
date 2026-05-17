import {
  emitReservationEvents,
  RESERVATION_EVENTS,
} from "./helper/emitReservationEvent.js";

function getRestaurantId(reservation) {
  return reservation?.restaurantId ? String(reservation.restaurantId) : null;
}

async function emitForReservation(ctx, type, reservation, extra = {}) {
  const restaurantId = getRestaurantId(reservation) || extra.restaurantId;
  if (!restaurantId || !reservation) return;
  await emitReservationEvents(ctx, restaurantId, type, reservation, extra);
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function eventForPaymentStatus(paymentStatus) {
  const status = normalizeStatus(paymentStatus);
  if (status === "paid" || status === "success" || status === "completed") {
    return RESERVATION_EVENTS.CONFIRMED;
  }
  if (["failed", "cancelled", "canceled", "expired"].includes(status)) {
    return status === "expired"
      ? RESERVATION_EVENTS.PAYMENT_EXPIRED
      : RESERVATION_EVENTS.PAYMENT_FAILED;
  }
  return RESERVATION_EVENTS.STATUS_CHANGED;
}

function eventForReservationStatus(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "confirmed") return RESERVATION_EVENTS.CONFIRMED;
  if (normalized === "seated") return RESERVATION_EVENTS.CHECKED_IN;
  if (normalized === "cancelled") return RESERVATION_EVENTS.CANCELLED;
  return RESERVATION_EVENTS.STATUS_CHANGED;
}

export function withReservationRealtimeEvents(mutation = {}) {
  return {
    ...mutation,

    async createReservation(parent, args, ctx, info) {
      const reservation = await mutation.createReservation.call(mutation, parent, args, ctx, info);
      const eventType = normalizeStatus(reservation?.status) === "confirmed"
        ? RESERVATION_EVENTS.CONFIRMED
        : RESERVATION_EVENTS.CREATED;
      await emitForReservation(ctx, eventType, reservation, {
        source: "createReservation",
        tableId: reservation?.tableId ? String(reservation.tableId) : null,
      });
      return reservation;
    },

    async updateReservation(parent, args, ctx, info) {
      const reservation = await mutation.updateReservation.call(mutation, parent, args, ctx, info);
      await emitForReservation(ctx, RESERVATION_EVENTS.STATUS_CHANGED, reservation, {
        source: "updateReservation",
      });
      return reservation;
    },

    async updateReservationStatus(parent, args, ctx, info) {
      const reservation = await mutation.updateReservationStatus.call(mutation, parent, args, ctx, info);
      await emitForReservation(ctx, eventForReservationStatus(args?.input?.status || reservation?.status), reservation, {
        source: "updateReservationStatus",
        status: reservation?.status || args?.input?.status || null,
      });
      return reservation;
    },

    async submitReservationPayment(parent, args, ctx, info) {
      const reservation = await mutation.submitReservationPayment.call(mutation, parent, args, ctx, info);
      await emitForReservation(ctx, eventForPaymentStatus(args?.input?.paymentStatus), reservation, {
        source: "submitReservationPayment",
        paymentStatus: args?.input?.paymentStatus || null,
      });
      return reservation;
    },

    async cancelReservation(parent, args, ctx, info) {
      const reservation = await mutation.cancelReservation.call(mutation, parent, args, ctx, info);
      await emitForReservation(ctx, RESERVATION_EVENTS.CANCELLED, reservation, {
        source: "cancelReservation",
      });
      return reservation;
    },

    async deleteReservation(parent, args, ctx, info) {
      const reservation = await mutation.deleteReservation.call(mutation, parent, args, ctx, info);
      await emitForReservation(ctx, RESERVATION_EVENTS.CANCELLED, reservation, {
        source: "deleteReservation",
      });
      return reservation;
    },

    async requestReservationChange(parent, args, ctx, info) {
      const reservation = await mutation.requestReservationChange.call(mutation, parent, args, ctx, info);
      await emitForReservation(ctx, RESERVATION_EVENTS.CHANGE_REQUESTED, reservation, {
        source: "requestReservationChange",
        changeRequestType: reservation?.changeRequestType || args?.input?.type || null,
      });
      return reservation;
    },

    async approveReservationChange(parent, args, ctx, info) {
      const reservation = await mutation.approveReservationChange.call(mutation, parent, args, ctx, info);
      await emitForReservation(ctx, RESERVATION_EVENTS.CHANGE_APPROVED, reservation, {
        source: "approveReservationChange",
        changeRequestType: reservation?.changeRequestType || null,
      });
      return reservation;
    },

    async rejectReservationChange(parent, args, ctx, info) {
      const reservation = await mutation.rejectReservationChange.call(mutation, parent, args, ctx, info);
      await emitForReservation(ctx, RESERVATION_EVENTS.CHANGE_REJECTED, reservation, {
        source: "rejectReservationChange",
        changeRequestType: reservation?.changeRequestType || null,
      });
      return reservation;
    },

    async checkInReservation(parent, args, ctx, info) {
      const reservation = await mutation.checkInReservation.call(mutation, parent, args, ctx, info);
      await emitForReservation(ctx, RESERVATION_EVENTS.CHECKED_IN, reservation, {
        source: "checkInReservation",
        tableId: reservation?.tableId ? String(reservation.tableId) : null,
      });
      return reservation;
    },

    async changeReservationTable(parent, args, ctx, info) {
      const reservation = await mutation.changeReservationTable.call(mutation, parent, args, ctx, info);
      await emitForReservation(ctx, RESERVATION_EVENTS.STATUS_CHANGED, reservation, {
        source: "changeReservationTable",
        tableId: reservation?.tableId ? String(reservation.tableId) : null,
      });
      return reservation;
    },
  };
}

export default withReservationRealtimeEvents;
