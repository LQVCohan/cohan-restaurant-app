import React from "react";
import "./StatusChip.scss";

export default function StatusChip({ status }) {
  const s = (status || "").toLowerCase();

  const configMap = {
    // --- Đơn hàng (Orders) ---
    pending: { text: "Chờ xác nhận", icon: "⏳", style: "warning" },
    confirmed: { text: "Đang chuẩn bị", icon: "👨‍🍳", style: "primary" },
    preparing: { text: "Đang nấu", icon: "🔥", style: "primary" },
    ready: { text: "Sẵn sàng", icon: "🔔", style: "primary" },
    shipping: { text: "Đang giao", icon: "🚚", style: "primary" },
    delivering: { text: "Đang giao", icon: "🚚", style: "primary" },
    completed: { text: "Hoàn thành", icon: "🎉", style: "success" },
    cancelled: { text: "Đã hủy", icon: "❌", style: "danger" },
    rejected: { text: "Bị từ chối", icon: "⛔", style: "danger" },

    // --- Đặt bàn (Reservations) ---
    pending_payment: { text: "Chờ thanh toán", icon: "💸", style: "warning" },
    reserved: { text: "Đã đặt", icon: "📅", style: "primary" },
    booked: { text: "Đã đặt", icon: "📅", style: "primary" },
    checked_in: { text: "Đã đến", icon: "👋", style: "success" },
    expired: { text: "Hết hạn", icon: "⚠️", style: "danger" },
  };

  const cfg = configMap[s] || {
    text: s || "Không rõ",
    icon: "❔",
    style: "default",
  };

  return (
    <span className={`status-chip status-${cfg.style}`}>
      <span className="chip-icon">{cfg.icon}</span>
      <span className="chip-text">{cfg.text}</span>
    </span>
  );
}
