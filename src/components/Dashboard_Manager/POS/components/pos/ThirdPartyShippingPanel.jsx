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

const panelStyle = {
  margin: "0.75rem 0.85rem 0",
  border: "1px solid #fed7aa",
  borderRadius: 16,
  background: "linear-gradient(180deg, #ffffff 0%, #fff7ed 100%)",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
  padding: "0.75rem",
};

const rowStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  marginTop: 8,
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
      return undefined;
    }

    const attach = () => {
      const wrapper = document.querySelector("[data-pos-order-panel]");
      if (!wrapper) return;

      const discountBox = wrapper.querySelector('[class*="discountBox"]');
      const header = wrapper.querySelector('[class*="header"]');
      const node = document.createElement("div");
      node.dataset.posThirdPartyShipping = "true";

      if (discountBox?.parentNode) {
        discountBox.insertAdjacentElement("afterend", node);
      } else if (header?.parentNode) {
        header.insertAdjacentElement("beforebegin", node);
      } else {
        wrapper.prepend(node);
      }

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
      deliveryStatus: "pending",
      ...patch,
    }));
  };

  return createPortal(
    <section style={panelStyle} aria-label="Đối tác giao hàng bên thứ ba">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 950, color: "#0f172a" }}>Đối tác giao hàng</div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginTop: 2 }}>
            {selectedProvider.hint}
          </div>
        </div>
        <span
          style={{
            borderRadius: 999,
            background: "#ffedd5",
            color: "#c2410c",
            padding: "0.2rem 0.5rem",
            fontSize: 11,
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          3rd-party ship
        </span>
      </div>

      <label style={{ ...labelStyle, marginTop: 10 }}>
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

      <div style={rowStyle}>
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
      </div>

      <div style={rowStyle}>
        <label style={labelStyle}>
          Mã vận đơn
          <input
            style={inputStyle}
            placeholder="VD: GRB123..."
            value={shippingInfo?.externalTrackingCode || ""}
            onChange={(event) => updateShipping({ externalTrackingCode: event.target.value })}
          />
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
    </section>,
    mountNode,
  );
}
