import React, { useState } from "react";

export default function TableMapModal({ onClose }) {
  const [selected, setSelected] = useState(null);

  const isAvailable = (n) => [1, 3, 5, 7, 8].includes(n); // demo
  const seats = (n) => (n === 8 ? 8 : n >= 5 ? 6 : n >= 3 ? 4 : 2);

  return (
    <div
      className="modal"
      onClick={(e) => e.target.classList.contains("modal") && onClose?.()}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2>🪑 Sơ Đồ Bàn</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div style={{ textAlign: "center", marginBottom: "1rem" }}>
            <div
              style={{
                display: "inline-flex",
                gap: "1rem",
                background: "#f8fafc",
                padding: "1rem",
                borderRadius: 12,
              }}
            >
              <Legend color="#10b981" label="Bàn trống" />
              <Legend color="#ef4444" label="Đã đặt" />
              <Legend color="#f59e0b" label="Đang sử dụng" />
            </div>
          </div>

          <div
            style={{
              background: "#f8fafc",
              padding: "1.5rem",
              borderRadius: 16,
              position: "relative",
              minHeight: 360,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 10,
                left: "50%",
                transform: "translateX(-50%)",
                background: "#0284c7",
                color: "#fff",
                padding: ".5rem 1rem",
                borderRadius: 10,
                fontWeight: 700,
              }}
            >
              🚪 Lối vào
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: "1rem",
                marginTop: "3rem",
              }}
            >
              {Array.from({ length: 8 }).map((_, i) => {
                const n = i + 1;
                const available = isAvailable(n);
                const cap = seats(n);
                const bg = available
                  ? "#10b981"
                  : n % 3 === 0
                  ? "#f59e0b"
                  : "#ef4444";
                const w = cap >= 6 ? 100 : cap >= 4 ? 80 : 60;
                const h = 60;

                return (
                  <div
                    key={n}
                    className="table-item"
                    onClick={() => available && setSelected({ n, cap })}
                  >
                    <div
                      style={{
                        width: w,
                        height: h,
                        background: bg,
                        borderRadius: 8,
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        margin: "0 auto",
                        cursor: available ? "pointer" : "not-allowed",
                        outline:
                          selected?.n === n ? "3px solid #0284c7" : "none",
                      }}
                    >
                      {n}
                    </div>
                    <div
                      style={{
                        textAlign: "center",
                        marginTop: 6,
                        fontSize: 14,
                      }}
                    >
                      {cap} chỗ
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                position: "absolute",
                bottom: 10,
                right: 10,
                background: "#6b7280",
                color: "#fff",
                padding: ".4rem .8rem",
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              👨‍🍳 Bếp
            </div>
          </div>

          {selected && (
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                background: "#f0f9ff",
                borderRadius: 12,
              }}
            >
              <h4 style={{ margin: 0, color: "#0284c7" }}>
                Thông tin bàn đã chọn
              </h4>
              <p style={{ margin: ".25rem 0" }}>
                Bàn số <b>{selected.n}</b> — <b>{selected.cap}</b> chỗ
              </p>
              <button
                className="btn btn-success"
                onClick={() => {
                  alert(`✅ Đã gửi yêu cầu đặt bàn ${selected.n}`);
                  onClose?.();
                }}
              >
                📞 Đặt bàn này
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{ width: 18, height: 18, background: color, borderRadius: 4 }}
      />
      <span>{label}</span>
    </div>
  );
}
