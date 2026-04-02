// src/components/orders/modals/TrackingModal.jsx
import React, { useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import "./TrackingModal.scss";

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
  const [zoomedImage, setZoomedImage] = useState(null);

  const progressIndex = useMemo(() => {
    const map = new Map(STAGES.map((s, i) => [s.key, i]));
    const key = String(order?.currentStatus || "").toLowerCase();
    return map.has(key) ? map.get(key) : 0;
  }, [order]);

  if (!isOpen) return null;

  const timeline = Array.isArray(order?.statusTimeline)
    ? order.statusTimeline
    : [];

  const orderItems = Array.isArray(order?.items) ? order.items : [];

  return (
    <>
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

          <div className="tracking__proofs">
            <h4>Ảnh minh chứng món ăn</h4>
            {orderItems.length === 0 ? (
              <div className="tracking__empty">Không có dữ liệu món trong đơn.</div>
            ) : (
              orderItems.map((item) => {
                const images = Array.isArray(item?.proofImages)
                  ? item.proofImages.filter(Boolean)
                  : [];
                return (
                  <div key={item?._id || `${item?.name}_${item?.quantity}`} className="proof-item-row">
                    <div className="proof-item-title">
                      {item?.quantity || 1}× {item?.name}
                    </div>
                    {images.length === 0 ? (
                      <div className="proof-item-empty">Chưa có ảnh minh chứng.</div>
                    ) : (
                      <div className="proof-grid">
                        {images.map((src, idx) => (
                          <button
                            key={`${src}_${idx}`}
                            type="button"
                            className="proof-thumb"
                            onClick={() => setZoomedImage(src)}
                          >
                            <img src={src} alt={`${item?.name}-${idx}`} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <Modal.Footer>
          <button className="btn btn--secondary" onClick={onCallShipper}>
            📞 Gọi shipper
          </button>
          <button className="btn btn--primary" onClick={onClose}>
            Đóng
          </button>
        </Modal.Footer>
      </Modal>

      {zoomedImage && (
        <div className="tracking-lightbox" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} alt="proof-large" />
        </div>
      )}
    </>
  );
}
