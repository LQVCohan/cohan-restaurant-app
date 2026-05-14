import React, { useMemo, useState } from "react";
import useSocketOrder from "@/hooks/useSocketOrder";
import { useNotification } from "@/hooks/useNotification";
import useMenuAvailabilityWatch from "@/hooks/useMenuAvailabilityWatch";
import { usePos } from "@/context/PosContext";
import styles from "./POSLayout.module.scss";

function getItemLabel(evt) {
  return evt?.menuItemName || evt?.name || `Món ${String(evt?.menuItemId || "").slice(-6)}`;
}

function normalizeServingKey(evt) {
  return evt?.servingVariantKey || evt?.servingKey || "portion";
}

export default function PosMenuAvailabilityRealtimeNotice({ restaurantId }) {
  const { showNotification } = useNotification();
  const { currentTable, currentOrderType } = usePos();
  const { registerWatch, registering } = useMenuAvailabilityWatch();
  const [latestOutOfStock, setLatestOutOfStock] = useState(null);
  const [statusText, setStatusText] = useState("");

  const canRegisterForCurrentTable = useMemo(() => {
    return Boolean(
      latestOutOfStock?.menuItemId &&
        restaurantId &&
        currentOrderType === "dine_in" &&
        (currentTable?.id || currentTable?.code),
    );
  }, [latestOutOfStock?.menuItemId, restaurantId, currentOrderType, currentTable?.id, currentTable?.code]);

  useSocketOrder(restaurantId, {
    onMenuItemOutOfStock: (evt) => {
      setLatestOutOfStock(evt);
      setStatusText("");
      showNotification(
        `⚠️ ${getItemLabel(evt)} vừa hết khả dụng. Nếu bàn/POS đang chọn món này, hãy đăng ký nhắc khi có lại.`,
        "warning",
      );
    },
    onMenuItemAvailableAgain: (evt) => {
      if (
        latestOutOfStock?.menuItemId &&
        String(latestOutOfStock.menuItemId) === String(evt?.menuItemId)
      ) {
        setLatestOutOfStock(null);
        setStatusText("");
      }
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

  const handleRegisterForTable = async () => {
    if (!canRegisterForCurrentTable) {
      setStatusText("Vui lòng chọn bàn dine-in trước khi đăng ký nhắc.");
      return;
    }

    const result = await registerWatch({
      restaurantId,
      menuItemId: latestOutOfStock.menuItemId,
      servingKey: normalizeServingKey(latestOutOfStock),
      desiredQuantity: 1,
      tableId: currentTable?.id || currentTable?._id || undefined,
      tableCode: currentTable?.code || undefined,
      source: "pos",
      reason: "out_of_stock",
      note: `POS đăng ký nhắc món cho bàn ${currentTable?.code || currentTable?.id || "đang chọn"}.`,
    });

    if (!result.success) {
      setStatusText(result.message || "Không thể đăng ký nhắc cho bàn này.");
      return;
    }

    setStatusText(result.data?.message || "Đã đăng ký nhắc cho bàn này.");
  };

  if (!latestOutOfStock) return null;

  return (
    <div className={styles.menuAvailabilityNotice}>
      <div>
        <strong>{getItemLabel(latestOutOfStock)} vừa hết khả dụng</strong>
        <p>
          {statusText ||
            "Nếu khách của bàn hiện tại vẫn muốn món này, hãy đăng ký nhắc. Khi món có lại, hệ thống chỉ báo lại và không tự giữ món."}
        </p>
      </div>

      <div className={styles.menuAvailabilityNoticeActions}>
        <button
          type="button"
          onClick={handleRegisterForTable}
          disabled={registering || !canRegisterForCurrentTable}
        >
          {registering ? "Đang đăng ký..." : "Nhắc bàn này"}
        </button>
        <button type="button" onClick={() => setLatestOutOfStock(null)}>
          Đóng
        </button>
      </div>
    </div>
  );
}
