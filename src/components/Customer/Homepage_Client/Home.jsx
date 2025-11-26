import React, { useState } from "react";
import Header from "./components/Header";
import HeroSection from "./components/HeroSection";
import Categories from "./components/Categories";
import RestaurantGrid from "./components/RestaurantGrid";
import DishGrid from "./components/DishGrid";
import HowItWorks from "./components/HowItWorks";
import Cart from "./components/Cart";
import TableBooking from "./components/TableBooking";

import { useCart } from "../../../context/CartProvider";

import "../../../styles/Homepage/Home.scss";

/** 👉 TẠM: id nhà hàng default (thay bằng id thật từ BE) */
const DEFAULT_RESTAURANT_ID = "68e3fc0486dc90d60c7101dc";

/** 👉 Hàm xác định timeSlot theo giờ hiện tại */
const getCurrentTimeSlot = () => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 10) return "breakfast";
  if (hour >= 10 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 22) return "dinner";
  return "late_night";
};

const Home = () => {
  // 👉 Ở đây nạp biến để truyền xuống dưới
  const restaurantId = DEFAULT_RESTAURANT_ID;
  const timeSlot = getCurrentTimeSlot();

  // Sample data - trong thực tế sẽ fetch từ API
  const [restaurants] = useState([
    {
      id: 1,
      name: "Phở Hà Nội",
      image: "🍜",
      rating: 4.8,
      deliveryTime: "20-30 phút",
      category: "vietnamese",
      description: "Phở truyền thống Hà Nội",
    },
    {
      id: 2,
      name: "Pizza Italia",
      image: "🍕",
      rating: 4.6,
      deliveryTime: "25-35 phút",
      category: "pizza",
      description: "Pizza Ý chính gốc",
    },
    {
      id: 3,
      name: "Burger King",
      image: "🍔",
      rating: 4.5,
      deliveryTime: "15-25 phút",
      category: "fastfood",
      description: "Burger và fast food",
    },
    {
      id: 4,
      name: "Sushi Tokyo",
      image: "🍱",
      rating: 4.9,
      deliveryTime: "30-40 phút",
      category: "asian",
      description: "Sushi Nhật Bản tươi ngon",
    },
    {
      id: 5,
      name: "Bánh ngọt Paris",
      image: "🧁",
      rating: 4.7,
      deliveryTime: "20-30 phút",
      category: "dessert",
      description: "Bánh ngọt Pháp cao cấp",
    },
    {
      id: 6,
      name: "Trà sữa Taiwan",
      image: "🥤",
      rating: 4.4,
      deliveryTime: "10-20 phút",
      category: "drink",
      description: "Trà sữa Taiwan chính gốc",
    },
  ]);

  const [dishes] = useState([
    {
      id: 1,
      name: "Phở bò tái",
      price: 65000,
      image: "🍜",
      restaurant: "Phở Hà Nội",
    },
    {
      id: 2,
      name: "Pizza Margherita",
      price: 180000,
      image: "🍕",
      restaurant: "Pizza Italia",
    },
    {
      id: 3,
      name: "Burger bò phô mai",
      price: 95000,
      image: "🍔",
      restaurant: "Burger King",
    },
    {
      id: 4,
      name: "Sushi cá hồi",
      price: 250000,
      image: "🍱",
      restaurant: "Sushi Tokyo",
    },
    {
      id: 5,
      name: "Bánh macaron",
      price: 45000,
      image: "🧁",
      restaurant: "Bánh ngọt Paris",
    },
    {
      id: 6,
      name: "Trà sữa trân châu",
      price: 35000,
      image: "🥤",
      restaurant: "Trà sữa Taiwan",
    },
    {
      id: 7,
      name: "Bún bò Huế",
      price: 70000,
      image: "🍜",
      restaurant: "Phở Hà Nội",
    },
    {
      id: 8,
      name: "Pizza hải sản",
      price: 220000,
      image: "🍕",
      restaurant: "Pizza Italia",
    },
  ]);

  // State management
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isTableBookingOpen, setIsTableBookingOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [filteredRestaurants, setFilteredRestaurants] = useState(restaurants);

  // Cart hook
  const {
    cart,
    addToCart,
    updateQuantity,

    clearCart,
    removeRestaurantItems,
    getTotalItems,
    getTotalPrice,
  } = useCart();

  // Event handlers
  const handleCategoryFilter = (category) => {
    const filtered = restaurants.filter((r) => r.category === category);
    setFilteredRestaurants(filtered);

    document
      .getElementById("restaurants")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSearchRestaurants = (address) => {
    if (address.trim()) {
      alert(`Đang tìm nhà hàng gần "${address}"...`);
      document
        .getElementById("restaurants")
        ?.scrollIntoView({ behavior: "smooth" });
    } else {
      alert("Vui lòng nhập địa chỉ giao hàng!");
    }
  };

  const handleRestaurantInfoClick = (restaurantId) => {
    const restaurant = restaurants.find((r) => r.id === restaurantId);
    setSelectedRestaurant(restaurant);
    setIsTableBookingOpen(false);
  };

  const handleAddToCart = (dish) => {
    addToCart(dish);
    showAddToCartAnimation();
  };

  const handleBookTable = (bookingData) => {
    console.log("Booking data:", bookingData);
    alert(
      `Đặt bàn thành công tại ${selectedRestaurant.name}!\nNgày: ${bookingData.date}\nGiờ: ${bookingData.time}\nSố khách: ${bookingData.guests}`
    );
    setIsTableBookingOpen(false);
    setSelectedRestaurant(null);
  };

  const showAddToCartAnimation = () => {
    const cartButton = document.querySelector(".cart-floating-btn");
    if (cartButton) {
      cartButton.style.transform = "scale(1.1)";
      setTimeout(() => {
        cartButton.style.transform = "scale(1)";
      }, 200);
    }
  };

  const handleCartToggle = () => {
    setIsCartOpen(!isCartOpen);
  };

  const handleCartClose = () => {
    setIsCartOpen(false);
  };

  const handleTableBookingClose = () => {
    setIsTableBookingOpen(false);
    setSelectedRestaurant(null);
  };

  return (
    <div className="home">
      <Header />

      <HeroSection onSearch={handleSearchRestaurants} />

      {/* 👉 TRUYỀN restaurantId + timeSlot XUỐNG CATEGORIES */}
      <Categories onCategorySelect={handleCategoryFilter} timeSlot={timeSlot} />

      <RestaurantGrid
        restaurants={filteredRestaurants}
        onRestaurantInfoClick={handleRestaurantInfoClick}
      />

      <DishGrid dishes={dishes.slice(0, 8)} onAddToCart={handleAddToCart} />

      <HowItWorks />

      <Cart
        isOpen={isCartOpen}
        onClose={handleCartClose}
        cart={cart}
        onUpdateQuantity={updateQuantity}
        totalPrice={getTotalPrice()}
        onCheckoutSuccess={clearCart}
        onClearCart={clearCart}
        onRemoveRestaurantItems={removeRestaurantItems}
      />

      <TableBooking
        restaurant={selectedRestaurant}
        isOpen={isTableBookingOpen}
        onClose={handleTableBookingClose}
        onBookTable={handleBookTable}
      />

      <button onClick={handleCartToggle} className="cart-floating-btn">
        <span className="cart-floating-btn__icon">🛒</span>
        {getTotalItems() > 0 && (
          <span className="cart-floating-btn__count">{getTotalItems()}</span>
        )}
      </button>
    </div>
  );
};

export default Home;
