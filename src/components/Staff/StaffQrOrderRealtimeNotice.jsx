import useSocketOrder from "@/hooks/useSocketOrder";
import { useNotification } from "@/hooks/useNotification";

const QR_ORDER_SOURCE = "customer_table_qr";

export default function StaffQrOrderRealtimeNotice({ restaurantId, enabled = true }) {
  const { showNotification } = useNotification();

  useSocketOrder(enabled ? restaurantId : null, {
    onCreated: (order) => {
      const source = String(order?.clientMeta?.source || "").toLowerCase();
      if (source !== QR_ORDER_SOURCE) return;

      const tableLabel = order?.tableCode
        ? `Bàn ${order.tableCode}`
        : "Một bàn";
      showNotification(
        `${tableLabel} có order mới từ QR. Đang chờ xác nhận từ nhân viên trước khi chuyển bếp.`,
        "warning",
      );
    },
  });

  return null;
}
