import React, { useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Clock3 } from "lucide-react";
import useMenuAvailabilityWatch from "../../../hooks/useMenuAvailabilityWatch";
import "./FoodAvailabilityWatchPanel.scss";

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
  const [tone, setTone] = useState("warning");
  const [watchId, setWatchId] = useState(null);

  const canRegister = useMemo(() => {
    return Boolean(restaurantId && menuItemId && servingKey && (userId || tableId || tableCode));
  }, [restaurantId, menuItemId, servingKey, userId, tableId, tableCode]);

  if (!isVisible && !message) return null;

  const handleRegister = async () => {
    if (!canRegister) {
      setTone("error");
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
      setTone("error");
      setMessage(result.message || "Không thể đăng ký nhắc món.");
      return;
    }

    const payload = result.data;
    setTone("success");
    setWatchId(payload?.watch?.id || "already-available");
    setMessage(payload?.message || "Đã đăng ký nhắc khi món có lại.");
    onRegistered?.(payload);
  };

  const registered = Boolean(watchId);

  return (
    <div className={`fd-availability-watch-panel is-${tone} ${registered ? "is-registered" : ""}`}>
      <div className="fd-availability-watch-panel__icon">
        {registered ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
      </div>

      <div className="fd-availability-watch-panel__body">
        <div className="fd-availability-watch-panel__badge">
          {registered ? "Đã đăng ký" : "Tồn kho thay đổi"}
        </div>
        <strong>
          {registered
            ? "Hệ thống sẽ nhắc khi món có lại"
            : isOutOfStock
              ? "Món này hiện chưa khả dụng"
              : "Có thể món vừa được khách khác giữ"}
        </strong>
        <p>
          {message ||
            "Bạn có thể nhận nhắc khi món khả dụng trở lại. Hệ thống không tự giữ món, đơn vẫn được xử lý theo FCFS."}
        </p>
        <div className="fd-availability-watch-panel__meta">
          <span>
            <Clock3 size={13} /> Không tự giữ món
          </span>
          <span>SL cần: {Math.max(1, Number(desiredQuantity || 1))}</span>
        </div>

        {!registered ? (
          <button type="button" onClick={handleRegister} disabled={registering}>
            <Bell size={15} />
            {registering ? "Đang đăng ký..." : "Nhắc tôi khi có lại"}
          </button>
        ) : null}
      </div>
    </div>
  );
}