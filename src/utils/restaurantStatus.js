export const getOpeningStatusLabel = (status) => ({ open: "Đang mở cửa", closed: "Đã đóng cửa", paused: "Tạm ngưng nhận khách", maintenance: "Đang bảo trì", holiday: "Nghỉ hôm nay" }[status] || "Chưa rõ");
export const canShowReservationButton = (r) => !!r?.canReserve;
export const canShowOrderButton = (r) => !!r?.canOrder;
export const getOpeningStatusDescription = (r) => r?.openingStatusReason || getOpeningStatusLabel(r?.openingStatus);
export const getRestaurantPrimaryCTA = (r) => (r?.openingStatus === "closed" && r?.canReserve ? "Đặt bàn trước" : "Đặt bàn");
