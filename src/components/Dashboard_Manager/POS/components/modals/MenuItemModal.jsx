// src/components/Dashboard_Manager/POS/components/modals/MenuItemModal.jsx
import React, { useState, useEffect } from "react";
import s from "./MenuItemModal.module.scss";
import { formatPrice } from "../../utils/format";
import { flyToOrder } from "../../../../../utils/flyToOrder";
export default function MenuItemModal({ isOpen, item, onAdd, onClose }) {
  const [qty, setQty] = useState(1);
  const [cooking, setCooking] = useState(null);
  const [unit, setUnit] = useState("portion");
  const [note, setNote] = useState("");
  const [price, setPrice] = useState(0);
  const [servingVariants, setServingVariants] = useState([]);

  useEffect(() => {
    if (isOpen && item) {
      const defaultCooking =
        item.preparationMethods?.find((m) => m.isDefault) ??
        item.preparationMethods?.[0] ??
        null;
      setCooking(defaultCooking ? defaultCooking.name : null);
      setPrice(defaultCooking?.price ?? item.basePrice ?? 0);
      setServingVariants(item.servingVariants ?? []);

      // auto chọn unit
      const hasPortion = item.servingVariants?.some(
        (v) => v.mode === "PORTION"
      );
      const hasWeight = item.servingVariants?.some(
        (v) => v.mode === "BY_WEIGHT"
      );
      setUnit(hasPortion ? "portion" : hasWeight ? "kg" : "portion");
      setQty(1);
      setNote("");
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const formattedPrice = formatPrice(price);
  const changeQty = (d) => setQty((q) => Math.max(1, q + d));

  const handleAdd = () => {
    const menuCard = document.querySelector(`[data-menu-id="${item.id}"]`);
    const rightPanel = document.querySelector("[data-pos-order-panel]");
    if (menuCard && rightPanel) flyToOrder(menuCard, rightPanel);
    onAdd?.({
      menuItem: item,
      quantity: qty,
      cookingOption: cooking,
      unit,
      note,
      price,
    });
  };

  return (
    <div className={s.backdrop} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className={s.header}>
          {item.thumbImage ? (
            <img src={item.thumbImage} alt={item.name} className={s.image} />
          ) : (
            <div className={s.imagePlaceholder}>🍽️</div>
          )}
          <button className={s.close} onClick={onClose}>
            ×
          </button>
        </div>

        {/* BODY */}
        <div className={s.body}>
          <h3 className={s.title}>{item.name}</h3>
          {item.description && <p className={s.desc}>{item.description}</p>}

          {/* Cách chế biến */}
          <div className={s.group}>
            <div className={s.label}>Cách chế biến:</div>
            {item.preparationMethods?.length ? (
              <div className={s.optionList}>
                {item.preparationMethods.map((m) => (
                  <button
                    key={m.name}
                    onClick={() => {
                      setCooking(m.name);
                      setPrice(m.price);
                    }}
                    className={`${s.chip} ${
                      cooking === m.name ? s.active : ""
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className={s.noOption}>Không có tuỳ chọn đặc biệt</div>
            )}
          </div>

          {/* Đơn vị tính */}
          <div className={s.group}>
            <div className={s.label}>Đơn vị tính:</div>
            <div className={s.optionList}>
              {(servingVariants.length
                ? servingVariants.map((v) => v.mode.toLowerCase())
                : ["portion"]
              ).map((v) => (
                <button
                  key={v}
                  className={`${s.chip} ${unit === v ? s.active : ""}`}
                  onClick={() => setUnit(v)}
                >
                  {v === "portion" ? "Phần" : "Kg"}
                </button>
              ))}
            </div>
          </div>

          {/* Số lượng */}
          <div className={s.group}>
            <div className={s.label}>Số lượng:</div>
            <div className={s.qtyControls}>
              <button className={s.qtyBtn} onClick={() => changeQty(-1)}>
                −
              </button>
              <input
                className={s.qtyInput}
                type="number"
                min={1}
                step={unit === "kg" ? 0.1 : 1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value) || 1)}
              />
              <button className={s.qtyBtn} onClick={() => changeQty(+1)}>
                +
              </button>
            </div>
          </div>

          {/* Ghi chú */}
          <div className={s.group}>
            <div className={s.label}>Ghi chú cho bếp:</div>
            <textarea
              className={s.textarea}
              rows={3}
              value={note}
              placeholder="Không cay, ít muối..."
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className={s.footer}>
          <div className={s.priceBox}>
            <span className={s.priceLabel}>Giá:</span>
            <strong className={s.priceValue}>{formattedPrice}</strong>
          </div>

          <button className={s.addBtn} onClick={handleAdd}>
            + Thêm vào đơn
          </button>
        </div>
      </div>
    </div>
  );
}
