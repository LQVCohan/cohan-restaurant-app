import React, { useContext, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Clock3 } from "lucide-react";
import { AuthContext } from "../../../context/AuthContext";
import useMenuAvailabilityWatch from "../../../hooks/useMenuAvailabilityWatch";
import "./FoodAvailabilityWatchPanel.scss";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const { user } = useContext(AuthContext) || {};
  const { registerWatch, registering } = useMenuAvailabilityWatch();
  const [contactEmail, setContactEmail] = useState(user?.email || "");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("warning");
  const [watchId, setWatchId] = useState(null);

  useEffect(() => {
    if (user?.email) setContactEmail(user.email);
  }, [user?.email]);

  const normalizedEmail = contactEmail.trim().toLowerCase();
  const canRegister = useMemo(() => {
    return Boolean(
      restaurantId &&
      menuItemId &&
      servingKey &&
      EMAIL_PATTERN.test(normalizedEmail),
    );
  }, [restaurantId, menuItemId, servingKey, normalizedEmail]);

  if (!isVisible && !message) return null;

  const handleRegister = async () => {
    if (!canRegister) {
      setTone("error");
      setMessage("Vui lòng nhập email hợp lệ để nhận nhắc khi món có lại.");
      return;
    }

    const result = await registerWatch({
      restaurantId,
      menuItemId,
      servingKey,
      desiredQuantity: Math.max(1, Number(desiredQuantity || 1)),
      userId,
      contactEmail: normalizedEmail,
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
            ? "Hệ thống sẽ gửi email khi món có lại"
            : isOutOfStock
              ? "Món này hiện chưa khả dụng"
              : "Có thể món vừa được khách khác giữ"}
        </strong>
        <p>
          {message ||
            "Nhập email để nhận nhắc khi món khả dụng trở lại. Hệ thống không tự giữ món, đơn vẫn được xử lý theo FCFS."}
        </p>

        {!registered && !user?.email ? (
          <label className="fd-availability-watch-panel__email">
            <span>Email nhận thông báo</span>
            <input
              type="email"
              value={contactEmail}
              onChange={(event) => {
                setContactEmail(event.target.value);
                if (tone === "error") {
                  setTone("warning");
                  setMessage("");
                }
              }}
              placeholder="email@example.com"
              autoComplete="email"
              disabled={registering}
            />
          </label>
        ) : null}

        <div className="fd-availability-watch-panel__meta">
          <span>
            <Clock3 size={13} /> Không tự giữ món
          </span>
          <span>SL cần: {Math.max(1, Number(desiredQuantity || 1))}</span>
          {user?.email ? <span>Gửi tới {user.email}</span> : null}
        </div>

        {!registered ? (
          <button type="button" onClick={handleRegister} disabled={registering}>
            <Bell size={15} />
            {registering ? "Đang đăng ký..." : "Gửi email khi có lại"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
