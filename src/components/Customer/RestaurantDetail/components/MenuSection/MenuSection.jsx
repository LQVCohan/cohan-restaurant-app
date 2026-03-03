import React, { useState, useEffect } from "react";
import { gql, useQuery } from "@apollo/client";
import "./MenuSection.scss";

// Components
import Cart from "../../../../Customer/Homepage_Client/components/Cart";
import { useCart } from "../../../../../hooks/useCart";

// Icons
import { ShoppingCart, Plus, ChevronDown } from "lucide-react";

// Utils
const formatPrice = (value) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value
  );

/* ──────────────── GraphQL (Giữ nguyên) ──────────────── */
const GET_CATEGORIES = gql`
  query GetCategories($restaurantId: ID!, $timeSlot: TimeSlot!) {
    categories(restaurantId: $restaurantId, timeSlot: $timeSlot) {
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

const MenuSection = ({ restaurantId }) => {
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("breakfast");
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);

  // State lưu biến thể đang chọn của từng món: { [itemId]: variantKey }
  const [selectedVariants, setSelectedVariants] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);

  const { cart, addToCart, updateQuantity, getTotalItems, getTotalPrice } =
    useCart();

  // --- QUERY CATEGORIES ---
  const { data: categoriesData, loading: catLoading } = useQuery(
    GET_CATEGORIES,
    {
      variables: { restaurantId, timeSlot: selectedTimeSlot },
      skip: !restaurantId,
      fetchPolicy: "network-only",
    }
  );

  useEffect(() => {
    if (categoriesData?.categories?.length) {
      setCategories(categoriesData.categories);
      setActiveCategory((prev) => prev || categoriesData.categories[0]?.id);
    }
  }, [categoriesData]);

  // --- QUERY MENU ITEMS ---
  const {
    data: menuData,
    loading: menuLoading,
    fetchMore,
  } = useQuery(GET_MENU_ITEMS_BY_CATEGORY, {
    variables: activeCategory
      ? {
          restaurantId,
          timeSlot: selectedTimeSlot,
          categoryId: activeCategory,
          cursor: null,
          limit: 20,
        }
      : undefined,
    skip: !activeCategory,
    fetchPolicy: "network-only",
  });

  const { data: foodReviewsData } = useQuery(GET_FOOD_REVIEWS, {
    variables: { restaurantId, limit: 500 },
    skip: !restaurantId,
    fetchPolicy: "cache-first",
  });

  const foodReviewMap = React.useMemo(() => {
    const map = new Map();
    const items = foodReviewsData?.reviews?.items || [];

    items.forEach((review) => {
      const key = String(review.targetId);
      const current = map.get(key) || { total: 0, sum: 0 };
      current.total += 1;
      current.sum += Number(review.rating || 0);
      map.set(key, current);
    });

    return map;
  }, [foodReviewsData]);

  useEffect(() => {
    if (!menuData?.menuItemsConnection) return;
    const newNodes = menuData.menuItemsConnection.edges.map((e) => e.node);

    setMenuItems(newNodes);

    // Tự động chọn variant đầu tiên cho mỗi món khi load
    setSelectedVariants((prev) => {
      const next = { ...prev };
      for (const it of newNodes) {
        // Chỉ set nếu chưa có trong state và món đó có variants
        if (!next[it.id] && it.servingVariants?.length > 0) {
          next[it.id] = it.servingVariants[0].key;
        }
      }
      return next;
    });

    setCursor(menuData.menuItemsConnection.pageInfo?.endCursor || null);
    setHasNextPage(!!menuData.menuItemsConnection.pageInfo?.hasNextPage);
  }, [menuData]);

  // --- HANDLERS ---
  const handleTimeSlotChange = (slot) => {
    if (slot === selectedTimeSlot) return;
    setSelectedTimeSlot(slot);
    setActiveCategory(null);
    setMenuItems([]);
  };

  const handleCategoryChange = (catId) => {
    if (catId === activeCategory) return;
    setActiveCategory(catId);
    setMenuItems([]);
  };

  const handleVariantChange = (itemId, variantKey) => {
    setSelectedVariants((prev) => ({ ...prev, [itemId]: variantKey }));
  };

  const handleAddToCart = (item) => {
    const selKey = selectedVariants[item.id];
    const variant =
      item.servingVariants?.find((v) => v.key === selKey) ||
      item.servingVariants?.[0];

    // Ưu tiên giá của variant, nếu không có thì lấy basePrice
    const finalPrice = variant?.price ?? item.basePrice ?? 0;
    // Tên món + Tên biến thể (nếu có)
    const variantName =
      variant?.name && variant.name !== "Standard" ? variant.name : null;

    addToCart({
      id: variant ? `${item.id}_${variant.key}` : item.id, // ID duy nhất trong giỏ
      name: item.name,
      price: finalPrice,
      image: item.thumbImage || "/default-dishes.jpg",
      method: variantName, // Lưu cách chế biến vào đây để hiển thị trong giỏ
    });
    setIsCartOpen(true);
  };

  const loadMoreItems = () => {
    if (!hasNextPage || !cursor) return;
    fetchMore({
      variables: {
        cursor,
        restaurantId,
        timeSlot: selectedTimeSlot,
        categoryId: activeCategory,
        limit: 20,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult) return prev;
        return {
          menuItemsConnection: {
            edges: [
              ...prev.menuItemsConnection.edges,
              ...fetchMoreResult.menuItemsConnection.edges,
            ],
            pageInfo: fetchMoreResult.menuItemsConnection.pageInfo,
            __typename: prev.menuItemsConnection.__typename,
          },
        };
      },
    });
  };

  const timeSlots = [
    { id: "breakfast", label: "🍳 Sáng" },
    { id: "lunch", label: "🍱 Trưa" },
    { id: "dinner", label: "🍷 Tối" },
    { id: "late_night", label: "🌙 Khuya" },
  ];

  return (
    <div className="menu-section">
      {/* 1. TIME SLOT TABS */}
      <div className="time-slot-tabs">
        {timeSlots.map((slot) => (
          <button
            key={slot.id}
            className={`slot-btn ${
              selectedTimeSlot === slot.id ? "active" : ""
            }`}
            onClick={() => handleTimeSlotChange(slot.id)}
          >
            {slot.label}
          </button>
        ))}
      </div>

      <div className="menu-layout">
        {/* 2. CATEGORY SIDEBAR */}
        <aside className="category-sidebar">
          <h3 className="sidebar-header">Thực đơn</h3>
          <div className="category-list">
            {catLoading ? (
              <div className="spinner-sm"></div>
            ) : (
              categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`category-item ${
                    activeCategory === cat.id ? "active" : ""
                  }`}
                  onClick={() => handleCategoryChange(cat.id)}
                >
                  {cat.name}
                </button>
              ))
            )}
          </div>
        </aside>

        {/* 3. MENU ITEMS LIST */}
        <main className="menu-content">
          {menuLoading && menuItems.length === 0 ? (
            <div className="loading-state">
              <div className="spinner"></div>
            </div>
          ) : menuItems.length > 0 ? (
            <div className="dish-list">
              {menuItems.map((item) => {
                const img = item.thumbImage || "/default-dishes.jpg";
                const variants = item.servingVariants || [];
                const reviewSummary =
                  foodReviewMap.get(String(item.id)) ||
                  foodReviewMap.get(item.id) ||
                  null;
                const dishAvgRating = reviewSummary
                  ? (reviewSummary.sum / reviewSummary.total).toFixed(1)
                  : null;
                const dishReviewCount = reviewSummary?.total || 0;

                // Logic hiển thị giá và variant đang chọn
                const selectedKey =
                  selectedVariants[item.id] || variants[0]?.key;
                const currentVariant =
                  variants.find((v) => v.key === selectedKey) || variants[0];
                const displayPrice = currentVariant?.price ?? item.basePrice;

                return (
                  <div key={item.id} className="dish-card-horizontal">
                    <div className="dish-img-wrapper">
                      <img src={img} alt={item.name} loading="lazy" />
                    </div>

                    <div className="dish-info">
                      <div className="info-top">
                        <div className="header-row">
                          <div className="dish-head-main">
                            <h4 className="dish-name">{item.name}</h4>
                            {dishAvgRating && (
                              <div className="dish-rating">
                                ⭐ {dishAvgRating} ({dishReviewCount})
                              </div>
                            )}
                          </div>
                          <span className="price">
                            {formatPrice(displayPrice)}
                          </span>
                        </div>
                        <p className="dish-desc">{item.description}</p>
                      </div>

                      <div className="info-bottom">
                        {/* KHU VỰC CHỌN CÁCH CHẾ BIẾN / BIẾN THỂ */}
                        <div className="variant-control">
                          {variants.length > 1 ? (
                            <div className="custom-select-wrapper">
                              <select
                                className="variant-select"
                                value={selectedKey}
                                onChange={(e) =>
                                  handleVariantChange(item.id, e.target.value)
                                }
                              >
                                {variants.map((v) => (
                                  <option key={v.key} value={v.key}>
                                    {v.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown size={14} className="arrow-icon" />
                            </div>
                          ) : (
                            // Nếu chỉ có 1 variant và có tên cụ thể (vd: "Phần Lớn") thì hiện badge
                            variants.length === 1 &&
                            variants[0].name &&
                            variants[0].name !== "Standard" && (
                              <span className="single-variant-badge">
                                {variants[0].name}
                              </span>
                            )
                          )}
                        </div>

                        <button
                          className="btn-add"
                          onClick={() => handleAddToCart(item)}
                        >
                          <Plus size={16} /> Thêm
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {hasNextPage && (
                <button
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
              <p>Chưa có món ăn trong danh mục này.</p>
            </div>
          )}
        </main>
      </div>

      {/* Floating Cart */}
      <button className="cart-fab" onClick={() => setIsCartOpen(true)}>
        <ShoppingCart size={24} />
        {getTotalItems() > 0 && (
          <span className="count">{getTotalItems()}</span>
        )}
      </button>

      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={updateQuantity}
        totalPrice={getTotalPrice()}
      />
    </div>
  );
};

export default MenuSection;
