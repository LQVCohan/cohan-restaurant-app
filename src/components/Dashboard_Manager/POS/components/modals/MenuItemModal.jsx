import React, { useState } from "react";
import stylesModal from "./MenuItemModal.module.scss";

export default function MenuItemModal({ isOpen, item, onAdd, onClose }) {
  const [qty, setQty] = useState(1);
  const [cooking, setCooking] = useState("Bình thường");
  const [unit, setUnit] = useState("Phần");
  const [note, setNote] = useState("");

  if (!isOpen || !item) return null;
  const change = (d) => setQty((q) => Math.max(1, q + d));
  const add = () =>
    onAdd?.({
      menuItem: item,
      quantity: qty,
      cookingOption: cooking,
      unit,
      note,
    });

  return (
    <div className={stylesModal.backdrop}>
      <div className={stylesModal.modal}>
        <div className={stylesModal.header}>
          <h3 className={stylesModal.title}>{item.name}</h3>
          <button className={stylesModal.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={stylesModal.group}>
          <label className={stylesModal.label}>Cách chế biến:</label>
          <div className={stylesModal.grid}>
            {["Bình thường", "Ít cay", "Cay vừa", "Cay nhiều"].map((o) => (
              <button
                key={o}
                className={`${stylesModal.opt} ${
                  cooking === o ? stylesModal.optActive : ""
                }`}
                onClick={() => setCooking(o)}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <div className={stylesModal.group}>
          <label className={stylesModal.label}>Đơn vị tính:</label>
          <div className={stylesModal.grid}>
            {["Phần", "Kg", "Suất"].map((o) => (
              <button
                key={o}
                className={`${stylesModal.opt} ${
                  unit === o ? stylesModal.optActive : ""
                }`}
                onClick={() => setUnit(o)}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <div className={stylesModal.group}>
          <label className={stylesModal.label}>Số lượng:</label>
          <div className={stylesModal.qtyRow}>
            <button className={stylesModal.qtyBtn} onClick={() => change(-1)}>
              -
            </button>
            <input
              className={stylesModal.input}
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value) || 1)}
            />
            <button className={stylesModal.qtyBtn} onClick={() => change(+1)}>
              +
            </button>
          </div>
        </div>

        <div className={stylesModal.group}>
          <label className={stylesModal.label}>Ghi chú:</label>
          <textarea
            className={`${stylesModal.input} ${stylesModal.textarea}`}
            rows={3}
            value={note}
            placeholder="Ghi chú đặc biệt..."
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className={stylesModal.actions}>
          <button
            className={`${stylesModal.btn} ${stylesModal.secondary}`}
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            className={`${stylesModal.btn} ${stylesModal.primary}`}
            onClick={add}
          >
            Thêm vào đơn
          </button>
        </div>
      </div>
    </div>
  );
}
