// src/components/Customer/RestaurantMenu/RestaurantMenu.jsx
import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { useLocation, useNavigate } from "react-router-dom";
import "./RestaurantMenu.scss";
import Cart from "../../Customer/Homepage_Client/components/Cart";
import { useCart } from "../../../context/CartProvider";
import { formatCurrency } from "../../../utils/formatters";
import { useCustomerCartActions } from "../../../hooks/useCustomerCartActions";
import { buildFoodDetailPath } from "../../../utils/customerFoodNavigation";
import { openAiMenuAssistant } from "@/utils/aiChatbotEvents";
import { AuthContext } from "@/context/AuthContext";
import { useNotification } from "@/hooks/useNotification";

// Components Con
import RestaurantCard from "./components/RestaurantCard";
import MenuDetailView from "./components/MenuDetailView";

const GET_CUSTOMER_RESTAURANTS = gql`
  query GetCustomerRestaurants($limit: Int) {
    publicRestaurants(limit: $limit) {
      edges {
        node {
      id
      name
      cuisineType
      avgRating
      reviewCount
      canOrder
      openingStatus
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
    }
  }
`;


const MY_RESTAURANT_FAVORITES = gql`
  query MyRestaurantFavoritesForMenu {
    myFavorites(type: "restaurant") { id targetId }
  }
`;

const TOGGLE_RESTAURANT_FAVORITE = gql`
  mutation ToggleRestaurantFavoriteForMenu($input: ToggleFavoriteInput!) {
    toggleFavorite(input: $input) { id type targetId }
  }
`;

const GET_CUSTOMER_RESTAURANT_BY_ID = gql`
  query GetCustomerRestaurantById($id: ID!) {
    publicRestaurant(id: $id) {
      id
      name
      cuisineType
      avgRating
      reviewCount
      canOrder
      openingStatus
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
      : null,
  reviews: typeof restaurant?.reviewCount === "number" ? restaurant.reviewCount : 0,
  canOrder: !!restaurant?.canOrder,
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
  const bookingAddonMode = returnTo === "booking" && !!restaurantParam;
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const { showNotification } = useNotification();

  const { data: favoriteData, refetch: refetchRestaurantFavorites } = useQuery(MY_RESTAURANT_FAVORITES, {
    skip: !isAuthenticated || !user?.id,
    fetchPolicy: "cache-and-network",
  });
  const favoriteRestaurantIds = useMemo(
    () => new Set((favoriteData?.myFavorites || []).map((favorite) => String(favorite?.targetId))),
    [favoriteData?.myFavorites],
  );
  const [toggleRestaurantFavorite] = useMutation(TOGGLE_RESTAURANT_FAVORITE, {
    onCompleted: () => refetchRestaurantFavorites?.(),
    onError: () => showNotification("Không thể cập nhật yêu thích nhà hàng.", "error"),
  });
  const handleToggleRestaurantFavorite = (restaurant) => {
    if (!isAuthenticated || !user?.id) {
      showNotification("Vui lòng đăng nhập để lưu nhà hàng yêu thích.", "warning");
      navigate("/login", { state: { from: `/cus-menu${search || ""}` } });
      return;
    }
    toggleRestaurantFavorite({ variables: { input: { type: "restaurant", targetId: restaurant.id } } });
  };

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
    () => (restaurantsData?.publicRestaurants?.edges || []).map((e) => normalizeRestaurant(e.node)),
    [restaurantsData?.publicRestaurants?.edges]
  );

  // 👉 Dùng cart context
  const {
    cart,
    updateQuantity,
    clearCart,
    removeFromCart,
    removeRestaurantItems,
    getTotalItems,
    getTotalPrice,
  } = useCart();

  const {
    updateCartItemQuantity,
    removeCartLineItem,
    clearCustomerCart,
    removeRestaurantScopedItems,
    isBusy,
    busyItemIds,
    busyRestaurantIds,
    isClearing,
  } = useCustomerCartActions({
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
    removeRestaurantItems,
  });

  const totalPrice = getTotalPrice();
  const totalCount = getTotalItems();
  const bookingCartItems = useMemo(
    () => (cart || []).filter((item) => String(item.restaurantId) === String(restaurantParam || "")),
    [cart, restaurantParam],
  );
  const bookingCartTotal = useMemo(
    () => bookingCartItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0),
    [bookingCartItems],
  );
  const bookingCartCount = useMemo(
    () => bookingCartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [bookingCartItems],
  );
  const displayCartTotal = bookingAddonMode ? bookingCartTotal : totalPrice;
  const displayCartCount = bookingAddonMode ? bookingCartCount : totalCount;

  useEffect(() => {
    if (!restaurantParam) return;
    const found = normalizedRestaurants.find(
      (res) => String(res.id) === String(restaurantParam)
    );
    if (found) {
      setSelectedRes(found);
      return;
    }

    const detailRestaurant = restaurantByIdData?.publicRestaurant;
    if (detailRestaurant?.id && String(detailRestaurant.id) === String(restaurantParam)) {
      setSelectedRes(normalizeRestaurant(detailRestaurant));
    }
  }, [normalizedRestaurants, restaurantByIdData?.publicRestaurant, restaurantParam]);

  const handleOpenFoodDetail = (foodId, state = {}) => {
    navigate(buildFoodDetailPath(foodId, state || {}), { state });
  };

  const handleBookingAddonComplete = () => {
    if (!restaurantParam) return;
    setIsCartOpen(false);
    navigate(`/restaurant/${restaurantParam}/layout?fromMenu=1`);
  };

  const handleCheckoutSuccess = () => {
    if (bookingAddonMode && restaurantParam) {
      handleBookingAddonComplete();
      return;
    }
    clearCart();
  };

  const handleMenuBack = () => {
    if (bookingAddonMode && restaurantParam) {
      navigate(`/restaurant/${restaurantParam}/layout?fromMenu=1`);
      return;
    }
    setSelectedRes(null);
  };

  const renderRestaurantSkeletons = () => (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <article className="res-card-skeleton" aria-hidden="true" key={index}>
          <div className="skeleton-media" />
          <div className="skeleton-body">
            <span className="skeleton-line skeleton-line--wide" />
            <span className="skeleton-line" />
            <span className="skeleton-line skeleton-line--short" />
          </div>
        </article>
      ))}
    </>
  );

  return (
    <main className="restaurant-app">
      {!selectedRes && (
        <section className="hero-section fade-in" aria-labelledby="restaurant-menu-title">
          <div className="hero-copy">
            <p className="hero-eyebrow">Cohan marketplace</p>
            <h1 id="restaurant-menu-title">
              Chọn nhà hàng hợp gu, đặt món đúng khoảnh khắc.
            </h1>
            <p>
              Duyệt thực đơn theo bữa, ưu tiên khẩu vị cá nhân và mở chi tiết món
              nhanh mà khách vãng lai vẫn xem được trước khi đăng nhập checkout.
            </p>
            <div className="hero-chips" aria-label="Điểm nổi bật của trang đặt món">
              <span>Đặt món nhanh</span>
              <span>Theo khẩu vị</span>
              <span>Theo nhà hàng gần bạn</span>
            </div>
          </div>
          <aside className="hero-visual" aria-label="Trải nghiệm đặt món nổi bật">
            <span className="hero-visual__label">Bữa trưa đề xuất</span>
            <strong>12:30</strong>
            <p>Ưu tiên món đang mở bán, có khuyến mãi và phù hợp khẩu vị.</p>
            <div className="hero-visual__stack">
              <span>★ Nhà hàng được đánh giá cao</span>
              <span>• Lọc theo khung giờ</span>
              <span>• Xem chi tiết từng món</span>
            </div>
          </aside>
        </section>
      )}

      {bookingAddonMode && selectedRes ? (
        <div className="booking-alert" style={{ margin: "0 auto 16px", maxWidth: 1180 }}>
          Bạn đang chọn món đi kèm đặt bàn tại <strong>{selectedRes.name}</strong>. Giỏ chỉ được hoàn tất với món của nhà hàng này.
        </div>
      ) : null}

      {selectedRes ? (
        <section className="menu-assistant-bar" aria-label="Trợ lý gợi ý món">
          <button
            type="button"
            className="menu-assistant-btn"
            onClick={() =>
              openAiMenuAssistant(
                selectedRes?.id
                  ? { message: "Gợi ý món phù hợp cho tôi", autoSend: true, restaurantId: selectedRes.id }
                  : { message: "Tìm món phù hợp cho tôi", autoSend: false }
              )
            }
          >
            <span>Không biết chọn gì?</span> Hỏi AI gợi ý món
          </button>
        </section>
      ) : null}

      {selectedRes ? (
        <MenuDetailView
          restaurant={selectedRes}
          canOrder={!!selectedRes?.canOrder}
          onBack={handleMenuBack}
          onOpenFoodDetail={handleOpenFoodDetail}
        />
      ) : (
        <section className="grid-container res-grid" aria-busy={restaurantsLoading}>
          {restaurantsLoading ? (
            renderRestaurantSkeletons()
          ) : restaurantsError ? (
            <div className="restaurant-state restaurant-state--error" role="alert">
              <span className="restaurant-state__icon">!</span>
              <h2>Không thể tải danh sách nhà hàng</h2>
              <p>Vui lòng kiểm tra kết nối hoặc tải lại trang để tiếp tục chọn món.</p>
            </div>
          ) : normalizedRestaurants.length === 0 ? (
            <div className="restaurant-state">
              <span className="restaurant-state__icon">🍽️</span>
              <h2>Chưa có nhà hàng sẵn sàng</h2>
              <p>Hãy quay lại sau, đội ngũ Cohan đang cập nhật thêm thực đơn mới.</p>
            </div>
          ) : (
            normalizedRestaurants.map((res) => (
              <RestaurantCard
                key={res.id}
                data={res}
                isFavorite={favoriteRestaurantIds.has(String(res.id))}
                onToggleFavorite={handleToggleRestaurantFavorite}
                onClick={() => setSelectedRes(res)}
              />
            ))
          )}

          {!restaurantsLoading &&
            !restaurantsError &&
            restaurantParam &&
            !selectedRes &&
            !restaurantByIdLoading && (
              <div className="restaurant-state restaurant-state--compact" role="status">
                Không tìm thấy nhà hàng trong liên kết này.
              </div>
            )}
        </section>
      )}

      {/* FLOATING CART BUTTON */}
      {cart.length > 0 && (
        <button
          type="button"
          className="floating-cart-btn fade-in"
          onClick={() => setIsCartOpen(true)}
          aria-label={`Mở giỏ hàng, ${displayCartCount} món, tổng ${formatCurrency(displayCartTotal)}`}
        >
          <span className="cart-icon" aria-hidden="true">🛒</span>
          <span className="cart-count">{displayCartCount}</span>
          <span className="cart-total">{formatCurrency(displayCartTotal)}</span>
        </button>
      )}

      {/* CART SLIDE-OUT */}
      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={updateCartItemQuantity}
        totalPrice={bookingAddonMode ? bookingCartTotal : totalPrice}
        onCheckoutSuccess={handleCheckoutSuccess}
        onClearCart={clearCustomerCart}
        onRemoveRestaurantItems={removeRestaurantScopedItems}
        onRemoveItem={removeCartLineItem}
        isBusy={isBusy}
        busyItemIds={busyItemIds}
        busyRestaurantIds={busyRestaurantIds}
        isClearing={isClearing}
        bookingAddonMode={bookingAddonMode}
        bookingRestaurantId={restaurantParam}
        onBookingAddonComplete={handleBookingAddonComplete}
      />
    </main>
  );
};

export default RestaurantMenu;
