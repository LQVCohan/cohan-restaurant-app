// src/components/Customer/RestaurantMenu/RestaurantMenu.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./RestaurantMenu.scss";
import Cart from "../../Customer/Homepage_Client/components/Cart";
import OrderSummaryModal from "../BookingDishesModal/OrderSummaryModal";
import { useCart } from "../../../context/CartProvider";
import { MOCK_RESTAURANTS } from "./menuData";
import { formatCurrency } from "../../../utils/formatters";

// Components Con
import RestaurantCard from "./components/RestaurantCard";
import MenuDetailView from "./components/MenuDetailView";

const RestaurantMenu = () => {
  const navigate = useNavigate();
  const { search, pathname } = useLocation();
  const [selectedRes, setSelectedRes] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isDirectCheckoutOpen, setIsDirectCheckoutOpen] = useState(false);
  const [isCheckoutBooting, setIsCheckoutBooting] = useState(false);
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const restaurantParam = searchParams.get("restaurantId");
  const returnTo = searchParams.get("returnTo");
  const openCart = searchParams.get("openCart");
  const checkout = searchParams.get("checkout");

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

  useEffect(() => {
    if (checkout === "1") return;
    if (openCart === "1") setIsCartOpen(true);
  }, [openCart, checkout]);

  useEffect(() => {
    if (checkout === "1") {
      setIsCheckoutBooting(true);
      setIsCartOpen(false);

      const timer = setTimeout(() => {
        setIsDirectCheckoutOpen(true);
        setIsCheckoutBooting(false);
      }, 250);

      return () => clearTimeout(timer);
    }

    setIsCheckoutBooting(false);
  }, [checkout]);

  const handleOpenFoodDetail = (foodId) => {
    navigate(`/food/${foodId}`);
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
        autoOpenCheckout={checkout === "1"}
      />

      <OrderSummaryModal
        isOpen={isDirectCheckoutOpen}
        onClose={() => {
          setIsDirectCheckoutOpen(false);
          if (checkout === "1") {
            navigate(pathname, { replace: true });
          }
        }}
        items={cart}
        onSuccess={handleCheckoutSuccess}
      />

      <OrderSummaryModal
        isOpen={isDirectCheckoutOpen}
        onClose={() => {
          setIsDirectCheckoutOpen(false);
          setIsCheckoutBooting(false);
          if (checkout === "1") {
            navigate(pathname, { replace: true });
          }
        }}
        items={cart}
        onSuccess={handleCheckoutSuccess}
      />

      {isCheckoutBooting && (
        <div className="checkout-loading-overlay" role="status" aria-live="polite">
          <div className="checkout-loading-card">
            <div className="checkout-spinner" />
            <p>Đang mở thanh toán...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantMenu;
