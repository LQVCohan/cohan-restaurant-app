import React, { useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ShoppingCart } from "lucide-react";

import LoadingSpinner from "@/components/common/LoadingSpinner";
import Cart from "../../../../Customer/Homepage_Client/components/Cart";
import { useCart } from "../../../../../context/CartProvider";
import { useCustomerCartActions } from "../../../../../hooks/useCustomerCartActions";
import {
  buildFoodDetailPath,
  buildFoodDetailState,
} from "../../../../../utils/customerFoodNavigation";
import {
  canCustomerOrderMenuItem,
  getMenuItemAvailability,
} from "../../../../../utils/menuItemAvailability";
import { getCannotOrderReason } from "../../../../../utils/restaurantStatus";

import "./MenuSection.scss";
import "./MenuSection.polish.scss";

const formatPrice = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value || 0);

const isPlaceholderImage = (url = "") => {
  const normalizedUrl = String(url || "").trim().toLowerCase();
  return (
    !normalizedUrl ||
    normalizedUrl.includes("default-") ||
    normalizedUrl.includes("/default") ||
    normalizedUrl.includes("picsum.photos") ||
    normalizedUrl.includes("source.unsplash") ||
    normalizedUrl.includes("images.unsplash.com") ||
    normalizedUrl.includes("/random")
  );
};

const getDishImage = (item = {}) =>
  isPlaceholderImage(item.thumbImage) ? "" : item.thumbImage;

const getDishInitial = (name = "") =>
  String(name || "M").trim().charAt(0).toUpperCase() || "M";

const GET_CATEGORIES = gql`
  query GetCategories($restaurantId: ID!, $timeSlot: TimeSlot!) {
    customerMenuCategories(restaurantId: $restaurantId, timeSlot: $timeSlot) {
      id
      name
      order
      isActive
    }
  }
`;

const GET_MENU_ITEMS_BY_CATEGORY = gql`
  query GetMenuItemsByCategory(
    $restaurantId: ID!
    $timeSlot: TimeSlot!
    $categoryId: ID!
    $search: String
    $sort: MenuItemSort
    $limit: Int = 20
    $cursor: ID
  ) {
    menuItemsConnection(
      limit: $limit
      cursor: $cursor
      filter: {
        restaurantId: $restaurantId
        timeSlot: $timeSlot
        categoryId: $categoryId
        search: $search
        sort: $sort
      }
    ) {
      edges {
        node {
          id
          restaurantId
          menuId
          categoryId
          name
          description
          basePrice
          hasByWeightVariant
          thumbImage
          status
          inventoryStatus
          stockWarnings
          maxAvailable
          avgPrepTimeMin
          servingVariants {
            key
            mode
            sellQty
            sellUnit
            name
            price
          }
        }
        cursor
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

const GET_FOOD_REVIEWS = gql`
  query GetFoodReviewsByRestaurant($restaurantId: ID!, $limit: Int = 500) {
    reviews(
      restaurantId: $restaurantId
      targetType: "food"
      status: "published"
      limit: $limit
      skip: 0
    ) {
      items {
        targetId
        rating
      }
    }
  }
`;

const MENU_SORT_OPTIONS = [
  { value: "default", label: "Mặc định" },
  { value: "name_asc", label: "Tên A-Z" },
  { value: "price_asc", label: "Giá thấp-cao" },
  { value: "price_desc", label: "Giá cao-thấp" },
];

const TIME_SLOTS = [
  { id: "breakfast", label: "🍳 Sáng" },
  { id: "lunch", label: "🍱 Trưa" },
  { id: "dinner", label: "🍷 Tối" },
  { id: "late_night", label: "🌙 Khuya" },
];

const getCannotOrderTitle = (status) => {
  switch (status) {
    case "closed":
      return "Nhà hàng đang đóng cửa";
    case "paused":
      return "Nhà hàng đang tạm ngưng nhận đơn";
    case "maintenance":
      return "Nhà hàng đang bảo trì";
    case "holiday":
      return "Nhà hàng nghỉ hôm nay";
    default:
      return "Nhà hàng hiện chưa nhận đặt món";
  }
};

const MenuSection = ({
  restaurantId,
  restaurant,
  canOrder: canOrderProp,
  openingStatus: openingStatusProp,
  openingStatusReason,
}) => {
  const navigate = useNavigate();

  const [selectedTimeSlot, setSelectedTimeSlot] = useState("breakfast");
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("default");

  const {
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
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

  const cartItemCount = getTotalItems();
  const cartTotalPrice = getTotalPrice();
  const hasCartItems = cartItemCount > 0;

  useEffect(() => {
    if (!hasCartItems && isCartOpen) setIsCartOpen(false);
  }, [hasCartItems, isCartOpen]);

  const openCartDrawer = () => {
    if (hasCartItems) setIsCartOpen(true);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setMenuItems([]);
    setCursor(null);
    setHasNextPage(false);
  }, [debouncedSearch, sortBy, activeCategory, selectedTimeSlot]);

  const { data: categoriesData, loading: catLoading } = useQuery(GET_CATEGORIES, {
    variables: { restaurantId, timeSlot: selectedTimeSlot },
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    const next = (categoriesData?.customerMenuCategories || []).filter(
      (category) => category?.id && category.isActive !== false,
    );
    setCategories(next);
    setActiveCategory((previous) => {
      if (previous && next.some((category) => String(category.id) === String(previous))) {
        return previous;
      }
      return next[0]?.id || null;
    });
  }, [categoriesData]);

  const queryVars = activeCategory
    ? {
        restaurantId,
        timeSlot: selectedTimeSlot,
        categoryId: activeCategory,
        search: debouncedSearch || null,
        sort: sortBy,
        cursor: null,
        limit: 20,
      }
    : undefined;

  const {
    data: menuData,
    loading: menuLoading,
    error: menuError,
    fetchMore,
  } = useQuery(GET_MENU_ITEMS_BY_CATEGORY, {
    variables: queryVars,
    skip: !activeCategory,
    fetchPolicy: "network-only",
  });

  const { data: foodReviewsData } = useQuery(GET_FOOD_REVIEWS, {
    variables: { restaurantId, limit: 500 },
    skip: !restaurantId,
    fetchPolicy: "cache-first",
  });

  const foodReviewMap = useMemo(() => {
    const map = new Map();
    for (const review of foodReviewsData?.reviews?.items || []) {
      const key = String(review.targetId);
      const current = map.get(key) || { total: 0, sum: 0 };
      current.total += 1;
      current.sum += Number(review.rating || 0);
      map.set(key, current);
    }
    return map;
  }, [foodReviewsData]);

  useEffect(() => {
    if (!menuData?.menuItemsConnection) return;

    const nodes = menuData.menuItemsConnection.edges.map((edge) => edge.node);
    setMenuItems(nodes);
    setSelectedVariants((previous) => {
      const next = { ...previous };
      for (const item of nodes) {
        if (!next[item.id] && item.servingVariants?.length) {
          next[item.id] = item.servingVariants[0].key;
        }
      }
      return next;
    });
    setCursor(menuData.menuItemsConnection.pageInfo?.endCursor || null);
    setHasNextPage(Boolean(menuData.menuItemsConnection.pageInfo?.hasNextPage));
  }, [menuData]);

  const resolvedCanOrder =
    typeof canOrderProp === "boolean" ? canOrderProp : Boolean(restaurant?.canOrder);
  const resolvedOpeningStatus = openingStatusProp || restaurant?.openingStatus;
  const cannotOrderReason =
    openingStatusReason ||
    restaurant?.openingStatusReason ||
    getCannotOrderReason(resolvedOpeningStatus);

  const isDishOrderable = (item) =>
    resolvedCanOrder && canCustomerOrderMenuItem(item);

  const loadMoreItems = () => {
    if (!hasNextPage || !cursor || !queryVars) return;

    fetchMore({
      variables: { ...queryVars, cursor, limit: 20 },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!fetchMoreResult?.menuItemsConnection) return previous;
        return {
          menuItemsConnection: {
            ...fetchMoreResult.menuItemsConnection,
            edges: [
              ...(previous?.menuItemsConnection?.edges || []),
              ...fetchMoreResult.menuItemsConnection.edges,
            ],
          },
        };
      },
    });
  };

  const openFoodDetail = (item) => {
    if (!item?.id) return;

    const state = buildFoodDetailState(item, {
      restaurantId,
      timeSlot: selectedTimeSlot,
      categoryId: item?.categoryId || activeCategory || null,
      selectedVariantKey:
        selectedVariants[item.id] || item.servingVariants?.[0]?.key || null,
    });

    navigate(buildFoodDetailPath(item.id, state), { state });
  };

  return (
    <div className="menu-section tab-panel-shell">
      <div className="menu-section-header">
        <div>
          <p className="section-eyebrow">Thực đơn</p>
          <h2>Khám phá món ăn</h2>
          <p>Chọn khung giờ, danh mục và tìm món phù hợp với khẩu vị của bạn.</p>
        </div>
      </div>

      <div className="time-slot-tabs" aria-label="Chọn khung giờ phục vụ">
        {TIME_SLOTS.map((slot) => (
          <button
            key={slot.id}
            type="button"
            className={`slot-btn ${selectedTimeSlot === slot.id ? "active" : ""}`}
            onClick={() => {
              if (slot.id !== selectedTimeSlot) {
                setSelectedTimeSlot(slot.id);
                setActiveCategory(null);
              }
            }}
          >
            {slot.label}
          </button>
        ))}
      </div>

      {!resolvedCanOrder && (
        <div className="menu-order-status-warning" role="status">
          <span className="warning-icon" aria-hidden="true">⏰</span>
          <span>
            <strong>{getCannotOrderTitle(resolvedOpeningStatus)}</strong>
            <small>{cannotOrderReason}</small>
          </span>
        </div>
      )}

      <div className="menu-layout">
        <aside className="category-sidebar">
          <h3 className="sidebar-header">Thực đơn</h3>
          <div className="category-list">
            {catLoading ? (
              <div className="category-loading">
                <LoadingSpinner size="small" />
              </div>
            ) : categories.length === 0 ? (
              <div className="category-empty">Chưa có danh mục</div>
            ) : (
              categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`category-item ${activeCategory === category.id ? "active" : ""}`}
                  onClick={() => {
                    if (category.id !== activeCategory) setActiveCategory(category.id);
                  }}
                >
                  {category.name}
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="menu-content section-card">
          <div className="menu-toolbar">
            <input
              aria-label="Tìm món"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tìm món theo tên hoặc mô tả..."
            />
            <select
              aria-label="Sắp xếp món"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              {MENU_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {menuLoading && menuItems.length === 0 ? (
            <div className="menu-skeleton-list" aria-label="Đang tải món ăn">
              {[0, 1, 2].map((item) => (
                <div key={item} className="menu-skeleton-card">
                  <div className="skeleton-thumb" />
                  <div className="skeleton-content">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ))}
            </div>
          ) : menuError ? (
            <div className="empty-state-card" role="alert">
              <span className="empty-state-icon" aria-hidden="true">⚠️</span>
              <h3 className="empty-state-title">Không tải được thực đơn</h3>
              <p className="empty-state-description">Vui lòng thử lại sau.</p>
            </div>
          ) : menuItems.length > 0 ? (
            <div className="dish-list">
              {menuItems.map((item) => {
                const variants = item.servingVariants || [];
                const selectedKey = selectedVariants[item.id] || variants[0]?.key;
                const currentVariant =
                  variants.find((variant) => variant.key === selectedKey) || variants[0];
                const availability = getMenuItemAvailability(item);
                const orderable = isDishOrderable(item);
                const review = foodReviewMap.get(String(item.id));
                const dishImage = getDishImage(item);

                return (
                  <article
                    key={item.id}
                    className={`dish-card-horizontal ${orderable ? "" : "is-unavailable"}`}
                    onClick={() => openFoodDetail(item)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Xem chi tiết món ${item.name}`}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openFoodDetail(item);
                      }
                    }}
                  >
                    <div className="dish-img-wrapper">
                      {dishImage ? (
                        <img src={dishImage} alt={item.name} loading="lazy" />
                      ) : (
                        <div className="dish-image-placeholder" aria-label="Ảnh món đang được cập nhật">
                          <strong aria-hidden="true">{getDishInitial(item.name)}</strong>
                          <span>Ảnh đang cập nhật</span>
                        </div>
                      )}
                    </div>

                    <div className="dish-info">
                      <div className="info-top">
                        <div className="header-row">
                          <div className="dish-head-main">
                            <h4 className="dish-name">{item.name}</h4>
                            {review && (
                              <div className="dish-rating">
                                ⭐ {(review.sum / review.total).toFixed(1)} ({review.total})
                              </div>
                            )}
                          </div>
                          <span className="price">
                            {formatPrice(currentVariant?.price ?? item.basePrice)}
                          </span>
                        </div>
                        <p className="dish-desc">{item.description}</p>
                        <span className={`availability-badge ${availability.badgeClassName}`}>
                          {availability.label}
                        </span>
                      </div>

                      <div className="info-bottom">
                        <div className="variant-control" onClick={(event) => event.stopPropagation()}>
                          {variants.length > 1 ? (
                            <div className="custom-select-wrapper">
                              <select
                                className="variant-select"
                                value={selectedKey}
                                onChange={(event) =>
                                  setSelectedVariants((previous) => ({
                                    ...previous,
                                    [item.id]: event.target.value,
                                  }))
                                }
                                aria-label={`Chọn phần ăn cho ${item.name}`}
                              >
                                {variants.map((variant) => (
                                  <option key={variant.key} value={variant.key}>{variant.name}</option>
                                ))}
                              </select>
                              <ChevronDown size={14} className="arrow-icon" aria-hidden="true" />
                            </div>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          className={`btn-add ${orderable ? "" : "btn-view-only"}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            openFoodDetail(item);
                          }}
                        >
                          {orderable ? "Chọn món" : "Xem chi tiết"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}

              {hasNextPage && (
                <button
                  type="button"
                  className="btn-load-more"
                  onClick={loadMoreItems}
                  disabled={menuLoading}
                >
                  {menuLoading ? "Đang tải..." : "Xem thêm"}
                </button>
              )}
            </div>
          ) : (
            <div className="empty-state-card menu-empty-state">
              <span className="empty-state-icon" aria-hidden="true">🍽️</span>
              <h3 className="empty-state-title">Chưa có món trong mục này</h3>
              <p className="empty-state-description">
                Thử đổi khung giờ, danh mục hoặc từ khóa tìm kiếm để xem các món khác.
              </p>
            </div>
          )}
        </main>
      </div>

      {hasCartItems && (
        <button type="button" className="cart-fab cart-fab--desktop" onClick={openCartDrawer}>
          <ShoppingCart size={24} aria-hidden="true" />
          <span className="count">{cartItemCount}</span>
        </button>
      )}

      {hasCartItems && (
        <button type="button" className="mobile-cart-bar" onClick={openCartDrawer}>
          <span>Xem giỏ hàng • {cartItemCount} món • {formatPrice(cartTotalPrice)}</span>
        </button>
      )}

      {hasCartItems && (
        <Cart
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cart={cart}
          onUpdateQuantity={updateCartItemQuantity}
          totalPrice={cartTotalPrice}
          onClearCart={clearCustomerCart}
          onRemoveRestaurantItems={removeRestaurantScopedItems}
          onRemoveItem={removeCartLineItem}
          isBusy={isBusy}
          busyItemIds={busyItemIds}
          busyRestaurantIds={busyRestaurantIds}
          isClearing={isClearing}
        />
      )}
    </div>
  );
};

export default MenuSection;
