import React, { useEffect } from "react";
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from "react-icons/fi";
import "./MenuToast.scss";

const ICONS = { success: FiCheckCircle, error: FiAlertCircle, warning: FiAlertCircle, info: FiInfo };

const MenuToast = ({ toasts = [], onDismiss }) => {
  useEffect(() => {
    const timers = toasts.map((toast) => setTimeout(() => onDismiss?.(toast.id), toast.duration || 3200));
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [toasts, onDismiss]);

  return (
    <div className="menu-toast-stack" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type] || FiInfo;
        return (
          <div key={toast.id} className={`menu-toast menu-toast--${toast.type || "info"}`}>
            <Icon size={16} />
            <span>{toast.message}</span>
            <button type="button" onClick={() => onDismiss?.(toast.id)}><FiX size={14} /></button>
          </div>
        );
      })}
    </div>
  );
};

export default MenuToast;
