export const TABLE_QR_ORDER_SOURCE = "customer_table_qr";

const normalize = (value) => String(value || "").trim().toLowerCase();

/**
 * Order QR tại bàn phải được nhân viên/POS kiểm tra trước khi vào hàng chờ bếp.
 * Backend giữ các order này ở currentStatus=pending cho tới khi confirmIncomingOrder
 * chuyển trạng thái sang confirmed và tạo kitchen work items.
 */
export const isTableQrOrderAwaitingStaffConfirmation = (order) => {
  if (!order) return false;

  const source = normalize(
    order?.clientMeta?.source ||
      order?.clientMeta?.clientSource ||
      order?.clientMeta?.channel,
  );
  const status = normalize(order?.currentStatus);

  return source === TABLE_QR_ORDER_SOURCE && status === "pending";
};

export const filterKitchenVisibleOrders = (orders = []) =>
  (Array.isArray(orders) ? orders : []).filter(
    (order) => !isTableQrOrderAwaitingStaffConfirmation(order),
  );

export const isStaffKitchenWorkspacePath = (pathname) =>
  normalize(pathname).startsWith("/staff/kitchen");
