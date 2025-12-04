import React from "react";
import "./StatusChip.scss";

export default function StatusChip({ status }) {
  const s = (status || "").toLowerCase();

  // Cấu hình hiển thị cho từng trạng thái
  const configMap = {
    // --- Đơn hàng (Orders) ---
    pending: { text: "Chờ xác nhận", icon: "⏳", style: "warning" },
    confirmed: { text: "Đang chuẩn bị", icon: "👨‍🍳", style: "info" },
    preparing: { text: "Đang nấu", icon: "🔥", style: "info" },
    ready: { text: "Sẵn sàng", icon: "🔔", style: "info" },
    shipping: { text: "Đang giao", icon: "🚚", style: "info" },
    delivering: { text: "Đang giao", icon: "🚚", style: "info" },
    completed: { text: "Hoàn thành", icon: "🎉", style: "success" },
    cancelled: { text: "Đã hủy", icon: "❌", style: "danger" },
    rejected: { text: "Bị từ chối", icon: "⛔", style: "danger" },

    // --- Đặt bàn (Reservations) ---
    pending_payment: { text: "Chờ thanh toán", icon: "💸", style: "warning" },
    reserved: { text: "Đã đặt", icon: "📅", style: "info" },
    booked: { text: "Đã đặt", icon: "📅", style: "info" },
    checked_in: { text: "Đã đến", icon: "👋", style: "success" },
    expired: { text: "Hết hạn", icon: "⚠️", style: "danger" },
  };

  // Fallback nếu status không khớp
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
