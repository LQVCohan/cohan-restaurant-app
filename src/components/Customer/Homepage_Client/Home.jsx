import React, { useState, useCallback } from "react";
import { Gift, MapPin, ShieldCheck, WalletCards } from "lucide-react";
import HeroSection from "./components/HeroSection";
import Categories from "./components/Categories";
import RestaurantGrid from "./components/RestaurantGrid";
import DishGrid from "./components/DishGrid";
import HowItWorks from "./components/HowItWorks";
import TableBooking from "./components/TableBooking";

import "../../../styles/Homepage/home.scss";

const getCurrentTimeSlot = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10) return "breakfast";
  if (hour >= 10 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 22) return "dinner";
  return "late_night";
};

const HomeValueStrip = () => {
  const items = [
    {
      icon: MapPin,
      title: "Gần bạn hơn",
      description: "Lọc nhà hàng theo vị trí và khoảng cách rõ ràng.",
    },
    {
      icon: Gift,
      title: "Deal mỗi ngày",
      description: "Ưu đãi, coupon và combo được gom ngay trên Cohan.",
    },
    {
      icon: WalletCards,
      title: "Cohan Balance",
      description: "Thanh toán bằng ví, nhận hoàn tiền nhanh sau đơn.",
    },
    {
      icon: ShieldCheck,
      title: "Đặt món an tâm",
      description: "Giữ món, theo dõi đơn và nhận hỗ trợ khi cần.",
    },
  ];

  return (
    <section className="home-value-strip" aria-label="Điểm mạnh khi đặt món trên FoodHub">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article key={item.title} className="home-value-strip__item">
            <div className="home-value-strip__icon"><Icon size={18} /></div>
            <div>
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </div>
          </article>
        );
      })}
    </section>
  );
};

const Home = () => {
  const timeSlot = getCurrentTimeSlot();

  const [filterState, setFilterState] = useState({});

  const [isTableBookingOpen, setIsTableBookingOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

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
        <HomeValueStrip />

        <RestaurantGrid
          restaurantFilter={filterState}
          onBookingClick={handleOpenBooking}
        />

        <Categories
          onCategorySelect={handleCategorySelect}
          timeSlot={timeSlot}
        />

        <DishGrid
          selectedCategoryId={filterState.categoryId}
          selectedCategoryName={filterState.categoryName}
          timeSlot={timeSlot}
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
