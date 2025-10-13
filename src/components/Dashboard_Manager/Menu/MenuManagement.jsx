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
import { gql, useQuery } from "@apollo/client";

/* ===========================
   GraphQL
   =========================== */

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

/* ===========================
   Helpers
   =========================== */

function normalizeItem(node) {
  // giữ nguyên preparationMethods từ BE
  const pm = Array.isArray(node.preparationMethods)
    ? node.preparationMethods.map((m) => ({
        name: m.name,
        price: typeof m.price === "number" ? m.price : 0,
        isDefault: !!m.isDefault,
      }))
    : [];

  // đồng thời map thêm "methods" để tương thích UI/Modal cũ
  const methods = pm.map((m) => ({
    name: m.name,
    price: m.price,
    cookTime:
      typeof node.avgPrepTimeMin === "number" ? node.avgPrepTimeMin : "",
    unit: "portion",
    isDefault: m.isDefault,
  }));

  return {
    ...node,
    image: node.thumbImage || "🍽️",
    preparationMethods: pm,
    methods, // để Modal/List dùng
  };
}

function averageItemPrice(item) {
  if (typeof item.basePrice === "number" && item.basePrice > 0)
    return item.basePrice;
  const pm = Array.isArray(item.preparationMethods)
    ? item.preparationMethods
    : [];
  if (!pm.length) return 0;
  return (
    pm.reduce((s, p) => s + (typeof p.price === "number" ? p.price : 0), 0) /
    pm.length
  );
}

/* ===========================
   Component
   =========================== */

const MenuManagement = () => {
  const auth = useContext(AuthContext);
  const managerId = auth?.user?.id;

  const [currentRestaurant, setCurrentRestaurant] = useState("");
  const [currentTimeSlot, setCurrentTimeSlot] = useState("breakfast");

  const [currentView, setCurrentView] = useState("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentCategory, setCurrentCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priceRange, setPriceRange] = useState({ minPrice: "", maxPrice: "" });

  const [modals, setModals] = useState({
    menuItem: { isOpen: false, editId: null },
    category: { isOpen: false },
    priceEdit: { isOpen: false },
    promotion: { isOpen: false },
  });

  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);

  // 1) Restaurants of manager
  const {
    data: mgrData,
    loading: mgrLoading,
    error: mgrError,
  } = useQuery(GET_MANAGER_RESTAURANTS, {
    variables: { managerId, limit: 50 },
    skip: !managerId,
  });

  const managerRestaurants =
    mgrData?.restaurantsByManager?.edges?.map((e) => e.node) || [];

  useEffect(() => {
    if (!currentRestaurant && managerRestaurants.length > 0) {
      setCurrentRestaurant(managerRestaurants[0].id);
    }
  }, [managerRestaurants, currentRestaurant]);

  // 2) Filters for menu
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

  // 3) Menu items connection
  const {
    data: menuData,
    loading: menuLoading,
    error: menuError,
    fetchMore,
    refetch,
  } = useQuery(MENU_ITEMS_CONNECTION, {
    skip: !currentRestaurant,
    variables: { limit: 20, cursor: null, filter: filterVars },
    notifyOnNetworkStatusChange: true,
  });

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

  const edges = menuData?.menuItemsConnection?.edges || [];
  const items = edges.map((e) => normalizeItem(e.node));
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

  const stats = useMemo(() => {
    const total = items.length;
    const available = items.filter((i) => i.status === "available").length;
    const avg =
      total === 0
        ? 0
        : Math.round(
            items.reduce((s, it) => s + averageItemPrice(it), 0) / total
          );
    const totalCategories = new Set(items.map((i) => i.categoryId)).size;

    return {
      totalDishes: total,
      availableDishes: available,
      totalCategories,
      avgPrice: avg,
    };
  }, [items]);

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
      {/* Header */}
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

          {menuLoading && items.length === 0 && (
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
                {items.map((item) =>
                  currentView === "grid" ? (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      onEdit={() => openModal("menuItem", item.id)}
                      onDelete={() => {}}
                      viewMode="grid"
                    />
                  ) : (
                    // Nếu bạn có ListRow, thay lại ở đây
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      onEdit={() => openModal("menuItem", item.id)}
                      onDelete={() => {}}
                      viewMode="list"
                    />
                  )
                )}
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
                  <div className="cursor-pagination__end">Đã tải hết</div>
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
        categories={[]}
        // truyền danh sách items hiện có để Modal lấy item đang sửa và đổ preparationMethods vào methods
        menuItems={items}
      />

      <CategoryModal
        isOpen={modals.category.isOpen}
        onSave={() => closeModal("category")}
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
        onSave={() => closeModal("promotion")}
        onClose={() => closeModal("promotion")}
      />
    </div>
  );
};

export default MenuManagement;
