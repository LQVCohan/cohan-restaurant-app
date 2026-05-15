import React, { useContext, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Clock3, X } from "lucide-react";
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
  const itemName =
    input.name ||
    firstItem?.name ||
    firstItem?.dishName ||
    detail?.menuItemName ||
    detail?.name ||
    "Món đã chọn";

  return {
    restaurantId,
    menuItemId,
    servingKey,
    desiredQuantity,
    tableId: input.tableId || null,
    tableCode: input.tableCode || null,
    source,
    itemName,
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
  const [statusTone, setStatusTone] = useState("warning");
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    const onOutOfStock = (event) => {
      const normalized = normalizePayload(event.detail);
      if (!normalized.restaurantId || !normalized.menuItemId) return;
      setPayload(normalized);
      setStatusText("");
      setStatusTone("warning");
      setRegistered(false);
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
    setStatusTone("warning");
    setRegistered(false);
  };

  const handleRegister = async () => {
    if (!canRegister) {
      setStatusTone("error");
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
      setStatusTone("error");
      setStatusText(result.message || "Không thể đăng ký nhắc món.");
      return;
    }

    setRegistered(true);
    setStatusTone("success");
    setStatusText(result.data?.message || "Đã đăng ký nhắc khi món có lại.");
  };

  return (
    <div className="global-menu-availability-prompt" role="dialog" aria-live="polite">
      <div className={`global-menu-availability-prompt__card ${registered ? "is-success" : ""}`}>
        <button
          type="button"
          className="global-menu-availability-prompt__close"
          onClick={handleClose}
          aria-label="Đóng"
        >
          <X size={18} />
        </button>

        <div className="global-menu-availability-prompt__icon">
          {registered ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
        </div>

        <div className="global-menu-availability-prompt__content">
          <div className="global-menu-availability-prompt__eyebrow">
            <span>{registered ? "Đã ghi nhận yêu cầu nhắc" : "Tồn kho thay đổi"}</span>
            <span>{payload.source === "pos" ? "POS" : "Online"}</span>
          </div>
          <h3>{registered ? "Sẽ nhắc khi món có lại" : `${payload.itemName} vừa hết khả dụng`}</h3>
          <p className={`global-menu-availability-prompt__message is-${statusTone}`}>
            {statusText || payload.message}
          </p>
          <div className="global-menu-availability-prompt__meta">
            <span>
              <Clock3 size={14} /> Không tự động giữ món
            </span>
            <span>SL: {payload.desiredQuantity}</span>
          </div>
        </div>

        <div className="global-menu-availability-prompt__actions">
          <button type="button" className="secondary" onClick={handleClose}>
            {registered ? "Đã hiểu" : "Bỏ qua"}
          </button>
          {!registered ? (
            <button type="button" onClick={handleRegister} disabled={registering}>
              <Bell size={15} />
              {registering ? "Đang đăng ký..." : "Nhắc tôi khi có lại"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}