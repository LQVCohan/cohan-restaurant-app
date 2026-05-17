export const RESERVATION_EVENTS = Object.freeze({
  CREATED: "RESERVATION_CREATED",
  CONFIRMED: "RESERVATION_CONFIRMED",
  CANCELLED: "RESERVATION_CANCELLED",
  PAYMENT_EXPIRED: "RESERVATION_PAYMENT_EXPIRED",
  PAYMENT_FAILED: "RESERVATION_PAYMENT_FAILED",
  CHANGE_REQUESTED: "RESERVATION_CHANGE_REQUESTED",
  CHANGE_APPROVED: "RESERVATION_CHANGE_APPROVED",
  CHANGE_REJECTED: "RESERVATION_CHANGE_REJECTED",
  CHECKED_IN: "RESERVATION_CHECKED_IN",
  STATUS_CHANGED: "RESERVATION_STATUS_CHANGED",
  SLOT_HELD: "TABLE_SLOT_HELD",
  SLOT_RELEASED: "TABLE_SLOT_RELEASED",
});

function normalizeReservationId(reservationOrId) {
  if (!reservationOrId) return null;
  if (typeof reservationOrId === "string") return reservationOrId;
  return String(reservationOrId._id || reservationOrId.id || "") || null;
}

function toReservationPayload(reservation) {
  if (!reservation) return null;
  const raw = typeof reservation.toObject === "function"
    ? reservation.toObject({ virtuals: true })
    : reservation;

  return {
    ...raw,
    id: String(raw.id || raw._id || ""),
    _id: raw._id ? String(raw._id) : undefined,
    restaurantId: raw.restaurantId ? String(raw.restaurantId) : null,
    tableId: raw.tableId ? String(raw.tableId) : null,
    userId: raw.userId ? String(raw.userId) : null,
    requestedTableId: raw.requestedTableId ? String(raw.requestedTableId) : null,
  };
}

export async function emitReservationEvent(ctx, restaurantId, type, reservation, extra = {}) {
  if (!ctx?.io || !restaurantId || !type) return;

  const payload = {
    type,
    reservation: toReservationPayload(reservation),
    reservationId: normalizeReservationId(reservation),
    restaurantId: String(restaurantId),
    ...extra,
  };

  ctx.io.to(`restaurant_${restaurantId}`).emit("reservationEvents", payload);
  console.log(`[SOCKET.IO] -> restaurant_${restaurantId} reservationEvents (${type})`);
}

export async function emitReservationUserEvent(ctx, userId, type, reservation, extra = {}) {
  if (!ctx?.io || !userId || !type) return;

  const payload = {
    type,
    reservation: toReservationPayload(reservation),
    reservationId: normalizeReservationId(reservation),
    userId: String(userId),
    ...extra,
  };

  ctx.io.to(`user_${userId}`).emit("reservationCustomerEvents", payload);
  console.log(`[SOCKET.IO] -> user_${userId} reservationCustomerEvents (${type})`);
}

export async function emitReservationEvents(ctx, restaurantId, type, reservation, extra = {}) {
  await emitReservationEvent(ctx, restaurantId, type, reservation, extra);
  const userId = reservation?.userId || extra?.userId;
  if (userId) {
    await emitReservationUserEvent(ctx, userId, type, reservation, extra);
  }
}
