import { getCachedTableReservationSnapshot } from "../../../src/services/reservationTableTiming.service.js";

const field = (name) => async (parent, _args, ctx) => {
  const snapshot = await getCachedTableReservationSnapshot(parent, ctx);
  return snapshot?.[name] ?? null;
};

export const TableReservationTimingFields = {
  nextReservationAt: field("nextReservationAt"),
  reservationGraceEndsAt: field("reservationGraceEndsAt"),
  reservationPhase: field("reservationPhase"),
  reservationId: field("reservationId"),
  reservationOrderCode: field("reservationOrderCode"),
  reservationStatus: field("reservationStatus"),
  reservationCustomerName: field("reservationCustomerName"),
  reservationCustomerPhone: field("reservationCustomerPhone"),
  reservationCustomerEmail: field("reservationCustomerEmail"),
  reservationPartySize: field("reservationPartySize"),
};
