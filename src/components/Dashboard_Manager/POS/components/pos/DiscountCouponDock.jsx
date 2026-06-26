import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePos } from "../../../../../context/PosContext";
import { isOffPremiseOrderType } from "./posDisplayLabels";

export default function DiscountCouponDock() {
  const { currentOrderType } = usePos();
  const [mountNode, setMountNode] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const isOffPremise = isOffPremiseOrderType(currentOrderType);

  useEffect(() => {
    if (!isOffPremise) {
      setIsOpen(false);
      if (mountNode?.parentNode) mountNode.parentNode.removeChild(mountNode);
      setMountNode(null);
      return undefined;
    }

    const attach = () => {
      const wrapper = document.querySelector("[data-pos-order-panel]");
      const headerRight = wrapper?.querySelector('[class*="headerRight"]');
      if (!wrapper || !headerRight) return;

      const existing = headerRight.querySelector('[data-pos-discount-dock="true"]');
      if (existing) {
        setMountNode(existing);
        return;
      }

      const node = document.createElement("div");
      node.dataset.posDiscountDock = "true";
      headerRight.prepend(node);
      setMountNode(node);
    };

    attach();
    const frame = window.requestAnimationFrame(attach);
    return () => {
      window.cancelAnimationFrame(frame);
      setMountNode((node) => {
        if (node?.parentNode) node.parentNode.removeChild(node);
        return null;
      });
    };
  }, [isOffPremise]);

  useEffect(() => {
    const wrapper = document.querySelector("[data-pos-order-panel]");
    if (!wrapper) return undefined;

    if (isOffPremise && isOpen) {
      wrapper.dataset.discountPopoverOpen = "true";
    } else {
      delete wrapper.dataset.discountPopoverOpen;
    }

    return () => {
      delete wrapper.dataset.discountPopoverOpen;
    };
  }, [isOpen, isOffPremise]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleMouseDown = (event) => {
      const target = event.target;
      const wrapper = document.querySelector("[data-pos-order-panel]");
      const discountBox = wrapper?.querySelector('[class*="discountBox"]');
      const dock = document.querySelector('[data-pos-discount-dock="true"]');

      if (discountBox?.contains(target) || dock?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!isOffPremise || !mountNode) return null;

  return createPortal(
    <>
      <style>{`
        [data-pos-order-panel] > [class*="discountBox"] {
          display: none !important;
        }
        [data-pos-order-panel][data-discount-popover-open="true"] > [class*="discountBox"] {
          display: block !important;
          position: absolute !important;
          top: 56px !important;
          left: 12px !important;
          right: 12px !important;
          z-index: 95 !important;
          margin: 0 !important;
          max-height: min(58vh, 520px) !important;
          overflow: auto !important;
          box-shadow: 0 24px 56px rgba(15, 23, 42, 0.18) !important;
        }
      `}</style>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        title={isOpen ? "Đóng ưu đãi / coupon" : "Mở ưu đãi / coupon"}
        style={{
          height: 34,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: isOpen ? "1px solid #fb923c" : "1px solid #fed7aa",
          borderRadius: 999,
          background: isOpen ? "#ffedd5" : "#fff7ed",
          color: "#9a3412",
          padding: "0 0.72rem",
          fontSize: 11,
          fontWeight: 900,
          cursor: "pointer",
          whiteSpace: "nowrap",
          boxShadow: isOpen
            ? "0 8px 18px rgba(249, 115, 22, 0.16)"
            : "0 4px 12px rgba(15, 23, 42, 0.05)",
        }}
      >
        🎟 Ưu đãi
      </button>
    </>,
    mountNode,
  );
}
