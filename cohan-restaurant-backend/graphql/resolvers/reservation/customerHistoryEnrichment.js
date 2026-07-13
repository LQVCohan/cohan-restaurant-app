import QRCode from "qrcode";
import { Table } from "../../../models/index.js";
import { ACTIVE_RESERVATION_STATUSES } from "../../../utils/tableStateGuards.js";

const qrStatuses = new Set(["confirmed"]);

const endAt = (item) => {
  if (item?.isUnlimitedTime) return null;
  const start = new Date(item?.timeTo).getTime();
  return Number.isFinite(start) ? start + Math.max(30, Number(item?.durationMinutes || 60)) * 60000 : null;
};

const overlaps = (a, b) => {
  const aStart = new Date(a?.timeTo).getTime();
  const bStart = new Date(b?.timeTo).getTime();
  if (!Number.isFinite(aStart) || !Number.isFinite(bStart)) return false;
  const aEnd = endAt(a);
  const bEnd = endAt(b);
  return (aEnd === null || bStart < aEnd) && (bEnd === null || aStart < bEnd);
};

export async function enrichCustomerReservations(reservations = []) {
  const tableIds = [...new Set(reservations.map((item) => String(item.tableId || "")).filter(Boolean))];
  const tables = tableIds.length
    ? await Table.find({ _id: { $in: tableIds } }).select({ code: 1, name: 1, label: 1 }).lean()
    : [];
  const tableById = new Map(tables.map((table) => [String(table._id), table]));

  return Promise.all(reservations.map(async (reservation) => {
    const table = tableById.get(String(reservation.tableId)) || null;
    const status = String(reservation.status || "").toLowerCase();
    const conflicts = ACTIVE_RESERVATION_STATUSES.includes(status)
      ? reservations.filter((candidate) =>
        String(candidate._id) !== String(reservation._id) &&
        String(candidate.restaurantId) === String(reservation.restaurantId) &&
        ACTIVE_RESERVATION_STATUSES.includes(String(candidate.status || "").toLowerCase()) &&
        overlaps(reservation, candidate))
      : [];
    const canCheckIn = qrStatuses.has(status) && new Date(reservation.timeTo).getTime() + 21600000 >= Date.now();
    const payload = canCheckIn ? JSON.stringify({ type: "COHAN_RESERVATION_CHECK_IN", reservationId: String(reservation._id), orderCode: reservation.orderCode, tableId: String(reservation.tableId) }) : null;

    return {
      ...reservation,
      tableCode: table?.code || table?.name || table?.label || null,
      tableName: table?.name || table?.label || table?.code || null,
      hasUserOverlap: conflicts.length > 0,
      overlapReservationCodes: conflicts.map((item) => item.orderCode || String(item._id).slice(-6).toUpperCase()),
      canCheckIn,
      checkInQrPayload: payload,
      checkInQrDataUrl: payload ? await QRCode.toDataURL(payload, { width: 280, margin: 1 }) : null,
    };
  }));
}
