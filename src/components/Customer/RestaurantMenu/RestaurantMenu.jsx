import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { useLocation, useNavigate } from "react-router-dom";
import "./RestaurantMenu.scss";
import Cart from "../../Customer/Homepage_Client/components/Cart";
import { useCart } from "../../../context/CartProvider";
import { formatCurrency } from "../../../utils/formatters";
import { useCustomerCartActions } from "../../../hooks/useCustomerCartActions";
import {
  buildFoodDetailPath,
  resolveMenuTimeSlotAt,
} from "../../../utils/customerFoodNavigation";
import { openAiMenuAssistant } from "@/utils/aiChatbotEvents";
import { AuthContext } from "@/context/AuthContext";
import { useNotification } from "@/hooks/useNotification";
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
    myFavorites(type: "restaurant") {
      id
      targetId
    }
  }
`;

const TOGGLE_RESTAURANT_FAVORITE = gql`
  mutation ToggleRestaurantFavoriteForMenu($input: ToggleFavoriteInput!) {
    toggleFavorite(input: $input) {
      id
      type
      targetId
    }
  }
`;

const GET_CUSTOMER_RESTAURANT_BY_ID = gql`
  query GetCustomerRestaurantById($id: ID!, $at: DateTime) {
    publicRestaurant(id: $id, at: $at) {
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

const ADD_CART_ITEM = gql`
  mutation AddCartItemFromReorder($input: AddCartItemInput!) {
    addCartItem(input: $input) {
      id
      totalQuantity
      totalAmount
      items {
        id
        restaurantId
        menuItemId
        name
        price
        modifiersPrice
        quantity
        thumbImage
        note
        servingVariantKey
        modifiers {
          groupId
          groupName
          optionId
          optionName
          priceRule {
            rule
            amount
          }
        }
        holdExpiresAt
        holdStatus
      }
    }
  }
`;

const RESTAURANT_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80";

const normalizeCartNote = (value) => String(value || "").trim();
const modifierKey = (modifiers = []) =>
  (modifiers || [])
    .map((modifier) => `${modifier?.groupId || ""}:${modifier?.optionId || ""}`)
    .sort()
    .join("|");

const getMutationErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.message ||
  fallback;

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
  cover:
    restaurant?.coverImage ||
    restaurant?.avatar ||
    RESTAURANT_FALLBACK_IMAGE,
  logo:
    restaurant?.avatar ||
    restaurant?.coverImage ||
    RESTAURANT_FALLBACK_IMAGE,
  cuisine: restaurant?.cuisineType || "Nhà hàng",
  rating:
    typeof restaurant?.avgRating === "number"
      ? Number(restaurant.avgRating).toFixed(1)
      : null,
  reviews:
    typeof restaurant?.reviewCount === "number" ? restaurant.reviewCount : 0,
  canOrder: Boolean(restaurant?.canOrder),
  openingStatus: restaurant?.openingStatus,
  address: formatAddress(restaurant?.address),
});

const RestaurantMenu = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [selectedRes, setSelectedRes] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [syncingReorder, setSyncingReorder] = useState(false);
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const restaurantParam = searchParams.get("restaurantId");
  const returnTo = searchParams.get("returnTo");
  const serviceAt = searchParams.get("serviceAt");
  const bookingAddonMode = returnTo === "booking" && Boolean(restaurantParam);
  const bookingTimeSlot = bookingAddonMode
    ? resolveMenuTimeSlotAt(serviceAt)
    : null;
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const roleName = String(
    user?.roleName || user?.role?.slug || user?.role?.name || "",
  ).toLowerCase();
  const isCustomer = roleName === "customer";
  const { showNotification } = useNotification();
  const [addCartItemMutation] = useMutation(ADD_CART_ITEM);

  const { data: favoriteData, refetch: refetchRestaurantFavorites } = useQuery(
    MY_RESTAURANT_FAVORITES,
    {
      skip: !isAuthenticated || !user?.id,
      fetchPolicy: "cache-and-network",
    },
  );
  const favoriteRestaurantIds = useMemo(
    () =>
      new Set(
        (favoriteData?.myFavorites || []).map((favorite) =>
          String(favorite?.targetId),
        ),
      ),
    [favoriteData?.myFavorites],
  );
  const [toggleRestaurantFavorite] = useMutation(
    TOGGLE_RESTAURANT_FAVORITE,
    {
      onCompleted: () => refetchRestaurantFavorites?.(),
      onError: () =>
        showNotification("Không thể cập nhật yêu thích nhà hàng.", "error"),
    },
  );

  const handleToggleRestaurantFavorite = (restaurant) => {
    if (!isAuthenticated || !user?.id) {
      showNotification(
        "Vui lòng đăng nhập để lưu nhà hàng yêu thích.",
        "warning",
      );
      navigate("/login", { state: { from: `/cus-menu${search || ""}` } });
      return;
    }
    toggleRestaurantFavorite({
      variables: {
        input: { type: "restaurant", targetId: restaurant.id },
      },
    });
  };

  const {
    data: restaurantsData,
    loading: restaurantsLoading,
    error: restaurantsError,
    refetch: refetchRestaurants,
  } = useQuery(GET_CUSTOMER_RESTAURANTS, {
    variables: { limit: 100 },
    fetchPolicy: "cache-and-network",
  });

  const { data: restaurantByIdData, loading: restaurantByIdLoading } = useQuery(
    GET_CUSTOMER_RESTAURANT_BY_ID,
    {
      variables: { id: restaurantParam, at: serviceAt || null },
      skip: !restaurantParam,
      fetchPolicy: "network-only",
    },
  );

  const normalizedRestaurants = useMemo(
    () =>
      (restaurantsData?.publicRestaurants?.edges || []).map((edge) =>
        normalizeRestaurant(edge.node),
      ),
    [restaurantsData?.publicRestaurants?.edges],
  );

  const {
    cart,
    updateQuantity,
    clearCart,
    removeFromCart,
    removeRestaurantItems,
    getTotalItems,
    getTotalPrice,
    upsertCartLine,
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
    () =>
      (cart || []).filter(
        (item) =>
          String(item.restaurantId) === String(restaurantParam || ""),
      ),
    [cart, restaurantParam],
  );
  const bookingCartTotal = useMemo(
    () =>
      bookingCartItems.reduce(
        (sum, item) =>
          sum +
          (Number(item.price || 0) + Number(item.modifiersPrice || 0)) *
            Number(item.quantity || 1),
        0,
      ),
    [bookingCartItems],
  );
  const bookingCartCount = useMemo(
    () =>
      bookingCartItems.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0,
      ),
    [bookingCartItems],
  );
  const displayCartTotal = bookingAddonMode ? bookingCartTotal : totalPrice;
  const displayCartCount = bookingAddonMode ? bookingCartCount : totalCount;

  useEffect(() => {
    if (!restaurantParam) return;
    const found = normalizedRestaurants.find(
      (restaurant) => String(restaurant.id) === String(restaurantParam),
    );
    const detailRestaurant = restaurantByIdData?.publicRestaurant;
    if (
      serviceAt &&
      detailRestaurant?.id &&
      String(detailRestaurant.id) === String(restaurantParam)
    ) {
      setSelectedRes(normalizeRestaurant(detailRestaurant));
      return;
    }

    if (found) {
      setSelectedRes(found);
      return;
    }


    if (
      detailRestaurant?.id &&
      String(detailRestaurant.id) === String(restaurantParam)
    ) {
      setSelectedRes(normalizeRestaurant(detailRestaurant));
    }
  }, [
    normalizedRestaurants,
    restaurantByIdData?.publicRestaurant,
    restaurantParam,
    serviceAt,
  ]);

  useEffect(() => {
    if (
      !restaurantParam ||
      !isAuthenticated ||
      !user?.id ||
      !isCustomer ||
      syncingReorder
    ) {
      return;
    }
    const localOnlyItems = bookingCartItems.filter(
      (item) => !item.backendCartId || !item.backendCartItemId,
    );
    if (!localOnlyItems.length) return;

    let cancelled = false;
    const syncLocalReorderItems = async () => {
      setSyncingReorder(true);
      try {
        for (const item of localOnlyItems) {
          if (cancelled) return;
          const menuItemId =
            item.dishId || item.menuItemId || item.menuId || item.id;
          if (!menuItemId) continue;
          const servingVariantKey =
            item.servingVariantKey ||
            item.servingKey ||
            item.variantKey ||
            "portion";
          const quantity = Math.max(1, Number(item.quantity || 1));
          const note = item.note || null;
          const selectedModifiers = (
            item.selectedModifiers ||
            item.modifiers ||
            []
          )
            .map((modifier) => ({
              groupId: modifier.groupId,
              optionId: modifier.optionId,
            }))
            .filter((modifier) => modifier.groupId && modifier.optionId);

          const { data } = await addCartItemMutation({
            variables: {
              input: {
                userId: user.id,
                restaurantId: String(restaurantParam),
                menuItemId,
                quantity,
                note,
                servingVariantKey,
                selectedModifiers,
                serviceAt: item.serviceAt || serviceAt || null,
              },
            },
          });

          const expectedModifierKey = modifierKey(selectedModifiers);
          const returnedItem = data?.addCartItem?.items?.find((serverItem) => {
            const sameMenuItem =
              String(serverItem?.menuItemId) === String(menuItemId);
            const sameServing =
              String(serverItem?.servingVariantKey || "portion") ===
              String(servingVariantKey || "portion");
            const sameNote =
              normalizeCartNote(serverItem?.note) === normalizeCartNote(note);
            return (
              sameMenuItem &&
              sameServing &&
              sameNote &&
              modifierKey(serverItem?.modifiers || []) === expectedModifierKey
            );
          });
          const backendCartId = data?.addCartItem?.id || null;
          const backendCartItemId = returnedItem?.id || null;
          if (!backendCartId || !backendCartItemId) continue;

          const modifiers = returnedItem?.modifiers || item.modifiers || [];
          upsertCartLine?.(
            {
              ...item,
              id: item.id || menuItemId,
              dishId: menuItemId,
              menuItemId,
              restaurantId: String(restaurantParam),
              name: returnedItem?.name || item.name,
              price: Number(returnedItem?.price ?? item.price ?? 0),
              modifiersPrice: Number(
                returnedItem?.modifiersPrice ?? item.modifiersPrice ?? 0,
              ),
              servingVariantKey:
                returnedItem?.servingVariantKey || servingVariantKey,
              servingKey: returnedItem?.servingVariantKey || servingVariantKey,
              modifiers,
              selectedModifiers: modifiers.map((modifier) => ({
                groupId: modifier.groupId,
                optionId: modifier.optionId,
              })),
              backendCartId,
              backendCartItemId,
              holdExpiresAt: returnedItem?.holdExpiresAt || null,
              holdStatus: returnedItem?.holdStatus || "active",
              note: returnedItem?.note ?? note,
            },
            { preserveQuantity: false },
          );
        }
        if (!cancelled) {
          showNotification(
            "Đã đồng bộ món đặt lại vào giỏ hàng để có thể thanh toán.",
            "success",
          );
        }
      } catch (error) {
        if (!cancelled) {
          showNotification(
            getMutationErrorMessage(
              error,
              "Không thể đồng bộ món đặt lại. Vui lòng thêm lại món từ thực đơn.",
            ),
            "error",
          );
        }
      } finally {
        if (!cancelled) setSyncingReorder(false);
      }
    };

    syncLocalReorderItems();
    return () => {
      cancelled = true;
    };
  }, [
    addCartItemMutation,
    bookingCartItems,
    isAuthenticated,
    isCustomer,
    restaurantParam,
    showNotification,
    syncingReorder,
    upsertCartLine,
    user?.id,
  ]);

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
    <main className="restaurant-app" aria-labelledby="restaurant-menu-title">
      {!selectedRes ? (
        <section
          className="hero-section fade-in"
          aria-labelledby="restaurant-menu-title"
        >
          <div className="hero-copy">
            <p className="hero-eyebrow">Cohan marketplace</p>
            <h1 id="restaurant-menu-title">
              Chọn nhà hàng hợp gu, đặt món đúng thời điểm.
            </h1>
            <p>
              Xem thực đơn, giá, tùy chọn, dị ứng và tình trạng món trước khi
              đăng nhập để đặt hàng.
            </p>
            <div
              className="hero-chips"
              aria-label="Điểm nổi bật của trang đặt món"
            >
              <span>Giá rõ ràng</span>
              <span>Theo khẩu vị</span>
              <span>Tồn kho cập nhật</span>
            </div>
          </div>
          <aside className="hero-visual" aria-label="Trải nghiệm đặt món nổi bật">
            <span className="hero-visual__label">Thông tin trước khi đặt</span>
            <strong>Đủ và rõ</strong>
            <p>
              So sánh món theo khung giờ, xem chi tiết ngay cả khi nhà hàng tạm
              đóng cửa.
            </p>
            <div className="hero-visual__stack">
              <span>• Giá theo khẩu phần</span>
              <span>• Cảnh báo dị ứng</span>
              <span>• Tùy chọn món và tồn kho</span>
            </div>
          </aside>
        </section>
      ) : null}

      {bookingAddonMode && selectedRes ? (
        <div className="booking-alert" role="status">
          Bạn đang chọn món đi kèm đặt bàn tại{" "}
          <strong>{selectedRes.name}</strong>. Giỏ chỉ được hoàn tất với món của
          nhà hàng này.
        </div>
      ) : null}

      {syncingReorder && selectedRes ? (
        <div className="booking-alert" role="status" aria-live="polite">
          Đang đồng bộ món đặt lại và tùy chọn vào giỏ hàng...
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
                  ? {
                      message: "Gợi ý món phù hợp cho tôi",
                      autoSend: true,
                      restaurantId: selectedRes.id,
                    }
                  : { message: "Tìm món phù hợp cho tôi", autoSend: false },
              )
            }
          >
            <span>Chưa biết chọn gì?</span> Hỏi AI gợi ý món
          </button>
        </section>
      ) : null}

      {selectedRes ? (
        <MenuDetailView
          restaurant={selectedRes}
          canOrder={Boolean(selectedRes?.canOrder)}
          initialTimeSlot={bookingTimeSlot}
          serviceAt={serviceAt}
          onBack={handleMenuBack}
          onOpenFoodDetail={handleOpenFoodDetail}
        />
      ) : (
        <section
          className="grid-container res-grid"
          aria-busy={restaurantsLoading}
          aria-live="polite"
          aria-label="Danh sách nhà hàng để đặt món"
        >
          {restaurantsLoading ? (
            renderRestaurantSkeletons()
          ) : restaurantsError ? (
            <div className="restaurant-state restaurant-state--error" role="alert">
              <span className="restaurant-state__icon" aria-hidden="true">
                !
              </span>
              <h2>Không thể tải danh sách nhà hàng</h2>
              <p>Vui lòng kiểm tra kết nối rồi thử lại.</p>
              <button type="button" onClick={() => refetchRestaurants?.()}>
                Tải lại
              </button>
            </div>
          ) : normalizedRestaurants.length === 0 ? (
            <div className="restaurant-state" role="status">
              <span className="restaurant-state__icon" aria-hidden="true">
                🍽️
              </span>
              <h2>Chưa có nhà hàng công khai</h2>
              <p>Hãy quay lại sau để xem thực đơn mới.</p>
            </div>
          ) : (
            normalizedRestaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                data={restaurant}
                isFavorite={favoriteRestaurantIds.has(String(restaurant.id))}
                onToggleFavorite={handleToggleRestaurantFavorite}
                onClick={() => setSelectedRes(restaurant)}
              />
            ))
          )}

          {!restaurantsLoading &&
          !restaurantsError &&
          restaurantParam &&
          !selectedRes &&
          !restaurantByIdLoading ? (
            <div className="restaurant-state restaurant-state--compact" role="status">
              Không tìm thấy nhà hàng trong liên kết này.
            </div>
          ) : null}
        </section>
      )}

      {cart.length > 0 ? (
        <button
          type="button"
          className="floating-cart-btn fade-in"
          onClick={() => setIsCartOpen(true)}
          aria-label={`Mở giỏ hàng, ${displayCartCount} món, tổng ${formatCurrency(
            displayCartTotal,
          )}`}
        >
          <span className="cart-icon" aria-hidden="true">
            🛒
          </span>
          <span className="cart-count">{displayCartCount}</span>
          <span className="cart-total">
            {formatCurrency(displayCartTotal)}
          </span>
        </button>
      ) : null}

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
        isBusy={isBusy || syncingReorder}
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
