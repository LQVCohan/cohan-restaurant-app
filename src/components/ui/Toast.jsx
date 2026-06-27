// src/components/ui/Toast.jsx
import React, { useEffect, useState } from "react";
import "./Toast.scss";

const REORDER_TOAST_TEXT = "Đã thêm món từ đơn cũ vào giỏ hàng.";
const CART_ADD_VALIDATION_EVENT = "cohan:cart-add-validation";

const getInitialCartValidation = () => {
  if (typeof window === "undefined") return null;
  return window.__cohanCartAddValidation || null;
};

const resolveToast = (toast, cartValidation) => {
  if (toast?.text !== REORDER_TOAST_TEXT || !cartValidation?.total) return toast;

  const { total, pending, success, skipped } = cartValidation;

  if (pending > 0) {
    return {
      ...toast,
      text: `Đang kiểm tra ${total} món trong đơn cũ...`,
      type: "success",
    };
  }

  if (success <= 0 && skipped > 0) {
    return {
      ...toast,
      text: "Các món trong đơn cũ hiện không còn khả dụng để đặt lại.",
      type: "error",
    };
  }

  if (success > 0 && skipped > 0) {
    return {
      ...toast,
      text: `Đã thêm ${success}/${total} món còn khả dụng vào giỏ hàng. ${skipped} món đã được bỏ qua.`,
      type: "success",
    };
  }

  if (success > 0) {
    return {
      ...toast,
      text: `Đã thêm ${success} món còn khả dụng vào giỏ hàng.`,
      type: "success",
    };
  }

  return toast;
};

export default function Toast({ items = [], onClose }) {
  const [cartValidation, setCartValidation] = useState(getInitialCartValidation);

  useEffect(() => {
    const timers = items.map((t) => setTimeout(() => onClose?.(t.id), 4000));
    return () => timers.forEach(clearTimeout);
  }, [items, onClose]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleCartValidation = (event) => setCartValidation(event.detail || null);
    window.addEventListener(CART_ADD_VALIDATION_EVENT, handleCartValidation);
    return () => window.removeEventListener(CART_ADD_VALIDATION_EVENT, handleCartValidation);
  }, []);

  if (!items?.length) return null;

  return (
    <div className="toast">
      {items.map((rawToast) => {
        const t = resolveToast(rawToast, cartValidation);
        return (
          <div
            key={t.id}
            className={`toast-item ${t.type === "error" ? "error" : "success"}`}
          >
            <span>{t.type === "error" ? "❌" : "✅"}</span>
            <span>{t.text}</span>
            <button className="toast-close" onClick={() => onClose?.(t.id)}>
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
