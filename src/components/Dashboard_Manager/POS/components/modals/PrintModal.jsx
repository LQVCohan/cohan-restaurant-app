import React from "react";
import s from "./PrintModal.module.scss";

export function PrintModal({
  isOpen,
  printTypes = ["kitchen", "bar", "temp-bill", "final-bill"],
  selectedType = "kitchen",
  printers = [],
  selectedPrinter,
  preview,
  onPickType,
  onPickPrinter,
  onAddQueue,
  onPrintNow,
  onClose,
}) {
  if (!isOpen) return null;
  const label = {
    kitchen: "Đơn bếp",
    bar: "Đơn bar",
    "temp-bill": "Bill tạm",
    "final-bill": "Bill cuối",
  };
  const icon = {
    kitchen: "👨‍🍳",
    bar: "🍹",
    "temp-bill": "📄",
    "final-bill": "🧾",
  };

  return (
    <div className={s.backdrop}>
      <div className={s.modal} role="dialog" aria-modal>
        <div className={s.header}>
          <h3 className={s.title}>Hệ thống in ấn</h3>
          <button className={s.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={s.grid}>
          <div>
            <div className={s.opts}>
              {printTypes.map((t) => (
                <div
                  key={t}
                  className={`${s.opt} ${
                    selectedType === t ? s.optActive : ""
                  }`}
                  onClick={() => onPickType?.(t)}
                >
                  <div style={{ fontSize: "2rem", marginBottom: ".5rem" }}>
                    {icon[t]}
                  </div>
                  <div style={{ fontWeight: 600 }}>{label[t]}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "1rem" }}>
              <div style={{ fontWeight: 500, marginBottom: ".5rem" }}>
                Chọn máy in:
              </div>
              <div className={s.printers}>
                {printers.map((p) => (
                  <div
                    key={p.id}
                    className={`${s.card} ${
                      selectedPrinter?.id === p.id ? s.cardActive : ""
                    }`}
                    onClick={() => onPickPrinter?.(p)}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <span
                        className={`${s.status} ${
                          p.status === "online"
                            ? s.online
                            : p.status === "busy"
                            ? s.busy
                            : s.offline
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <div style={{ fontSize: ".85rem", color: "#64748b" }}>
                      IP: {p.ip} · {p.type}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 500, marginBottom: ".5rem" }}>
              Xem trước:
            </div>
            <div className={s.preview}>
              <pre style={{ whiteSpace: "pre-wrap" }}>{preview}</pre>
            </div>
          </div>
        </div>

        <div className={s.actions}>
          <button className={s.btn} onClick={onClose}>
            Hủy
          </button>
          <button className={`${s.btn} ${s.primary}`} onClick={onAddQueue}>
            Thêm vào hàng đợi
          </button>
          <button className={`${s.btn} ${s.success}`} onClick={onPrintNow}>
            In ngay
          </button>
        </div>
      </div>
    </div>
  );
}
