import React, { useState, useEffect } from "react";
import {
  X,
  Printer,
  Wifi,
  MapPin,
  Save,
  Zap,
  CheckCircle2,
  HardDrive,
  FileText,
} from "lucide-react";
import { PRINT_STATIONS } from "@/utils/printStations";
import s from "./PrinterSettingsModal.module.scss";
import useModalKeyboardClose from "./useModalKeyboardClose";

const PRINTER_TYPES = [
  {
    id: "thermal",
    label: "In nhiệt (80mm)",
    icon: <Printer size={20} />,
    desc: "Hóa đơn, Bếp",
  },
  {
    id: "thermal-58",
    label: "In nhiệt (58mm)",
    icon: <HardDrive size={20} />,
    desc: "Tem nhãn",
  },
  {
    id: "laser",
    label: "In Laser A4",
    icon: <FileText size={20} />,
    desc: "Báo cáo",
  },
];

export function PrinterSettingsModal({
  isOpen,
  printer,
  onTest,
  onSave,
  onClose,
}) {
  const [form, setForm] = useState({
    name: "",
    ip: "",
    type: "thermal",
    location: "kitchen",
  });

  const [isTesting, setIsTesting] = useState(false);
  useModalKeyboardClose({ isOpen, onClose, disabled: isTesting });

  useEffect(() => {
    if (isOpen) {
      // Reset hoặc fill data khi mở modal
      setForm({
        name: printer?.name || "",
        ip: printer?.ip || "",
        type: printer?.type || "thermal",
        location: printer?.location || "kitchen",
      });
    }
  }, [isOpen, printer]);

  if (!isOpen) return null;

  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleTest = () => {
    setIsTesting(true);
    onTest?.(form);
    // Giả lập delay để tạo cảm giác hệ thống đang xử lý
    setTimeout(() => setIsTesting(false), 1500);
  };

  return (
    <div className={s.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={s.modal}
        onClick={(e) => e.stopPropagation()} // Ngăn click xuyên qua modal đóng backdrop
        role="document"
        tabIndex={-1}
      >
        {/* HEADER */}
        <div className={s.header}>
          <div className={s.headerTitle}>
            <div className={s.iconBg}>
              <Printer size={24} />
            </div>
            <div>
              <h3>{printer ? "Cấu hình thiết bị" : "Thêm máy in mới"}</h3>
              <p>Thiết lập thông số kết nối và vị trí</p>
            </div>
          </div>
          <button className={s.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={s.body}>
          {/* SECTION 1: GENERAL INFO */}
          <div className={s.row}>
            <div className={s.group}>
              <label>Tên định danh</label>
              <div className={s.inputWrapper}>
                <Printer size={16} className={s.inputIcon} />
                <input
                  value={form.name}
                  onChange={(e) => change("name", e.target.value)}
                  placeholder="Ví dụ: Máy in Bếp Nóng"
                  autoFocus
                />
              </div>
            </div>

            <div className={s.group}>
              <label>Địa chỉ IP (LAN)</label>
              <div className={s.inputWrapper}>
                <Wifi size={16} className={s.inputIcon} />
                <input
                  value={form.ip}
                  onChange={(e) => change("ip", e.target.value)}
                  placeholder="192.168.1.xxx"
                  className={s.monoFont}
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: PRINTER TYPE (VISUAL SELECT) */}
          <div className={s.group}>
            <label>Loại thiết bị</label>
            <div className={s.typeGrid}>
              {PRINTER_TYPES.map((type) => (
                <div
                  key={type.id}
                  className={`${s.typeCard} ${form.type === type.id ? s.active : ""}`}
                  onClick={() => change("type", type.id)}
                >
                  <div className={s.checkIcon}>
                    <CheckCircle2 size={14} />
                  </div>
                  <div className={s.cardIcon}>{type.icon}</div>
                  <span className={s.cardLabel}>{type.label}</span>
                  <span className={s.cardDesc}>{type.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 3: LOCATION */}
          <div className={s.group}>
            <label>Vị trí lắp đặt</label>
            <div className={s.selectWrapper}>
              <MapPin size={16} className={s.inputIcon} />
              <select
                value={form.location}
                onChange={(e) => change("location", e.target.value)}
              >
                {PRINT_STATIONS.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.label} - {station.description}
                  </option>
                ))}
                <option value="manager">Văn phòng Quản lý</option>
              </select>
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className={s.footer}>
          <button
            className={`${s.btn} ${s.btnGhost} ${isTesting ? s.loading : ""}`}
            onClick={handleTest}
            disabled={isTesting}
          >
            {isTesting ? (
              <>Running...</>
            ) : (
              <>
                <Zap size={18} /> Test Connection
              </>
            )}
          </button>

          <button
            className={`${s.btn} ${s.btnPrimary}`}
            onClick={() => onSave?.(form)}
          >
            <Save size={18} /> Lưu cấu hình
          </button>
        </div>
      </div>
    </div>
  );
}
