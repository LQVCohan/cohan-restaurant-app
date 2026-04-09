import React, { useState, useMemo } from "react";
import s from "./SplitTableModal.module.scss";
import useModalClosePipeline from "../../../../../hooks/useModalClosePipeline";
import useModalDraft from "../../../../../hooks/useModalDraft";
import { useNotification } from "../../../../../hooks/useNotification";

export function SplitTableModal({
  isOpen,
  tables = [],
  items = [],
  onConfirm,
  onClose,
}) {
  const { showNotification } = useNotification();
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [selected, setSelected] = useState(new Set());
  const hasDirtyForm = !!source || !!target || selected.size > 0;

  const { requestCloseWithDraft, clearDraft } = useModalDraft({
    enabled: isOpen,
    draftIdentity: {
      module: "pos",
      modal: "split-table-modal",
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: "create",
      entityType: "table-split",
      recordId: source || null,
      context: "pos-right-panel",
      schemaVersion: "1",
    },
    formValue: { source, target, selected: [...selected] },
    isDirty: hasDirtyForm,
    sanitize: (v) => ({
      source: v?.source || "",
      target: v?.target || "",
      selected: Array.isArray(v?.selected) ? v.selected : [],
    }),
    onRestore: (draft) => {
      setSource(draft?.source || "");
      setTarget(draft?.target || "");
      setSelected(new Set(Array.isArray(draft?.selected) ? draft.selected : []));
    },
    notify: showNotification,
  });

  const { requestClose, onBackdropMouseDown } = useModalClosePipeline({
    isOpen,
    onClose: () => requestCloseWithDraft(() => onClose?.()),
  });

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
    <div
      className={s.backdrop}
      onMouseDown={onBackdropMouseDown}
      role="dialog"
      aria-modal="true"
    >
      <div className={s.modal} onMouseDown={(e) => e.stopPropagation()} tabIndex={-1}>
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
          <button onClick={() => requestClose("cancel")}>Hủy</button>
          <button
            onClick={() => {
              onConfirm?.({ source, target, selected: [...selected] });
              clearDraft();
            }}
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
