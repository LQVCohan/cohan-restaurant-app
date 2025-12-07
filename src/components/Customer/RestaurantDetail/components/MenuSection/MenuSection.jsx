// src/components/Customer/RestaurantDetail/MenuSection.jsx
import React, { useState, useEffect } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import "./MenuSection.scss";

// Components
import Cart from "../../../../Customer/Homepage_Client/components/Cart";
import { useCart } from "../../../../../hooks/useCart";

// Utils
const formatPrice = (value) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value
  );

/* ──────────────── GraphQL Queries ──────────────── */
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
            price # 👈 GIÁ THEO VARIANT
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

const MenuSection = ({ restaurantId }) => {
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("breakfast");
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);

  // map: menuItemId -> servingVariantKey
  const [selectedVariants, setSelectedVariants] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);

  const { cart, addToCart, updateQuantity, getTotalItems, getTotalPrice } =
    useCart();

  /* ──────────────── Categories ──────────────── */
  const {
    data: categoriesData,
    loading: catLoading,
    error: catError,
  } = useQuery(GET_CATEGORIES, {
    variables: { restaurantId, timeSlot: selectedTimeSlot },
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    if (categoriesData?.categories?.length) {
      setCategories(categoriesData.categories);
      setActiveCategory((prev) => prev || categoriesData.categories[0]?.id);
    }
  }, [categoriesData]);

  /* ──────────────── Menu Items ──────────────── */
  const {
    data: menuData,
    loading: menuLoading,
    error: menuError,
    fetchMore,
    refetch,
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

  useEffect(() => {
    if (!menuData?.menuItemsConnection) return;
    const edges = menuData.menuItemsConnection.edges || [];
    const newNodes = edges.map((e) => e.node);

    setMenuItems((prev) => {
      const existing = new Map(prev.map((i) => [i.id, i]));
      newNodes.forEach((n) => existing.set(n.id, n));
      return Array.from(existing.values());
    });

    // set default servingVariant cho từng item (lấy variant đầu tiên)
    setSelectedVariants((prev) => {
      const next = { ...prev };
      for (const it of newNodes) {
        if (!next[it.id] && it.servingVariants?.length) {
          next[it.id] = it.servingVariants[0].key;
        }
      }
      return next;
    });

    setCursor(menuData.menuItemsConnection.pageInfo?.endCursor || null);
    setHasNextPage(!!menuData.menuItemsConnection.pageInfo?.hasNextPage);
  }, [menuData]);

  /* ──────────────── Helpers ──────────────── */
  const handleTimeSlotChange = (slot) => {
    if (slot === selectedTimeSlot) return;
    setSelectedTimeSlot(slot);
    setCategories([]);
    setActiveCategory(null);
    setMenuItems([]);
    setCursor(null);
    setSelectedVariants({});
  };

  const handleCategoryChange = (catId) => {
    if (catId === activeCategory) return;
    setActiveCategory(catId);
    setMenuItems([]);
    setCursor(null);
    setSelectedVariants({});
    refetch?.({
      restaurantId,
      timeSlot: selectedTimeSlot,
      categoryId: catId,
      cursor: null,
      limit: 20,
    });
  };

  const handleVariantChange = (itemId, variantKey) => {
    setSelectedVariants((prev) => ({ ...prev, [itemId]: variantKey }));
  };

  const getSelectedVariant = (item) => {
    const selKey = selectedVariants[item.id];
    const variants = item.servingVariants || [];
    if (!variants.length) return null;
    return variants.find((v) => v.key === selKey) || variants[0] || null;
  };

  const handleAddToCart = (item) => {
    const variant = getSelectedVariant(item);

    const price =
      variant && variant.price != null ? variant.price : item.basePrice ?? 0; // fallback nếu chưa có giá variant

    addToCart({
      id: variant ? `${item.id}_${variant.key}` : item.id,
      name: item.name,
      price,
      image: item.thumbImage || "/default-dishes.jpg",
      method: variant?.name || variant?.key || null, // vẫn reuse field method cho dễ
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
              ...(prev?.menuItemsConnection?.edges || []),
              ...(fetchMoreResult.menuItemsConnection?.edges || []),
            ],
            pageInfo: fetchMoreResult.menuItemsConnection?.pageInfo,
            __typename: prev?.menuItemsConnection?.__typename,
          },
        };
      },
    });
  };

  // Time Slots Config
  const timeSlots = [
    { id: "breakfast", label: "🍳 Bữa Sáng" },
    { id: "lunch", label: "🍱 Bữa Trưa" },
    { id: "dinner", label: "🍷 Bữa Tối" },
    { id: "late_night", label: "🌙 Ăn Khuya" },
  ];

  /* ──────────────── Render UI ──────────────── */
  if (catLoading || (!activeCategory && menuLoading)) {
    return (
      <div className="menu-loading">
        <div className="spinner" />
        <span>Đang tải thực đơn...</span>
      </div>
    );
  }

  if (catError) return <div className="menu-error">⚠️ {catError.message}</div>;

  return (
    <div className="menu-section-container">
      {/* 1. Time Slot Segmented Control */}
      <div className="time-slot-wrapper">
        <div className="time-slot-control">
          {timeSlots.map((slot) => (
            <button
              key={slot.id}
              className={`slot-item ${
                selectedTimeSlot === slot.id ? "active" : ""
              }`}
              onClick={() => handleTimeSlotChange(slot.id)}
            >
              {slot.label}
            </button>
          ))}
        </div>
      </div>

      <div className="menu-layout-grid">
        {/* 2. Sidebar Categories */}
        <aside className="menu-sidebar">
          <h3 className="sidebar-title">Danh mục</h3>
          <div className="categories-list">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`category-pill ${
                  activeCategory === cat.id ? "active" : ""
                }`}
                onClick={() => handleCategoryChange(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </aside>

        {/* 3. Main Content */}
        <main className="menu-main-content">
          {!activeCategory ? (
            <div className="empty-state">Vui lòng chọn danh mục món ăn</div>
          ) : menuError ? (
            <div className="error-state">Có lỗi xảy ra khi tải món ăn.</div>
          ) : menuItems.length === 0 && !menuLoading ? (
            <div className="empty-state">Danh mục này chưa có món nào.</div>
          ) : (
            <>
              <div className="menu-items-grid">
                {menuItems.map((item) => {
                  const img = item.thumbImage || "/images/food/placeholder.jpg";
                  const variants = item.servingVariants || [];
                  const selectedKey =
                    selectedVariants[item.id] ||
                    (variants[0] ? variants[0].key : "");
                  const currentVariant =
                    variants.find((v) => v.key === selectedKey) ||
                    variants[0] ||
                    null;

                  const displayPrice =
                    currentVariant && currentVariant.price != null
                      ? currentVariant.price
                      : item.basePrice;

                  return (
                    <article key={item.id} className="menu-card">
                      {/* Ảnh Card */}
                      <div className="card-image-wrapper">
                        <img src={img} alt={item.name} loading="lazy" />
                      </div>

                      {/* Nội dung Card */}
                      <div className="card-content">
                        <div className="card-header">
                          <h4 className="item-name">{item.name}</h4>
                          <span className="item-price">
                            {displayPrice != null
                              ? formatPrice(displayPrice)
                              : "—"}
                          </span>
                        </div>

                        {item.description && (
                          <p className="item-desc">{item.description}</p>
                        )}

                        <div className="card-footer">
                          {variants.length > 0 && (
                            <div className="method-selector">
                              <select
                                value={selectedKey}
                                onChange={(e) =>
                                  handleVariantChange(item.id, e.target.value)
                                }
                              >
                                {variants.map((v) => (
                                  <option key={v.key} value={v.key}>
                                    {v.name || v.key}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className="action-buttons">
                            <button
                              className="btn-add-cart"
                              onClick={() => handleAddToCart(item)}
                            >
                              + Thêm
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {hasNextPage && (
                <div className="load-more-wrapper">
                  <button
                    className="btn-load-more"
                    onClick={loadMoreItems}
                    disabled={menuLoading}
                  >
                    {menuLoading ? "Đang tải..." : "Xem thêm món"}
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Floating Cart Button */}
      <button className="cart-fab" onClick={() => setIsCartOpen(true)}>
        <span className="icon">🛒</span>
        <span className="count">{getTotalItems()}</span>
      </button>

      {/* Cart Modal */}
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
