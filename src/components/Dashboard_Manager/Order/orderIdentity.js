export const getOrderCustomerName = (order) =>
  order?.customerInfo?.name ||
  order?.shipping?.fullName ||
  order?.user?.fullName ||
  "Khách lẻ";

export const getOrderTypeLabel = (orderType) => {
  if (orderType === "delivery") return "Giao hàng";
  if (orderType === "takeaway") return "Mang về";
  return "Tại bàn";
};
