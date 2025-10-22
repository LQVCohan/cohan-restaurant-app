import React from "react";

const map = {
  pending_payment: { text: "Chờ thanh toán", icon: "⏳" },
  pending: { text: "Chờ xử lý", icon: "⏳" },
  confirmed: { text: "Đã xác nhận", icon: "✅" },
  preparing: { text: "Đang chuẩn bị", icon: "👨‍🍳" },
  ready: { text: "Sẵn sàng", icon: "🔔" },
  completed: { text: "Hoàn thành", icon: "🎉" },
  cancelled: { text: "Đã hủy", icon: "❌" },
};

export default function StatusChip({ status }) {
  const s = (status || "").toLowerCase();
  const cfg = map[s] || { text: s, icon: "📋" };
  return (
    <span className="status-chip">
      {cfg.icon} {cfg.text}
    </span>
  );
}
