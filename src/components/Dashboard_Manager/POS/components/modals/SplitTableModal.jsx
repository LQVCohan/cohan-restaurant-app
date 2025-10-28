import React, { useState, useMemo } from "react";
import s from "./SplitTableModal.module.scss";

export function SplitTableModal({
  isOpen,
  tables = [],
  items = [],
  onConfirm,
  onClose,
}) {
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [selected, setSelected] = useState(new Set());

  const targets = useMemo(
    () => tables.filter((t) => t.status === "available" && t.code !== source),
    [tables, source]
  );

  const toggle = (id) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  if (!isOpen) return null;

  return (
    <div className={s.backdrop}>
      <div className={s.modal}>
        <h3 className={s.title}>Tách bàn</h3>
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">--Chọn bàn--</option>
          {tables.map((t) => (
            <option key={t.code} value={t.code}>
              {t.code}
            </option>
          ))}
        </select>
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">--Bàn đích--</option>
          {targets.map((t) => (
            <option key={t.code} value={t.code}>
              {t.code}
            </option>
          ))}
        </select>
        <div className={s.list}>
          {items.map((it) => (
            <label key={it.id}>
              <input
                type="checkbox"
                checked={selected.has(it.id)}
                onChange={() => toggle(it.id)}
              />
              {it.name} ×{it.quantity}
            </label>
          ))}
        </div>
        <div className={s.actions}>
          <button onClick={onClose}>Hủy</button>
          <button
            onClick={() =>
              onConfirm?.({ source, target, selected: [...selected] })
            }
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
