import React, { useContext, useEffect, useMemo, useState } from "react";
import { Bell, X } from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import useMenuAvailabilityWatch from "@/hooks/useMenuAvailabilityWatch";
import "./GlobalMenuAvailabilityPrompt.scss";

const EVENT_NAME = "menu-availability:out-of-stock";

function normalizePayload(detail) {
  const input = detail?.variables?.input || {};
  const firstItem = Array.isArray(input.items) ? input.items[0] : null;
  const restaurantId = input.restaurantId || detail?.restaurantId || null;
  const menuItemId =
    input.menuItemId ||
    firstItem?.menuItemId ||
    firstItem?.menuId ||
    firstItem?.dishId ||
    detail?.menuItemId ||
    null;
  const servingKey =
    input.servingVariantKey ||
    input.servingKey ||
    firstItem?.servingVariantKey ||
    firstItem?.servingKey ||
    firstItem?.servingVariant?.key ||
    detail?.servingKey ||
    "portion";
  const desiredQuantity = Math.max(
    1,
    Number(input.quantity || firstItem?.quantity || detail?.desiredQuantity || 1),
  );
  const source = input.tableCode
    ? "pos"
    : detail?.operationName?.toLowerCase?.().includes("table")
      ? "pos"
      : "online";

  return {
    restaurantId,
    menuItemId,
    servingKey,
    desiredQuantity,
    tableId: input.tableId || null,
    tableCode: input.tableCode || null,
    source,
    message:
      detail?.message ||
      "Món vừa được khách khác giữ hoặc đã hết khả dụng.",
  };
}

export default function GlobalMenuAvailabilityPrompt() {
  const { user } = useContext(AuthContext) || {};
  const { registerWatch, registering } = useMenuAvailabilityWatch();
  const [payload, setPayload] = useState(null);
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    const onOutOfStock = (event) => {
      const normalized = normalizePayload(event.detail);
      if (!normalized.restaurantId || !normalized.menuItemId) return;
      setPayload(normalized);
      setStatusText("");
    };

    window.addEventListener(EVENT_NAME, onOutOfStock);
    return () => window.removeEventListener(EVENT_NAME, onOutOfStock);
  }, []);

  const canRegister = useMemo(() => {
    if (!payload) return false;
    return Boolean(
      payload.restaurantId &&
        payload.menuItemId &&
        payload.servingKey &&
        (user?.id || payload.tableId || payload.tableCode),
    );
  }, [payload, user?.id]);

  if (!payload) return null;

  const handleClose = () => {
    setPayload(null);
    setStatusText("");
  };

  const handleRegister = async () => {
    if (!canRegister) {
      setStatusText("Vui lòng đăng nhập hoặc chọn đúng bàn để nhận nhắc khi món có lại.");
      return;
    }

    const result = await registerWatch({
      restaurantId: payload.restaurantId,
      menuItemId: payload.menuItemId,
      servingKey: payload.servingKey,
      desiredQuantity: payload.desiredQuantity,
      userId: user?.id,
      tableId: payload.tableId,
      tableCode: payload.tableCode,
      source: payload.source,
      reason: "out_of_stock",
      note: "Đăng ký nhắc tự động sau lỗi OUT_OF_STOCK từ FE.",
    });

    if (!result.success) {
      setStatusText(result.message || "Không thể đăng ký nhắc món.");
      return;
    }

    setStatusText(result.data?.message || "Đã đăng ký nhắc khi món có lại.");
  };

  return (
    <div className="global-menu-availability-prompt" role="dialog" aria-live="polite">
      <div className="global-menu-availability-prompt__card">
        <button
          type="button"
          className="global-menu-availability-prompt__close"
          onClick={handleClose}
          aria-label="Đóng"
        >
          <X size={18} />
        </button>

        <div className="global-menu-availability-prompt__icon">
          <Bell size={22} />
        </div>

        <div className="global-menu-availability-prompt__content">
          <h3>Món vừa hết khả dụng</h3>
          <p>{statusText || payload.message}</p>
          <p className="global-menu-availability-prompt__hint">
            Hệ thống chỉ nhắc khi món có lại, không tự động giữ món thay bạn.
          </p>
        </div>

        <div className="global-menu-availability-prompt__actions">
          <button type="button" className="secondary" onClick={handleClose}>
            Bỏ qua
          </button>
          <button type="button" onClick={handleRegister} disabled={registering}>
            {registering ? "Đang đăng ký..." : "Nhắc tôi khi có lại"}
          </button>
        </div>
      </div>
    </div>
  );
}
