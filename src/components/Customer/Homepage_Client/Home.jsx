import React, { useState, useCallback } from "react";
import HeroSection from "./components/HeroSection";
import Categories from "./components/Categories";
import RestaurantGrid from "./components/RestaurantGrid";
import HomeForYouSection from "./components/HomeForYouSection";
import DishGrid from "./components/DishGrid";
import HowItWorks from "./components/HowItWorks";
import TableBooking from "./components/TableBooking";
import MobileHome from "./MobileHome";
import useGsapHomeMotion from "./hooks/useGsapHomeMotion";
import useIsMobile from "../../../hooks/useIsMobile";

import "../../../styles/Homepage/home.scss";
import "../../../styles/Homepage/HomeMotion.scss";
import "../../../styles/Homepage/HomePremiumPolish.scss";
import "../../../styles/Homepage/HomeA11yPolish.scss";
import "../../../styles/Homepage/HomeResponsiveFix.scss";

const getCurrentTimeSlot = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10) return "breakfast";
  if (hour >= 10 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 22) return "dinner";
  return "late_night";
};

const DesktopHome = () => {
  const timeSlot = getCurrentTimeSlot();
  const [filterState, setFilterState] = useState({});
  const [isTableBookingOpen, setIsTableBookingOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [bookingNotice, setBookingNotice] = useState("");
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
    setBookingNotice("");
    setSelectedRestaurant(restaurant);
    setIsTableBookingOpen(true);
  }, []);

  const handleBookTable = () => {
    setBookingNotice(`Đã nhận yêu cầu đặt bàn tại ${selectedRestaurant?.name || "nhà hàng"}.`);
    setIsTableBookingOpen(false);
    setSelectedRestaurant(null);
  };

  return (
    <div className="home" ref={homeMotionRef}>
      <main className="home__main-content">
        <HeroSection onSearch={handleSearch} />

        {bookingNotice && (
          <div className="home__booking-notice" role="status" aria-live="polite">
            {bookingNotice}
          </div>
        )}

        <Categories
          onCategorySelect={handleCategorySelect}
          timeSlot={timeSlot}
        />

        <RestaurantGrid
          restaurantFilter={filterState}
          onBookingClick={handleOpenBooking}
        />

        <HomeForYouSection timeSlot={timeSlot} />

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

const Home = () => {
  const isMobile = useIsMobile();
  return isMobile ? <MobileHome /> : <DesktopHome />;
};

export default Home;
