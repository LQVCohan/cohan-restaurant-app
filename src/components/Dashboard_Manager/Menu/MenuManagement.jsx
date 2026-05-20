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
  FiPlus,
  FiFolderPlus,
  FiTag,
  FiAlertCircle,
  FiTrash2,
} from "react-icons/fi";
import "./MenuManagement.scss";
import "./MenuManagementPolish.scss";
import ManagementPageHeader from "../shared/ManagementPageHeader";

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
import MenuConfirmDialog from "./components/common/MenuConfirmDialog";
import MenuToast from "./components/common/MenuToast";

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


const getMenuEmptyState = ({
  restaurantId,
  selectedTimeSlot,
  items,
  displayItems,
  inventoryFilter,
  hasActiveMenuFilters,
  canCreateMenuItem,
  canCreateMenu,
  hasMenuForSelectedSlot,
  hasAnyMenu,
}) => {
  if (!restaurantId) {
    return {
      icon: "🏪",
      title: "Chọn nhà hàng để quản lý thực đơn",
      description: "Vui lòng chọn một nhà hàng trước khi xem hoặc chỉnh sửa món.",
      action: null,
    };
  }

  if (!hasAnyMenu) {
    return {
      icon: "🕒",
      title: "Chưa có menu cho nhà hàng này",
      description: "Tạo menu đầu tiên trước khi thêm món vào thực đơn.",
      action: canCreateMenu ? "create_menu" : null,
    };
  }

  if (selectedTimeSlot && !hasMenuForSelectedSlot) {
    return {
      icon: "🕒",
      title: "Chưa có menu cho khung giờ này",
      description: "Tạo menu hoặc chọn khung giờ khác để bắt đầu quản lý món.",
      action: canCreateMenu ? "create_menu" : null,
    };
  }

  const hasDisplayItems = (displayItems || []).length > 0;
  const hasItems = (items || []).length > 0;

  if (!hasDisplayItems && hasActiveMenuFilters) {
    const inventoryFilterMap = {
      out_of_stock: {
        title: "Không có món hết hàng",
        description: "Tất cả món đang đủ điều kiện bán hoặc không thuộc bộ lọc hiện tại.",
      },
      low_stock: {
        title: "Không có món sắp hết nguyên liệu",
        description: "Chưa phát hiện món nào có cảnh báo tồn kho thấp.",
      },
      not_tracked: {
        title: "Không có món thiếu recipe tracking",
        description: "Tất cả món trong phạm vi hiện tại đã có recipe hoặc không cần tracking.",
      },
      unavailable: {
        title: "Không có món tạm dừng",
        description: "Không có món nào ở trạng thái tạm dừng trong phạm vi hiện tại.",
      },
      hidden: {
        title: "Không có món đang ẩn",
        description: "Không có món nào đang bị ẩn theo bộ lọc hiện tại.",
      },
    };

    const inventoryState = inventoryFilterMap[inventoryFilter];
    if (inventoryState) {
      return {
        icon: "📦",
        ...inventoryState,
        action: "clear_filters",
      };
    }

    return {
      icon: "🔎",
      title: "Không tìm thấy món phù hợp",
      description: "Thử đổi từ khóa tìm kiếm hoặc xóa bớt bộ lọc.",
      action: "clear_filters",
    };
  }

  if (!hasActiveMenuFilters && !hasItems) {
    return {
      icon: "🍽️",
      title: "Chưa có món ăn nào",
      description: "Thêm món đầu tiên để bắt đầu xây dựng thực đơn cho khung giờ này.",
      action: canCreateMenuItem ? "add_item" : null,
    };
  }

  return null;
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
  const [inventorySyncPreview, setInventorySyncPreview] = useState(null);
  const [isSyncingInventory, setIsSyncingInventory] = useState(false);
  const [pendingSyncPayload, setPendingSyncPayload] = useState(null);
  const [menuToasts, setMenuToasts] = useState([]);

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
  const [updatingStatusItemIds, setUpdatingStatusItemIds] = useState(() => new Set());
  const [selectedItemIds, setSelectedItemIds] = useState(() => new Set());
  const [isBulkUpdatingStatus, setIsBulkUpdatingStatus] = useState(false);
  const [pendingBulkStatusAction, setPendingBulkStatusAction] = useState(null);
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
    copyMenu,
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
    toggleMenuItemStatus,
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

    const isCopySubmission = form?.__mode === "copy" || form?.isCopyDraft;

    if (isCopySubmission) {
      if (!currentRestaurant) {
        setMenuSubmitError("Vui lòng chọn nhà hàng trước khi sao chép thực đơn.");
        return;
      }
      if (!form?.sourceMenuId) {
        setMenuSubmitError("Không tìm thấy menu nguồn để sao chép.");
        return;
      }
      if (!form?.timeSlot) {
        setMenuSubmitError("Vui lòng chọn khung giờ đích để sao chép thực đơn.");
        return;
      }

      const hasMenuInTargetSlot = (menus || []).some(
        (menu) => menu?.timeSlot === form.timeSlot,
      );
      if (hasMenuInTargetSlot) {
        setMenuSubmitError(
          "Khung giờ này đã có thực đơn. Vui lòng chọn khung giờ còn trống để sao chép.",
        );
        return;
      }

      setIsSavingMenu(true);
      try {
        const copied = await copyMenu({
          sourceMenuId: form.sourceMenuId,
          targetTimeSlot: form.timeSlot,
          name: form.name,
          description: form.description || null,
          coverImage: form.coverImage || null,
          categoryMenuId: form.categoryMenuId || null,
          isActive: form.isActive || false,
          copyItems: true,
          copyRecipes: true,
        });

        await refetchMenus?.();
        setSelectedTimeSlot(copied?.timeSlot || form.timeSlot);
        toggleModal("menu", false);
        pushMenuToast("Đã sao chép thực đơn kèm món và recipe.", "success");
      } catch (err) {
        setMenuSubmitError(
          getGraphQLErrorMessage(err, "Không thể sao chép thực đơn. Vui lòng thử lại."),
        );
      } finally {
        setIsSavingMenu(false);
      }
      return;
    }

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


  const markItemStatusUpdating = useCallback((itemId, isUpdating) => {
    const key = String(itemId || "");
    if (!key) return;
    setUpdatingStatusItemIds((prev) => {
      const next = new Set(prev);
      if (isUpdating) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const handleChangeItemStatus = useCallback(
    async (item, status) => {
      const itemId = String(item?.id || "");
      if (!itemId || !status) return;
      if (!canUpdateMenuItem) return;
      if (updatingStatusItemIds.has(itemId)) return;

      markItemStatusUpdating(itemId, true);
      try {
        await toggleMenuItemStatus({ id: itemId, status });
        await refetchItems?.();
        pushMenuToast("Cập nhật trạng thái món thành công.", "success");
      } catch (error) {
        pushMenuToast(
          getGraphQLErrorMessage(error, "Không thể cập nhật trạng thái món."),
          "error",
        );
      } finally {
        markItemStatusUpdating(itemId, false);
      }
    },
    [
      updatingStatusItemIds,
      markItemStatusUpdating,
      canUpdateMenuItem,
      pushMenuToast,
      refetchItems,
      toggleMenuItemStatus,
    ],
  );

  const handleSelectToggle = useCallback((item, checked) => {
    const itemId = String(item?.id || "");
    if (!itemId) return;
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  const handleClearSelected = useCallback(() => {
    setSelectedItemIds(new Set());
  }, []);

  const runBulkUpdateStatus = useCallback(
    async (status, ids = []) => {
      if (!canUpdateMenuItem || !status || isBulkUpdatingStatus) return;
      if (!ids.length) return;

      setIsBulkUpdatingStatus(true);
      let successCount = 0;
      let failCount = 0;

      for (const itemId of ids) {
        try {
          await toggleMenuItemStatus({ id: itemId, status });
          successCount += 1;
        } catch {
          failCount += 1;
        }
      }

      try { await refetchItems?.(); } catch (error) { pushMenuToast(getGraphQLErrorMessage(error, "Không thể tải lại danh sách món."), "error"); }

      if (successCount > 0 && failCount === 0) pushMenuToast(`Đã cập nhật ${successCount} món.`, "success");
      else if (successCount > 0 && failCount > 0) pushMenuToast(`Đã cập nhật ${successCount} món, ${failCount} món lỗi.`, "warning");
      else pushMenuToast("Không thể cập nhật trạng thái món đã chọn.", "error");

      if (successCount > 0) setSelectedItemIds(new Set());
      setPendingBulkStatusAction(null);
      setIsBulkUpdatingStatus(false);
    },
    [canUpdateMenuItem, isBulkUpdatingStatus, pushMenuToast, refetchItems, toggleMenuItemStatus],
  );

  const handleBulkUpdateStatus = useCallback((status) => {
    if (!canUpdateMenuItem || !status || isBulkUpdatingStatus) return;
    const ids = Array.from(selectedItemIds);
    if (!ids.length) return;

    if (status === "hidden") {
      setPendingBulkStatusAction({ status, ids, title: "Ẩn nhiều món?", message: "Các món đã chọn sẽ không hiển thị trên menu bán hàng. Bạn vẫn có thể bật lại sau.", confirmText: "Ẩn món đã chọn", tone: "danger" });
      return;
    }
    if (status === "out_of_stock") {
      setPendingBulkStatusAction({ status, ids, title: "Đánh dấu hết hàng?", message: "Các món đã chọn sẽ tạm thời không bán được cho khách.", confirmText: "Đánh dấu hết hàng", tone: "warning" });
      return;
    }
    runBulkUpdateStatus(status, ids);
  }, [canUpdateMenuItem, isBulkUpdatingStatus, selectedItemIds, runBulkUpdateStatus]);

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


  useEffect(() => {
    if (isBulkUpdatingStatus) return;
    setSelectedItemIds(new Set());
  }, [currentRestaurant, isBulkUpdatingStatus, selectedTimeSlot]);

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
          return item.inventoryStatus === MENU_ITEM_INVENTORY_STATUS.NOT_TRACKED || warnings.some((w) => /tracking recipe|chưa tracking|recipe/i.test(String(w)));
        }
        return true;
      });
    },
    [items, categories, inventoryFilter],
  );

  const hasAnyMenu = (menus || []).length > 0;

  const hasMenuForSelectedSlot = useMemo(
    () => (menus || []).some((menu) => menu?.timeSlot === selectedTimeSlot),
    [menus, selectedTimeSlot],
  );

  const hasActiveMenuFilters = Boolean(
    search?.trim() ||
      categoryId ||
      statusFilter ||
      inventoryFilter !== "all" ||
      priceRange?.minPrice ||
      priceRange?.maxPrice,
  );

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setCategoryId(null);
    setStatusFilter(null);
    setInventoryFilter("all");
    setPriceRange({ minPrice: null, maxPrice: null });
  }, [setCategoryId, setPriceRange, setSearch, setStatusFilter]);

  const handleOpenRecipeIssue = useCallback((item) => {
    toggleModal("menuItem", true, item?.id);
    pushMenuToast("Mở món để cập nhật recipe và tồn kho.", "info");
  }, [pushMenuToast]);

  const emptyState = useMemo(
    () =>
      getMenuEmptyState({
        restaurantId: currentRestaurant,
        selectedTimeSlot,
        items,
        displayItems,
        inventoryFilter,
        hasActiveMenuFilters,
        canCreateMenuItem,
        canCreateMenu,
        hasMenuForSelectedSlot,
        hasAnyMenu,
      }),
    [
      canCreateMenu,
      canCreateMenuItem,
      currentRestaurant,
      displayItems,
      hasActiveMenuFilters,
      hasAnyMenu,
      hasMenuForSelectedSlot,
      inventoryFilter,
      items,
      selectedTimeSlot,
    ],
  );

  const visibleItemIds = useMemo(
    () => new Set((displayItems || []).map((item) => String(item.id))),
    [displayItems],
  );

  useEffect(() => {
    if (isBulkUpdatingStatus) return;
    setSelectedItemIds((prev) => {
      if (!prev.size) return prev;
      const next = new Set(
        Array.from(prev).filter((id) => visibleItemIds.has(String(id))),
      );
      return next.size === prev.size ? prev : next;
    });
  }, [isBulkUpdatingStatus, visibleItemIds]);

  const inventoryFilterCounts = useMemo(() => {
    const sourceItems = Array.isArray(items) ? items : [];
    return sourceItems.reduce(
      (acc, item) => {
        const warnings = Array.isArray(item?.stockWarnings) ? item.stockWarnings : [];

        acc.all += 1;
        if (item?.inventoryStatus === MENU_ITEM_INVENTORY_STATUS.LOW_STOCK) acc.low_stock += 1;
        if (item?.inventoryStatus === MENU_ITEM_INVENTORY_STATUS.OUT_OF_STOCK) acc.out_of_stock += 1;
        if (item?.inventoryStatus === MENU_ITEM_INVENTORY_STATUS.ERROR) acc.needs_check += 1;
        if (item?.inventoryStatus === MENU_ITEM_INVENTORY_STATUS.NOT_TRACKED || warnings.some((w) => /tracking recipe|chưa tracking|recipe/i.test(String(w)))) acc.not_tracked += 1;
        return acc;
      },
      { all: 0, low_stock: 0, out_of_stock: 0, needs_check: 0, not_tracked: 0 },
    );
  }, [items]);
  const pushMenuToast = useCallback((message, type = "info") => {
    setMenuToasts((prev) => [...prev, { id: `${Date.now()}_${Math.random()}`, message, type }]);
  }, []);

  const handleSyncInventory = useCallback(
    async ({ restaurantId, timeSlot }) => {
      const dryRunResult = await syncMenuItemInventoryStatuses({
        restaurantId,
        timeSlot,
        recoverOutOfStock: true,
        dryRun: true,
      });

      if (!dryRunResult?.updatedCount) {
        pushMenuToast("Không có món nào cần cập nhật.", "info");
        return dryRunResult;
      }
      setPendingSyncPayload({ restaurantId, timeSlot });
      setInventorySyncPreview(dryRunResult);
      return null;
    },
    [pushMenuToast, syncMenuItemInventoryStatuses],
  );
  const handleConfirmInventorySync = useCallback(async () => {
    if (!inventorySyncPreview || !pendingSyncPayload) return;
    setIsSyncingInventory(true);
    try {
      const result = await syncMenuItemInventoryStatuses({
        restaurantId: pendingSyncPayload.restaurantId,
        timeSlot: pendingSyncPayload.timeSlot,
        recoverOutOfStock: true,
        dryRun: false,
      });
      setInventorySyncPreview(null);
      setPendingSyncPayload(null);
      pushMenuToast(`Đã cập nhật ${result?.updatedCount || 0} món.`, "success");
      await refetchItems?.();
      await refetchMenus?.();
    } catch (error) {
      pushMenuToast(getGraphQLErrorMessage(error, "Không thể đồng bộ tồn kho."), "error");
    } finally {
      setIsSyncingInventory(false);
    }
  }, [inventorySyncPreview, pendingSyncPayload, pushMenuToast, refetchItems, refetchMenus, syncMenuItemInventoryStatuses]);
  const handleCancelInventorySyncPreview = useCallback(() => {
    if (isSyncingInventory) return;
    setInventorySyncPreview(null);
    setPendingSyncPayload(null);
  }, [isSyncingInventory]);

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
      <ManagementPageHeader
        eyebrow="MENU MANAGER"
        title="Quản lý Thực Đơn"
        subtitle="Thiết lập món ăn, danh mục món và nhóm thực đơn"
        icon="📋"
        selectedRestaurant={currentRestaurant || ""}
        onRestaurantChange={setCurrentRestaurant}
        restaurantList={managerRestaurants}
        customFilters={(
          <select
            className="mph-select"
            value={selectedTimeSlot || "breakfast"}
            onChange={(e) => setSelectedTimeSlot(e.target.value)}
          >
            {Object.entries(TIME_SLOT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
        quickActions={[
          ...(canManageDishCategory ? [{ icon: "🏷️", label: "Danh mục món", onClick: () => toggleModal("dishCategory", true) }] : []),
          ...(canManageMenuGroup ? [{ icon: "📁", label: "Nhóm thực đơn", onClick: () => toggleModal("menuGroup", true) }] : []),
        ]}
        primaryAction={canCreateMenuItem ? { icon: "➕", label: "Thêm món", onClick: () => toggleModal("menuItem", true) } : null}
      />

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
          selectedTimeSlot={selectedTimeSlot}
          onTimeSlotChange={setSelectedTimeSlot}
          activeMenuId={menus.find((m) => m.timeSlot === selectedTimeSlot)?.id}
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
          inventoryFilter={inventoryFilter}
          onInventoryFilterChange={setInventoryFilter}
          inventoryFilterCounts={inventoryFilterCounts}
        />

        <div className="mm-body__content">
          {deleteListRefreshError && (
            <div role="alert" className="mm-inline-alert">
              <FiAlertCircle size={18} className="mm-inline-alert__icon" />
              <p className="mm-inline-alert__text">{deleteListRefreshError}</p>
            </div>
          )}

          {itemsError && (
            <div className="mm-state-box error">
              <FiAlertCircle size={32} />
              <p className="mm-state-box__message">
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

          {!itemsLoading && displayItems.length === 0 && !itemsError && emptyState && (
            <div className="mm-empty-state">
              <div className="mm-empty-state__icon">{emptyState.icon}</div>
              <h3 className="mm-empty-state__title">{emptyState.title}</h3>
              <p className="mm-empty-state__description">{emptyState.description}</p>
              <div className="mm-empty-state__actions">
                {emptyState.action === "create_menu" && canCreateMenu && (
                  <button className="mm-btn mm-btn--primary" onClick={() => toggleModal("menu", true)}>
                    Tạo menu
                  </button>
                )}
                {emptyState.action === "add_item" && canCreateMenuItem && (
                  <button className="mm-btn mm-btn--primary" onClick={() => toggleModal("menuItem", true)}>
                    Thêm món mới
                  </button>
                )}
                {emptyState.action === "clear_filters" && (
                  <button className="mm-btn mm-btn--secondary" onClick={handleClearFilters}>
                    Xóa lọc
                  </button>
                )}
              </div>
            </div>
          )}

          {displayItems.length > 0 && (
            <>
              {canUpdateMenuItem && selectedItemIds.size > 0 && (
                <div className="mm-bulk-status-bar">
                  <span>Đã chọn {selectedItemIds.size} món</span>
                  <button type="button" className="mm-btn mm-btn--secondary" onClick={handleClearSelected} disabled={isBulkUpdatingStatus}>Bỏ chọn</button>
                  <button type="button" className="mm-btn mm-btn--secondary" onClick={() => handleBulkUpdateStatus("available")} disabled={isBulkUpdatingStatus}>Sẵn sàng</button>
                  <button type="button" className="mm-btn mm-btn--secondary" onClick={() => handleBulkUpdateStatus("unavailable")} disabled={isBulkUpdatingStatus}>Tạm dừng</button>
                  <button type="button" className="mm-btn mm-btn--secondary" onClick={() => handleBulkUpdateStatus("out_of_stock")} disabled={isBulkUpdatingStatus}>Hết hàng</button>
                  <button type="button" className="mm-btn mm-btn--secondary" onClick={() => handleBulkUpdateStatus("hidden")} disabled={isBulkUpdatingStatus}>Ẩn</button>
                </div>
              )}
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
                    onStatusChange={
                      canUpdateMenuItem && !isBulkUpdatingStatus
                        ? handleChangeItemStatus
                        : undefined
                    }
                    updatingStatus={
                      isBulkUpdatingStatus ||
                      updatingStatusItemIds.has(String(item.id))
                    }
                    selected={selectedItemIds.has(String(item.id))}
                    onSelectToggle={canUpdateMenuItem ? handleSelectToggle : undefined}
                    onOpenRecipeIssue={canUpdateMenuItem ? handleOpenRecipeIssue : undefined}
                    onOpenInventoryIssue={canUpdateMenuItem ? handleOpenRecipeIssue : undefined}
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
          <div className="mm-delete-confirm-body">
            <p className="mm-delete-confirm-body__headline">
              Bạn có chắc chắn muốn xóa món
              <strong className="mm-delete-confirm-body__item-name">
                {` ${deletingItem?.name || "này"}`}
              </strong>
              ?
            </p>
            <p className="mm-delete-confirm-body__note">
              Món sẽ bị gỡ khỏi danh sách hiện tại sau khi bạn xác nhận.
            </p>

            {deleteError && (
              <div role="alert" className="mm-inline-alert mm-inline-alert--tight">
                <FiAlertCircle size={18} className="mm-inline-alert__icon" />
                <p className="mm-inline-alert__text">{deleteError}</p>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer className="mm-delete-confirm-actions">
          <button
            type="button"
            onClick={handleCloseDeleteModal}
            disabled={isDeletingItem}
            className="mm-modal-btn mm-modal-btn--secondary"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirmDeleteItem}
            disabled={isDeletingItem}
            className="mm-modal-btn mm-modal-btn--danger"
          >
            <FiTrash2 size={16} />
            <span>{isDeletingItem ? "Đang xóa..." : "Xóa"}</span>
          </button>
        </Modal.Footer>
      </Modal>
      <MenuConfirmDialog
        isOpen={!!inventorySyncPreview}
        onCancel={handleCancelInventorySyncPreview}
        onConfirm={handleConfirmInventorySync}
        isLoading={isSyncingInventory}
        tone="warning"
        title="Xác nhận đồng bộ tồn kho"
        message="Hệ thống đã chạy kiểm tra trước. Bạn muốn áp dụng cập nhật trạng thái tồn kho ngay bây giờ?"
        confirmText="Xác nhận đồng bộ"
        cancelText="Hủy"
      >
        <div className="mm-sync-preview">
          <div>Đã kiểm tra: <strong>{inventorySyncPreview?.checkedCount || 0}</strong></div>
          <div>Sẽ cập nhật: <strong>{inventorySyncPreview?.updatedCount || 0}</strong></div>
          <div>available → out_of_stock: <strong>{inventorySyncPreview?.toOutOfStockCount || 0}</strong></div>
          <div>out_of_stock → available: <strong>{inventorySyncPreview?.toAvailableCount || 0}</strong></div>
          {!!inventorySyncPreview?.warnings?.length && <div>Cảnh báo: <strong>{inventorySyncPreview.warnings.length}</strong></div>}
          {!!inventorySyncPreview?.warnings?.length && (
            <ul className="mm-sync-preview__warnings">
              {inventorySyncPreview.warnings.slice(0, 4).map((warning, idx) => <li key={`${idx}_${warning}`}>{warning}</li>)}
            </ul>
          )}
        </div>
      </MenuConfirmDialog>
      <MenuConfirmDialog
        isOpen={!!pendingBulkStatusAction}
        onCancel={() => (!isBulkUpdatingStatus ? setPendingBulkStatusAction(null) : null)}
        onConfirm={() => runBulkUpdateStatus(pendingBulkStatusAction?.status, pendingBulkStatusAction?.ids || [])}
        isLoading={isBulkUpdatingStatus}
        tone={pendingBulkStatusAction?.tone || "warning"}
        title={pendingBulkStatusAction?.title || "Xác nhận cập nhật"}
        message={pendingBulkStatusAction?.message || ""}
        confirmText={pendingBulkStatusAction?.confirmText || "Xác nhận"}
        cancelText="Hủy"
      />
      <MenuToast toasts={menuToasts} onDismiss={(id) => setMenuToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </div>
  );
};

export default MenuManagement;
