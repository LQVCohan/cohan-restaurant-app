import React, { useMemo, useState } from "react";
import { Bell, CheckCircle2 } from "lucide-react";
import useMenuAvailabilityWatch from "../../../hooks/useMenuAvailabilityWatch";

export default function FoodAvailabilityWatchPanel({
  restaurantId,
  menuItemId,
  servingKey,
  desiredQuantity = 1,
  userId,
  source = "online",
  isVisible,
  isOutOfStock,
  tableId,
  tableCode,
  onRegistered,
}) {
  const { registerWatch, registering } = useMenuAvailabilityWatch();
  const [message, setMessage] = useState("");
  const [watchId, setWatchId] = useState(null);

  const canRegister = useMemo(() => {
    return Boolean(restaurantId && menuItemId && servingKey && (userId || tableId || tableCode));
  }, [restaurantId, menuItemId, servingKey, userId, tableId, tableCode]);

  if (!isVisible && !message) return null;

  const handleRegister = async () => {
    if (!canRegister) {
      setMessage("Vui lòng đăng nhập hoặc quét đúng bàn để nhận nhắc khi món có lại.");
      return;
    }

    const result = await registerWatch({
      restaurantId,
      menuItemId,
      servingKey,
      desiredQuantity: Math.max(1, Number(desiredQuantity || 1)),
      userId,
      tableId,
      tableCode,
      source,
      reason: isOutOfStock ? "out_of_stock" : "reserve_failed",
      note: "Khách chọn nhắc khi món có lại từ trang chi tiết món.",
    });

    if (!result.success) {
      setMessage(result.message || "Không thể đăng ký nhắc món.");
      return;
    }

    const payload = result.data;
    setWatchId(payload?.watch?.id || null);
    setMessage(payload?.message || "Đã đăng ký nhắc khi món có lại.");
    onRegistered?.(payload);
  };

  return (
    <div className="fd-availability-watch-panel">
      <div className="fd-availability-watch-panel__text">
        {watchId ? <CheckCircle2 size={18} /> : <Bell size={18} />}
        <div>
          <strong>{isOutOfStock ? "Món vừa hết khả dụng" : "Có thể món vừa được khách khác giữ"}</strong>
          <p>
            {message ||
              "Bạn có thể đăng ký nhắc. Khi món có lại, hệ thống chỉ thông báo và không tự giữ món thay bạn."}
          </p>
        </div>
      </div>

      {!watchId ? (
        <button type="button" onClick={handleRegister} disabled={registering}>
          {registering ? "Đang đăng ký..." : "Nhắc tôi khi có lại"}
        </button>
      ) : null}
    </div>
  );
}
