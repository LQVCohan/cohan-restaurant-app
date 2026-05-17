import React, { useState, useCallback, useMemo } from "react";
import Header from "./components/Header";
import HeroSection from "./components/HeroSection";
import Categories from "./components/Categories";
import RestaurantGrid from "./components/RestaurantGrid";
import DishGrid from "./components/DishGrid";
import HowItWorks from "./components/HowItWorks";
import Cart from "./components/Cart";
import TableBooking from "./components/TableBooking";

import { useCart } from "../../../context/CartProvider";
import "../../../styles/Homepage/home.scss";

// Hàm tiện ích lấy khung giờ (để lọc Category nếu cần)
const getCurrentTimeSlot = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10) return "breakfast";
  if (hour >= 10 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 22) return "dinner";
  return "late_night";
};

const Home = () => {
  const timeSlot = getCurrentTimeSlot();

  // --- STATE QUẢN LÝ ---
  // 1. Filter: Dùng để lọc RestaurantGrid khi bấm vào Category hoặc Search
  const [filterState, setFilterState] = useState({});

  // 2. Cart & Booking UI
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isTableBookingOpen, setIsTableBookingOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  // --- CART HOOK ---
  const {
    cart,
    updateQuantity,
    clearCart,
    removeRestaurantItems,
    getTotalItems,
    getTotalPrice,
  } = useCart();

  // --- HANDLERS ---

  // 1. Khi chọn Danh mục -> Cập nhật bộ lọc cho RestaurantGrid
  const handleCategorySelect = useCallback((category) => {
    const categoryId = typeof category === "string" ? category : category?.id;
    const categoryName = typeof category === "object" ? category?.name : "";

    setFilterState((prev) => ({
      ...prev,
      categoryId,
      categoryName,
      timeSlot,
    }));

    // Scroll xuống phần món ăn để lọc theo danh mục
    const element = document.getElementById("menu");
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition =
        elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
  }, [timeSlot]);

  // 2. Khi tìm kiếm từ Hero -> Cập nhật bộ lọc text
  const handleSearch = useCallback((searchPayload) => {
    const searchText =
      typeof searchPayload === "string"
        ? searchPayload
        : searchPayload?.search || "";

    if (!searchText.trim()) return;

    const nearbyCenter =
      typeof searchPayload === "object" ? searchPayload?.location || null : null;

    setFilterState((prev) => ({
      ...prev,
      search: searchText,
      nearbyCenter,
    }));

    document.getElementById("restaurants")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // 4. Mở modal đặt bàn (từ RestaurantGrid)
  const handleOpenBooking = useCallback((restaurant) => {
    setSelectedRestaurant(restaurant);
    setIsTableBookingOpen(true);
  }, []);


  const hasBackendHeldItems = useMemo(
    () =>
      (cart || []).some(
        (item) =>
          item?.backendCartId || item?.backendCartItemId || item?.holdExpiresAt,
      ),
    [cart],
  );

  const showBackendHoldWarning = useCallback(() => {
    alert(
      "Giỏ hàng có món đang được giữ trên máy chủ. Vui lòng thanh toán hoặc quản lý món từ trang chi tiết món.",
    );
  }, []);

  const handleCartUpdateQuantity = useCallback(
    (itemId, delta) => {
      if (hasBackendHeldItems) {
        showBackendHoldWarning();
        return;
      }
      updateQuantity(itemId, delta);
    },
    [hasBackendHeldItems, showBackendHoldWarning, updateQuantity],
  );

  const handleClearCart = useCallback(() => {
    if (hasBackendHeldItems) {
      showBackendHoldWarning();
      return;
    }
    clearCart();
  }, [clearCart, hasBackendHeldItems, showBackendHoldWarning]);

  const handleRemoveRestaurantItems = useCallback(
    (restaurantId) => {
      if (hasBackendHeldItems) {
        showBackendHoldWarning();
        return;
      }
      removeRestaurantItems(restaurantId);
    },
    [hasBackendHeldItems, removeRestaurantItems, showBackendHoldWarning],
  );


  const handleCheckoutSuccess = useCallback(() => {
    clearCart();
    setIsCartOpen(false);
  }, [clearCart]);

  // 5. Submit đặt bàn
  const handleBookTable = (bookingData) => {
    // Gọi API đặt bàn thật ở đây
    console.log("Booking Data:", bookingData);
    alert(`Đã gửi yêu cầu đặt bàn tại ${selectedRestaurant?.name}!`);
    setIsTableBookingOpen(false);
    setSelectedRestaurant(null);
  };

  return (
    <div className="home">
      <Header
        onCartToggle={() => setIsCartOpen(!isCartOpen)}
        cartItemCount={getTotalItems()}
      />

      <main className="home__main-content">
        {/* HERO: Banner & Search */}
        <HeroSection onSearch={handleSearch} />

        {/* CATEGORIES: Fetch danh mục thật */}
        <Categories
          onCategorySelect={handleCategorySelect}
          timeSlot={timeSlot}
        />

        {/* DISH GRID: Fetch Top Món Ăn (Không cần props data, tự fetch trong component) */}
        <DishGrid
          selectedCategoryId={filterState.categoryId}
          selectedCategoryName={filterState.categoryName}
          timeSlot={timeSlot}
        />

        {/* RESTAURANT GRID: Fetch Nhà Hàng (Nhận filter từ Home) */}
        {/* Lưu ý: Component RestaurantGrid cần xử lý prop `restaurantFilter` hoặc `addressFilter` để lọc */}
        <RestaurantGrid
          // Truyền filter xuống để RestaurantGrid gọi query lại
          restaurantFilter={filterState}
          // Xử lý khi bấm nút "Đặt bàn"
          onBookingClick={handleOpenBooking}
        />

        <div className="home__section-wrapper">
          <HowItWorks />
        </div>
      </main>

      {/* --- MODALS --- */}
      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={handleCartUpdateQuantity}
        totalPrice={getTotalPrice()}
        onCheckoutSuccess={handleCheckoutSuccess}
        onClearCart={handleClearCart}
        onRemoveRestaurantItems={handleRemoveRestaurantItems}
      />

      <TableBooking
        restaurant={selectedRestaurant}
        isOpen={isTableBookingOpen}
        onClose={() => {
          setIsTableBookingOpen(false);
          setSelectedRestaurant(null);
        }}
        onBookTable={handleBookTable}
      />

      {/* FLOATING CART BUTTON */}
      <button
        onClick={() => setIsCartOpen(!isCartOpen)}
        className="cart-floating-btn"
        aria-label="Xem giỏ hàng"
      >
        <span className="cart-floating-btn__icon">🛒</span>
        {getTotalItems() > 0 && (
          <span className="cart-floating-btn__count">
            {getTotalItems() > 99 ? "99+" : getTotalItems()}
          </span>
        )}
      </button>
    </div>
  );
};

export default Home;
