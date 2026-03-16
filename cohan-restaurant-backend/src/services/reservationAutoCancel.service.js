import { Reservation, Table } from "../../models/index.js";

export async function cleanupExpiredTableViewLocks() {
  const now = new Date();
  const res = await Table.updateMany({ "viewLock.expiresAt": { $lte: now } }, { $unset: { viewLock: 1 } });
  return res;
}


export async function autoCancelExpiredReservations() {
  const now = new Date();

  const expired = await Reservation.find({
    status: "pending_payment",
    pendingPaymentExpiresAt: { $lte: now },
  })
    .select({ _id: 1, tableId: 1 })
    .lean();

  if (!expired.length) return { modifiedCount: 0 };

  const ids = expired.map((x) => x._id);
  const tableIds = [...new Set(expired.map((x) => String(x.tableId)).filter(Boolean))];

  const result = await Reservation.updateMany(
    { _id: { $in: ids } },
    { $set: { status: "cancelled", depositStatus: "cancelled" } }
  );

  for (const tid of tableIds) {
    const hasActive = await Reservation.exists({
      tableId: tid,
      status: { $in: ["pending_payment", "confirmed", "seated"] },
    });
    if (!hasActive) {
      await Table.updateOne({ _id: tid }, { $set: { status: "available" } }).catch(() => {});
    }
  }

  return result;
}
