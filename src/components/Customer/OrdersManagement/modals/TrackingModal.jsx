// src/components/orders/modals/TrackingModal.jsx
import React, { useMemo } from "react";
import Modal, { ModalFooter } from "@/components/common/Modal";
import "./TrackingModal.scss";

/**
 * Props
 * - isOpen: boolean
 * - onClose: () => void
 * - order: {
 *     id, createdAt, currentStatus, statusTimeline?: [{status, at, note}]
 *   }
 * - onCallShipper?: () => void
 */
const STAGES = [
  { key: "pending", label: "Chờ xác nhận", icon: "🕒" },
  { key: "confirmed", label: "Đang chế biến", icon: "👨‍🍳" },
  { key: "shipping", label: "Đang giao", icon: "🚚" },
  { key: "arrived", label: "Đã đến", icon: "📍" },
  { key: "completed", label: "Đã nhận", icon: "✅" },
];

export default function TrackingModal({
  isOpen,
  onClose,
  order,
  onCallShipper,
}) {
  const progressIndex = useMemo(() => {
    const map = new Map(STAGES.map((s, i) => [s.key, i]));
    const key = String(order?.currentStatus || "").toLowerCase();
    return map.has(key) ? map.get(key) : 0;
  }, [order]);

  if (!isOpen) return null;

  const timeline = Array.isArray(order?.statusTimeline)
    ? order.statusTimeline
    : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📍 Theo dõi đơn hàng"
      size="md"
    >
      <div className="tracking">
        <div className="tracking__steps">
          {STAGES.map((s, idx) => {
            const active = idx <= progressIndex;
            return (
              <div key={s.key} className={`step ${active ? "active" : ""}`}>
                <div className="step__dot">{s.icon}</div>
                <div className="step__label">{s.label}</div>
                {idx < STAGES.length - 1 && (
                  <div
                    className={`step__line ${
                      idx < progressIndex ? "filled" : ""
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="tracking__meta">
          <div>
            <strong>Mã đơn:</strong> #{order?.id}
          </div>
          <div>
            <strong>Khởi tạo:</strong>{" "}
            {order?.createdAt
              ? new Date(order.createdAt).toLocaleString("vi-VN")
              : "—"}
          </div>
          <div>
            <strong>Trạng thái hiện tại:</strong> {order?.currentStatus || "—"}
          </div>
        </div>

        <div className="tracking__timeline">
          <h4>Nhật ký trạng thái</h4>
          {timeline.length === 0 ? (
            <div className="tracking__empty">Chưa có nhật ký chi tiết.</div>
          ) : (
            <ul>
              {timeline.map((ev, i) => (
                <li key={i}>
                  <span className="time">
                    {ev?.at ? new Date(ev.at).toLocaleString("vi-VN") : "—"}
                  </span>
                  <span className="status">{ev?.status}</span>
                  {ev?.note && <span className="note"> • {ev.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ModalFooter>
        <button className="btn btn--secondary" onClick={onCallShipper}>
          📞 Gọi shipper
        </button>
        <button className="btn btn--primary" onClick={onClose}>
          Đóng
        </button>
      </ModalFooter>
    </Modal>
  );
}
