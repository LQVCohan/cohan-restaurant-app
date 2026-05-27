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

const formatPrice = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value || 0);

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
          byWeight
          thumbImage
          status
          inventoryStatus
          stockWarnings
          maxAvailable
          avgPrepTimeMin
          servingVariants {
            key
            mode
            yieldQty
            yieldUnit
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

const MenuSection = ({
  restaurantId,
  restaurant,
  canOrder: canOrderProp,
  openingStatus: openingStatusProp,
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
      (cat) => cat?.id && cat.isActive !== false,
    );

    setCategories(next);
    setActiveCategory((prev) => {
      if (prev && next.some((cat) => String(cat.id) === String(prev))) return prev;
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

    setSelectedVariants((prev) => {
      const next = { ...prev };
      for (const it of nodes) {
        if (!next[it.id] && it.servingVariants?.length) {
          next[it.id] = it.servingVariants[0].key;
        }
      }
      return next;
    });

    setCursor(menuData.menuItemsConnection.pageInfo?.endCursor || null);
    setHasNextPage(!!menuData.menuItemsConnection.pageInfo?.hasNextPage);
  }, [menuData]);

  const resolvedCanOrder =
    typeof canOrderProp === "boolean" ? canOrderProp : !!restaurant?.canOrder;

  const cannotOrderReason = getCannotOrderReason(
    openingStatusProp || restaurant?.openingStatus,
  );

  const isDishOrderable = (item) =>
    resolvedCanOrder && canCustomerOrderMenuItem(item);

  const loadMoreItems = () => {
    if (!hasNextPage || !cursor || !queryVars) return;

    fetchMore({
      variables: { ...queryVars, cursor, limit: 20 },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult?.menuItemsConnection) return prev;

        return {
          menuItemsConnection: {
            ...fetchMoreResult.menuItemsConnection,
            edges: [
              ...(prev?.menuItemsConnection?.edges || []),
              ...fetchMoreResult.menuItemsConnection.edges,
            ],
          },
        };
      },
    });
  };

  const openFoodDetail = (item) => {
    if (!isDishOrderable(item) || !item?.id) return;

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
    <div className="menu-section">
      <div className="time-slot-tabs">
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

      <div className="menu-layout">
        <aside className="category-sidebar">
          <h3 className="sidebar-header">Thực đơn</h3>
          <div className="category-list">
            {catLoading ? (
              <LoadingSpinner size="small" />
            ) : (
              categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-item ${activeCategory === cat.id ? "active" : ""}`}
                  onClick={() => {
                    if (cat.id !== activeCategory) setActiveCategory(cat.id);
                  }}
                >
                  {cat.name}
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="menu-content">
          <div className="menu-toolbar">
            <input
              aria-label="Tìm món"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm món..."
            />
            <select
              aria-label="Sắp xếp món"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {MENU_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {menuLoading && menuItems.length === 0 ? (
            <div className="loading-state">
              <LoadingSpinner size="large" />
            </div>
          ) : menuError ? (
            <div className="empty-state" role="alert">
              <p>Không tải được danh sách món. Vui lòng thử lại.</p>
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

                return (
                  <div
                    key={item.id}
                    className={`dish-card-horizontal ${orderable ? "" : "is-disabled"}`}
                    onClick={() => openFoodDetail(item)}
                    role={orderable ? "button" : undefined}
                    tabIndex={orderable ? 0 : -1}
                    aria-disabled={!orderable || undefined}
                    onKeyDown={(e) => {
                      if (!orderable) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openFoodDetail(item);
                      }
                    }}
                  >
                    <div className="dish-img-wrapper">
                      <img
                        src={item.thumbImage || "/default-dishes.jpg"}
                        alt={item.name}
                        loading="lazy"
                      />
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
                        <span
                          className={`availability-badge ${availability.badgeClassName}`}
                        >
                          {availability.label}
                        </span>
                      </div>

                      <div className="info-bottom">
                        <div
                          className="variant-control"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {variants.length > 1 ? (
                            <div className="custom-select-wrapper">
                              <select
                                className="variant-select"
                                value={selectedKey}
                                onChange={(e) =>
                                  setSelectedVariants((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                              >
                                {variants.map((variant) => (
                                  <option key={variant.key} value={variant.key}>
                                    {variant.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown size={14} className="arrow-icon" />
                            </div>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          className="btn-add"
                          disabled={!orderable}
                          onClick={(e) => {
                            e.stopPropagation();
                            openFoodDetail(item);
                          }}
                        >
                          Chọn món
                        </button>
                      </div>
                    </div>
                  </div>
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
            <div className="empty-state">
              <span className="icon">🍽️</span>
              <p>Chưa có món ăn phù hợp.</p>
            </div>
          )}
        </main>
      </div>

      {!resolvedCanOrder && (
        <div className="menu-order-status-warning" role="status">
          {cannotOrderReason}
        </div>
      )}

      <button type="button" className="cart-fab" onClick={() => setIsCartOpen(true)}>
        <ShoppingCart size={24} />
        {getTotalItems() > 0 && <span className="count">{getTotalItems()}</span>}
      </button>

      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={updateCartItemQuantity}
        totalPrice={getTotalPrice()}
        onClearCart={clearCustomerCart}
        onRemoveRestaurantItems={removeRestaurantScopedItems}
        onRemoveItem={removeCartLineItem}
        isBusy={isBusy}
        busyItemIds={busyItemIds}
        busyRestaurantIds={busyRestaurantIds}
        isClearing={isClearing}
      />
    </div>
  );
};

export default MenuSection;
