import React, { useState, useEffect, useMemo } from "react";
import stylesModal from "./MenuItemModal.module.scss";

export default function MenuItemModal({ isOpen, item, onAdd, onClose }) {
  const [qty, setQty] = useState(1);
  const [cooking, setCooking] = useState(null);
  const [unit, setUnit] = useState("portion");
  const [note, setNote] = useState("");
  const [price, setPrice] = useState(0);
  const [servingVariants, setServingVariants] = useState([]);
  const [selectedVariantKey, setSelectedVariantKey] = useState(null);

  // bảo vệ
  const prepMethods = Array.isArray(item?.preparationMethods)
    ? item.preparationMethods
    : [];

  // giá default ưu tiên: _displayPrice (tính ở CenterPanel) -> basePrice -> price
  const baseDisplayPrice = useMemo(() => {
    if (!item) return 0;
    return (
      Number(item._displayPrice ?? 0) ||
      Number(item.basePrice ?? 0) ||
      Number(item.price ?? 0) ||
      0
    );
  }, [item]);

  useEffect(() => {
    if (!isOpen || !item) return;

    // reset state khi mở modal
    setQty(1);
    setNote("");
    const variants = Array.isArray(item.servingVariants)
      ? item.servingVariants
      : [];
    setServingVariants(variants);

    // chọn cooking default
    let initialCooking = null;
    let initialPrice = baseDisplayPrice;

    if (prepMethods.length > 0) {
      const def =
        prepMethods.find((m) => m?.isDefault) || prepMethods[0] || null;
      initialCooking = def?.name || null;
      if (def?.price != null) {
        initialPrice = Number(def.price);
      }
    }

    // nếu có servingVariants → xác định unit
    if (variants.length > 0) {
      // ưu tiên PORTION
      const portionVar = variants.find((v) => v.mode === "PORTION");
      const weightVar = variants.find((v) => v.mode === "BY_WEIGHT");
      if (portionVar) {
        setUnit("portion");
        setSelectedVariantKey(portionVar.key);
        // nếu variant có price riêng thì dùng
        if (typeof portionVar.price === "number") {
          initialPrice = portionVar.price;
        }
        if (portionVar.preparationMethodName) {
          initialCooking = portionVar.preparationMethodName;
        }
      } else if (weightVar) {
        setUnit("kg");
        setSelectedVariantKey(weightVar.key);
        if (typeof weightVar.price === "number") {
          initialPrice = weightVar.price;
        }
        if (weightVar.preparationMethodName) {
          initialCooking = weightVar.preparationMethodName;
        }
      } else {
        // không match gì → để mặc định
        setUnit("portion");
        setSelectedVariantKey(variants[0]?.key ?? null);
      }
    } else {
      // không có variants → mặc định portion
      setUnit("portion");
      setSelectedVariantKey(null);
    }

    setCooking(initialCooking);
    setPrice(initialPrice);
  }, [isOpen, item, prepMethods, baseDisplayPrice]);

  const change = (d) => setQty((q) => Math.max(1, q + d));

  const handleCookingChange = (selectedCooking) => {
    setCooking(selectedCooking.name);
    // nếu cooking có price riêng thì set, không thì giữ nguyên
    if (typeof selectedCooking.price === "number") {
      setPrice(Number(selectedCooking.price));
    }
  };

  const handleSelectVariant = (variant) => {
    setSelectedVariantKey(variant.key);
    // đổi unit theo variant
    if (variant.mode === "PORTION") {
      setUnit("portion");
    } else if (variant.mode === "BY_WEIGHT") {
      setUnit("kg");
    } else {
      // fallback
      setUnit(variant.mode?.toLowerCase?.() || "portion");
    }

    // nếu variant có cách chế biến riêng
    if (variant.preparationMethodName) {
      setCooking(variant.preparationMethodName);
    }

    // nếu variant có price riêng thì set
    if (typeof variant.price === "number") {
      setPrice(Number(variant.price));
    } else {
      // không có thì giữ price hiện tại
    }
  };

  const handleQuantityChange = (e) => {
    const value = e.target.value;
    // nếu đơn vị là portion thì chỉ cho số nguyên
    if (unit === "portion" && !Number.isInteger(Number(value))) {
      return;
    }
    setQty(Number(value) || 1);
  };

  const add = () => {
    if (!item) return;
    onAdd?.({
      menuItem: {
        // GỬI ĐỦ để useOrderManagement không lỗi
        id: item.id,
        dishId: item.dishId || item.id,
        name: item.name,
        price: price,
        _displayPrice: price,
        menuId: item.menuId || item.menu_id || null,
        categoryId: item.categoryId || item.category_id || null,
        image: item.thumbImage || item.image || null,
        servingVariants: item.servingVariants || [],
        preparationMethods: item.preparationMethods || [],
        byWeight: !!item.byWeight,
      },
      quantity: qty,
      cookingOption: cooking,
      unit,
      note,
      price,
      // để sau này nếu muốn lưu theo variant
      servingVariantKey: selectedVariantKey,
    });
  };

  if (!isOpen || !item) return null;

  const formattedPrice =
    typeof price === "number" ? `₫ ${price.toLocaleString("vi-VN")}` : "₫ 0";

  return (
    <div className={stylesModal.backdrop}>
      <div className={stylesModal.modal}>
        <div className={stylesModal.header}>
          <h3 className={stylesModal.title}>{item.name}</h3>
          <button className={stylesModal.close} onClick={onClose}>
            ×
          </button>
        </div>

        {/* Cách chế biến */}
        <div className={stylesModal.group}>
          <label className={stylesModal.label}>Cách chế biến:</label>
          <div className={stylesModal.grid}>
            {prepMethods.length === 0 ? (
              <div className={stylesModal.noPrepContainer}>
                <span className={stylesModal.noPrepIcon}>⚠️</span>
                <p className={stylesModal.noPrepText}>
                  Món ăn này không có cách chế biến đặc biệt.
                </p>
              </div>
            ) : (
              prepMethods.map((o) => (
                <button
                  /* dùng name làm key là ok vì server trả uniq */
                  key={o.name}
                  className={`${stylesModal.opt} ${
                    cooking === o.name ? stylesModal.optActive : ""
                  }`}
                  onClick={() => handleCookingChange(o)}
                >
                  {o.name}
                  {typeof o.price === "number" && o.price > 0
                    ? ` (+${o.price.toLocaleString("vi-VN")}đ)`
                    : ""}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Đơn vị / Serving variant */}
        <div className={stylesModal.group}>
          <label className={stylesModal.label}>Đơn vị tính / Khẩu phần:</label>
          <div className={stylesModal.grid}>
            {servingVariants.length === 0 ? (
              <button
                className={`${stylesModal.opt} ${
                  unit === "portion" ? stylesModal.optActive : ""
                }`}
                onClick={() => {
                  setUnit("portion");
                  setSelectedVariantKey(null);
                  // khi quay về portion mà không có variant thì dùng giá base
                  setPrice(baseDisplayPrice);
                }}
              >
                Phần
              </button>
            ) : (
              servingVariants.map((variant) => (
                <button
                  key={variant.key}
                  className={`${stylesModal.opt} ${
                    selectedVariantKey === variant.key
                      ? stylesModal.optActive
                      : ""
                  }`}
                  onClick={() => handleSelectVariant(variant)}
                >
                  {variant.mode === "PORTION"
                    ? "Phần"
                    : variant.mode === "BY_WEIGHT"
                    ? "Kg"
                    : variant.mode}
                  {typeof variant.price === "number" &&
                  Number(variant.price) > 0
                    ? ` · ${Number(variant.price).toLocaleString("vi-VN")}đ`
                    : ""}
                  {variant.preparationMethodName
                    ? ` · ${variant.preparationMethodName}`
                    : ""}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Số lượng */}
        <div className={stylesModal.group}>
          <label className={stylesModal.label}>Số lượng:</label>
          <div className={stylesModal.qtyRow}>
            <button className={stylesModal.qtyBtn} onClick={() => change(-1)}>
              −
            </button>
            <input
              className={stylesModal.input}
              type="number"
              min={1}
              value={qty}
              onChange={handleQuantityChange}
            />
            <button className={stylesModal.qtyBtn} onClick={() => change(+1)}>
              +
            </button>
          </div>
        </div>

        {/* Giá */}
        <div className={stylesModal.group}>
          <label className={stylesModal.label}>Giá:</label>
          <div className={stylesModal.price}>
            <span>{formattedPrice}</span>
          </div>
        </div>

        {/* Ghi chú */}
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

        {/* Actions */}
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
