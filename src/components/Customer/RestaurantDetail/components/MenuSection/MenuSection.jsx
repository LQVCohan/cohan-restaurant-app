// ✅ src/components/Customer/RestaurantDetail/MenuSection.jsx
import React, { useState, useEffect } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import "./MenuSection.scss";

// 🧺 Giỏ hàng/images/food/placeholder.jpg
import Cart from "../../../../Customer/Homepage_Client/components/Cart";
import { useCart } from "../../../../../hooks/useCart";

/* ──────────────────────────────────────────────
   GraphQL Query
────────────────────────────────────────────── */
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

  // Map method được chọn cho từng item: { [itemId]: methodName }
  const [selectedMethods, setSelectedMethods] = useState({});

  // 🛒 Giỏ hàng
  const { cart, addToCart, updateQuantity, getTotalItems, getTotalPrice } =
    useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);

  /* ──────────────── Categories ──────────────── */
  const {
    data: categoriesData,
    loading: categoriesLoading,
    error: categoriesError,
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
    data: menuItemsData,
    loading: menuItemsLoading,
    error: menuItemsError,
    fetchMore,
    refetch: refetchItems,
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

  // Khi có items mới:
  useEffect(() => {
    if (!menuItemsData?.menuItemsConnection) return;

    const edges = menuItemsData.menuItemsConnection.edges || [];
    const newNodes = edges.map((e) => e.node);

    // Gộp tránh trùng
    setMenuItems((prev) => {
      const existing = new Map(prev.map((i) => [i.id, i]));
      newNodes.forEach((n) => existing.set(n.id, n));
      return Array.from(existing.values());
    });

    // Set default method cho item chưa có
    setSelectedMethods((prev) => {
      const next = { ...prev };
      for (const it of newNodes) {
        if (
          !next[it.id] &&
          Array.isArray(it.preparationMethods) &&
          it.preparationMethods.length
        ) {
          const def =
            it.preparationMethods.find((m) => m.isDefault) ||
            it.preparationMethods[0];
          next[it.id] = def?.name;
        }
      }
      return next;
    });

    setCursor(menuItemsData.menuItemsConnection.pageInfo?.endCursor || null);
    setHasNextPage(!!menuItemsData.menuItemsConnection.pageInfo?.hasNextPage);
  }, [menuItemsData]);

  /* ──────────────── Helpers ──────────────── */
  const getSelectedMethod = (item) => {
    const selName = selectedMethods[item.id];
    if (!selName) return null;
    return (
      (item.preparationMethods || []).find((m) => m.name === selName) || null
    );
  };

  // Thay thế getDisplayPriceK hiện tại
  const getDisplayPriceK = (item) => {
    const sel = getSelectedMethod(item);
    if (sel && typeof sel.price === "number") {
      return sel.price; // ✅ giá tuyệt đối của method (đơn vị k)
    }
    if (typeof item.basePrice === "number") {
      return item.basePrice; // fallback nếu item không có method
    }
    return null;
  };

  /* ──────────────── Handlers ──────────────── */
  const handleTimeSlotChange = (timeSlot) => {
    if (timeSlot === selectedTimeSlot) return;
    setSelectedTimeSlot(timeSlot);
    setCategories([]);
    setActiveCategory(null);
    setMenuItems([]);
    setCursor(null);
    setHasNextPage(false);
    setSelectedMethods({});
  };

  const handleCategoryChange = (categoryId) => {
    if (categoryId === activeCategory) return;
    setActiveCategory(categoryId);
    setMenuItems([]);
    setCursor(null);
    setSelectedMethods({});
    refetchItems?.({
      restaurantId,
      timeSlot: selectedTimeSlot,
      categoryId,
      cursor: null,
      limit: 20,
    });
  };

  const handleMethodChange = (itemId, methodName) => {
    setSelectedMethods((prev) => ({ ...prev, [itemId]: methodName }));
  };

  // Thay thế handleAddToCart hiện tại
  const handleAddToCart = (item) => {
    const imgUrl = item.thumbImage || "/public/default-dishes.jpg";
    const method = getSelectedMethod(item);

    // ✅ Nếu có method → dùng method.price; nếu không → dùng basePrice
    const priceK =
      method && typeof method.price === "number"
        ? method.price
        : typeof item.basePrice === "number"
        ? item.basePrice
        : 0;

    addToCart({
      id: method ? `${item.id}_${method.name}` : item.id, // phân biệt theo method
      name: item.name,
      price: priceK, // VND cho giỏ
      image: <img src={imgUrl} alt={item.name} />,
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
            pageInfo:
              fetchMoreResult.menuItemsConnection?.pageInfo ||
              prev?.menuItemsConnection?.pageInfo,
            __typename:
              prev?.menuItemsConnection?.__typename || "MenuItemConnection",
          },
        };
      },
    });
  };

  /* ──────────────── UI Loading/Error ──────────────── */
  if (categoriesLoading || (!activeCategory && menuItemsLoading)) {
    return (
      <div className="menu-section-restaurant-detail">
        <div className="menu-loading">
          <div className="spinner" />
          <p>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (categoriesError) {
    return (
      <div className="menu-section-restaurant-detail">
        <p className="error-text">
          ⚠️ Lỗi tải danh mục: {categoriesError.message}
        </p>
      </div>
    );
  }

  /* ──────────────── Render ──────────────── */
  return (
    <div className="menu-section-restaurant-detail">
      {/* TimeSlot Selector */}
      <div className="time-slot-selector">
        {["breakfast", "lunch", "dinner", "late_night"].map((slot) => (
          <button
            key={slot}
            className={`time-slot-btn ${
              selectedTimeSlot === slot ? "selected" : ""
            }`}
            onClick={() => handleTimeSlotChange(slot)}
          >
            {slot === "late_night"
              ? "Late Night"
              : slot.charAt(0).toUpperCase() + slot.slice(1)}
          </button>
        ))}
      </div>

      <div className="menu-layout">
        {/* Danh mục */}
        <nav className="menu-nav">
          <div className="menu-categories">
            {categories.map((category) => (
              <button
                key={category.id}
                className={`menu-category ${
                  activeCategory === category.id ? "menu-category--active" : ""
                }`}
                onClick={() => handleCategoryChange(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </nav>

        {/* Món ăn */}
        <div className="menu-content">
          {!activeCategory ? (
            <div className="menu-empty">
              Hãy chọn một danh mục để xem món ăn
            </div>
          ) : menuItemsError ? (
            <div className="menu-error">
              ⚠️ Lỗi tải món ăn: {menuItemsError.message}
            </div>
          ) : menuItems.length === 0 && !menuItemsLoading ? (
            <div className="menu-empty">Chưa có món trong danh mục này</div>
          ) : (
            <>
              <div className="menu-items menu-items--two-cols-wide">
                {menuItems.map((item) => {
                  const img = item.thumbImage || "/public/default-dishes.jpg";
                  const methods = item.preparationMethods || [];
                  const selectedName = selectedMethods[item.id] || "";
                  // const displayPriceK = getDisplayPriceK(item);

                  return (
                    <div key={item.id} className="menu-item menu-item--rect">
                      <div className="menu-item__image-frame">
                        <img src={img} alt={item.name} loading="lazy" />
                      </div>

                      <div className="menu-item__content">
                        <div className="menu-item__header">
                          <h4 className="menu-item__name">{item.name}</h4>
                        </div>

                        {/* Select cách chế biến (nếu có) */}
                        {methods.length > 0 && (
                          <div className="menu-item__method-select">
                            <select
                              value={selectedName}
                              onChange={(e) =>
                                handleMethodChange(item.id, e.target.value)
                              }
                            >
                              {methods.map((m) => (
                                <option key={m.name} value={m.name}>
                                  {m.name}{" "}
                                  {typeof m.price === "number"
                                    ? `- ${m.price} đ`
                                    : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {item.description && (
                          <p className="menu-item__description menu-item__description--clamp">
                            {item.description}
                          </p>
                        )}

                        <div className="menu-item__actions">
                          <button className="btn btn--secondary btn--small">
                            👁️ Xem chi tiết
                          </button>
                          <button
                            className="btn btn--primary btn--small"
                            onClick={() => handleAddToCart(item)}
                          >
                            🛒 Thêm vào giỏ
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasNextPage && (
                <button
                  className="btn btn--primary btn--small load-more-btn"
                  onClick={loadMoreItems}
                  disabled={menuItemsLoading}
                >
                  {menuItemsLoading ? "Đang tải..." : "Tải thêm món"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 🔘 Nút nổi mở giỏ */}
      <button
        className="cart-fab"
        onClick={() => setIsCartOpen(true)}
        aria-label="Mở giỏ hàng"
      >
        🧺 <span className="cart-fab__count">{getTotalItems()}</span>
      </button>

      {/* 🧺 Panel giỏ hàng */}
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
