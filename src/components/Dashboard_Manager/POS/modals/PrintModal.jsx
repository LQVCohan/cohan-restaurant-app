import React, { useState } from "react";
import Modal from "../../../common/Modal";
import "./PrintModal.scss";
import Button from "../../../common/Button";

const TYPES = [
  { id: "kitchen", name: "Phiếu bếp" },
  { id: "bar", name: "Phiếu bar" },
  { id: "bill", name: "Hóa đơn tạm tính" },
];

export default function PrintModal({
  open,
  onClose,
  printers = [],
  queue = [],
  onPrint,
}) {
  const [type, setType] = useState("bill");
  const [selected, setSelected] = useState(null);

  const handlePrint = () => {
    if (!selected) return;
    onPrint?.({ type, printerId: selected.id });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="In hóa đơn / phiếu"
      size="lg"
      footer={
        <div className="print-actions">
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button variant="primary" onClick={handlePrint}>
            In
          </Button>
        </div>
      }
    >
      <div className="print-modal">
        <div className="print-types">
          <h4>Loại tài liệu</h4>
          <div className="type-buttons">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`type-btn ${type === t.id ? "active" : ""}`}
                onClick={() => setType(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="print-content">
          <section className="printer-section">
            <h4>Máy in</h4>
            <div className="printers-list">
              {printers.map((p) => {
                const cls = [
                  "printer-item",
                  p.status, // "online" | "offline" | "busy"
                  selected?.id === p.id && "selected",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={cls}
                    disabled={p.status !== "online"}
                    onClick={() => setSelected(p)}
                  >
                    <div className="printer-info">
                      <div className="printer-name">
                        <span className={`status-icon ${p.status}`} />
                        {p.name}
                      </div>
                      <div className="printer-details">
                        <span>Model: {p.model}</span>
                        <span>IP: {p.ip}</span>
                      </div>
                    </div>
                    {selected?.id === p.id ? (
                      <span className="selected-icon">✔</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="queue-section">
            <h4 className="queue-header">Hàng đợi in</h4>
            {!queue.length ? (
              <div className="queue-empty">Chưa có lệnh in.</div>
            ) : (
              <div className="queue-list">
                {queue.map((q) => (
                  <div key={q.id} className={`queue-item ${q.status}`}>
                    <div className="queue-info">
                      <div className="queue-header-info">
                        <strong>#{q.code}</strong>
                        <span className={`queue-status ${q.status}`}>
                          {q.status === "printing"
                            ? "Đang in…"
                            : q.status === "completed"
                            ? "Hoàn tất"
                            : "Lỗi"}
                        </span>
                      </div>
                      <div className="queue-printer">
                        Máy in: {q.printerName}
                      </div>
                      <div className="queue-items">{q.items} trang</div>
                    </div>
                    <div>
                      {new Date(q.createdAt).toLocaleTimeString("vi-VN")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </Modal>
  );
}
