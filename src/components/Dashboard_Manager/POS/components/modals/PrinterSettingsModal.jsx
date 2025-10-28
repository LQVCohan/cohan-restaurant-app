import React, { useState, useEffect } from "react";
import s from "./PrinterSettingsModal.module.scss";

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

  useEffect(() => {
    if (printer) {
      setForm({
        name: printer.name || "",
        ip: printer.ip || "",
        type: printer.type || "thermal",
        location: printer.location || "kitchen",
      });
    }
  }, [printer]);

  if (!isOpen) return null;
  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className={s.backdrop}>
      <div className={s.modal} role="dialog" aria-modal>
        <div className={s.header}>
          <h3 className={s.title}>Cài đặt máy in</h3>
          <button className={s.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={s.group}>
          <label className={s.label}>Tên máy in</label>
          <input
            className={s.input}
            value={form.name}
            onChange={(e) => change("name", e.target.value)}
            placeholder="Máy in bếp chính"
          />
        </div>

        <div className={s.group}>
          <label className={s.label}>Địa chỉ IP</label>
          <input
            className={s.input}
            value={form.ip}
            onChange={(e) => change("ip", e.target.value)}
            placeholder="192.168.1.100"
          />
        </div>

        <div className={s.group}>
          <label className={s.label}>Loại máy in</label>
          <select
            className={s.select}
            value={form.type}
            onChange={(e) => change("type", e.target.value)}
          >
            <option value="thermal">Máy in nhiệt (80mm)</option>
            <option value="thermal-58">Máy in nhiệt (58mm)</option>
            <option value="laser">Máy in laser A4</option>
            <option value="inkjet">Máy in phun A4</option>
          </select>
        </div>

        <div className={s.group}>
          <label className={s.label}>Vị trí</label>
          <select
            className={s.select}
            value={form.location}
            onChange={(e) => change("location", e.target.value)}
          >
            <option value="kitchen">Bếp</option>
            <option value="bar">Bar</option>
            <option value="cashier">Thu ngân</option>
            <option value="manager">Quản lý</option>
          </select>
        </div>

        <div className={s.actions}>
          <button className={s.btn} onClick={() => onTest?.(form)}>
            Test in
          </button>
          <button
            className={`${s.btn} ${s.success}`}
            onClick={() => onSave?.(form)}
          >
            Lưu cài đặt
          </button>
        </div>
      </div>
    </div>
  );
}
