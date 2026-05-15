import React, { useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, X } from "lucide-react";
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
  const [tone, setTone] = useState("warning");

  const tableLabel = currentTable?.code || currentTable?.name || currentTable?.id || currentTable?._id || "chưa chọn bàn";

  const canRegisterForCurrentTable = useMemo(() => {
    return Boolean(
      latestOutOfStock?.menuItemId &&
        restaurantId &&
        currentOrderType === "dine_in" &&
        (currentTable?.id || currentTable?._id || currentTable?.code),
    );
  }, [latestOutOfStock?.menuItemId, restaurantId, currentOrderType, currentTable?.id, currentTable?._id, currentTable?.code]);

  useSocketOrder(restaurantId, {
    onMenuItemOutOfStock: (evt) => {
      setLatestOutOfStock(evt);
      setStatusText("");
      setTone("warning");
      showNotification(
        `⚠️ ${getItemLabel(evt)} vừa hết khả dụng. Có thể đăng ký nhắc cho bàn hiện tại.`,
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
        setTone("warning");
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
      setTone("error");
      setStatusText("Vui lòng chọn bàn dine-in trước khi đăng ký nhắc món.");
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
      setTone("error");
      setStatusText(result.message || "Không thể đăng ký nhắc cho bàn này.");
      return;
    }

    setTone("success");
    setStatusText(result.data?.message || "Đã đăng ký nhắc cho bàn này.");
  };

  if (!latestOutOfStock) return null;

  const registered = tone === "success";

  return (
    <div className={`${styles.menuAvailabilityNotice} ${styles[`menuAvailabilityNotice_${tone}`] || ""}`}>
      <div className={styles.menuAvailabilityNoticeIcon}>
        {registered ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
      </div>

      <div className={styles.menuAvailabilityNoticeBody}>
        <div className={styles.menuAvailabilityNoticeMeta}>
          <span>{registered ? "Đã đăng ký nhắc" : "Món vừa hết"}</span>
          <span>Bàn: {tableLabel}</span>
        </div>
        <strong>{getItemLabel(latestOutOfStock)}</strong>
        <p>
          {statusText ||
            "Nếu khách vẫn muốn món này, hãy đăng ký nhắc cho bàn hiện tại. Khi món có lại, hệ thống chỉ thông báo và không tự giữ món."}
        </p>
      </div>

      <div className={styles.menuAvailabilityNoticeActions}>
        {!registered ? (
          <button
            type="button"
            onClick={handleRegisterForTable}
            disabled={registering || !canRegisterForCurrentTable}
          >
            <Bell size={15} />
            {registering ? "Đang đăng ký..." : "Nhắc bàn này"}
          </button>
        ) : null}
        <button
          type="button"
          className={styles.menuAvailabilityNoticeClose}
          onClick={() => setLatestOutOfStock(null)}
          aria-label="Đóng cảnh báo món hết"
        >
          <X size={16} />
          Đóng
        </button>
      </div>
    </div>
  );
}
