// reservationAutoCancel.service.js
import { Reservation } from "../../models/index.js";

export async function autoCancelExpiredReservations() {
  const now = new Date();

  const result = await Reservation.updateMany(
    {
      status: "pending_payment",
      pendingPaymentExpiresAt: { $lte: now },
    },
    {
      $set: { status: "cancelled" },
    }
  );

  console.log(
    `[Reservation AutoCancel] Cancelled ${
      result.modifiedCount
    } expired reservations at ${now.toISOString()}`
  );
}
