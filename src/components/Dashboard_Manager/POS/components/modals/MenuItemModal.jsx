import React, { useState, useEffect } from "react";
import stylesModal from "./MenuItemModal.module.scss";

export default function MenuItemModal({ isOpen, item, onAdd, onClose }) {
  const [qty, setQty] = useState(1);
  const [cooking, setCooking] = useState(null);
  const [unit, setUnit] = useState("portion"); // Mặc định là "portion"
  const [note, setNote] = useState("");
  const [price, setPrice] = useState(0);
  const [servingVariants, setServingVariants] = useState([]);

  // Đảm bảo modal hiển thị đúng khi mở
  useEffect(() => {
    if (isOpen && item) {
      const defaultCooking = item.preparationMethods.find(
        (method) => method.isDefault
      );
      setCooking(
        defaultCooking ? defaultCooking.name : item.preparationMethods[0]?.name
      );
      setPrice(
        defaultCooking
          ? defaultCooking.price
          : item.preparationMethods[0]?.price
      );

      // Lấy dữ liệu servingVariants từ item và quyết định đơn vị tính
      const variants = item.servingVariants || [];
      setServingVariants(variants);

      // Nếu có servingVariants, ưu tiên theo "PORTION" hoặc "BY_WEIGHT"
      const defaultUnit = variants.find((variant) => variant.mode === "PORTION")
        ? "portion"
        : variants.find((variant) => variant.mode === "BY_WEIGHT")
        ? "kg"
        : "portion"; // Nếu không có gì, mặc định là "portion"
      setUnit(defaultUnit);
    }
  }, [isOpen, item]);

  const change = (d) => setQty((q) => Math.max(1, q + d));

  const handleCookingChange = (selectedCooking) => {
    setCooking(selectedCooking.name);
    setPrice(selectedCooking.price);
  };

  const add = () => {
    onAdd?.({
      menuItem: item,
      quantity: qty,
      cookingOption: cooking,
      unit,
      note,
      price,
    });
  };

  const handleQuantityChange = (e) => {
    const value = e.target.value;
    // Validate số lượng chỉ được phép là số nguyên khi chọn "Portion"
    if (unit === "portion" && !Number.isInteger(Number(value))) {
      return;
    }
    setQty(Number(value) || 1);
  };

  if (!isOpen || !item) return null;

  // Kiểm tra và đảm bảo giá hợp lệ trước khi gọi .toLocaleString()
  const formattedPrice = price ? price.toLocaleString() : "₫ 0";

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
            {item.preparationMethods.length === 0 ? (
              // Nếu không có preparationMethods, hiển thị thông báo
              <div className={stylesModal.noPrepContainer}>
                <span className={stylesModal.noPrepIcon}>⚠️</span>
                <p className={stylesModal.noPrepText}>
                  Món ăn này không có cách chế biến đặc biệt.
                </p>
              </div>
            ) : (
              item.preparationMethods.map((o) => (
                <button
                  key={o.name}
                  className={`${stylesModal.opt} ${
                    cooking === o.name ? stylesModal.optActive : ""
                  }`}
                  onClick={() => handleCookingChange(o)}
                >
                  {o.name}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Đơn vị tính (Portion hoặc Kg) */}
        <div className={stylesModal.group}>
          <label className={stylesModal.label}>Đơn vị tính:</label>
          <div className={stylesModal.grid}>
            {servingVariants.length === 0 ? (
              // Không có servingVariants, mặc định chọn "Portion"
              <button
                className={`${stylesModal.opt} ${
                  unit === "portion" ? stylesModal.optActive : ""
                }`}
                onClick={() => setUnit("portion")}
              >
                Portion
              </button>
            ) : (
              // Hiển thị theo servingVariants
              servingVariants.map((variant) => (
                <button
                  key={variant.key}
                  className={`${stylesModal.opt} ${
                    unit === variant.mode.toLowerCase()
                      ? stylesModal.optActive
                      : ""
                  }`}
                  onClick={() => setUnit(variant.mode.toLowerCase())}
                >
                  {variant.mode === "PORTION"
                    ? "Portion"
                    : variant.mode === "BY_WEIGHT"
                    ? "Kg"
                    : variant.mode}
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

        {/* Hiển thị giá */}
        <div className={stylesModal.group}>
          <label className={stylesModal.label}>Giá:</label>
          <div className={stylesModal.price}>
            <span>{`₫ ${formattedPrice}`}</span>
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

        {/* Nút hành động */}
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
