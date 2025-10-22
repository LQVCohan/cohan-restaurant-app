// src/pages/Restaurant/MenuManagement/MenuManagement.jsx
import React, { useContext, useEffect, useMemo, useState } from "react";
import "./MenuManagement.scss";

import StatsSection from "./components/StatsSection/StatsSection";
import Toolbar from "./components/Toolbar/Toolbar";
import MenuItemCard from "./components/MenuItemCard/MenuItemCard";
// import MenuItemListRow from "./components/MenuItemListRow/MenuItemListRow";
import MenuItemModal from "./components/MenuItemModal/MenuItemModal";
import CategoryModal from "./components/CategoryModal/CategoryModal";
import PriceEditModal from "./components/PriceEditModal/PriceEditModal";
import PromotionModal from "./components/PromotionModal/PromotionModal";

import { AuthContext } from "../../../context/AuthContext";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

/* ===========================
   GraphQL (cùng file cho dễ theo dõi)
   =========================== */

// Lấy danh sách nhà hàng của manager hiện tại (Connection)
const GET_MANAGER_RESTAURANTS = gql`
  query ManagerRestaurants($managerId: ID!, $limit: Int = 50, $cursor: ID) {
    restaurantsByManager(
      managerId: $managerId
      limit: $limit
      cursor: $cursor
    ) {
      edges {
        cursor
        node {
          id
          name
          avatar
          address {
            city
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

// MenuItem Connection + đủ dữ liệu để render chế biến & công thức
const MENU_ITEMS_CONNECTION = gql`
  query MenuItemsConnection(
    $limit: Int = 20
    $cursor: ID
    $filter: MenuItemFilter!
  ) {
    menuItemsConnection(limit: $limit, cursor: $cursor, filter: $filter) {
      edges {
        cursor
        node {
          id
          restaurantId
          menuId
          categoryId
          name
          description
          status
          basePrice
          avgPrepTimeMin
          recipe
          notes
          thumbImage
          preparationMethods {
            name
            price
            isDefault
          }
          createdAt
          updatedAt
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

const BULK_UPDATE_MENUITEM_PRICES = gql`
  mutation BulkUpdateMenuItemPrices($input: BulkUpdateMenuItemPricesInput!) {
    bulkUpdateMenuItemPrices(input: $input) {
      updatedCount
      items {
        id
        basePrice
        preparationMethods {
          name
          price
          isDefault
        }
      }
    }
  }
`;
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
/* ===========================
   Helpers
   =========================== */

// cố gắng parse JSON từ trường recipe để lấy ingredients (nếu có)
function parseIngredientsFromRecipe(recipe) {
  if (!recipe || typeof recipe !== "string") return [];
  try {
    const obj = JSON.parse(recipe);
    if (Array.isArray(obj?.ingredients)) {
      // chuẩn hoá { name, amount, unit? }
      return obj.ingredients
        .filter((x) => x && x.name)
        .map((x) => ({
          name: String(x.name),
          amount: x.amount ?? "",
          unit: x.unit ?? "",
        }));
    }
    return [];
  } catch {
    return [];
  }
}

// chuẩn hoá 1 node MenuItem từ BE thành shape FE đang dùng
function normalizeItem(node) {
  // methods từ preparationMethods
  const methods = Array.isArray(node.preparationMethods)
    ? node.preparationMethods.map((m) => ({
        name: m.name,
        price: typeof m.price === "number" ? m.price : 0,
        // cookTime: không có ở từng method -> fallback avgPrepTimeMin
        cookTime:
          typeof node.avgPrepTimeMin === "number" ? node.avgPrepTimeMin : "",
        unit: "portion",
        isDefault: !!m.isDefault,
      }))
    : [];

  // công thức/ingredients
  const ingredients = parseIngredientsFromRecipe(node.recipe);

  return {
    ...node,
    // bổ sung field mà UI cũ mong đợi
    image: node.thumbImage || "🍽️",
    methods,
    ingredients,
  };
}

function formatVnd(n) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(n || 0));
}

/* ===========================
   Component chính
   =========================== */

const MenuManagement = () => {
  const auth = useContext(AuthContext);
  const managerId = auth?.user?.id;

  const [currentRestaurant, setCurrentRestaurant] = useState("");
  const [currentTimeSlot, setCurrentTimeSlot] = useState("breakfast");

  // Toolbar filters
  const [currentView, setCurrentView] = useState("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentCategory, setCurrentCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priceRange, setPriceRange] = useState({ minPrice: "", maxPrice: "" });
  // const [categories, setCategories] = useState([]);
  const [modals, setModals] = useState({
    menuItem: { isOpen: false, editId: null },
    category: { isOpen: false },
    priceEdit: { isOpen: false },
    promotion: { isOpen: false },
  });

  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);

  // 1) Query danh sách nhà hàng của manager
  const {
    data: mgrData,
    loading: mgrLoading,
    error: mgrError,
  } = useQuery(GET_MANAGER_RESTAURANTS, {
    variables: { managerId, limit: 50 },
    skip: !managerId,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const managerRestaurants =
    mgrData?.restaurantsByManager?.edges?.map((e) => e.node) || [];

  // auto-chọn nhà hàng đầu tiên
  useEffect(() => {
    if (!currentRestaurant && managerRestaurants.length > 0) {
      setCurrentRestaurant(managerRestaurants[0].id);
    }
  }, [managerRestaurants, currentRestaurant]);

  // 2) Build filter cho query menu items
  const filterVars = useMemo(
    () => ({
      restaurantId: currentRestaurant || null,
      timeSlot: currentTimeSlot,
      search: searchTerm || undefined,
      categoryId: currentCategory || undefined,
      status: statusFilter || undefined,
      minPrice:
        priceRange.minPrice !== "" ? Number(priceRange.minPrice) : undefined,
      maxPrice:
        priceRange.maxPrice !== "" ? Number(priceRange.maxPrice) : undefined,
    }),
    [
      currentRestaurant,
      currentTimeSlot,
      searchTerm,
      currentCategory,
      statusFilter,
      priceRange,
    ]
  );
  // get categories
  const cRestaurantId = currentRestaurant;
  const cTimeSlot = currentTimeSlot;
  const { data: categoryData } = useQuery(GET_CATEGORIES, {
    variables: { restaurantId: cRestaurantId, timeSlot: cTimeSlot },
    skip: !currentRestaurant,
    fetchPolicy: "network-only",
  });
  // 3) Query menu items theo cursor
  const {
    data: menuData,
    loading: menuLoading,
    error: menuError,
    fetchMore,
    refetch,
  } = useQuery(MENU_ITEMS_CONNECTION, {
    skip: !currentRestaurant, // chưa chọn nhà hàng thì chưa query
    variables: {
      limit: 20,
      cursor: null,
      filter: filterVars,
    },
    notifyOnNetworkStatusChange: true,
  });

  // refetch khi đổi filter/timeslot/restaurant
  useEffect(() => {
    if (!currentRestaurant) return;
    refetch({ limit: 20, cursor: null, filter: filterVars });
  }, [
    currentRestaurant,
    currentTimeSlot,
    searchTerm,
    currentCategory,
    statusFilter,
    priceRange,
    refetch,
    filterVars,
  ]);

  // 4) Chuẩn hoá dữ liệu items
  const edges = menuData?.menuItemsConnection?.edges || [];
  const rawItems = edges.map((e) => e.node);
  const items = rawItems.map(normalizeItem);
  const pageInfo = menuData?.menuItemsConnection?.pageInfo || {
    endCursor: null,
    hasNextPage: false,
  };

  const loadMore = () => {
    if (!pageInfo?.hasNextPage) return;
    fetchMore({
      variables: {
        cursor: pageInfo.endCursor,
        limit: 20,
        filter: filterVars,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult) return prev;
        return {
          menuItemsConnection: {
            __typename: "MenuItemConnection",
            edges: [
              ...(prev.menuItemsConnection?.edges || []),
              ...(fetchMoreResult.menuItemsConnection?.edges || []),
            ],
            pageInfo: fetchMoreResult.menuItemsConnection?.pageInfo,
          },
        };
      },
    });
  };

  // 5) Stats từ items đã tải
  const stats = useMemo(() => {
    const total = items.length;
    const available = items.filter((i) => i.status === "available").length;
    const avg =
      total === 0
        ? 0
        : items.reduce((sum, it) => {
            if (typeof it.basePrice === "number" && it.basePrice > 0)
              return sum + it.basePrice;
            const pm = Array.isArray(it.methods) ? it.methods : [];
            if (pm.length === 0) return sum;
            const avgPm =
              pm.reduce(
                (s, p) => s + (typeof p.price === "number" ? p.price : 0),
                0
              ) / pm.length;
            return sum + avgPm;
          }, 0) / total;

    const totalCategories = new Set(items.map((i) => i.categoryId)).size;

    return {
      totalDishes: total,
      availableDishes: available,
      totalCategories,
      avgPrice: Math.round(avg || 0),
    };
  }, [items]);

  // 6) Modal helpers
  const openModal = (key, editId = null) =>
    setModals((p) => ({ ...p, [key]: { isOpen: true, editId } }));
  const closeModal = (key) =>
    setModals((p) => ({ ...p, [key]: { isOpen: false, editId: null } }));

  const handlePriceRangeChange = ({ minPrice, maxPrice }) =>
    setPriceRange({ minPrice, maxPrice });

  if (!managerId) return <div>Đang lấy thông tin đăng nhập…</div>;
  if (mgrLoading) return <div>Đang tải danh sách nhà hàng…</div>;
  if (mgrError)
    return <div style={{ color: "#b91c1c" }}>Lỗi: {mgrError.message}</div>;

  return (
    <div className="menu-management">
      {/* Header: chọn nhà hàng & timeslot */}
      <div className="menu-management__header">
        <h1 className="menu-management__title">🍽️ Quản lý Menu</h1>
        <div className="menu-management__controls">
          <div className="control-group">
            <label className="control-group__label">Nhà hàng:</label>
            <select
              className="control-group__select"
              value={currentRestaurant}
              onChange={(e) => setCurrentRestaurant(e.target.value)}
              disabled={mgrLoading || (managerRestaurants.length || 0) <= 1}
              title={mgrError ? mgrError.message : ""}
            >
              {!mgrLoading && !(managerRestaurants.length > 0) && (
                <option value="">(Không có nhà hàng khả dụng)</option>
              )}
              {mgrLoading && <option value="">Đang tải...</option>}
              {managerRestaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label className="control-group__label">Khung giờ:</label>
            <select
              className="control-group__select"
              value={currentTimeSlot}
              onChange={(e) => setCurrentTimeSlot(e.target.value)}
            >
              <option value="breakfast">🌅 Sáng</option>
              <option value="lunch">☀️ Trưa</option>
              <option value="dinner">🌙 Tối</option>
              <option value="late_night">🌃 Đêm</option>
            </select>
          </div>

          <button
            className="btn btn--primary"
            onClick={() => openModal("menuItem")}
          >
            ➕ Thêm món
          </button>

          <button
            className="btn btn--secondary"
            onClick={() => openModal("category")}
          >
            📁 Thêm danh mục
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsSection
        stats={stats}
        isCollapsed={isStatsCollapsed}
        onToggleCollapse={() => setIsStatsCollapsed((s) => !s)}
      />

      {/* Toolbar */}
      <Toolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        currentCategory={currentCategory}
        onCategoryChange={setCurrentCategory}
        currentView={currentView}
        onViewChange={setCurrentView}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onPriceRangeChange={handlePriceRangeChange}
        onBulkPriceEdit={() => openModal("priceEdit")}
        onCreatePromotion={() => openModal("promotion")}
        onAddCategory={() => openModal("category")}
        categories={[]}
        itemCount={items.length}
        minPrice={priceRange.minPrice}
        maxPrice={priceRange.maxPrice}
      />

      {/* Content */}
      <div className="menu-management__main">
        <div className="menu-management__content">
          {menuError && (
            <div className="error-state">
              <p>Đã xảy ra lỗi khi tải menu: {menuError.message}</p>
            </div>
          )}

          {menuLoading && edges.length === 0 && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Đang tải món ăn...</p>
            </div>
          )}

          {!menuLoading && items.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">🍽️</div>
              <h3 className="empty-state__title">Chưa có món ăn nào</h3>
              <p className="empty-state__description">
                Hãy thêm món ăn đầu tiên cho menu này.
              </p>
            </div>
          )}

          {items.length > 0 && (
            <>
              <div className={`menu-grid menu-grid--${currentView}`}>
                {items.map((item) => {
                  // khối mở rộng hiển thị chế biến + công thức (không sửa MenuItemCard)
                  // chỉ để tạo key khác; state cục bộ nằm ngoài scope => dùng details/summary HTML
                  return (
                    <div key={item.id} className="menu-card-wrapper">
                      {currentView === "grid" ? (
                        <MenuItemCard
                          item={item}
                          onEdit={() => openModal("menuItem", item.id)}
                          onDelete={() => {}}
                          viewMode="grid"
                        />
                      ) : (
                        // <MenuItemListRow ... />
                        <MenuItemCard
                          item={item}
                          onEdit={() => openModal("menuItem", item.id)}
                          onDelete={() => {}}
                          viewMode="list"
                        />
                      )}

                      {/* Phần mở rộng: Cách chế biến & Nguyên liệu */}
                    </div>
                  );
                })}
              </div>

              <div className="cursor-pagination">
                {pageInfo?.hasNextPage ? (
                  <button
                    className="btn btn--secondary"
                    onClick={loadMore}
                    disabled={menuLoading}
                  >
                    {menuLoading ? "Đang tải..." : "Tải thêm"}
                  </button>
                ) : (
                  <div className="cursor-pagination__end">
                    <label>Đã tải hết</label>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <MenuItemModal
        isOpen={modals.menuItem.isOpen}
        editId={modals.menuItem.editId}
        onSave={() => {
          closeModal("menuItem");
          refetch({ limit: 20, cursor: null, filter: filterVars });
        }}
        onClose={() => closeModal("menuItem")}
        // có thể truyền categories nếu bạn đã có query riêng
        categories={categoryData?.categories || []}
        menuItems={items}
      />

      <CategoryModal
        isOpen={modals.category.isOpen}
        onSave={() => {
          closeModal("category");
        }}
        onClose={() => closeModal("category")}
      />

      <PriceEditModal
        isOpen={modals.priceEdit.isOpen}
        menuItems={items}
        onSave={() => {
          closeModal("priceEdit");
          refetch({ limit: 20, cursor: null, filter: filterVars });
        }}
        onClose={() => closeModal("priceEdit")}
      />

      <PromotionModal
        isOpen={modals.promotion.isOpen}
        onSave={() => {
          closeModal("promotion");
        }}
        onClose={() => closeModal("promotion")}
      />
    </div>
  );
};

export default MenuManagement;
