import { Table } from "../../models/index.js";
import { expirePendingReservationPayments } from "./reservationAvailability.service.js";

export async function cleanupExpiredTableViewLocks() {
  const now = new Date();
  const res = await Table.updateMany({ "viewLock.expiresAt": { $lte: now } }, { $unset: { viewLock: 1 } });
  return res;
}

export async function autoCancelExpiredReservations({ io } = {}) {
  return expirePendingReservationPayments({ io });
}
