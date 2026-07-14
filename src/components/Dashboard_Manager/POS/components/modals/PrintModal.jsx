import React, { useEffect, useMemo } from "react";
import s from "./PrintModal.module.scss";
import useModalKeyboardClose from "./useModalKeyboardClose";

export function PrintModal({
  isOpen,
  mode = "temp",
  modes = [
    { id: "temp", label: "Tạm tính (in toàn bộ)" },
    { id: "stations", label: "In theo quầy" },
  ],
  printers = [],
  selectedPrinter,
  tempPreview = "",
  stationPreviews = [],
  onChangeMode,
  onPickPrinter,
  onAddQueue,
  onPrintNow,
  onOpenQueue,
  onClose,
}) {
  useModalKeyboardClose({ isOpen, onClose });

  const tempPrinters = useMemo(() => {
    const cashierPrinters = printers.filter(
      (printer) =>
        String(printer?.location || "")
          .trim()
          .toLowerCase() === "cashier",
    );
    return cashierPrinters.length ? cashierPrinters : printers;
  }, [printers]);

  useEffect(() => {
    if (!isOpen || mode !== "temp" || !tempPrinters.length) return;
    const selectedIsAvailable = tempPrinters.some(
      (printer) => String(printer?.id) === String(selectedPrinter?.id),
    );
    if (!selectedIsAvailable) onPickPrinter?.(tempPrinters[0]);
  }, [isOpen, mode, onPickPrinter, selectedPrinter?.id, tempPrinters]);

  if (!isOpen) return null;

  return (
    <div className={s.backdrop} onMouseDown={onClose} role="dialog" aria-modal>
      <div
        className={s.modal}
        role="document"
        onMouseDown={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className={s.header}>
          <h3 className={s.title}>In hóa đơn & phiếu bếp</h3>
          <button className={s.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={s.modes}>
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${s.modeBtn} ${mode === item.id ? s.modeActive : ""}`}
              onClick={() => onChangeMode?.(item.id)}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            className={s.queueBtn}
            onClick={onOpenQueue}
          >
            Hàng đợi in
          </button>
        </div>

        {mode === "temp" ? (
          <div className={s.grid}>
            <div>
              <div className={s.sectionTitle}>Chọn máy in tạm tính</div>
              <div className={s.printers}>
                {tempPrinters.map((p) => (
                  <div
                    key={p.id}
                    className={`${s.card} ${
                      selectedPrinter?.id === p.id ? s.cardActive : ""
                    }`}
                    onClick={() => onPickPrinter?.(p)}
                  >
                    <div className={s.cardHeader}>
                      <div className={s.cardName}>{p.name}</div>
                      <span
                        className={`${s.status} ${
                          p.status === "online"
                            ? s.online
                            : p.status === "busy"
                              ? s.busy
                              : s.offline
                        }`}
                      >
                        {p.status === "online"
                          ? "Sẵn sàng"
                          : p.status === "busy"
                            ? "Đang in"
                            : "Ngoại tuyến"}
                      </span>
                    </div>
                    <div className={s.cardMeta}>
                      IP: {p.ip} · {p.type}
                    </div>
                  </div>
                ))}
                {!tempPrinters.length && (
                  <div className={s.preview}>Chưa cấu hình máy in thu ngân.</div>
                )}
              </div>
            </div>

            <div>
              <div className={s.sectionTitle}>Xem trước tạm tính</div>
              <div className={s.preview}>
                <pre style={{ whiteSpace: "pre-wrap" }}>{tempPreview}</pre>
              </div>
            </div>
          </div>
        ) : (
          <div className={s.stationGrid}>
            {stationPreviews.map((station) => (
              <div key={station.id} className={s.stationCard}>
                <div className={s.stationHeader}>
                  <div>
                    <div className={s.stationTitle}>{station.label}</div>
                    <div className={s.stationMeta}>
                      {station.printers.length
                        ? `Máy in: ${station.printers
                            .map((p) => p.name)
                            .join(", ")}`
                        : "Chưa gán máy in"}
                    </div>
                  </div>
                </div>
                <div className={s.preview}>
                  <pre style={{ whiteSpace: "pre-wrap" }}>
                    {station.preview || "Không có món để in"}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}

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
