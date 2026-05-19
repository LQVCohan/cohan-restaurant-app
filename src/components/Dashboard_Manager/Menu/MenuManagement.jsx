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
  FiTag,
  FiAlertCircle,
  FiTrash2,
} from "react-icons/fi";
import "./MenuManagement.scss";
import "./MenuManagementPolish.scss";

// Sub-components
import CompactMenuStrip from "./components/StatsSection/CompactMenuStrip";
import Toolbar from "./components/Toolbar/Toolbar";
import MenuItemCard from "./components/MenuItemCard/MenuItemCard";
// Modals
import MenuItemModal from "./components/MenuItemModal/MenuItemModal";
import DishCategoryModal from "./components/DishCategoryModal/DishCategoryModal";
import MenuGroupModal from "./components/MenuGroupModal/MenuGroupModal";
import PriceEditModal from "./components/PriceEditModal/PriceEditModal";
import MenuModal from "./components/MenuModal/MenuModal";
import Modal from "../../common/Modal";

// Logic
import { AuthContext } from "../../../context/AuthContext";
import { gql, useQuery } from "@apollo/client";
import useMenuManagement from "../../../hooks/useMenuManagement";
import { useCategoryManagement } from "../../../hooks/useCategoryManagement";
import { useRecipes } from "../../../hooks/useRecipes";
import {
  MENU_MANAGEMENT_ACTIONS,
  canAccessMenuManagementAction,
} from "../../../utils/frontendRoleAccess";
import { MENU_ITEM_INVENTORY_STATUS } from "../../../utils/menuItemAvailability";
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
const TIME_SLOT_ORDER = ["breakfast", "lunch", "dinner", "late_night"];
const getGraphQLErrorMessage = (
  error,
  fallbackMessage = "Đã xảy ra lỗi không xác định.",
) => {
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

  return error?.message || fallbackMessage;
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
  const currentUser = auth?.user;

  const canViewMenu = canAccessMenuManagementAction(
    currentUser,
    MENU_MANAGEMENT_ACTIONS.VIEW,
  );

  const canCreateMenuItem = canAccessMenuManagementAction(
    currentUser,
    MENU_MANAGEMENT_ACTIONS.CREATE_ITEM,
  );

  const canUpdateMenuItem = canAccessMenuManagementAction(
    currentUser,
    MENU_MANAGEMENT_ACTIONS.UPDATE_ITEM,
  );

  const canDeleteMenuItem = canAccessMenuManagementAction(
    currentUser,
    MENU_MANAGEMENT_ACTIONS.DELETE_ITEM,
  );

  const canUpdatePrice = canAccessMenuManagementAction(
    currentUser,
    MENU_MANAGEMENT_ACTIONS.UPDATE_PRICE,
  );

  const canManageDishCategory = canAccessMenuManagementAction(
    currentUser,
    MENU_MANAGEMENT_ACTIONS.MANAGE_DISH_CATEGORY,
  );

  const canManageMenuGroup = canAccessMenuManagementAction(
    currentUser,
    MENU_MANAGEMENT_ACTIONS.MANAGE_MENU_GROUP,
  );

  const canCreateMenu = canAccessMenuManagementAction(
    currentUser,
    MENU_MANAGEMENT_ACTIONS.CREATE_MENU,
  );

  const canUpdateMenu = canAccessMenuManagementAction(
    currentUser,
    MENU_MANAGEMENT_ACTIONS.UPDATE_MENU,
  );

  const canToggleMenu = canAccessMenuManagementAction(
    currentUser,
    MENU_MANAGEMENT_ACTIONS.TOGGLE_MENU,
  );
  const canCopyMenu = canAccessMenuManagementAction(
    currentUser,
    MENU_MANAGEMENT_ACTIONS.COPY_MENU,
  );
  // --- LOCAL STATE ---
  const [currentRestaurant, setCurrentRestaurant] = useState("");
  const [currentView, setCurrentView] = useState("grid");
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);
  const [sortOption, setSortOption] = useState("default");
  const [inventoryFilter, setInventoryFilter] = useState("all");

  const [modals, setModals] = useState({
    menuItem: { isOpen: false, editId: null },
    menu: { isOpen: false, editingMenu: null },
    dishCategory: { isOpen: false },
    menuGroup: { isOpen: false },
    priceEdit: { isOpen: false },
  });

  const [isSavingMenu, setIsSavingMenu] = useState(false);
  const [menuSubmitError, setMenuSubmitError] = useState("");
  const [isTogglingMenu, setIsTogglingMenu] = useState(false);
  const [isSavingPriceEdit, setIsSavingPriceEdit] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteListRefreshError, setDeleteListRefreshError] = useState("");
  const priceEditSubmitRef = useRef(false);
  const deleteItemSubmitRef = useRef(false);

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
    [mgrData],
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
    syncMenuItemInventoryStatuses,
  } = useMenuManagement({
    restaurantId: currentRestaurant || null,
    defaultTimeSlot: "breakfast",
    pageSize: 20,
    useConnection: true,
    sort: sortOption,
  });
  const buildCopyMenuName = useCallback(
    (sourceMenu) => {
      const baseName = `${sourceMenu?.name || "Menu"} (bản sao)`;
      const existingNames = new Set(
        (menus || []).map((menu) =>
          String(menu?.name || "")
            .trim()
            .toLowerCase(),
        ),
      );

      let candidate = baseName;
      let counter = 2;

      while (existingNames.has(candidate.trim().toLowerCase())) {
        candidate = `${baseName} ${counter}`;
        counter += 1;
      }

      return candidate;
    },
    [menus],
  );
  const getSuggestedCopyTimeSlot = useCallback(() => {
    const usedSlots = new Set((menus || []).map((menu) => menu.timeSlot));
    return TIME_SLOT_ORDER.find((slot) => !usedSlots.has(slot)) || null;
  }, [menus]);
  const handleCopyMenu = useCallback(
    (menu) => {
      if (!menu) return;

      const suggestedTimeSlot = getSuggestedCopyTimeSlot();

      if (!suggestedTimeSlot) {
        setMenuSubmitError(
          "Không thể sao chép vì nhà hàng này đã có đủ 4 thực đơn theo khung giờ. Hãy chỉnh sửa menu hiện có hoặc ẩn một menu trước.",
        );
        return;
      }

      const copyDraft = {
        __mode: "copy",
        isCopyDraft: true,
        sourceMenuId: menu.id || menu._id || null,

        id: null,
        name: buildCopyMenuName(menu),
        description: menu.description || "",
        timeSlot: suggestedTimeSlot,
        categoryMenuId: menu.categoryMenuId || menu.categoryMenu?.id || "",
        coverImage: menu.coverImage || "",
        isActive: false,
      };

      toggleModal("menu", true, copyDraft);
    },
    [buildCopyMenuName, getSuggestedCopyTimeSlot],
  );
  const shouldLoadCategoryMenus = modals.menu.isOpen || modals.menuGroup.isOpen;
  const { categories, categoryMenus, createCategoryMenu, updateCategoryMenu } =
    useCategoryManagement({
      restaurantId: currentRestaurant || null,
      timeSlot: selectedTimeSlot || "breakfast",
      limit: 8,
      loadCategories: true,
      loadTopCategories: false,
      loadCategoryMenus: shouldLoadCategoryMenus,
    });

  const { updateRecipe } = useRecipes(
    currentRestaurant || null,
    selectedTimeSlot || null,
    {
      search: null,
      categoryId: null,
    },
  );

  const menuItemsById = useMemo(
    () => new Map((items || []).map((item) => [String(item.id), item])),
    [items],
  );

  const getMenuItemLabel = useCallback(
    (itemId, fallbackName = "") => {
      if (fallbackName) return fallbackName;
      return menuItemsById.get(String(itemId))?.name || `Món #${itemId}`;
    },
    [menuItemsById],
  );

  const toggleModal = (name, isOpen = true, data = null) => {
    if (name === "menu") {
      setMenuSubmitError("");
    }

    setModals((prev) => {
      const newState = { ...prev, [name]: { ...prev[name], isOpen } };
      if (name === "menuItem") newState.menuItem.editId = data;
      if (name === "menu") newState.menu.editingMenu = data;
      return newState;
    });
  };

  const handleSubmitMenu = async (form) => {
    if (!currentRestaurant) return;

    setMenuSubmitError("");

    const isCreatingMenu = !form?.id;
    const hasMenuInSelectedSlot = (menus || []).some((menu) => {
      const sameSlot = menu?.timeSlot === form.timeSlot;
      const sameMenu = form?.id && String(menu?.id) === String(form.id);
      return sameSlot && !sameMenu;
    });

    if (isCreatingMenu && hasMenuInSelectedSlot) {
      setMenuSubmitError(
        "Khung giờ này đã có thực đơn. Vui lòng chọn khung giờ còn trống để tạo bản sao hoặc tạo menu mới.",
      );
      return;
    }

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
      setMenuSubmitError(
        getGraphQLErrorMessage(err, "Không thể lưu menu. Vui lòng thử lại."),
      );
    } finally {
      setIsSavingMenu(false);
    }
  };
  const handleToggleMenuActive = async (menu) => {
    if (!currentRestaurant || !menu?.timeSlot || isTogglingMenu) return;

    const nextIsActive = menu.isActive === false;

    setIsTogglingMenu(true);
    setMenuSubmitError("");

    try {
      await ensureMenu({
        restaurantId: currentRestaurant,
        timeSlot: menu.timeSlot,
        name: menu.name,
        description: menu.description || null,
        coverImage: menu.coverImage || null,
        categoryMenuId: menu.categoryMenuId || menu.categoryMenu?.id || null,
        isActive: nextIsActive,
      });

      await refetchMenus?.();
    } catch (err) {
      setMenuSubmitError(
        getGraphQLErrorMessage(
          err,
          nextIsActive
            ? "Không thể bật lại thực đơn. Vui lòng thử lại."
            : "Không thể ẩn thực đơn. Vui lòng thử lại.",
        ),
      );
    } finally {
      setIsTogglingMenu(false);
    }
  };
  const handleRequestDeleteItem = useCallback((item) => {
    if (!item?.id) return;

    setDeleteError("");
    setDeleteListRefreshError("");
    setDeletingItem({
      id: item.id,
      name: item.name || `Món #${item.id}`,
    });
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    if (isDeletingItem) return;
    setDeletingItem(null);
    setDeleteError("");
  }, [isDeletingItem]);

  const handleConfirmDeleteItem = useCallback(async () => {
    if (!deletingItem?.id || deleteItemSubmitRef.current) return;

    const itemName = deletingItem.name || `Món #${deletingItem.id}`;
    deleteItemSubmitRef.current = true;
    setIsDeletingItem(true);
    setDeleteError("");
    setDeleteListRefreshError("");

    try {
      await deleteMenuItem(deletingItem.id);

      try {
        await refetchItems?.();
        setDeletingItem(null);
      } catch (error) {
        const message = getGraphQLErrorMessage(
          error,
          "Không thể tải lại danh sách món ăn.",
        );

        setDeletingItem(null);
        setDeleteListRefreshError(
          `Đã xóa món "${itemName}" nhưng không thể tải lại danh sách: ${message}`,
        );
      }
    } catch (error) {
      setDeleteError(
        getGraphQLErrorMessage(
          error,
          "Không thể xóa món ăn. Vui lòng thử lại.",
        ),
      );
    } finally {
      deleteItemSubmitRef.current = false;
      setIsDeletingItem(false);
    }
  }, [deleteMenuItem, deletingItem, refetchItems]);

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
              (result?.items || []).map((item) => String(item.id)),
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
            const message = getGraphQLErrorMessage(
              error,
              "Không thể lưu thay đổi giá.",
            );

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
            const message = getGraphQLErrorMessage(
              error,
              "Không thể lưu thay đổi giá.",
            );
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
          const message = getGraphQLErrorMessage(
            error,
            "Không thể tải lại dữ liệu món ăn.",
          );

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
    ],
  );

  const displayItems = useMemo(
    () => {
      const mapped = (items || []).map((item) => ({
        ...item,
        categoryName:
          categories.find((c) => c.id === item.categoryId)?.name ||
          item.categoryName,
      }));
      if (inventoryFilter === "all") return mapped;
      return mapped.filter((item) => {
        const warnings = Array.isArray(item.stockWarnings) ? item.stockWarnings : [];
        const hasRecipe = Array.isArray(item.servingVariants) && item.servingVariants.length > 0;
        if (inventoryFilter === "low_stock") {
          return item.inventoryStatus === MENU_ITEM_INVENTORY_STATUS.LOW_STOCK;
        }
        if (inventoryFilter === "out_of_stock") {
          return item.inventoryStatus === MENU_ITEM_INVENTORY_STATUS.OUT_OF_STOCK;
        }
        if (inventoryFilter === "needs_check") {
          return item.inventoryStatus === MENU_ITEM_INVENTORY_STATUS.ERROR;
        }
        if (inventoryFilter === "not_tracked") {
          return item.inventoryStatus === MENU_ITEM_INVENTORY_STATUS.NOT_TRACKED || !hasRecipe || warnings.some((w) => /chưa tracking recipe/i.test(String(w)));
        }
        return true;
      });
    },
    [items, categories, inventoryFilter],
  );

  const handleSyncInventory = useCallback(
    async ({ restaurantId, timeSlot }) => {
      const dryRunResult = await syncMenuItemInventoryStatuses({
        restaurantId,
        timeSlot,
        recoverOutOfStock: true,
        dryRun: true,
      });

      if (!dryRunResult?.updatedCount) {
        window.alert("Không có món nào cần cập nhật.");
        return dryRunResult;
      }

      const confirmed = window.confirm(
        `Sẽ cập nhật ${dryRunResult.updatedCount} món.\n` +
          `- available → out_of_stock: ${dryRunResult.toOutOfStockCount || 0}\n` +
          `- out_of_stock → available: ${dryRunResult.toAvailableCount || 0}\n\n` +
          "Bạn có chắc muốn đồng bộ tồn kho ngay bây giờ?",
      );
      if (!confirmed) return null;

      return syncMenuItemInventoryStatuses({
        restaurantId,
        timeSlot,
        recoverOutOfStock: true,
        dryRun: false,
      });
    },
    [syncMenuItemInventoryStatuses],
  );

  const inlineAlertStyle = {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "12px 14px",
    marginBottom: 16,
    borderRadius: 10,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
  };

  const modalButtonBaseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minWidth: 108,
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid transparent",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };

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
  if (!canViewMenu) {
    return (
      <div className="mm-state-box error">
        <FiAlertCircle /> Bạn không có quyền truy cập màn hình quản lý thực đơn.
      </div>
    );
  }
  return (
    <div className="mm-page-container">
      <header className="mm-header">
        <div className="mm-header__left">
          <h1 className="mm-title">Quản lý Thực Đơn</h1>
          <p className="mm-subtitle">
            Thiết lập món ăn, danh mục món và nhóm thực đơn
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
            {canManageDishCategory && (
              <button
                className="mm-btn mm-btn--secondary"
                onClick={() => toggleModal("dishCategory", true)}
              >
                <FiTag /> Danh mục món
              </button>
            )}

            {canManageMenuGroup && (
              <button
                className="mm-btn mm-btn--secondary"
                onClick={() => toggleModal("menuGroup", true)}
              >
                <FiFolderPlus /> Nhóm thực đơn
              </button>
            )}

            {canCreateMenuItem && (
              <button
                className="mm-btn mm-btn--primary"
                onClick={() => toggleModal("menuItem", true)}
              >
                <FiPlus /> Thêm món
              </button>
            )}
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
          onAddMenu={
            canCreateMenu ? () => toggleModal("menu", true) : undefined
          }
          onEditMenu={
            canUpdateMenu
              ? (menu) => toggleModal("menu", true, menu)
              : undefined
          }
          onToggleMenuActive={
            canToggleMenu ? handleToggleMenuActive : undefined
          }
          onDeleteMenu={undefined}
          onCopyMenu={canCopyMenu ? handleCopyMenu : undefined}
          onSyncInventory={handleSyncInventory}
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
          onBulkPriceEdit={
            canUpdatePrice ? () => toggleModal("priceEdit", true) : undefined
          }
          onAddDishCategory={
            canManageDishCategory
              ? () => toggleModal("dishCategory", true)
              : undefined
          }
          onAddMenuGroup={
            canManageMenuGroup
              ? () => toggleModal("menuGroup", true)
              : undefined
          }
          categories={categories}
          itemCount={displayItems.length}
          minPrice={priceRange.minPrice ?? ""}
          maxPrice={priceRange.maxPrice ?? ""}
        />

        <div className="mm-body__content">
          <div className="mm-inventory-quick-filters" style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {[
              ["all", "Tất cả"],
              ["low_stock", "Sắp hết"],
              ["out_of_stock", "Hết nguyên liệu"],
              ["needs_check", "Cần kiểm kho"],
              ["not_tracked", "Chưa tracking recipe"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`mm-btn mm-btn--secondary ${inventoryFilter === key ? "active" : ""}`}
                onClick={() => setInventoryFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {deleteListRefreshError && (
            <div role="alert" style={inlineAlertStyle}>
              <FiAlertCircle
                size={18}
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <p style={{ margin: 0, lineHeight: 1.5 }}>
                {deleteListRefreshError}
              </p>
            </div>
          )}

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
              {canCreateMenuItem && (
                <button
                  className="mm-btn mm-btn--primary"
                  onClick={() => toggleModal("menuItem", true)}
                >
                  Thêm món ngay
                </button>
              )}
            </div>
          )}

          {displayItems.length > 0 && (
            <>
              <div className={`mm-grid mm-grid--${currentView}`}>
                {displayItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    onEdit={
                      canUpdateMenuItem
                        ? () => toggleModal("menuItem", true, item.id)
                        : undefined
                    }
                    onDelete={
                      canDeleteMenuItem
                        ? () => handleRequestDeleteItem(item)
                        : undefined
                    }
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
        restaurantId={currentRestaurant || null}
        submitError={menuSubmitError}
      />

      <MenuItemModal
        isOpen={modals.menuItem.isOpen}
        editId={modals.menuItem.editId}
        onClose={() => toggleModal("menuItem", false)}
        onSave={async () => {
          await refetchItems?.();
          toggleModal("menuItem", false);
        }}
        menuItems={items}
        categories={categories}
        restaurantId={currentRestaurant}
        timeSlot={selectedTimeSlot || "breakfast"}
      />

      <DishCategoryModal
        restaurantId={currentRestaurant}
        timeSlot={selectedTimeSlot || "breakfast"}
        isOpen={modals.dishCategory.isOpen}
        onClose={() => toggleModal("dishCategory", false)}
        onSave={async () => {
          await refetchItems?.();
          toggleModal("dishCategory", false);
        }}
      />

      <MenuGroupModal
        restaurantId={currentRestaurant}
        timeSlot={selectedTimeSlot || "breakfast"}
        isOpen={modals.menuGroup.isOpen}
        onClose={() => toggleModal("menuGroup", false)}
        onSave={() => toggleModal("menuGroup", false)}
      />

      <PriceEditModal
        isOpen={modals.priceEdit.isOpen}
        isSubmitting={isSavingPriceEdit}
        onClose={() => toggleModal("priceEdit", false)}
        onSave={handleSavePriceChanges}
        menuItems={items}
      />

      <Modal
        isOpen={!!deletingItem}
        onClose={handleCloseDeleteModal}
        size="sm"
        closeOnOverlayClick={!isDeletingItem}
        closeOnEscape={!isDeletingItem}
      >
        <Modal.Header>Xác nhận xóa món</Modal.Header>
        <Modal.Body>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, color: "#334155", lineHeight: 1.6 }}>
              Bạn có chắc chắn muốn xóa món
              <strong style={{ color: "#1e293b" }}>
                {` ${deletingItem?.name || "này"}`}
              </strong>
              ?
            </p>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              Món sẽ bị gỡ khỏi danh sách hiện tại sau khi bạn xác nhận.
            </p>

            {deleteError && (
              <div
                role="alert"
                style={{ ...inlineAlertStyle, marginBottom: 0 }}
              >
                <FiAlertCircle
                  size={18}
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <p style={{ margin: 0, lineHeight: 1.5 }}>{deleteError}</p>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={handleCloseDeleteModal}
            disabled={isDeletingItem}
            style={{
              ...modalButtonBaseStyle,
              borderColor: "#cbd5e1",
              background: "#ffffff",
              color: "#475569",
              cursor: isDeletingItem ? "not-allowed" : "pointer",
              opacity: isDeletingItem ? 0.7 : 1,
            }}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirmDeleteItem}
            disabled={isDeletingItem}
            style={{
              ...modalButtonBaseStyle,
              background: "#dc2626",
              color: "#ffffff",
              cursor: isDeletingItem ? "not-allowed" : "pointer",
              opacity: isDeletingItem ? 0.75 : 1,
            }}
          >
            <FiTrash2 size={16} />
            <span>{isDeletingItem ? "Đang xóa..." : "Xóa"}</span>
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default MenuManagement;
