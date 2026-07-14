const ACTIVE_RESERVATION_STATUSES = new Set([
  "confirmed",
  "pending_change",
  "pending_payment",
]);

export function getTableReservationTime(table) {
  const value = table?.nextReservationAt;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function hasFutureTableReservation(table, now = new Date()) {
  const reservationTime = getTableReservationTime(table);
  if (!reservationTime) return false;
  const status = String(table?.reservationStatus || "confirmed").toLowerCase();
  if (!ACTIVE_RESERVATION_STATUSES.has(status)) return false;
  return reservationTime.getTime() > new Date(now).getTime();
}

export function formatPosReservationTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "chưa rõ giờ";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function buildFutureReservationNotice(table) {
  const time = getTableReservationTime(table);
  if (!time) return "";
  const tableCode = table?.code || "bàn này";
  return `Bàn ${tableCode} đã có khách đặt lúc ${formatPosReservationTime(
    time,
  )}. Món đặt trước chưa hiển thị trong POS và sẽ tự tải khi tới giờ. Bạn vẫn có thể xem tại Quản lý đơn hàng → Order trước.`;
}
