export function getFutureOrderSchedule(order) {
  const value =
    order?.customerInfo?.timeTo || order?.clientMeta?.reservationTimeTo || null;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function sortFutureOrders(orders = []) {
  return [...(Array.isArray(orders) ? orders : [])].sort((left, right) => {
    const leftTime = getFutureOrderSchedule(left)?.getTime() ?? Infinity;
    const rightTime = getFutureOrderSchedule(right)?.getTime() ?? Infinity;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return String(left?.orderCode || left?.id || "").localeCompare(
      String(right?.orderCode || right?.id || ""),
    );
  });
}

export function formatFutureOrderDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa rõ thời gian";
  return date.toLocaleString("vi-VN", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function getFutureOrderItemCount(order) {
  return (Array.isArray(order?.items) ? order.items : []).reduce(
    (total, item) => total + Math.max(0, Number(item?.quantity || 0)),
    0,
  );
}
