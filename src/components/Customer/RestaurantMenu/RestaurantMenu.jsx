// src/components/Customer/RestaurantMenu/RestaurantMenu.jsx
import React, { useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { useLocation, useNavigate } from "react-router-dom";
import "./RestaurantMenu.scss";
import Cart from "../../Customer/Homepage_Client/components/Cart";
import { useCart } from "../../../context/CartProvider";
import { formatCurrency } from "../../../utils/formatters";
import { buildFoodDetailPath } from "../../../utils/customerFoodNavigation";

// Components Con
import RestaurantCard from "./components/RestaurantCard";
import MenuDetailView from "./components/MenuDetailView";

const GET_CUSTOMER_RESTAURANTS = gql`
  query GetCustomerRestaurants($limit: Int) {
    restaurantsTop(limit: $limit) {
      id
      name
      cuisineType
      avgRating
      orderCount
      reservationCount
      coverImage
      avatar
      address {
        line1
        line2
        ward
        district
        city
      }
    }
  }
`;

const GET_CUSTOMER_RESTAURANT_BY_ID = gql`
  query GetCustomerRestaurantById($id: ID!) {
    restaurant(id: $id) {
      id
      name
      cuisineType
      avgRating
      orderCount
      reservationCount
      coverImage
      avatar
      address {
        line1
        line2
        ward
        district
        city
      }
    }
  }
`;

const RESTAURANT_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80";

const formatAddress = (address) => {
  if (!address) return "Địa chỉ đang cập nhật";
  const parts = [
    address.line1,
    address.line2,
    address.ward,
    address.district,
    address.city,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  return parts.length ? parts.join(", ") : "Địa chỉ đang cập nhật";
};

const normalizeRestaurant = (restaurant) => ({
  ...restaurant,
  id: restaurant?.id,
  name: restaurant?.name || "Nhà hàng",
  cover: restaurant?.coverImage || restaurant?.avatar || RESTAURANT_FALLBACK_IMAGE,
  logo: restaurant?.avatar || restaurant?.coverImage || RESTAURANT_FALLBACK_IMAGE,
  cuisine: restaurant?.cuisineType || "Nhà hàng",
  rating:
    typeof restaurant?.avgRating === "number"
      ? Number(restaurant.avgRating).toFixed(1)
      : "5.0",
  reviews:
    typeof restaurant?.reservationCount === "number"
      ? restaurant.reservationCount
      : typeof restaurant?.orderCount === "number"
        ? restaurant.orderCount
        : 0,
  address: formatAddress(restaurant?.address),
});

const RestaurantMenu = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [selectedRes, setSelectedRes] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const restaurantParam = searchParams.get("restaurantId");
  const returnTo = searchParams.get("returnTo");

  const {
    data: restaurantsData,
    loading: restaurantsLoading,
    error: restaurantsError,
  } = useQuery(GET_CUSTOMER_RESTAURANTS, {
    variables: { limit: 100 },
    fetchPolicy: "cache-and-network",
  });

  const { data: restaurantByIdData, loading: restaurantByIdLoading } = useQuery(
    GET_CUSTOMER_RESTAURANT_BY_ID,
    {
      variables: { id: restaurantParam },
      skip: !restaurantParam,
      fetchPolicy: "network-only",
    }
  );

  const normalizedRestaurants = useMemo(
    () => (restaurantsData?.restaurantsTop || []).map(normalizeRestaurant),
    [restaurantsData?.restaurantsTop]
  );

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
    const found = normalizedRestaurants.find(
      (res) => String(res.id) === String(restaurantParam)
    );
    if (found) {
      setSelectedRes(found);
      return;
    }

    const detailRestaurant = restaurantByIdData?.restaurant;
    if (detailRestaurant?.id && String(detailRestaurant.id) === String(restaurantParam)) {
      setSelectedRes(normalizeRestaurant(detailRestaurant));
    }
  }, [normalizedRestaurants, restaurantByIdData?.restaurant, restaurantParam]);

  const handleOpenFoodDetail = (foodId, state = {}) => {
    navigate(buildFoodDetailPath(foodId, state || {}), { state });
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
          {restaurantsLoading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#999" }}>
              Đang tải nhà hàng...
            </div>
          ) : restaurantsError ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#d32f2f" }}>
              Không thể tải danh sách nhà hàng. Vui lòng thử lại.
            </div>
          ) : normalizedRestaurants.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#999" }}>
              Hiện chưa có nhà hàng nào.
            </div>
          ) : (
            normalizedRestaurants.map((res) => (
              <RestaurantCard
                key={res.id}
                data={res}
                onClick={() => setSelectedRes(res)}
              />
            ))
          )}

          {!restaurantsLoading &&
            !restaurantsError &&
            restaurantParam &&
            !selectedRes &&
            !restaurantByIdLoading && (
              <div style={{ textAlign: "center", padding: "0.5rem", color: "#d97706" }}>
                Không tìm thấy nhà hàng.
              </div>
            )}
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
