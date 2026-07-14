import Reservation from "../../../models/reservation.model.js";
import { RESERVATION_ARRIVAL_GRACE_MINUTES } from "../../../src/services/reservationTableTiming.service.js";

const toValidDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

export function isOnTimeReservationArrival(reservation, checkedInAt) {
  const reservationAt = toValidDate(reservation?.timeTo);
  const arrivalAt = toValidDate(checkedInAt);
  if (!reservationAt || !arrivalAt) return false;
  const graceEndsAt = new Date(
    reservationAt.getTime() + RESERVATION_ARRIVAL_GRACE_MINUTES * 60 * 1000,
  );
  return arrivalAt.getTime() <= graceEndsAt.getTime();
}

async function recordReservationArrival(result) {
  const reservationId = result?._id || result?.id;
  if (!reservationId || String(result?.status || "") !== "seated") return result;

  const checkedInAt =
    toValidDate(result?.checkedInAt) ||
    toValidDate(result?.updatedAt) ||
    new Date();
  const tableDepositRefundEligible = isOnTimeReservationArrival(
    result,
    checkedInAt,
  );

  const updated = await Reservation.findOneAndUpdate(
    { _id: reservationId, checkedInAt: null },
    {
      $set: {
        checkedInAt,
        tableDepositRefundEligible,
      },
    },
    { new: true },
  ).lean();

  if (updated) {
    result.checkedInAt = updated.checkedInAt;
    result.tableDepositRefundEligible = updated.tableDepositRefundEligible;
  }
  return result;
}

export function withReservationArrivalAudit(mutation = {}) {
  const wrapped = { ...mutation };

  for (const fieldName of ["checkInReservation", "updateReservationStatus"]) {
    const baseResolver = mutation[fieldName];
    if (typeof baseResolver !== "function") continue;

    wrapped[fieldName] = async function auditedReservationArrival(
      parent,
      args,
      ctx,
      info,
    ) {
      const result = await baseResolver.call(mutation, parent, args, ctx, info);
      return recordReservationArrival(result);
    };
  }

  return wrapped;
}

export const reservationArrivalAuditInternals = {
  recordReservationArrival,
  toValidDate,
};

export default withReservationArrivalAudit;
