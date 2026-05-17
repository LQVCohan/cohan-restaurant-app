// src/components/Customer/RestaurantMenu/components/ProductModal.jsx
import React, { useState, useEffect } from "react";
import { X, Minus, Plus } from "lucide-react";
import "../styles/ProductModal.scss";

const ProductModal = ({ product, onClose, onAddToCart }) => {
  // Legacy note: hiện chưa được render trong luồng customer chính; không dùng làm đường add cart production.
  // --- 1. KHAI BÁO HOOKS (Luôn để trên cùng, không được nằm trong if) ---

  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);

  // --- 2. EFFECT: Reset dữ liệu khi product thay đổi ---
  useEffect(() => {
    if (product) {
      setQuantity(1);
      setNote("");
      setSelectedSize(product.variants ? product.variants[0] : null);
      setSelectedToppings([]);

      // Logic chọn mặc định Cách chế biến
      const methods = product.cookingMethods || [
        { id: "m1", name: "Chiên nước mắm", price: 0 },
        { id: "m2", name: "Xào chua ngọt", price: 0 },
        { id: "m3", name: "Rang muối", price: 0 },
        { id: "m4", name: "Sốt bơ tỏi", price: 5000 },
      ];
      if (methods && methods.length > 0) {
        setSelectedMethod(methods[0]);
      }
    }
  }, [product]);

  // --- 3. KIỂM TRA NULL (Chỉ return SAU KHI đã gọi xong Hooks) ---

  // --- 4. DATA HELPER (Lấy dữ liệu để render) ---
  // Định nghĩa lại mảng này ở đây để dùng cho render và tính toán
  const cookingMethods = product.cookingMethods || [
    { id: "m1", name: "Chiên nước mắm", price: 0 },
    { id: "m2", name: "Xào chua ngọt", price: 0 },
    { id: "m3", name: "Rang muối", price: 0 },
    { id: "m4", name: "Sốt bơ tỏi", price: 5000 },
  ];

  // --- 5. HANDLERS ---
  const handleQuantityChange = (delta) => {
    const newQty = quantity + delta;
    if (newQty >= 1) setQuantity(newQty);
  };

  const toggleTopping = (topping) => {
    if (selectedToppings.find((t) => t.id === topping.id)) {
      setSelectedToppings(selectedToppings.filter((t) => t.id !== topping.id));
    } else {
      setSelectedToppings([...selectedToppings, topping]);
    }
  };

  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
  };

  const calculateTotal = () => {
    let total = product.price;
    if (selectedSize) total += selectedSize.price || 0;
    selectedToppings.forEach((t) => (total += t.price));
    if (selectedMethod) total += selectedMethod.price || 0;
    return total * quantity;
  };

  const handleAddToCart = () => {
    const finalItem = {
      ...product,
      displayName: `${product.name} ${
        selectedMethod ? `(${selectedMethod.name})` : ""
      }`,
      selectedSize,
      selectedToppings,
      selectedMethod,
      note,
      quantity,
      totalPrice: calculateTotal(),
    };
    onAddToCart(finalItem);
    onClose();
  };

  // --- 6. RENDER ---
  return (
    <div className="modal-menu-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Ảnh sản phẩm */}
        <div className="modal-img">
          <img src={product.image} alt={product.name} />
          <button className="close-btn mobile-only" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Thông tin chi tiết */}
        <div className="modal-info">
          <button className="close-btn desktop-only" onClick={onClose}>
            <X size={20} />
          </button>

          <h2>{product.name}</h2>
          <p className="desc">{product.description}</p>

          {/* Chọn Size */}
          {product.variants && (
            <div className="option-section">
              <h3>Kích thước</h3>
              <div className="options-grid">
                {product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    className={
                      selectedSize?.id === variant.id ? "selected" : ""
                    }
                    onClick={() => setSelectedSize(variant)}
                  >
                    {variant.name} (+{variant.price.toLocaleString()}đ)
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chọn Cách Chế Biến */}
          {cookingMethods && cookingMethods.length > 0 && (
            <div className="option-section">
              <h3>Bạn muốn chế biến kiểu nào?</h3>
              <div className="options-grid">
                {cookingMethods.map((method) => (
                  <button
                    key={method.id}
                    className={
                      selectedMethod?.id === method.id ? "selected" : ""
                    }
                    onClick={() => handleMethodSelect(method)}
                  >
                    {method.name}
                    {method.price > 0
                      ? ` (+${method.price.toLocaleString()}đ)`
                      : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chọn Topping */}
          <div className="option-section">
            <h3>Topping thêm</h3>
            <div className="options-grid">
              {[
                { id: 1, name: "Trân châu đen", price: 5000 },
                { id: 2, name: "Thạch dừa", price: 5000 },
              ].map((topping) => (
                <button
                  key={topping.id}
                  className={
                    selectedToppings.find((t) => t.id === topping.id)
                      ? "selected"
                      : ""
                  }
                  onClick={() => toggleTopping(topping)}
                >
                  {topping.name} (+{topping.price.toLocaleString()}đ)
                </button>
              ))}
            </div>
          </div>

          <textarea
            className="note-input"
            rows="2"
            placeholder="Ghi chú thêm (VD: cay ít, không hành...)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          ></textarea>

          <div className="modal-footer">
            <div className="qty-control">
              <button onClick={() => handleQuantityChange(-1)}>
                <Minus size={16} />
              </button>
              <span>{quantity}</span>
              <button onClick={() => handleQuantityChange(1)}>
                <Plus size={16} />
              </button>
            </div>
            <button className="add-cart-btn" onClick={handleAddToCart}>
              <span>Thêm {calculateTotal().toLocaleString()}đ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
