// src/components/Customer/RestaurantMenu/RestaurantMenu.jsx
import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import "./RestaurantMenu.scss";
import Cart from "../../Customer/Homepage_Client/components/Cart";
import { MOCK_RESTAURANTS, MOCK_MENU_ITEMS, MOCK_CATEGORIES } from "./menuData";
// 👉 DÙNG CART CONTEXT (bọc hook useCart cũ)
import { useCart } from "../../../context/CartProvider"; // chỉnh lại path nếu cần

// --- HELPERS ---
const formatCurrency = (val) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    val
  );
const ITEMS_PER_PAGE = 8;

// =========================================================================
// 1. COMPONENT: MODAL CHỌN MÓN
// =========================================================================
const ProductModal = ({ item, onClose, onAddToCart }) => {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [selectedVariant, setSelectedVariant] = useState(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  useEffect(() => {
    if (item.servingVariants?.length > 0)
      setSelectedVariant(item.servingVariants[0]);
  }, [item]);

  const handleImageError = (e) => {
    e.target.src = "https://placehold.co/600x400/e2e8f0/94a3b8?text=Food+Image";
  };

  const unitPrice = item.basePrice;
  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    const cartItem = {
      id: item.id,
      cartId: `${item.id}-${selectedVariant?.name || "default"}-${Date.now()}`,
      name: item.name + (selectedVariant ? ` (${selectedVariant.name})` : ""),
      price: unitPrice,
      quantity,
      restaurantId: item.restaurantId,
      thumbImage: item.thumbImage,
      note,
    };
    onAddToCart(cartItem);
    onClose();
  };

  return createPortal(
    <div className="modal-menu-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-img">
          <img
            src={item.thumbImage}
            alt={item.name}
            onError={handleImageError}
          />
          <button className="close-btn mobile-only" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-info">
          <button className="close-btn desktop-only" onClick={onClose}>
            ✕
          </button>
          <h2>{item.name}</h2>
          <p className="desc">{item.description}</p>

          {item.servingVariants?.length > 0 && (
            <div className="option-section">
              <h3>Tùy chọn</h3>
              <div className="options-grid">
                {item.servingVariants.map((v, i) => (
                  <button
                    key={i}
                    className={selectedVariant === v ? "selected" : ""}
                    onClick={() => setSelectedVariant(v)}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="option-section">
            <h3>Ghi chú</h3>
            <textarea
              className="note-input"
              placeholder="Ví dụ: Không hành, ít đá..."
              rows="2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            ></textarea>
          </div>

          <div className="modal-footer">
            <div className="qty-control">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                -
              </button>
              <span>{quantity}</span>
              <button onClick={() => setQuantity((q) => q + 1)}>+</button>
            </div>
            <button className="add-cart-btn" onClick={handleAddToCart}>
              <span>Thêm vào giỏ</span>
              <span>{formatCurrency(totalPrice)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// =========================================================================
// 2. UI NHỎ
// =========================================================================
const RestaurantCard = ({ data, onClick }) => (
  <div className="res-card fade-in" onClick={onClick}>
    <div className="cover">
      <img src={data.cover} alt={data.name} loading="lazy" />
      <div className="cuisine-badge">{data.cuisine}</div>
    </div>
    <div className="logo-wrapper">
      <img src={data.logo} alt="logo" />
    </div>
    <div className="info">
      <h3 className="res-name">{data.name}</h3>
      <div className="res-stats">
        <span className="rating">★ {data.rating}</span>
        <span>• {data.reviews} đánh giá</span>
      </div>
      <div className="res-footer">
        <svg width="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
        </svg>
        <span>{data.address}</span>
      </div>
    </div>
  </div>
);

const MenuItemCard = ({ item, onClick }) => {
  const handleImageError = (e) => {
    e.target.src = "https://placehold.co/600x400/e2e8f0/94a3b8?text=Food+Image";
  };
  return (
    <div
      className={`item-card ${item.status === "inactive" ? "inactive" : ""}`}
      onClick={() => item.status !== "inactive" && onClick(item)}
    >
      <div className="thumb">
        <img
          src={item.thumbImage}
          alt={item.name}
          loading="lazy"
          onError={handleImageError}
        />
        {item.status === "inactive" && <span className="badge">Hết hàng</span>}
      </div>
      <div className="details">
        <h4 title={item.name}>{item.name}</h4>
        <p title={item.description}>{item.description}</p>
        {item.servingVariants?.length > 0 && (
          <div className="variants">
            {item.servingVariants.map((v, i) => (
              <span key={i}>{v.name}</span>
            ))}
          </div>
        )}
        <div className="bottom">
          <span className="price">{formatCurrency(item.basePrice)}</span>
          <button className="add-btn">+</button>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 3. VIEW CHI TIẾT THỰC ĐƠN NHÀ HÀNG
// =========================================================================
const MenuDetailView = ({ restaurant, onBack, onAddToCart }) => {
  const [timeSlot, setTimeSlot] = useState("lunch");
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);

  const filteredItems = useMemo(() => {
    return MOCK_MENU_ITEMS.filter((item) => {
      const matchRes = item.restaurantId === restaurant.id;
      const matchSlot = item.timeSlot ? item.timeSlot === timeSlot : true;
      const matchCat =
        activeCat === "all" ? true : item.categoryId === activeCat;
      const matchSearch = item.name
        .toLowerCase()
        .includes(search.toLowerCase());
      return matchRes && matchSlot && matchCat && matchSearch;
    });
  }, [restaurant.id, timeSlot, activeCat, search]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const currentItems = filteredItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [timeSlot, activeCat, search]);

  return (
    <div className="fade-in">
      <header className="menu-header">
        <div className="header-content">
          <div className="top-row">
            <button onClick={onBack} className="back-btn">
              ⬅ Quay lại
            </button>
            <h2>{restaurant.name}</h2>
            <div className="search-box">
              <input
                placeholder="Tìm món..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span>🔍</span>
            </div>
            <div className="view-toggle">
              <button
                className={viewMode === "grid" ? "active" : ""}
                onClick={() => setViewMode("grid")}
              >
                ⊞
              </button>
              <button
                className={viewMode === "list" ? "active" : ""}
                onClick={() => setViewMode("list")}
              >
                ☰
              </button>
            </div>
          </div>
          <div className="tabs-row">
            {[
              { id: "breakfast", label: "🍳 Bữa Sáng" },
              { id: "lunch", label: "☀️ Bữa Trưa" },
              { id: "dinner", label: "🌙 Bữa Tối" },
              { id: "late_night", label: "🦉 Ăn Đêm" },
            ].map((s) => (
              <div
                key={s.id}
                className={`tab ${timeSlot === s.id ? "active" : ""}`}
                onClick={() => setTimeSlot(s.id)}
              >
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="grid-container">
        <div className="category-filter">
          <div className="pills">
            <button
              className={activeCat === "all" ? "active" : ""}
              onClick={() => setActiveCat("all")}
            >
              Tất cả
            </button>
            {MOCK_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className={activeCat === cat.id ? "active" : ""}
                onClick={() => setActiveCat(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#999" }}>
            Không tìm thấy món nào.
          </div>
        ) : (
          <>
            <div
              className={`grid-container menu-grid ${
                viewMode === "list" ? "list-view" : ""
              }`}
              style={{ padding: 0 }}
            >
              {currentItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onClick={setSelectedItem}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  &lt;
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    className={currentPage === idx + 1 ? "active" : ""}
                    onClick={() => setCurrentPage(idx + 1)}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  &gt;
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedItem && (
        <ProductModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAddToCart={onAddToCart}
        />
      )}
    </div>
  );
};

// =========================================================================
// 4. ROOT: DÙNG CART ĐỒNG BỘ (CONTEXT)
// =========================================================================
const RestaurantMenu = () => {
  const [selectedRes, setSelectedRes] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // 👉 Dùng cart dùng chung
  const {
    cart,
    addToCart,
    updateQuantity,
    clearCart,
    removeRestaurantItems,
    getTotalItems,
    getTotalPrice,
  } = useCart();

  const handleAddToCart = (newItem) => {
    addToCart(newItem);

    const btn = document.querySelector(".floating-cart-btn");
    if (btn) {
      btn.style.transform = "scale(1.2)";
      setTimeout(() => (btn.style.transform = "scale(1)"), 200);
    }
  };

  const handleUpdateQuantity = (cartItemId, delta) => {
    updateQuantity(cartItemId, delta);
  };

  const handleRemoveRestaurantItems = (restaurantId) => {
    removeRestaurantItems(restaurantId);
  };

  const handleClearCart = () => {
    if (window.confirm("Bạn muốn xóa toàn bộ giỏ hàng?")) {
      clearCart();
    }
  };

  const totalPrice = getTotalPrice();
  const totalCount = getTotalItems();

  return (
    <div className="restaurant-app">
      {!selectedRes && (
        <div className="hero-section fade-in">
          <h1>
            Khám phá <span>Ẩm thực đỉnh cao</span>
          </h1>
          <p>Lựa chọn nhà hàng yêu thích và tận hưởng hương vị tuyệt vời.</p>
        </div>
      )}

      {selectedRes ? (
        <MenuDetailView
          restaurant={selectedRes}
          onBack={() => setSelectedRes(null)}
          onAddToCart={handleAddToCart}
        />
      ) : (
        <div className="grid-container res-grid">
          {MOCK_RESTAURANTS.map((res) => (
            <RestaurantCard
              key={res.id}
              data={res}
              onClick={() => setSelectedRes(res)}
            />
          ))}
        </div>
      )}

      {/* FLOATING CART BUTTON */}
      {cart.length > 0 && (
        <button
          className="floating-cart-btn fade-in"
          onClick={() => setIsCartOpen(true)}
        >
          <span className="cart-icon">🛒</span>
          <span className="cart-count">{totalCount}</span>
          <span className="cart-total">{formatCurrency(totalPrice)}</span>
        </button>
      )}

      {/* CART SLIDE-OUT */}
      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        totalPrice={totalPrice}
        onCheckoutSuccess={clearCart}
        onClearCart={handleClearCart}
        onRemoveRestaurantItems={handleRemoveRestaurantItems}
      />
    </div>
  );
};

export default RestaurantMenu;
