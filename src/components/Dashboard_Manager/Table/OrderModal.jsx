import React, { useState, useEffect } from "react";
import Modal from "../../common/Modal";
import "./OrderModal.scss";
import { menuData, cookingMethods } from "../../../data/menuData";
import { formatPrice } from "../../../utils/formatters";

const OrderModal = ({ isOpen, onClose, tableInfo = null }) => {
  const [cart, setCart] = useState([]);
  const [currentCategory, setCurrentCategory] = useState("rice");
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [showGeneralNote, setShowGeneralNote] = useState(false);
  const [generalNote, setGeneralNote] = useState("");

  // Reset state khi modal đóng
  useEffect(() => {
    if (!isOpen) {
      setCart([]);
      setExpandedItems(new Set());
      setSearchTerm("");
      setShowGeneralNote(false);
      setGeneralNote("");
      setCurrentCategory("rice");
    }
  }, [isOpen]);

  const getCategoryName = (category) => {
    const names = {
      rice: "Cơm",
      noodles: "Bún/Phở",
      seafood: "Hải Sản",
      appetizers: "Khai Vị",
      drinks: "Đồ Uống",
    };
    return names[category] || category;
  };

  const showCategory = (category) => {
    setCurrentCategory(category);
    setExpandedItems(new Set());
  };

  const toggleItemExpansion = (itemId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const quickAddToCart = (itemId) => {
    const allItems = Object.values(menuData).flat();
    const item = allItems.find((i) => i.id === itemId);

    let weight = 1;
    if (item.isSeafood) {
      const inputWeight = prompt("Nhập số kg:");
      weight = parseFloat(inputWeight) || 1;
    }

    const defaultMethod = { name: "Bình thường", price: 0 };
    const cartItem = {
      id: Date.now(),
      item: item,
      method: defaultMethod,
      weight: weight,
      note: "",
      total: item.isSeafood
        ? (item.basePrice + defaultMethod.price) * weight
        : item.price + defaultMethod.price,
    };

    setCart((prev) => [...prev, cartItem]);
  };

  const addItemWithMethod = (itemId, method) => {
    const allItems = Object.values(menuData).flat();
    const item = allItems.find((i) => i.id === itemId);

    let weight = 1;
    if (item.isSeafood) {
      const inputWeight = prompt("Nhập số kg:");
      weight = parseFloat(inputWeight) || 1;
    }

    const cartItem = {
      id: Date.now(),
      item: item,
      method: method,
      weight: weight,
      note: "",
      total: item.isSeafood
        ? (item.basePrice + method.price) * weight
        : item.price + method.price,
    };

    setCart((prev) => [...prev, cartItem]);
    // Đóng dropdown sau khi chọn
    setExpandedItems(new Set());
  };

  const addCustomMethodToItem = (itemId) => {
    const customName = document
      .getElementById(`custom-method-${itemId}`)
      ?.value.trim();
    const customPrice =
      parseInt(document.getElementById(`custom-price-${itemId}`)?.value) || 0;

    if (!customName) {
      alert("Vui lòng nhập tên cách chế biến!");
      return;
    }

    const allItems = Object.values(menuData).flat();
    const item = allItems.find((i) => i.id === itemId);
    const method = { name: customName, price: customPrice };

    let weight = 1;
    if (item.isSeafood) {
      const inputWeight = prompt("Nhập số kg:");
      weight = parseFloat(inputWeight) || 1;
    }

    const cartItem = {
      id: Date.now(),
      item: item,
      method: method,
      weight: weight,
      note: "",
      total: item.isSeafood
        ? (item.basePrice + method.price) * weight
        : item.price + method.price,
    };

    setCart((prev) => [...prev, cartItem]);

    // Clear inputs và đóng dropdown
    const methodInput = document.getElementById(`custom-method-${itemId}`);
    const priceInput = document.getElementById(`custom-price-${itemId}`);
    if (methodInput) methodInput.value = "";
    if (priceInput) priceInput.value = "";
    setExpandedItems(new Set());
  };

  const removeFromCart = (itemId) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateItemNote = (itemId, note) => {
    setCart((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, note } : item))
    );
  };

  const clearCart = () => {
    if (
      cart.length > 0 &&
      window.confirm("Bạn có chắc muốn xóa hết món trong giỏ hàng?")
    ) {
      setCart([]);
    }
  };

  const getTotalAmount = () => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  };

  const confirmOrder = () => {
    if (cart.length === 0) {
      alert("Giỏ hàng trống!");
      return;
    }

    const orderData = {
      tableInfo,
      items: cart,
      generalNote,
      total: getTotalAmount(),
      timestamp: new Date().toISOString(),
    };

    console.log("Order confirmed:", orderData);
    alert("Đặt món thành công! Đơn hàng đang được xử lý.");
    onClose();
  };

  const filteredItems = searchTerm
    ? menuData[currentCategory]?.filter((item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      ) || []
    : menuData[currentCategory] || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Đặt Món ${tableInfo ? `- ${tableInfo.name}` : ""}`}
      size="xl"
      className="order-modal"
    >
      <div className="order-modal__container">
        {/* Navigation Bar - Category Select + Search */}
        <div className="order-modal__navigation">
          <div className="category-selector">
            <select
              value={currentCategory}
              onChange={(e) => showCategory(e.target.value)}
              className="category-select"
            >
              {Object.keys(menuData).map((category) => (
                <option key={category} value={category}>
                  {getCategoryName(category)}
                </option>
              ))}
            </select>
          </div>

          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Tìm kiếm món ăn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <svg
              className="search-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Main Content */}
        <div className="order-modal__content">
          {/* Menu Section */}
          <div className="menu-section">
            <div className="menu-items">
              {filteredItems.map((item) => (
                <div key={item.id} className="menu-item">
                  <div className="menu-item__header">
                    <div className="item-image">{item.image}</div>
                    <div className="item-info">
                      <h4 className="item-name">{item.name}</h4>
                      <p className="item-price">
                        {item.isSeafood
                          ? `${formatPrice(item.basePrice)}/kg`
                          : formatPrice(item.price)}
                      </p>
                    </div>
                    <div className="item-actions">
                      <button
                        onClick={() => quickAddToCart(item.id)}
                        className="quick-add-btn"
                      >
                        Chọn Nhanh
                      </button>
                      <div className="cooking-method-dropdown">
                        <button
                          onClick={() => toggleItemExpansion(item.id)}
                          className="method-dropdown-btn"
                        >
                          Cách Chế Biến
                          <svg
                            className={`dropdown-arrow ${
                              expandedItems.has(item.id) ? "expanded" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>

                        {expandedItems.has(item.id) && (
                          <div className="method-dropdown-menu">
                            {cookingMethods[currentCategory]?.map(
                              (method, index) => (
                                <button
                                  key={index}
                                  onClick={() =>
                                    addItemWithMethod(item.id, method)
                                  }
                                  className="method-option"
                                >
                                  <span className="method-name">
                                    {method.name}
                                  </span>
                                  <span className="method-price">
                                    +{formatPrice(method.price)}
                                  </span>
                                </button>
                              )
                            )}

                            <div className="custom-method-section">
                              <div className="custom-method-inputs">
                                <input
                                  type="text"
                                  placeholder="Cách chế biến tùy chỉnh..."
                                  id={`custom-method-${item.id}`}
                                  className="custom-method-input"
                                />
                                <input
                                  type="number"
                                  placeholder="Giá"
                                  id={`custom-price-${item.id}`}
                                  className="custom-price-input"
                                />
                                <button
                                  onClick={() => addCustomMethodToItem(item.id)}
                                  className="add-custom-btn"
                                >
                                  Thêm
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cart Section */}
          <div className="cart-section">
            <div className="cart-header">
              <h3>Giỏ Hàng ({cart.length} món)</h3>
              {cart.length > 0 && (
                <button onClick={clearCart} className="clear-cart-btn">
                  Xóa Hết
                </button>
              )}
            </div>

            <div className="cart-items">
              {cart.length === 0 ? (
                <div className="empty-cart">
                  <div className="empty-cart-icon">🛒</div>
                  <p>Giỏ hàng trống</p>
                  <small>Chọn món ăn để bắt đầu đặt hàng</small>
                </div>
              ) : (
                cart.map((cartItem) => (
                  <div key={cartItem.id} className="cart-item">
                    <div className="cart-item__header">
                      <div className="item-details">
                        <h5 className="item-name">{cartItem.item.name}</h5>
                        <div className="item-specs">
                          <span className="item-method">
                            {cartItem.method.name}
                          </span>
                          {cartItem.item.isSeafood && (
                            <span className="item-weight">
                              {cartItem.weight}kg
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="item-price-actions">
                        <p className="item-total">
                          {formatPrice(cartItem.total)}
                        </p>
                        <button
                          onClick={() => removeFromCart(cartItem.id)}
                          className="remove-btn"
                          title="Xóa món"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <textarea
                      placeholder="Ghi chú cho món này..."
                      value={cartItem.note}
                      onChange={(e) =>
                        updateItemNote(cartItem.id, e.target.value)
                      }
                      className="item-note"
                      rows="2"
                    />
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer */}
            <div className="cart-footer">
              <div className="general-note-section">
                <button
                  onClick={() => setShowGeneralNote(!showGeneralNote)}
                  className="general-note-toggle"
                >
                  {showGeneralNote
                    ? "− Ẩn ghi chú chung"
                    : "+ Thêm ghi chú chung"}
                </button>
                {showGeneralNote && (
                  <textarea
                    placeholder="Ghi chú chung cho đơn hàng..."
                    value={generalNote}
                    onChange={(e) => setGeneralNote(e.target.value)}
                    className="general-note-input"
                    rows="3"
                  />
                )}
              </div>

              <div className="cart-summary">
                <div className="cart-total">
                  <span className="total-label">Tổng cộng:</span>
                  <span className="total-amount">
                    {formatPrice(getTotalAmount())}
                  </span>
                </div>

                <button
                  onClick={confirmOrder}
                  className="confirm-order-btn"
                  disabled={cart.length === 0}
                >
                  Xác Nhận Đặt Món ({cart.length} món)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default OrderModal;
