export const getOpeningStatusLabel = (status) => {
  const labelMap = {
    open: "Đang mở cửa",
    closed: "Đã đóng cửa",
    paused: "Tạm ngưng nhận khách",
    maintenance: "Đang bảo trì",
    holiday: "Nghỉ hôm nay",
    inactive: "Ngừng hoạt động",
    hidden: "Không công khai",
    suspended: "Tạm khóa",
    archived: "Đã lưu trữ",
  };

  return labelMap[status] || "Chưa rõ trạng thái";
};
export const canShowReservationButton = (r) => !!r?.canReserve;
export const canShowOrderButton = (r) => !!r?.canOrder;
export const getOpeningStatusDescription = (r) => r?.openingStatusReason || getOpeningStatusLabel(r?.openingStatus);
export const getRestaurantPrimaryCTA = (r) => {
  if (!r?.canReserve) return "Hiện không nhận đặt bàn";
  if (r?.openingStatus === "closed" && r?.canReserve) return "Đặt bàn trước";
  return "Đặt bàn";
};

export const getCannotOrderReason = (openingStatus) => {
  const cannotOrderReasonMap = {
    closed: "Nhà hàng đang đóng cửa",
    paused: "Nhà hàng đang tạm ngưng nhận đơn",
    maintenance: "Nhà hàng đang bảo trì",
    holiday: "Nhà hàng nghỉ hôm nay",
  };

  return cannotOrderReasonMap[openingStatus] || "Nhà hàng chưa nhận đặt món";
};
