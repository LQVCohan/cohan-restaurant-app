import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePos } from "../../../../../context/PosContext";

const SHIPPING_PROVIDERS = [
  { value: "ship_now", label: "Quán tự giao", hint: "Nhân viên nội bộ hoặc gọi ship riêng" },
  { value: "grab", label: "GrabExpress", hint: "Gọi tài xế Grab giao đơn" },
  { value: "ahamove", label: "Ahamove", hint: "Giao nhanh nội thành" },
  { value: "be", label: "beDelivery", hint: "Đối tác be giao hàng" },
  { value: "ghn", label: "GHN", hint: "Giao qua đối tác logistics" },
];

const DELIVERY_STATUS_OPTIONS = [
  { value: "pending", label: "Chờ gọi ship" },
  { value: "driver_assigned", label: "Đã có tài xế" },
  { value: "picked_up", label: "Đã lấy hàng" },
  { value: "delivering", label: "Đang giao" },
  { value: "delivered", label: "Đã giao" },
];

const toNumberInput = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? String(Math.round(number)) : "";
};

const compactInputStyle = {
  minWidth: 0,
  height: 30,
  border: "1px solid #e2e8f0",
  borderRadius: 999,
  padding: "0 0.55rem",
  fontSize: 11,
  fontWeight: 850,
  color: "#0f172a",
  background: "#fff",
};

const labelStyle = {
  display: "grid",
  gap: 4,
  color: "#475569",
  fontSize: 11,
  fontWeight: 800,
};

const inputStyle = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "0.5rem 0.55rem",
  fontWeight: 800,
  color: "#0f172a",
  background: "#fff",
};

export default function ThirdPartyShippingPanel() {
  const { currentOrderType, shippingInfo, setShippingInfo } = usePos();
  const [mountNode, setMountNode] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const selectedProvider = useMemo(
    () =>
      SHIPPING_PROVIDERS.find(
        (provider) => provider.value === (shippingInfo?.deliveryMethod || "ship_now"),
      ) || SHIPPING_PROVIDERS[0],
    [shippingInfo?.deliveryMethod],
  );

  useEffect(() => {
    if (currentOrderType !== "delivery") {
      if (mountNode?.parentNode) mountNode.parentNode.removeChild(mountNode);
      setMountNode(null);
      setIsOpen(false);
      return undefined;
    }

    const attach = () => {
      const wrapper = document.querySelector("[data-pos-order-panel]");
      const headerRight = wrapper?.querySelector('[class*="headerRight"]');
      if (!headerRight) return;

      const node = document.createElement("div");
      node.dataset.posThirdPartyShipping = "true";
      headerRight.prepend(node);
      setMountNode(node);
    };

    const frame = window.requestAnimationFrame(attach);
    return () => {
      window.cancelAnimationFrame(frame);
      setMountNode((node) => {
        if (node?.parentNode) node.parentNode.removeChild(node);
        return null;
      });
    };
  }, [currentOrderType]);

  if (currentOrderType !== "delivery" || !mountNode) return null;

  const updateShipping = (patch) => {
    setShippingInfo?.((prev) => ({
      ...(prev || {}),
      deliveryStatus: prev?.deliveryStatus || "pending",
      ...patch,
    }));
  };

  const shippingFee = Number(shippingInfo?.shippingFee || 0);
  const providerLabel = selectedProvider.label;

  return createPortal(
    <div style={{ position: "relative", marginRight: 8 }}>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        title="Cấu hình giao hàng bên thứ 3"
        style={{
          height: 34,
          maxWidth: 176,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: "1px solid #fed7aa",
          borderRadius: 999,
          background: "#fff7ed",
          color: "#9a3412",
          padding: "0 0.7rem",
          fontSize: 11,
          fontWeight: 900,
          cursor: "pointer",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        🚚 {providerLabel}
        {shippingFee > 0 ? ` · ${shippingFee.toLocaleString("vi-VN")}đ` : ""}
      </button>

      {isOpen && (
        <section
          aria-label="Đối tác giao hàng bên thứ ba"
          style={{
            position: "absolute",
            top: 42,
            right: 0,
            width: 360,
            maxWidth: "calc(100vw - 32px)",
            zIndex: 90,
            border: "1px solid #fed7aa",
            borderRadius: 16,
            background: "linear-gradient(180deg, #ffffff 0%, #fff7ed 100%)",
            boxShadow: "0 24px 56px rgba(15, 23, 42, 0.18)",
            padding: "0.75rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 950, color: "#0f172a" }}>Đối tác giao hàng</div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginTop: 2 }}>
                {selectedProvider.hint}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                border: 0,
                borderRadius: 999,
                background: "#ffedd5",
                color: "#c2410c",
                padding: "0.25rem 0.55rem",
                fontSize: 11,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Đóng
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 8, marginTop: 10 }}>
            <label style={labelStyle}>
              Nhà vận chuyển
              <select
                style={inputStyle}
                value={shippingInfo?.deliveryMethod || "ship_now"}
                onChange={(event) => updateShipping({ deliveryMethod: event.target.value })}
              >
                {SHIPPING_PROVIDERS.map((provider) => (
                  <option key={provider.value} value={provider.value}>{provider.label}</option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Phí ship
              <input
                style={inputStyle}
                type="number"
                min="0"
                placeholder="0"
                value={toNumberInput(shippingInfo?.shippingFee)}
                onChange={(event) => updateShipping({ shippingFee: Number(event.target.value || 0) })}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            <label style={labelStyle}>
              Trạng thái
              <select
                style={inputStyle}
                value={shippingInfo?.deliveryStatus || "pending"}
                onChange={(event) => updateShipping({ deliveryStatus: event.target.value })}
              >
                {DELIVERY_STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              SĐT tài xế
              <input
                style={inputStyle}
                placeholder="Số tài xế"
                value={shippingInfo?.driverPhone || ""}
                onChange={(event) => updateShipping({ driverPhone: event.target.value })}
              />
            </label>
          </div>

          <label style={{ ...labelStyle, marginTop: 8 }}>
            Mã vận đơn
            <input
              style={inputStyle}
              placeholder="VD: GRB123..."
              value={shippingInfo?.externalTrackingCode || ""}
              onChange={(event) => updateShipping({ externalTrackingCode: event.target.value })}
            />
          </label>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
            <select
              style={{ ...compactInputStyle, flex: 1 }}
              value={shippingInfo?.deliveryMethod || "ship_now"}
              onChange={(event) => updateShipping({ deliveryMethod: event.target.value })}
            >
              {SHIPPING_PROVIDERS.map((provider) => (
                <option key={provider.value} value={provider.value}>{provider.label}</option>
              ))}
            </select>
            <input
              style={{ ...compactInputStyle, width: 94 }}
              type="number"
              min="0"
              placeholder="Phí ship"
              value={toNumberInput(shippingInfo?.shippingFee)}
              onChange={(event) => updateShipping({ shippingFee: Number(event.target.value || 0) })}
            />
          </div>
        </section>
      )}
    </div>,
    mountNode,
  );
}
