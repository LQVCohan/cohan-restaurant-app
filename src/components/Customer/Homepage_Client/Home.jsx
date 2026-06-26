import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import HeroSection from "./components/HeroSection";
import Categories from "./components/Categories";
import RestaurantGrid from "./components/RestaurantGrid";
import HomeForYouSection from "./components/HomeForYouSection";
import DishGrid from "./components/DishGrid";
import HowItWorks from "./components/HowItWorks";
import TableBooking from "./components/TableBooking";
import useGsapHomeMotion from "./hooks/useGsapHomeMotion";

import "../../../styles/Homepage/home.scss";
import "../../../styles/Homepage/HomeMotion.scss";
import "../../../styles/Homepage/HomePremiumPolish.scss";

const getCurrentTimeSlot = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10) return "breakfast";
  if (hour >= 10 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 22) return "dinner";
  return "late_night";
};

const CUSTOMER_SHORTCUTS = [
  { icon: "🎟️", tag: "Ưu đãi", title: "Kho Coupon", desc: "Xem ưu đãi đã lưu và dùng ngay khi đặt món.", path: "/coupons" },
  { icon: "💳", tag: "Thanh toán", title: "Ví của tôi", desc: "Quản lý ví và kiểm tra tiện ích thanh toán nhanh.", path: "/wallet" },
  { icon: "🍱", tag: "Tiết kiệm", title: "Combo", desc: "Chọn nhanh các combo món ăn đang có trên hệ thống.", path: "/combos" },
  { icon: "✨", tag: "Cá nhân hóa", title: "Dành cho bạn", desc: "Món hợp khẩu vị, dựa trên thói quen gần đây.", path: "/for-you" },
  { icon: "📍", tag: "Gần nhất", title: "Gần bạn", desc: "Tìm nhà hàng thuận đường, quyết định nhanh hơn.", path: "/restaurants" },
  { icon: "📦", tag: "Theo dõi", title: "Đơn của tôi", desc: "Theo dõi đơn và đặt lại khi cần.", path: "/orders" },
];

const Home = () => {
  const navigate = useNavigate();
  const timeSlot = getCurrentTimeSlot();
  const [filterState, setFilterState] = useState({});
  const [isTableBookingOpen, setIsTableBookingOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const homeMotionRef = useGsapHomeMotion();

  const handleCategorySelect = useCallback((category) => {
    const categoryId = typeof category === "string" ? category : category?.id;
    const categoryName = typeof category === "object" ? category?.name : "";

    setFilterState((prev) => ({
      ...prev,
      categoryId,
      categoryName,
      timeSlot,
    }));

    const element = document.getElementById("menu");
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
  }, [timeSlot]);

  const handleSearch = useCallback((searchPayload) => {
    const searchText = typeof searchPayload === "string" ? searchPayload : searchPayload?.search || "";
    if (!searchText.trim()) return;

    const nearbyCenter = typeof searchPayload === "object" ? searchPayload?.location || null : null;
    setFilterState((prev) => ({ ...prev, search: searchText, nearbyCenter }));
    document.getElementById("restaurants")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleOpenBooking = useCallback((restaurant) => {
    setSelectedRestaurant(restaurant);
    setIsTableBookingOpen(true);
  }, []);

  const handleBookTable = (bookingData) => {
    console.log("Booking Data:", bookingData);
    alert(`Đã gửi yêu cầu đặt bàn tại ${selectedRestaurant?.name}!`);
    setIsTableBookingOpen(false);
    setSelectedRestaurant(null);
  };

  return (
    <div className="home" ref={homeMotionRef}>
      <main className="home__main-content">
        <HeroSection onSearch={handleSearch} />

        <RestaurantGrid
          restaurantFilter={filterState}
          onBookingClick={handleOpenBooking}
        />

        <HomeForYouSection timeSlot={timeSlot} />

        <section className="home-shortcuts" aria-labelledby="home-shortcuts-title">
          <div className="home-shortcuts__container">
            <div className="home-shortcuts__copy">
              <span className="home-shortcuts__eyebrow">Khám phá nhanh</span>
              <h3 id="home-shortcuts-title">Tiếp tục hành trình ăn uống của bạn</h3>
              <p>Mở nhanh những khu vực khách hay dùng nhất để lưu ưu đãi, xem gợi ý và theo dõi đơn.</p>
            </div>
            <div className="home-shortcuts__grid">
              {CUSTOMER_SHORTCUTS.map((item) => (
                <button key={item.path} type="button" className="home-shortcut-card" onClick={() => navigate(item.path)}>
                  <span className="home-shortcut-card__icon" aria-hidden="true">{item.icon}</span>
                  <span className="home-shortcut-card__content">
                    <em className="home-shortcut-card__tag">{item.tag}</em>
                    <strong>{item.title}</strong>
                    <small>{item.desc}</small>
                  </span>
                  <span className="home-shortcut-card__arrow" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <Categories
          onCategorySelect={handleCategorySelect}
          timeSlot={timeSlot}
        />

        <DishGrid
          selectedCategoryId={filterState.categoryId}
          selectedCategoryName={filterState.categoryName}
          timeSlot={timeSlot}
        />

        <HowItWorks />
      </main>

      <TableBooking
        restaurant={selectedRestaurant}
        isOpen={isTableBookingOpen}
        onClose={() => {
          setIsTableBookingOpen(false);
          setSelectedRestaurant(null);
        }}
        onBookTable={handleBookTable}
      />
    </div>
  );
};

export default Home;
