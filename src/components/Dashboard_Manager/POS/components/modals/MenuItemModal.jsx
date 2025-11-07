// src/components/Dashboard_Manager/POS/components/modals/MenuItemModal.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import s from "./MenuItemModal.module.scss";
import { formatPrice } from "../../utils/format";
import { flyToOrder } from "../../../../../utils/flyToOrder";

export default function MenuItemModal({ isOpen, item, onAdd, onClose }) {
  const [qty, setQty] = useState(1); // numeric source of truth
  const [qtyInput, setQtyInput] = useState("1"); // text input (allows '', '.5', '1,25'…)
  const [cooking, setCooking] = useState(null);
  const [unit, setUnit] = useState("portion"); // 'portion' | 'kg'
  const [note, setNote] = useState("");
  const [price, setPrice] = useState(0);
  const [servingVariants, setServingVariants] = useState([]);

  /* ----------------------- helpers ----------------------- */
  const toNumber = (v) => {
    if (typeof v !== "string") return Number(v) || 0;
    // accept ',' as decimal, accept leading '.' => '0.'
    const norm = v.replace(",", ".").replace(/^\.([0-9])/, "0.$1");
    const n = Number(norm);
    return Number.isFinite(n) ? n : NaN;
  };

  const clampForUnit = useCallback(
    (n) => {
      if (!Number.isFinite(n)) return unit === "kg" ? 0.5 : 1;
      if (unit === "kg") {
        // allow 0.1 precision, min 0.1
        const fixed = Math.max(0.1, Math.round(n * 100) / 100);
        return fixed;
      }
      // portion: integers >= 1
      return Math.max(1, Math.floor(n));
    },
    [unit]
  );

  const setQtyFromInput = useCallback(
    (text) => {
      setQtyInput(text);
      if (text === "" || text === "." || text === "," || text === "-") {
        // allow empty/partial while typing
        return;
      }
      const n = toNumber(text);
      if (!Number.isNaN(n)) {
        setQty(clampForUnit(n));
      }
    },
    [clampForUnit]
  );

  const bump = (delta) => {
    if (unit === "kg") {
      const next = clampForUnit((Number.isFinite(qty) ? qty : 0.5) + delta);
      setQty(next);
      setQtyInput(String(next));
    } else {
      const next = clampForUnit((Number.isFinite(qty) ? qty : 1) + delta);
      setQty(next);
      setQtyInput(String(next));
    }
  };

  const onBlurQty = () => {
    if (qtyInput === "" || qtyInput === "." || qtyInput === ",") {
      const fallback = unit === "kg" ? 0.5 : 1;
      setQty(fallback);
      setQtyInput(String(fallback));
      return;
    }
    const n = toNumber(qtyInput);
    const fixed = clampForUnit(Number.isNaN(n) ? (unit === "kg" ? 0.5 : 1) : n);
    setQty(fixed);
    setQtyInput(String(fixed));
  };

  const onChangeUnit = (next) => {
    const normalized = next === "kg" ? "kg" : "portion";
    setUnit(normalized);
    // provide sensible default & allow typing from blank
    const base = normalized === "kg" ? 0.5 : 1;
    setQty(base);
    setQtyInput(String(base));
  };

  /* ----------------------- init per open/item ----------------------- */
  useEffect(() => {
    if (isOpen && item) {
      const defaultCooking =
        item.preparationMethods?.find((m) => m.isDefault) ??
        item.preparationMethods?.[0] ??
        null;

      setCooking(defaultCooking ? defaultCooking.name : null);
      setPrice(defaultCooking?.price ?? item.basePrice ?? 0);
      setServingVariants(item.servingVariants ?? []);

      // auto detect unit -> normalize strictly to 'portion' | 'kg'
      const hasPortion = item.servingVariants?.some(
        (v) => v.mode === "PORTION"
      );
      const hasWeight = item.servingVariants?.some(
        (v) => v.mode === "BY_WEIGHT"
      );
      const first = hasPortion ? "portion" : hasWeight ? "kg" : "portion";
      onChangeUnit(first);

      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, item]);

  /* ----------------------- derived ----------------------- */
  const variantKeys = useMemo(() => {
    return servingVariants.length
      ? servingVariants.map((v) => (v.mode === "BY_WEIGHT" ? "kg" : "portion"))
      : ["portion"];
  }, [servingVariants]);

  const formattedPrice = formatPrice(price);

  /* ----------------------- add to order ----------------------- */
  const handleAdd = () => {
    // ensure final numeric qty
    const n = clampForUnit(toNumber(qtyInput));
    const finalQty = Number.isFinite(n) ? n : unit === "kg" ? 0.5 : 1;

    const menuCard = document.querySelector(`[data-menu-id="${item.id}"]`);
    const rightPanel = document.querySelector("[data-pos-order-panel]");
    if (menuCard && rightPanel) flyToOrder(menuCard, rightPanel);

    onAdd?.({
      menuItem: item,
      quantity: finalQty,
      cookingOption: cooking,
      unit,
      note,
      price,
    });
  };

  if (!isOpen || !item) return null;

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
              {variantKeys.map((v) => (
                <button
                  key={v}
                  className={`${s.chip} ${unit === v ? s.active : ""}`}
                  onClick={() => onChangeUnit(v)}
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
              <button
                className={s.qtyBtn}
                onClick={() => bump(unit === "kg" ? -0.1 : -1)}
              >
                −
              </button>
              {/* text input to allow '' / ',' / '.' while typing */}
              <input
                className={s.qtyInput}
                type="text"
                inputMode={unit === "kg" ? "decimal" : "numeric"}
                value={qtyInput}
                onChange={(e) => {
                  const val = e.target.value;
                  if (unit === "kg") {
                    // allow digits, comma, dot; block other letters
                    if (/^[0-9.,]*$/.test(val) || val === "") {
                      setQtyFromInput(val);
                    }
                  } else {
                    // integers only (but allow empty while typing)
                    if (/^[0-9]*$/.test(val) || val === "") {
                      setQtyFromInput(val);
                    }
                  }
                }}
                onBlur={onBlurQty}
                placeholder={unit === "kg" ? "0,5" : "1"}
              />
              <button
                className={s.qtyBtn}
                onClick={() => bump(unit === "kg" ? +0.1 : +1)}
              >
                +
              </button>
            </div>

            {unit === "kg" ? (
              <div className={s.hint}>
                Cho phép số thập phân (dùng “.” hoặc “,”), tối thiểu 0.1.
              </div>
            ) : (
              <div className={s.hint}>Nhập số nguyên ≥ 1.</div>
            )}
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
