import React from "react";
import useSocketOrder from "@/hooks/useSocketOrder";
import { useNotification } from "@/hooks/useNotification";

function getItemLabel(evt) {
  return evt?.menuItemName || evt?.name || `Món ${String(evt?.menuItemId || "").slice(-6)}`;
}

export default function PosMenuAvailabilityRealtimeNotice({ restaurantId }) {
  const { showNotification } = useNotification();

  useSocketOrder(restaurantId, {
    onMenuItemOutOfStock: (evt) => {
      showNotification(
        `⚠️ ${getItemLabel(evt)} vừa hết khả dụng. Nếu bàn/POS đang chọn món này, hãy đăng ký nhắc khi có lại.`,
        "warning",
      );
    },
    onMenuItemAvailableAgain: (evt) => {
      showNotification(
        `✅ ${getItemLabel(evt)} đã khả dụng lại. Có thể báo cho bàn đang chờ đặt lại.`,
        "success",
      );
    },
    onMenuAvailabilityNotification: (evt) => {
      if (evt?.type !== "MENU_ITEM_AVAILABLE_AGAIN") return;
      const tableText = evt?.target?.tableCode
        ? ` cho bàn ${evt.target.tableCode}`
        : "";
      showNotification(
        `🔔 ${getItemLabel(evt)} đã có lại${tableText}. Hệ thống không tự giữ món, cần đặt lại nếu khách vẫn muốn dùng.`,
        "info",
      );
    },
  });

  return null;
}
