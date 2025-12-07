// src/pages/Restaurant/MenuManagement/MenuManagement.jsx
import React, { useContext, useEffect, useMemo, useState } from "react";
import "./MenuManagement.scss";

import CompactMenuStrip from "./components/StatsSection/CompactMenuStrip";
import Toolbar from "./components/Toolbar/Toolbar";
import MenuItemCard from "./components/MenuItemCard/MenuItemCard";
import MenuItemModal from "./components/MenuItemModal/MenuItemModal";
import CategoryModal from "./components/CategoryModal/CategoryModal";
import PriceEditModal from "./components/PriceEditModal/PriceEditModal";
import PromotionModal from "./components/PromotionModal/PromotionModal";

import { AuthContext } from "../../../context/AuthContext";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

import useMenuManagement from "../../../hooks/useMenuManagement";

/* ===========================
   GraphQL: restaurants & categories
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

// Lấy category theo restaurant + timeslot
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

// Hiển thị label khung giờ
const TIME_SLOT_LABELS = {
  breakfast: "🌅 Sáng",
  lunch: "☀️ Trưa",
  dinner: "🌙 Tối",
  late_night: "🌃 Đêm",
};

const MenuManagement = () => {
  const auth = useContext(AuthContext);
  const managerId = auth?.user?.id;

  const [currentRestaurant, setCurrentRestaurant] = useState("");
  const [currentView, setCurrentView] = useState("grid");
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);

  const [modals, setModals] = useState({
    menuItem: { isOpen: false, editId: null },
    category: { isOpen: false },
    priceEdit: { isOpen: false },
    promotion: { isOpen: false },
  });

  /* ===========================
     1) Query danh sách nhà hàng
     =========================== */

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

  // auto chọn nhà hàng đầu tiên
  useEffect(() => {
    if (!currentRestaurant && managerRestaurants.length > 0) {
      setCurrentRestaurant(managerRestaurants[0].id);
    }
  }, [managerRestaurants, currentRestaurant]);

  /* ===========================
     2) Hook Menu Management cho nhà hàng hiện tại
     =========================== */

  const {
    items,
    selectedTimeSlot,
    setSelectedTimeSlot,
    search,
    setSearch,
    categoryId,
    setCategoryId,
    statusFilter,
    setStatusFilter,
    priceRange,
    setPriceRange,
    itemsLoading,
    itemsError,
    pageInfo,
    fetchMoreItems,
    refetchItems,
  } = useMenuManagement({
    restaurantId: currentRestaurant,
    defaultTimeSlot: "breakfast",
    pageSize: 20,
    useConnection: true,
  });

  /* ===========================
     3) Categories cho modal & filter
     =========================== */

  const { data: categoryData } = useQuery(GET_CATEGORIES, {
    variables: {
      restaurantId: currentRestaurant,
      timeSlot: selectedTimeSlot || "breakfast",
    },
    skip: !currentRestaurant || !selectedTimeSlot,
    fetchPolicy: "network-only",
  });

  const categories = categoryData?.categories || [];

  /* ===========================
     4) Stats
     =========================== */

  const stats = useMemo(() => {
    const total = items.length;
    const available = items.filter((i) => i.status === "available").length;

    const avg =
      total === 0
        ? 0
        : items.reduce((sum, it) => {
            if (typeof it.basePrice === "number" && it.basePrice > 0) {
              return sum + it.basePrice;
            }
            return sum;
          }, 0) / total;

    const totalCategories = new Set(items.map((i) => i.categoryId)).size;

    return {
      totalDishes: total,
      availableDishes: available,
      totalCategories,
      avgPrice: Math.round(avg || 0),
    };
  }, [items]);

  /* ===========================
     5) Helpers
     =========================== */

  const openModal = (key, editId = null) =>
    setModals((p) => ({ ...p, [key]: { isOpen: true, editId } }));

  const closeModal = (key) =>
    setModals((p) => ({ ...p, [key]: { isOpen: false, editId: null } }));

  const handlePriceRangeChange = ({ minPrice, maxPrice }) =>
    setPriceRange({ minPrice, maxPrice });

  const loadMore = () => {
    fetchMoreItems();
  };

  /* ===========================
     6) Render
     =========================== */

  if (!managerId) return <div>Đang lấy thông tin đăng nhập…</div>;
  if (mgrLoading) return <div>Đang tải danh sách nhà hàng…</div>;
  if (mgrError)
    return <div style={{ color: "#b91c1c" }}>Lỗi: {mgrError.message}</div>;

  return (
    <div className="menu-management">
      {/* Header: chọn nhà hàng & timeslot */}
      <div className="menu-management__header">
        <h1 className="menu-management__title">
          <span className="menu-management__title-icon">🍽️</span>
          <span>Quản lý Menu</span>
        </h1>

        <div className="menu-management__controls">
          {/* Chọn nhà hàng */}
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

          {/* Khung giờ */}
          <div className="control-group">
            <label className="control-group__label">Khung giờ:</label>
            <select
              className="control-group__select"
              value={selectedTimeSlot || ""}
              onChange={(e) => setSelectedTimeSlot(e.target.value)}
            >
              <option value="breakfast">{TIME_SLOT_LABELS.breakfast}</option>
              <option value="lunch">{TIME_SLOT_LABELS.lunch}</option>
              <option value="dinner">{TIME_SLOT_LABELS.dinner}</option>
              <option value="late_night">{TIME_SLOT_LABELS.late_night}</option>
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
      <CompactMenuStrip
        stats={stats}
        isCollapsed={isStatsCollapsed}
        onToggleCollapse={() => setIsStatsCollapsed((s) => !s)}
      />

      {/* Toolbar */}
      <Toolbar
        searchTerm={search}
        onSearchChange={setSearch}
        currentCategory={categoryId || ""}
        onCategoryChange={setCategoryId}
        currentView={currentView}
        onViewChange={setCurrentView}
        statusFilter={statusFilter || ""}
        onStatusFilterChange={setStatusFilter}
        onPriceRangeChange={handlePriceRangeChange}
        onBulkPriceEdit={() => openModal("priceEdit")}
        onCreatePromotion={() => openModal("promotion")}
        onAddCategory={() => openModal("category")}
        categories={categories}
        itemCount={items.length}
        minPrice={priceRange.minPrice ?? ""}
        maxPrice={priceRange.maxPrice ?? ""}
      />

      {/* Content */}
      <div className="menu-management__main">
        <div className="menu-management__content">
          {itemsError && (
            <div className="error-state">
              <p>Đã xảy ra lỗi khi tải menu: {itemsError.message}</p>
            </div>
          )}

          {itemsLoading && items.length === 0 && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Đang tải món ăn...</p>
            </div>
          )}

          {!itemsLoading && items.length === 0 && (
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
                {items.map((item) => (
                  <div key={item.id} className="menu-card-wrapper">
                    {currentView === "grid" ? (
                      <MenuItemCard
                        item={item}
                        onEdit={() => openModal("menuItem", item.id)}
                        onDelete={() => {}}
                        viewMode="grid"
                      />
                    ) : (
                      <MenuItemCard
                        item={item}
                        onEdit={() => openModal("menuItem", item.id)}
                        onDelete={() => {}}
                        viewMode="list"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="cursor-pagination">
                {pageInfo?.hasNextPage ? (
                  <button
                    className="btn btn--secondary"
                    onClick={loadMore}
                    disabled={itemsLoading}
                  >
                    {itemsLoading ? "Đang tải..." : "Tải thêm"}
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
          refetchItems?.();
        }}
        onClose={() => closeModal("menuItem")}
        categories={categories}
        menuItems={items}
      />

      <CategoryModal
        isOpen={modals.category.isOpen}
        onSave={() => {
          closeModal("category");
          // nếu sau này có mutation category, refetch categories ở đây
        }}
        onClose={() => closeModal("category")}
      />

      <PriceEditModal
        isOpen={modals.priceEdit.isOpen}
        menuItems={items}
        onSave={() => {
          closeModal("priceEdit");
          refetchItems?.();
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
