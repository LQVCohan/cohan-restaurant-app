// src/pages/Restaurant/MenuManagement/MenuManagement.jsx
import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  FiMapPin,
  FiClock,
  FiPlus,
  FiFolderPlus,
  FiAlertCircle,
} from "react-icons/fi";
import "./MenuManagement.scss";

// Sub-components
import CompactMenuStrip from "./components/StatsSection/CompactMenuStrip";
import Toolbar from "./components/Toolbar/Toolbar";
import MenuItemCard from "./components/MenuItemCard/MenuItemCard";
// Modals
import MenuItemModal from "./components/MenuItemModal/MenuItemModal";
import CategoryModal from "./components/CategoryModal/CategoryModal";
import PriceEditModal from "./components/PriceEditModal/PriceEditModal";
import PromotionModal from "./components/PromotionModal/PromotionModal";
import MenuModal from "./components/MenuModal/MenuModal";

// Logic
import { AuthContext } from "../../../context/AuthContext";
import { gql, useQuery } from "@apollo/client";
import useMenuManagement from "../../../hooks/useMenuManagement";
import { useCategoryManagement } from "../../../hooks/useCategoryManagement";

/* ========== QUERY ========== */
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

const TIME_SLOT_LABELS = {
  breakfast: "Bữa Sáng (Breakfast)",
  lunch: "Bữa Trưa (Lunch)",
  dinner: "Bữa Tối (Dinner)",
  late_night: "Ăn Khuya (Late Night)",
};

const MenuManagement = () => {
  const auth = useContext(AuthContext);
  const managerId = auth?.user?.id;

  // --- LOCAL STATE ---
  const [currentRestaurant, setCurrentRestaurant] = useState("");
  const [currentView, setCurrentView] = useState("grid");
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);
  const [sortOption, setSortOption] = useState("default"); // State cho sort

  // Modals state object
  const [modals, setModals] = useState({
    menuItem: { isOpen: false, editId: null },
    menu: { isOpen: false, editingMenu: null },
    category: { isOpen: false },
    priceEdit: { isOpen: false },
    promotion: { isOpen: false },
  });

  const [isSavingMenu, setIsSavingMenu] = useState(false);

  /* --- DATA FETCHING --- */
  const {
    data: mgrData,
    loading: mgrLoading,
    error: mgrError,
  } = useQuery(GET_MANAGER_RESTAURANTS, {
    variables: { managerId, limit: 50 },
    skip: !managerId,
    fetchPolicy: "cache-and-network",
  });

  const managerRestaurants = useMemo(
    () => mgrData?.restaurantsByManager?.edges?.map((e) => e.node) || [],
    [mgrData]
  );

  useEffect(() => {
    if (!currentRestaurant && managerRestaurants.length > 0) {
      setCurrentRestaurant(managerRestaurants[0].id);
    }
  }, [managerRestaurants, currentRestaurant]);

  // Hook Menu Management (Core logic)
  const {
    menus,
    menusLoading,
    menusError,
    ensureMenu,
    refetchMenus,
    items,
    itemsLoading,
    itemsError,
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
    pageInfo,
    fetchMoreItems,
    refetchItems,
  } = useMenuManagement({
    restaurantId: currentRestaurant || null,
    defaultTimeSlot: "breakfast",
    pageSize: 20,
    useConnection: true,
    // (Optional) Pass sortOption to hook if backend supports it
    // sort: sortOption
  });

  // Hook Category Management
  const { categories, categoryMenus, createCategoryMenu, updateCategoryMenu } =
    useCategoryManagement({
      restaurantId: currentRestaurant || null,
      timeSlot: selectedTimeSlot || "breakfast",
      limit: 8,
      loadCategories: true,
      loadTopCategories: false,
      loadCategoryMenus: modals.menu.isOpen,
    });

  /* --- HANDLERS --- */
  // Modal toggle helpers
  const toggleModal = (name, isOpen = true, data = null) => {
    setModals((prev) => {
      const newState = { ...prev, [name]: { ...prev[name], isOpen } };
      if (name === "menuItem") newState.menuItem.editId = data;
      if (name === "menu") newState.menu.editingMenu = data;
      return newState;
    });
  };

  const handleSubmitMenu = async (form) => {
    if (!currentRestaurant) return;
    setIsSavingMenu(true);
    try {
      await ensureMenu({
        restaurantId: currentRestaurant,
        timeSlot: form.timeSlot,
        name: form.name,
        description: form.description || null,
        coverImage: form.coverImage || null,
        categoryMenuId: form.categoryMenuId || null,
        isActive: form.isActive || false,
      });
      await refetchMenus?.();
      toggleModal("menu", false);
    } catch (err) {
      alert(err?.message || "Lỗi khi lưu menu");
    } finally {
      setIsSavingMenu(false);
    }
  };

  /* --- SORT LOGIC (Client-side example if backend not ready) --- */
  // Nếu hook useMenuManagement chưa xử lý sort, ta có thể sort tạm ở đây:
  const displayItems = useMemo(() => {
    if (!items) return [];
    let sorted = [...items];
    if (sortOption === "name_asc")
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sortOption === "name_desc")
      sorted.sort((a, b) => b.name.localeCompare(a.name));
    if (sortOption === "price_asc")
      sorted.sort((a, b) => a.basePrice - b.basePrice);
    if (sortOption === "price_desc")
      sorted.sort((a, b) => b.basePrice - a.basePrice);
    return sorted;
  }, [items, sortOption]);

  /* --- RENDER --- */
  if (!managerId)
    return (
      <div className="mm-state-box">
        <div className="spinner-dots"></div>Đang xác thực...
      </div>
    );
  if (mgrLoading)
    return (
      <div className="mm-state-box">
        <div className="spinner-dots"></div>
      </div>
    );
  if (mgrError)
    return (
      <div className="mm-state-box error">
        <FiAlertCircle /> {mgrError.message}
      </div>
    );

  return (
    <div className="mm-page-container">
      {/* 1. STICKY HEADER */}
      <header className="mm-header">
        <div className="mm-header__left">
          <h1 className="mm-title">Quản lý Thực Đơn</h1>
          <p className="mm-subtitle">
            Thiết lập món ăn, giá bán và danh mục kinh doanh
          </p>
        </div>

        <div className="mm-header__right">
          {/* Global Context Filters */}
          <div className="mm-global-filter">
            <div className="mm-select-wrapper">
              <FiMapPin className="mm-icon" />
              <select
                className="mm-select"
                value={currentRestaurant || ""}
                onChange={(e) => setCurrentRestaurant(e.target.value)}
                disabled={managerRestaurants.length <= 1}
              >
                {managerRestaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mm-select-wrapper">
              <FiClock className="mm-icon" />
              <select
                className="mm-select"
                value={selectedTimeSlot || "breakfast"}
                onChange={(e) => setSelectedTimeSlot(e.target.value)}
              >
                {Object.entries(TIME_SLOT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="mm-actions">
            <button
              className="mm-btn mm-btn--secondary"
              onClick={() => toggleModal("category", true)}
            >
              <FiFolderPlus /> Danh mục
            </button>
            <button
              className="mm-btn mm-btn--primary"
              onClick={() => toggleModal("menuItem", true)}
            >
              <FiPlus /> Thêm món
            </button>
          </div>
        </div>
      </header>

      {/* 2. STATS & MENU STRIP */}
      <section className="mm-stats-section">
        <CompactMenuStrip
          menus={menus}
          menusLoading={menusLoading}
          menusError={menusError}
          isCollapsed={isStatsCollapsed}
          onToggleCollapse={() => setIsStatsCollapsed((s) => !s)}
          onAddMenu={() => toggleModal("menu", true)}
          onEditMenu={(menu) => toggleModal("menu", true, menu)}
          onDeleteMenu={() => alert("Coming soon...")}
        />
      </section>

      {/* 3. MAIN BODY */}
      <main className="mm-body">
        {/* Toolbar Component */}
        <Toolbar
          searchTerm={search}
          onSearchChange={setSearch}
          currentCategory={categoryId || ""}
          onCategoryChange={setCategoryId}
          currentView={currentView}
          onViewChange={setCurrentView}
          statusFilter={statusFilter || ""}
          onStatusFilterChange={setStatusFilter}
          // Sort props
          sortOption={sortOption}
          onSortChange={setSortOption}
          // Price props
          onPriceRangeChange={setPriceRange}
          onBulkPriceEdit={() => toggleModal("priceEdit", true)}
          onCreatePromotion={() => toggleModal("promotion", true)}
          onAddCategory={() => toggleModal("category", true)}
          categories={categories}
          itemCount={displayItems.length}
          minPrice={priceRange.minPrice ?? ""}
          maxPrice={priceRange.maxPrice ?? ""}
        />

        {/* Content Area */}
        <div className="mm-body__content">
          {itemsError && (
            <div className="mm-state-box error">
              <FiAlertCircle size={32} />
              <p style={{ marginTop: 8 }}>
                Lỗi tải dữ liệu: {itemsError.message}
              </p>
            </div>
          )}

          {itemsLoading && items.length === 0 && (
            <div className="mm-state-box">
              <div className="spinner-dots"></div>
              <p>Đang đồng bộ dữ liệu món ăn...</p>
            </div>
          )}

          {!itemsLoading && displayItems.length === 0 && !itemsError && (
            <div className="mm-empty-state">
              <div className="mm-empty-state__img">🍽️</div>
              <h3>Chưa có món ăn nào</h3>
              <p>
                Thực đơn của bạn đang trống hoặc không tìm thấy kết quả phù hợp.
              </p>
              <button
                className="mm-btn mm-btn--primary"
                onClick={() => toggleModal("menuItem", true)}
              >
                Thêm món ngay
              </button>
            </div>
          )}

          {displayItems.length > 0 && (
            <>
              <div className={`mm-grid mm-grid--${currentView}`}>
                {displayItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    onEdit={() => toggleModal("menuItem", true, item.id)}
                    onDelete={() => {}}
                    viewMode={currentView}
                  />
                ))}
              </div>

              {pageInfo?.hasNextPage && (
                <div className="mm-pagination">
                  <button
                    className="mm-btn-load-more"
                    onClick={fetchMoreItems}
                    disabled={itemsLoading}
                  >
                    {itemsLoading ? "Đang tải thêm..." : "Tải thêm món ăn"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* --- MODALS INJECTION --- */}
      <MenuModal
        isOpen={modals.menu.isOpen}
        initialData={modals.menu.editingMenu}
        categoryMenus={categoryMenus}
        onClose={() => toggleModal("menu", false)}
        onSubmit={handleSubmitMenu}
        isSubmitting={isSavingMenu}
        createCategoryMenu={createCategoryMenu}
        updateCategoryMenu={updateCategoryMenu}
      />

      <MenuItemModal
        isOpen={modals.menuItem.isOpen}
        editId={modals.menuItem.editId}
        onClose={() => toggleModal("menuItem", false)}
        onSave={() => {
          refetchItems?.();
          toggleModal("menuItem", false);
        }}
        menuItems={items}
        categories={categories}
      />

      <CategoryModal
        restaurantId={currentRestaurant}
        isOpen={modals.category.isOpen}
        onClose={() => toggleModal("category", false)}
        onSave={() => toggleModal("category", false)}
      />

      <PriceEditModal
        isOpen={modals.priceEdit.isOpen}
        onClose={() => toggleModal("priceEdit", false)}
        onSave={() => {
          refetchItems?.();
          toggleModal("priceEdit", false);
        }}
        menuItems={items}
      />

      <PromotionModal
        isOpen={modals.promotion.isOpen}
        onClose={() => toggleModal("promotion", false)}
        onSave={(data) => {
          console.log("Promo Data:", data);
          toggleModal("promotion", false);
        }}
        menuItems={items} // Pass menuItems for scope selection
      />
    </div>
  );
};

export default MenuManagement;
