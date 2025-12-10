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

import CompactMenuStrip from "./components/StatsSection/CompactMenuStrip";
import Toolbar from "./components/Toolbar/Toolbar";
import MenuItemCard from "./components/MenuItemCard/MenuItemCard";
import MenuItemModal from "./components/MenuItemModal/MenuItemModal";
import CategoryModal from "./components/CategoryModal/CategoryModal";
import PriceEditModal from "./components/PriceEditModal/PriceEditModal";
import PromotionModal from "./components/PromotionModal/PromotionModal";
import MenuModal from "./components/MenuModal/MenuModal";

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

  const [currentRestaurant, setCurrentRestaurant] = useState("");
  const [currentView, setCurrentView] = useState("grid");
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);

  // Modals state
  const [modals, setModals] = useState({
    menuItem: { isOpen: false, editId: null },
    menu: { isOpen: false, editingMenu: null },
    category: { isOpen: false },
    priceEdit: { isOpen: false },
    promotion: { isOpen: false },
  });

  const [isSavingMenu, setIsSavingMenu] = useState(false);

  /* DATA FETCHING LOGIC (Giữ nguyên) */
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
  });

  const { categories, categoryMenus, createCategoryMenu, updateCategoryMenu } =
    useCategoryManagement({
      restaurantId: currentRestaurant || null,
      timeSlot: selectedTimeSlot || "breakfast",
      limit: 8,
      loadCategories: true,
      loadTopCategories: false,
      loadCategoryMenus: modals.menu.isOpen,
    });

  /* HANDLERS (Giữ nguyên logic) */
  const openMenuModalCreate = () =>
    setModals((prev) => ({
      ...prev,
      menu: { isOpen: true, editingMenu: null },
    }));
  const openMenuModalEdit = (menu) =>
    setModals((prev) => ({
      ...prev,
      menu: { isOpen: true, editingMenu: menu },
    }));
  const closeMenuModal = () =>
    setModals((prev) => ({
      ...prev,
      menu: { isOpen: false, editingMenu: null },
    }));
  const openMenuItemModal = (editId = null) =>
    setModals((prev) => ({ ...prev, menuItem: { isOpen: true, editId } }));
  const closeMenuItemModal = () =>
    setModals((prev) => ({
      ...prev,
      menuItem: { isOpen: false, editId: null },
    }));
  const openCategoryModal = () =>
    setModals((prev) => ({ ...prev, category: { isOpen: true } }));
  const closeCategoryModal = () =>
    setModals((prev) => ({ ...prev, category: { isOpen: false } }));
  const openPriceEditModal = () =>
    setModals((prev) => ({ ...prev, priceEdit: { isOpen: true } }));
  const closePriceEditModal = () =>
    setModals((prev) => ({ ...prev, priceEdit: { isOpen: false } }));
  const openPromotionModal = () =>
    setModals((prev) => ({ ...prev, promotion: { isOpen: true } }));
  const closePromotionModal = () =>
    setModals((prev) => ({ ...prev, promotion: { isOpen: false } }));

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
      closeMenuModal();
    } catch (err) {
      alert(err?.message || "Lỗi khi lưu menu");
    } finally {
      setIsSavingMenu(false);
    }
  };

  const handleDeleteMenu = () => {
    alert("Chức năng xóa đang được phát triển.");
  };

  /* RENDER START */
  if (!managerId) return <div className="saas-loading">Đang xác thực...</div>;
  if (mgrLoading)
    return (
      <div className="saas-loading">
        <div className="spinner"></div>
      </div>
    );
  if (mgrError)
    return (
      <div className="saas-error">
        <FiAlertCircle /> {mgrError.message}
      </div>
    );

  return (
    <div className="saas-container">
      {/* 1. Header Section */}
      <header className="saas-header">
        <div className="saas-header__left">
          <h1 className="saas-header__title">Quản lý Thực Đơn</h1>
          <p className="saas-header__subtitle">
            Thiết lập món ăn, giá bán và danh mục cho nhà hàng
          </p>
        </div>

        <div className="saas-header__right">
          {/* Global Filters */}
          <div className="saas-filters">
            <div className="saas-select-wrapper">
              <FiMapPin className="saas-select-icon" />
              <select
                className="saas-select"
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

            <div className="saas-select-wrapper">
              <FiClock className="saas-select-icon" />
              <select
                className="saas-select"
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

          {/* Primary Actions */}
          <div className="saas-actions">
            <button
              className="saas-btn saas-btn--secondary"
              onClick={openCategoryModal}
            >
              <FiFolderPlus /> Danh mục
            </button>
            <button
              className="saas-btn saas-btn--primary"
              onClick={() => openMenuItemModal()}
            >
              <FiPlus /> Thêm món mới
            </button>
          </div>
        </div>
      </header>

      {/* 2. Menu Strip (Context) */}
      <section className="saas-section">
        <CompactMenuStrip
          menus={menus}
          menusLoading={menusLoading}
          menusError={menusError}
          isCollapsed={isStatsCollapsed}
          onToggleCollapse={() => setIsStatsCollapsed((s) => !s)}
          onAddMenu={openMenuModalCreate}
          onEditMenu={openMenuModalEdit}
          onDeleteMenu={handleDeleteMenu}
        />
      </section>

      {/* 3. Toolbar & Content */}
      <section className="saas-body">
        <div className="saas-body__toolbar">
          <Toolbar
            searchTerm={search}
            onSearchChange={setSearch}
            currentCategory={categoryId || ""}
            onCategoryChange={setCategoryId}
            currentView={currentView}
            onViewChange={setCurrentView}
            statusFilter={statusFilter || ""}
            onStatusFilterChange={setStatusFilter}
            onPriceRangeChange={setPriceRange}
            onBulkPriceEdit={openPriceEditModal}
            onCreatePromotion={openPromotionModal}
            onAddCategory={openCategoryModal}
            categories={categories}
            itemCount={items.length}
            minPrice={priceRange.minPrice ?? ""}
            maxPrice={priceRange.maxPrice ?? ""}
          />
        </div>

        <div className="saas-body__content">
          {itemsError && (
            <div className="saas-state-box error">
              <FiAlertCircle size={24} />
              <p>Lỗi tải dữ liệu: {itemsError.message}</p>
            </div>
          )}

          {itemsLoading && items.length === 0 && (
            <div className="saas-state-box loading">
              <div className="spinner-dots"></div>
              <p>Đang đồng bộ dữ liệu món ăn...</p>
            </div>
          )}

          {!itemsLoading && items.length === 0 && !itemsError && (
            <div className="saas-empty-state">
              <div className="saas-empty-state__img">🍽️</div>
              <h3>Chưa có món ăn nào</h3>
              <p>
                Thực đơn của bạn đang trống. Hãy bắt đầu bằng cách thêm món ăn
                mới.
              </p>
              <button
                className="saas-btn saas-btn--primary"
                onClick={() => openMenuItemModal()}
              >
                Thêm món ngay
              </button>
            </div>
          )}

          {items.length > 0 && (
            <>
              <div
                className={`menu-grid-layout menu-grid-layout--${currentView}`}
              >
                {items.map((item) => (
                  <div key={item.id} className="menu-item-wrapper">
                    <MenuItemCard
                      item={item}
                      onEdit={() => openMenuItemModal(item.id)}
                      onDelete={() => {}}
                      viewMode={currentView}
                    />
                  </div>
                ))}
              </div>

              {pageInfo?.hasNextPage && (
                <div className="saas-pagination">
                  <button
                    className="saas-btn saas-btn--outline"
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
      </section>

      {/* Modals Injection */}
      <MenuModal
        isOpen={modals.menu.isOpen}
        initialData={modals.menu.editingMenu}
        categoryMenus={categoryMenus}
        onClose={closeMenuModal}
        onSubmit={handleSubmitMenu}
        isSubmitting={isSavingMenu}
        createCategoryMenu={createCategoryMenu}
        updateCategoryMenu={updateCategoryMenu}
      />
      <MenuItemModal
        isOpen={modals.menuItem.isOpen}
        editId={modals.menuItem.editId}
        onClose={closeMenuItemModal}
        onSave={() => {
          refetchItems?.();
          closeMenuItemModal();
        }}
        menuItems={items}
        categories={categories}
      />
      <CategoryModal
        restaurantId={currentRestaurant}
        isOpen={modals.category.isOpen}
        onClose={closeCategoryModal}
        onSave={closeCategoryModal}
      />
      <PriceEditModal
        isOpen={modals.priceEdit.isOpen}
        onClose={closePriceEditModal}
        onSave={() => {
          refetchItems?.();
          closePriceEditModal();
        }}
        menuItems={items}
      />
      <PromotionModal
        isOpen={modals.promotion.isOpen}
        onClose={closePromotionModal}
        onSave={closePromotionModal}
      />
    </div>
  );
};

export default MenuManagement;
