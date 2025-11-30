// src/components/Customer/RestaurantDetail/MenuSection.jsx
import React, { useState, useEffect } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import "./MenuSection.scss";

// Components
import Cart from "../../../../Customer/Homepage_Client/components/Cart";
import { useCart } from "../../../../../hooks/useCart";

// Utils (Giả lập hoặc import từ utils của bạn)
const formatPrice = (value) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value
  );

/* ──────────────── GraphQL Queries (Giữ nguyên) ──────────────── */
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
          name
          description
          basePrice
          status
          thumbImage
          preparationMethods {
            name
            price
            isDefault
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
  const [selectedMethods, setSelectedMethods] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);

  const { cart, addToCart, updateQuantity, getTotalItems, getTotalPrice } =
    useCart();

  /* ──────────────── Logic (Giữ nguyên logic cũ, chỉ clean code) ──────────────── */
  // ... (Code Categories Query giữ nguyên)
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

  // ... (Code Menu Items Query giữ nguyên)
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

    setSelectedMethods((prev) => {
      const next = { ...prev };
      for (const it of newNodes) {
        if (!next[it.id] && it.preparationMethods?.length) {
          const def =
            it.preparationMethods.find((m) => m.isDefault) ||
            it.preparationMethods[0];
          next[it.id] = def?.name;
        }
      }
      return next;
    });

    setCursor(menuData.menuItemsConnection.pageInfo?.endCursor || null);
    setHasNextPage(!!menuData.menuItemsConnection.pageInfo?.hasNextPage);
  }, [menuData]);

  // Handlers
  const handleTimeSlotChange = (slot) => {
    if (slot === selectedTimeSlot) return;
    setSelectedTimeSlot(slot);
    setCategories([]);
    setActiveCategory(null);
    setMenuItems([]);
    setCursor(null);
    setSelectedMethods({});
  };

  const handleCategoryChange = (catId) => {
    if (catId === activeCategory) return;
    setActiveCategory(catId);
    setMenuItems([]);
    setCursor(null);
    setSelectedMethods({});
    refetch?.({
      restaurantId,
      timeSlot: selectedTimeSlot,
      categoryId: catId,
      cursor: null,
      limit: 20,
    });
  };

  const handleMethodChange = (itemId, methodName) => {
    setSelectedMethods((prev) => ({ ...prev, [itemId]: methodName }));
  };

  const getSelectedMethod = (item) => {
    const selName = selectedMethods[item.id];
    return (
      (item.preparationMethods || []).find((m) => m.name === selName) || null
    );
  };

  const handleAddToCart = (item) => {
    const method = getSelectedMethod(item);
    const price = method?.price ?? item.basePrice ?? 0;

    addToCart({
      id: method ? `${item.id}_${method.name}` : item.id,
      name: item.name,
      price: price,
      image: item.thumbImage || "/default-dishes.jpg",
      method: method?.name || null,
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
                  const methods = item.preparationMethods || [];
                  const selectedName = selectedMethods[item.id] || "";
                  const currentMethod = getSelectedMethod(item);
                  const displayPrice = currentMethod
                    ? currentMethod.price
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
                            {formatPrice(displayPrice)}
                          </span>
                        </div>

                        {item.description && (
                          <p className="item-desc">{item.description}</p>
                        )}

                        <div className="card-footer">
                          {methods.length > 0 && (
                            <div className="method-selector">
                              <select
                                value={selectedName}
                                onChange={(e) =>
                                  handleMethodChange(item.id, e.target.value)
                                }
                              >
                                {methods.map((m) => (
                                  <option key={m.name} value={m.name}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className="action-buttons">
                            {/* Nút Xem (Optional) */}
                            {/* <button className="btn-icon">👁️</button> */}
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
