// src/components/ui/Toast.jsx
import React, { useEffect } from "react";
import "./Toast.scss";

export default function Toast({ items = [], onClose }) {
  useEffect(() => {
    const timers = items.map((t) => setTimeout(() => onClose?.(t.id), 4000));
    return () => timers.forEach(clearTimeout);
  }, [items, onClose]);

  if (!items?.length) return null;

  return (
    <div className="toast">
      {items.map((t) => (
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
      ))}
    </div>
  );
}
