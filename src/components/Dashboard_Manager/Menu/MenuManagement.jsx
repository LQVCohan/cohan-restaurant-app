// src/pages/Restaurant/MenuManagement/MenuManagement.jsx
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import MenuModal from "./components/MenuModal/MenuModal";

// Logic
import { AuthContext } from "../../../context/AuthContext";
import { gql, useQuery } from "@apollo/client";
import useMenuManagement from "../../../hooks/useMenuManagement";
import { useCategoryManagement } from "../../../hooks/useCategoryManagement";
import { useRecipes } from "../../../hooks/useRecipes";

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

const getGraphQLErrorMessage = (error) => {
  const graphQlMessage = error?.graphQLErrors
    ?.map((entry) => entry?.message)
    .filter(Boolean)
    .join("; ");

  if (graphQlMessage) return graphQlMessage;
  if (error?.networkError?.result?.errors?.length) {
    return error.networkError.result.errors
      .map((entry) => entry?.message)
      .filter(Boolean)
      .join("; ");
  }

  return error?.message || "Không thể lưu thay đổi giá.";
};

const cloneIngredients = (ingredients = []) =>
  Array.isArray(ingredients)
    ? ingredients.map((ingredient) => ({
        ingredientId: ingredient?.ingredientId,
        qty: Number(ingredient?.qty || 0),
        unit: ingredient?.unit || ingredient?.baseUnit || "",
        wastePct: Number(ingredient?.wastePct || 0),
      }))
    : [];

const normalizeServingVariantsForSave = (methods = []) => {
  const normalizedMethods = methods.map((method, idx) => ({
    key: method.key || `sv_${idx}`,
    name: method.name,
    mode: method.mode || "PORTION",
    sellQty: Number(method.sellQty || 1),
    sellUnit: method.sellUnit || "portion",
    price: Number(method.price || 0),
    ingredients: cloneIngredients(method.ingredients),
    isDefault:
      typeof method.isDefault === "boolean" ? method.isDefault : idx === 0,
  }));

  let defaultIndex = normalizedMethods.findIndex((method) => method.isDefault);
  if (defaultIndex < 0) defaultIndex = 0;

  return normalizedMethods.map((method, idx) => ({
    ...method,
    isDefault: idx === defaultIndex,
  }));
};

const buildPriceEditError = ({ successCount, failures }) => {
  const failureCount = failures.length;
  const headline =
    successCount > 0
      ? `Đã lưu ${successCount} món, còn ${failureCount} món chưa lưu được.`
      : `Không thể lưu thay đổi giá cho ${failureCount} món.`;

  const error = new Error(headline);
  error.successCount = successCount;
  error.failureCount = failureCount;
  error.failures = failures;
  return error;
};

const MenuManagement = () => {
  const auth = useContext(AuthContext);
  const managerId = auth?.user?.id;

  // --- LOCAL STATE ---
  const [currentRestaurant, setCurrentRestaurant] = useState("");
  const [currentView, setCurrentView] = useState("grid");
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);
  const [sortOption, setSortOption] = useState("default");

  const [modals, setModals] = useState({
    menuItem: { isOpen: false, editId: null },
    menu: { isOpen: false, editingMenu: null },
    category: { isOpen: false },
    priceEdit: { isOpen: false },
  });

  const [isSavingMenu, setIsSavingMenu] = useState(false);
  const [isSavingPriceEdit, setIsSavingPriceEdit] = useState(false);
  const priceEditSubmitRef = useRef(false);

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
    deleteMenuItem,
    bulkUpdateMenuItemPrices,
  } = useMenuManagement({
    restaurantId: currentRestaurant || null,
    defaultTimeSlot: "breakfast",
    pageSize: 20,
    useConnection: true,
    sortOption,
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

  const { updateRecipe } = useRecipes(
    currentRestaurant || null,
    selectedTimeSlot || null,
    {
      search: null,
      categoryId: null,
    }
  );

  const menuItemsById = useMemo(
    () => new Map((items || []).map((item) => [String(item.id), item])),
    [items]
  );

  const getMenuItemLabel = useCallback(
    (itemId, fallbackName = "") => {
      if (fallbackName) return fallbackName;
      return menuItemsById.get(String(itemId))?.name || `Món #${itemId}`;
    },
    [menuItemsById]
  );

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

  const handleSavePriceChanges = useCallback(
    async ({ bulkOperations = [], manualUpdates = [] } = {}) => {
      if (priceEditSubmitRef.current) {
        throw new Error("Đang lưu thay đổi giá, vui lòng chờ hoàn tất.");
      }
      if (!currentRestaurant) {
        throw new Error("Chưa chọn nhà hàng để cập nhật giá.");
      }

      priceEditSubmitRef.current = true;
      setIsSavingPriceEdit(true);

      let successCount = 0;
      const failures = [];

      try {
        for (const operation of bulkOperations) {
          const targetIds = Array.isArray(operation?.menuItemIds)
            ? operation.menuItemIds.filter(Boolean)
            : [];

          if (!targetIds.length) continue;

          try {
            const result = await bulkUpdateMenuItemPrices({
              restaurantId: currentRestaurant,
              timeSlot: selectedTimeSlot || null,
              target: { menuItemIds: targetIds },
              mode: operation.mode,
              value: Number(operation.value),
              // Align FE preview with backend bulk mutation rounding.
              roundTo: Number.isInteger(operation.roundTo)
                ? operation.roundTo
                : 0,
              floorZero: operation.floorZero !== false,
            });

            const updatedIds = new Set(
              (result?.items || []).map((item) => String(item.id))
            );

            targetIds.forEach((itemId) => {
              if (updatedIds.has(String(itemId))) {
                successCount += 1;
                return;
              }

              failures.push({
                type: "bulk",
                itemId,
                itemName: getMenuItemLabel(itemId),
                message: "Backend không xác nhận cập nhật giá cho món này.",
              });
            });
          } catch (error) {
            const message = getGraphQLErrorMessage(error);

            targetIds.forEach((itemId) => {
              const itemName = getMenuItemLabel(itemId);
              failures.push({
                type: "bulk",
                itemId,
                itemName,
                message,
              });
              console.error("Bulk price update failed", {
                itemId,
                itemName,
                error,
              });
            });
          }
        }

        for (const update of manualUpdates) {
          try {
            await updateRecipe(update.itemId, {
              servingVariants: normalizeServingVariantsForSave(update.methods),
            });
            successCount += 1;
          } catch (error) {
            const message = getGraphQLErrorMessage(error);
            const itemName = getMenuItemLabel(update.itemId, update.itemName);

            failures.push({
              type: "manual",
              itemId: update.itemId,
              itemName,
              message,
            });
            console.error("Manual price update failed", {
              itemId: update.itemId,
              itemName,
              error,
            });
          }
        }

        try {
          await refetchItems?.();
        } catch (error) {
          const message = getGraphQLErrorMessage(error);

          if (!successCount && failures.length === 0) {
            throw error;
          }

          failures.push({
            type: "refresh",
            itemId: null,
            itemName: "Danh sách món ăn",
            message: `Đã lưu xong nhưng không thể tải lại dữ liệu: ${message}`,
          });
        }

        if (failures.length > 0) {
          throw buildPriceEditError({ successCount, failures });
        }
      } finally {
        priceEditSubmitRef.current = false;
        setIsSavingPriceEdit(false);
      }
    },
    [
      bulkUpdateMenuItemPrices,
      currentRestaurant,
      getMenuItemLabel,
      refetchItems,
      selectedTimeSlot,
      updateRecipe,
    ]
  );

  const displayItems = useMemo(
    () =>
      (items || []).map((item) => ({
        ...item,
        // Backend now owns connection ordering so FE only enriches display fields.
        categoryName:
          categories.find((c) => c.id === item.categoryId)?.name ||
          item.categoryName,
      })),
    [items, categories]
  );

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
      <header className="mm-header">
        <div className="mm-header__left">
          <h1 className="mm-title">Quản lý Thực Đơn</h1>
          <p className="mm-subtitle">
            Thiết lập món ăn, giá bán và danh mục kinh doanh
          </p>
        </div>

        <div className="mm-header__right">
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

      <section className="mm-stats-section">
        <CompactMenuStrip
          menus={menus}
          menusLoading={menusLoading}
          menusError={menusError}
          isCollapsed={isStatsCollapsed}
          onToggleCollapse={() => setIsStatsCollapsed((s) => !s)}
          onAddMenu={() => toggleModal("menu", true)}
          onEditMenu={(menu) => toggleModal("menu", true, menu)}
          onDeleteMenu={undefined}
        />
      </section>

      <main className="mm-body">
        <Toolbar
          searchTerm={search}
          onSearchChange={setSearch}
          currentCategory={categoryId || ""}
          onCategoryChange={setCategoryId}
          currentView={currentView}
          onViewChange={setCurrentView}
          statusFilter={statusFilter || ""}
          onStatusFilterChange={setStatusFilter}
          sortOption={sortOption}
          onSortChange={setSortOption}
          onPriceRangeChange={setPriceRange}
          onBulkPriceEdit={() => toggleModal("priceEdit", true)}
          onAddCategory={() => toggleModal("category", true)}
          categories={categories}
          itemCount={displayItems.length}
          minPrice={priceRange.minPrice ?? ""}
          maxPrice={priceRange.maxPrice ?? ""}
        />

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
                    onDelete={async () => {
                      if (!window.confirm(`Xóa món "${item.name}"?`)) return;
                      await deleteMenuItem(item.id);
                      await refetchItems?.();
                    }}
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
        restaurantId={currentRestaurant}
        timeSlot={selectedTimeSlot || "breakfast"}
      />

      <CategoryModal
        restaurantId={currentRestaurant}
        timeSlot={selectedTimeSlot || "breakfast"}
        isOpen={modals.category.isOpen}
        onClose={() => toggleModal("category", false)}
        onSave={() => toggleModal("category", false)}
      />

      <PriceEditModal
        isOpen={modals.priceEdit.isOpen}
        isSubmitting={isSavingPriceEdit}
        onClose={() => toggleModal("priceEdit", false)}
        onSave={handleSavePriceChanges}
        menuItems={items}
      />
    </div>
  );
};

export default MenuManagement;
