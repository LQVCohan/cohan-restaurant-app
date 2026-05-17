// src/components/Customer/RestaurantMenu/RestaurantMenu.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./RestaurantMenu.scss";
import Cart from "../../Customer/Homepage_Client/components/Cart";
import { useCart } from "../../../context/CartProvider";
import { MOCK_RESTAURANTS } from "./menuData";
import { formatCurrency } from "../../../utils/formatters";

// Components Con
import RestaurantCard from "./components/RestaurantCard";
import MenuDetailView from "./components/MenuDetailView";

const RestaurantMenu = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [selectedRes, setSelectedRes] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const restaurantParam = searchParams.get("restaurantId");
  const returnTo = searchParams.get("returnTo");

  // 👉 Dùng cart context
  const {
    cart,
    updateQuantity,
    clearCart,
    removeRestaurantItems,
    getTotalItems,
    getTotalPrice,
  } = useCart();

  const handleClearCart = () => {
    if (window.confirm("Bạn muốn xóa toàn bộ giỏ hàng?")) {
      clearCart();
    }
  };

  const totalPrice = getTotalPrice();
  const totalCount = getTotalItems();

  useEffect(() => {
    if (!restaurantParam) return;
    const found = MOCK_RESTAURANTS.find(
      (res) => String(res.id) === String(restaurantParam)
    );
    if (found) setSelectedRes(found);
  }, [restaurantParam]);

  const handleOpenFoodDetail = (foodId, state = {}) => {
    const params = new URLSearchParams();
    if (state?.restaurantId) params.set("restaurantId", state.restaurantId);
    if (state?.timeSlot) params.set("timeSlot", state.timeSlot);
    if (state?.categoryId) params.set("categoryId", state.categoryId);

    const queryString = params.toString();
    const detailUrl = queryString ? `/food/${foodId}?${queryString}` : `/food/${foodId}`;
    navigate(detailUrl, { state });
  };

  const handleCheckoutSuccess = () => {
    if (returnTo === "booking" && restaurantParam) {
      navigate(`/restaurant/${restaurantParam}/layout?fromMenu=1`);
      return;
    }
    clearCart();
  };

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
          onOpenFoodDetail={handleOpenFoodDetail}
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
        onUpdateQuantity={updateQuantity}
        totalPrice={totalPrice}
        onCheckoutSuccess={handleCheckoutSuccess}
        onClearCart={handleClearCart}
        onRemoveRestaurantItems={removeRestaurantItems}
      />
    </div>
  );
};

export default RestaurantMenu;
