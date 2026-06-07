import React, { useState, useCallback } from "react";
import HeroSection from "./components/HeroSection";
import Categories from "./components/Categories";
import RestaurantGrid from "./components/RestaurantGrid";
import DishGrid from "./components/DishGrid";
import HowItWorks from "./components/HowItWorks";
import TableBooking from "./components/TableBooking";

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

  // Filter: Dùng để lọc RestaurantGrid khi bấm vào Category hoặc Search
  const [filterState, setFilterState] = useState({});

  // Booking UI
  const [isTableBookingOpen, setIsTableBookingOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  // Khi chọn Danh mục -> Cập nhật bộ lọc cho RestaurantGrid
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
      const offsetPosition =
        elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
  }, [timeSlot]);

  // Khi tìm kiếm từ Hero -> Cập nhật bộ lọc text
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

  // Mở modal đặt bàn (từ RestaurantGrid nếu được dùng ở flow khác)
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
    <div className="home">
      <main className="home__main-content">
        <HeroSection onSearch={handleSearch} />

        <Categories
          onCategorySelect={handleCategorySelect}
          timeSlot={timeSlot}
        />

        <DishGrid
          selectedCategoryId={filterState.categoryId}
          selectedCategoryName={filterState.categoryName}
          timeSlot={timeSlot}
        />

        <RestaurantGrid
          restaurantFilter={filterState}
          onBookingClick={handleOpenBooking}
        />

        <div className="home__section-wrapper">
          <HowItWorks />
        </div>
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
