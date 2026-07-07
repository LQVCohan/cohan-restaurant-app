import React, { useEffect, useMemo, useState } from "react";
import { Select as SearchSelect } from "antd";
import {
  Bookmark,
  ChefHat,
  ChevronDown,
  ClipboardList,
  Clock3,
  Eraser,
  Image as ImageIcon,
  Layers,
  Loader,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

import Modal from "../../../../components/common/Modal";
import useOrderManagement from "../../../../hooks/useOrderManagement";
import useFloorManagement from "../../../../hooks/useFloorManagement";
import useTableManagement from "../../../../hooks/useTableManagement";
import useMenuManagement from "../../../../hooks/useMenuManagement";
import { useCategoryManagement } from "../../../../hooks/useCategoryManagement";
import { useNotification } from "@/hooks/useNotification";
import useModalDraft from "../../../../hooks/useModalDraft";

import "./NewOrderModal.scss";
import "./NewOrderModalPolish.scss";
import "./NewOrderSearchSelect.scss";

const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value || 0));

const MENU_SKELETON_COUNT = 8;
const ALL_CATEGORY_ID = "__all__";
const OTHER_CATEGORY_ID = "__other__";

const normalizeSearchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const filterSearchOption = (input, option) =>
  normalizeSearchText(option?.label).includes(normalizeSearchText(input));

export const buildNewOrderCategoryOptions = (
  categories = [],
  items = [],
) => {
  const categoriesById = new Map();

  (Array.isArray(categories) ? categories : []).forEach((category) => {
    const id = String(category?.id || "").trim();
    if (!id || category?.isActive === false || categoriesById.has(id)) return;
    categoriesById.set(id, String(category?.name || "Danh mục khác").trim());
  });

  const knownCategoryIds = new Set(categoriesById.keys());
  const unknownCategoryIds = new Set();
  let includeUncategorized = false;

  (Array.isArray(items) ? items : []).forEach((item) => {
    const categoryId = String(item?.categoryId || "").trim();
    if (!categoryId) {
      includeUncategorized = true;
      return;
    }
    if (!knownCategoryIds.has(categoryId)) unknownCategoryIds.add(categoryId);
  });

  const categoryOptions = Array.from(categoriesById.entries())
    .map(([id, name]) => ({ id, name, categoryIds: [id] }))
    .sort((left, right) => left.name.localeCompare(right.name, "vi"));

  if (unknownCategoryIds.size || includeUncategorized) {
    const existingOther = categoryOptions.find(
      (category) => normalizeSearchText(category.name) === "khac",
    );

    if (existingOther) {
      existingOther.categoryIds.push(...unknownCategoryIds);
      existingOther.includeUncategorized = includeUncategorized;
    } else {
      categoryOptions.push({
        id: OTHER_CATEGORY_ID,
        name: "Khác",
        categoryIds: [...unknownCategoryIds],
        includeUncategorized,
      });
    }
  }

  return [
    { id: ALL_CATEGORY_ID, name: "Tất cả danh mục", categoryIds: [] },
    ...categoryOptions,
  ];
};

const MenuSkeleton = () => (
  <div className="menu-skeleton-grid" aria-label="Đang tải thực đơn">
    {Array.from({ length: MENU_SKELETON_COUNT }).map((_, index) => (
      <article className="menu-skeleton-card" key={`menu-skeleton-${index}`}>
        <span className="menu-skeleton-card__image" />
        <span className="menu-skeleton-card__title" />
        <span className="menu-skeleton-card__meta" />
        <span className="menu-skeleton-card__price" />
      </article>
    ))}
  </div>
);

const DishCard = ({ dish, onAdd }) => {
  const [showMethods, setShowMethods] = useState(false);
  const preparationMethods = Array.isArray(dish?.preparationMethods)
    ? dish.preparationMethods
    : [];
  const hasMethods = preparationMethods.length > 0;
  const imageUrl = dish?.imageUrl || null;

  const handleAdd = (prepMethod = null) => {
    const price =
      Number(dish?.basePrice || 0) > 0
        ? Number(dish.basePrice)
        : Number(prepMethod?.price || dish?._displayPrice || 0);

    onAdd({
      menuItem: dish,
      quantity: 1,
      cookingOption: prepMethod?.name || "",
      price,
    });
    setShowMethods(false);
  };

  const handleAddDefault = () => {
    if (hasMethods) {
      setShowMethods(true);
      return;
    }
    handleAdd(dish?._defaultPreparation || null);
  };

  return (
    <article
      className={`dish-card ${showMethods ? "dish-card--methods-open" : ""}`}
    >
      <div
        className="dish-card__click"
        onClick={handleAddDefault}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleAddDefault();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Thêm ${dish?.name || "món"} vào đơn`}
      >
        <div className="dish-card__thumb">
          {imageUrl ? (
            <img src={imageUrl} alt={dish?.name || "Món ăn"} loading="lazy" />
          ) : (
            <div className="dish-card__thumb--placeholder" aria-hidden="true">
              <ImageIcon size={24} />
            </div>
          )}
        </div>

        <div className="dish-card__info">
          <h4 className="dish-card__name" title={dish?.name || ""}>
            {dish?.name || "Món chưa có tên"}
          </h4>

          <div className="dish-card__meta-row">
            {hasMethods ? (
              <span className="badge badge--info">
                {preparationMethods.length} lựa chọn
              </span>
            ) : null}
            {Number(dish?.basePrice || 0) === 0 ? (
              <span className="badge badge--warning">Giá theo cách chế biến</span>
            ) : null}
          </div>

          <p className="dish-card__price">
            {formatCurrency(dish?._displayPrice)}
          </p>
        </div>
      </div>

      <button
        type="button"
        className="dish-card__add"
        title="Thêm nhanh"
        aria-label={`Thêm ${dish?.name || "món"}`}
        onClick={(event) => {
          event.stopPropagation();
          handleAddDefault();
        }}
      >
        <Plus size={18} />
      </button>

      {showMethods ? (
        <div
          className="dish-card__methods-pop"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="dish-card__methods-title">
            <span>Chọn cách chế biến</span>
            <button
              type="button"
              onClick={() => setShowMethods(false)}
              className="dish-card__methods-close"
              aria-label="Đóng danh sách cách chế biến"
            >
              <X size={16} />
            </button>
          </div>

          <div className="dish-card__methods-list">
            {preparationMethods.map((method, index) => (
              <button
                type="button"
                key={method?.name || index}
                onClick={() => handleAdd(method)}
                className="dish-card__method-btn"
              >
                <span>{method?.name || "Mặc định"}</span>
                {Number(dish?.basePrice || 0) === 0 ? (
                  <b>{formatCurrency(method?.price)}</b>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
};

const NewOrderModal = ({ isOpen, onClose, restaurantId, onSuccess }) => {
  const notificationApi = useNotification();
  const showNotification =
    notificationApi?.showNotification || (() => undefined);

  const [currentTable, setCurrentTable] = useState(null);
  const [currentOrder, setCurrentOrder] = useState([]);
  const [tableOrders, setTableOrders] = useState({});
  const [showCart, setShowCart] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const posContext = useMemo(
    () => ({
      currentOrder,
      setCurrentOrder,
      currentTable,
      tableOrders,
      setTableOrders,
    }),
    [currentOrder, currentTable, tableOrders],
  );

  const { addToOrder, updateItemQty, removeItem, saveOrder, totals } =
    useOrderManagement(posContext);

  const {
    floors,
    activeLevel,
    setActiveLevel,
  } = useFloorManagement({ restaurantId });
  const { tables, tablesLoading } = useTableManagement({ restaurantId });
  const {
    menus,
    itemsWithPrice,
    itemsLoading,
    selectedTimeSlot,
    setSelectedTimeSlot,
  } = useMenuManagement({ restaurantId });
  const { categories } = useCategoryManagement({
    restaurantId,
    timeSlot: selectedTimeSlot,
    loadTopCategories: false,
    loadCategoryMenus: false,
  });

  const hasDirtyForm =
    Boolean(currentTable) ||
    currentOrder.length > 0 ||
    Boolean(query.trim()) ||
    Boolean(selectedCategoryId);

  const closeModalNow = () => {
    setCurrentTable(null);
    setCurrentOrder([]);
    setShowCart(false);
    setQuery("");
    setSelectedCategoryId("");
    onClose?.();
  };

  const { requestCloseWithDraft, clearDraft } = useModalDraft({
    enabled: isOpen,
    draftIdentity: {
      module: "order",
      modal: "new-order-modal",
      route:
        typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: "create",
      entityType: "order",
      recordId: null,
      context: String(restaurantId || "default"),
      schemaVersion: "1",
    },
    formValue: () => ({
      currentTableCode: currentTable?.code || "",
      currentOrder,
      query,
      selectedCategoryId,
      selectedTimeSlot,
      activeLevel,
    }),
    isDirty: hasDirtyForm,
    sanitize: (value) => ({
      currentTableCode: value?.currentTableCode || "",
      currentOrder: Array.isArray(value?.currentOrder)
        ? value.currentOrder.map((row) => ({
            menuItemId: row?.menuItem?.id || row?.menuItemId || "",
            menuItemName: row?.menuItem?.name || row?.name || "",
            name: row?.name || row?.menuItem?.name || "",
            quantity: Number(row?.quantity || 0),
            cookingOption: row?.cookingOption || row?.method || "",
            method: row?.method || row?.cookingOption || "",
            price: Number(row?.price || 0),
            note: row?.note || "",
            _lineId: row?._lineId || undefined,
          }))
        : [],
      query: value?.query || "",
      selectedCategoryId: value?.selectedCategoryId || "",
      selectedTimeSlot: value?.selectedTimeSlot || "",
      activeLevel: value?.activeLevel ?? null,
    }),
    onRestore: (draft) => {
      const restoredTable = (tables || []).find(
        (table) => table.code === draft?.currentTableCode,
      );
      setCurrentTable(restoredTable || null);
      setCurrentOrder(
        Array.isArray(draft?.currentOrder) ? draft.currentOrder : [],
      );
      setQuery(draft?.query || "");
      setSelectedCategoryId(draft?.selectedCategoryId || "");
      if (draft?.selectedTimeSlot) {
        setSelectedTimeSlot(draft.selectedTimeSlot);
      }
      if (draft?.activeLevel !== undefined) {
        setActiveLevel(draft.activeLevel);
      }
    },
    notify: showNotification,
  });

  const availableTables = useMemo(
    () =>
      (tables || [])
        .filter(
          (table) =>
            table?.status === "available" &&
            (activeLevel === null || table?.floorLevel === activeLevel),
        )
        .sort(
          (left, right) =>
            Number(left?.floorLevel || 0) - Number(right?.floorLevel || 0) ||
            String(left?.code || "").localeCompare(
              String(right?.code || ""),
              "vi",
              { numeric: true },
            ),
        ),
    [tables, activeLevel],
  );

  const tableSelectOptions = useMemo(
    () =>
      availableTables.map((table) => ({
        value: table.code,
        label: `${table.code}${
          table.floorLevel != null ? ` (Tầng ${table.floorLevel})` : ""
        }`,
      })),
    [availableTables],
  );

  const sessions = useMemo(() => {
    const availableSet = new Set((menus || []).map((menu) => menu?.timeSlot));
    const labels = {
      breakfast: "Sáng",
      lunch: "Trưa",
      dinner: "Tối",
      late_night: "Đêm",
    };

    return ["breakfast", "lunch", "dinner", "late_night"]
      .filter((slot) => availableSet.has(slot))
      .map((slot) => ({ value: slot, label: labels[slot] || slot }));
  }, [menus]);

  useEffect(() => {
    if (!selectedTimeSlot && sessions.length > 0) {
      setSelectedTimeSlot(sessions[0].value);
    }
  }, [sessions, selectedTimeSlot, setSelectedTimeSlot]);

  const categoryOptions = useMemo(
    () => buildNewOrderCategoryOptions(categories, itemsWithPrice),
    [categories, itemsWithPrice],
  );

  const categorySelectOptions = useMemo(
    () =>
      categoryOptions.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categoryOptions],
  );

  const selectedCategoryOption = categoryOptions.find(
    (category) => category.id === selectedCategoryId,
  );

  const categoryNameById = useMemo(() => {
    const names = new Map();
    categoryOptions.forEach((category) => {
      category.categoryIds.forEach((categoryId) => {
        names.set(categoryId, category.name);
      });
    });
    return names;
  }, [categoryOptions]);

  const filteredDishes = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    return (itemsWithPrice || []).filter((dish) => {
      const dishCategoryId = String(dish?.categoryId || "").trim();

      if (selectedCategoryId) {
        const matchesCategory =
          selectedCategoryOption?.categoryIds.includes(dishCategoryId) ||
          (selectedCategoryOption?.includeUncategorized && !dishCategoryId);
        if (!matchesCategory) return false;
      }

      if (!normalizedQuery) return true;
      return normalizeSearchText(
        [
          dish?.name,
          dish?.searchKeywords,
          categoryNameById.get(dishCategoryId),
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(normalizedQuery);
    });
  }, [
    categoryNameById,
    itemsWithPrice,
    query,
    selectedCategoryId,
    selectedCategoryOption,
  ]);

  const selectedSessionLabel =
    sessions.find((session) => session.value === selectedTimeSlot)?.label ||
    "ca hiện tại";
  const selectedFloorLabel =
    activeLevel === null
      ? "Tất cả tầng"
      : (floors || []).find((floor) => Number(floor?.level) === Number(activeLevel))
          ?.name || `Tầng ${activeLevel}`;
  const activeCategoryLabel =
    selectedCategoryOption?.name || "Tất cả danh mục";
  const cartQuantity = currentOrder.reduce(
    (sum, item) => sum + Number(item?.quantity || 0),
    0,
  );
  const hasActiveFilters = Boolean(query.trim()) || Boolean(selectedCategoryId);

  const resetFilters = () => {
    setQuery("");
    setSelectedCategoryId("");
  };

  const handleTableChange = (tableCode) => {
    setCurrentTable(
      (tables || []).find((table) => table.code === tableCode) || null,
    );
  };

  const handleCategoryChange = (categoryId) => {
    setSelectedCategoryId(categoryId === ALL_CATEGORY_ID ? "" : categoryId);
  };

  const handleSaveOrder = async () => {
    if (!currentTable) {
      showNotification("Vui lòng chọn bàn.", "error");
      return;
    }
    if (!currentOrder.length) {
      showNotification("Chọn ít nhất 1 món.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveOrder({ persist: true, restaurantId });
      if (result?.success) {
        showNotification("Tạo đơn hàng thành công.", "success");
        clearDraft();
        await onSuccess?.();
        closeModalNow();
        return;
      }
      showNotification(result?.message || "Không thể tạo đơn hàng.", "error");
    } catch (error) {
      showNotification(
        error?.message || "Không thể tạo đơn hàng. Vui lòng thử lại.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = !isSaving && Boolean(currentTable) && currentOrder.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => requestCloseWithDraft(closeModalNow)}
      title="Tạo đơn hàng mới"
      size="xl"
      className="new-order-modal-shell"
    >
      <div className="new-order-modal">
        <div className="new-order-modal-layout">
          <section className="new-order-modal__menu-col">
            <div className="new-order-modal__controls">
              <div className="new-order-modal__header">
                <div className="new-order-modal__headline">
                  <span className="new-order-modal__eyebrow">
                    <ReceiptText size={14} /> Gọi món tại bàn
                  </span>
                  <h3>Tạo đơn nhanh, kiểm soát món rõ ràng</h3>
                  <p>
                    Chọn tầng, bàn và ca phục vụ. Mỗi món được thêm vào giỏ để
                    kiểm tra lại số lượng trước khi lưu đơn.
                  </p>
                </div>

                <div className="new-order-modal__summary-strip" aria-live="polite">
                  <div className="summary-pill">
                    <span>Bàn</span>
                    <b>{currentTable?.code || "Chưa chọn"}</b>
                  </div>
                  <div className="summary-pill">
                    <span>Món</span>
                    <b>{cartQuantity}</b>
                  </div>
                  <div className="summary-pill summary-pill--total">
                    <span>Tạm tính</span>
                    <b>{formatCurrency(totals.subtotal)}</b>
                  </div>
                </div>
              </div>

              <div className="controls__row controls__row--top">
                <div className="form-group">
                  <label className="sr-only" htmlFor="new-order-floor">
                    Lọc theo tầng
                  </label>
                  <Layers size={16} className="form-group__icon" />
                  <select
                    id="new-order-floor"
                    value={activeLevel ?? ""}
                    onChange={(event) => {
                      setActiveLevel(
                        event.target.value ? Number(event.target.value) : null,
                      );
                      setCurrentTable(null);
                    }}
                    className="form-group__select"
                  >
                    <option value="">Tất cả tầng</option>
                    {(floors || []).map((floor) => (
                      <option key={floor.id} value={floor.level}>
                        {floor.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="form-group__chevron" />
                </div>

                <div className="form-group form-group--searchable">
                  <label className="sr-only" htmlFor="new-order-table">
                    Tìm và chọn bàn
                  </label>
                  <Bookmark size={16} className="form-group__icon" />
                  <SearchSelect
                    id="new-order-table"
                    className="new-order-search-select"
                    value={currentTable?.code || undefined}
                    onChange={handleTableChange}
                    options={tableSelectOptions}
                    placeholder={tablesLoading ? "Đang tải bàn..." : "Tìm và chọn bàn"}
                    showSearch
                    allowClear
                    optionFilterProp="label"
                    filterOption={filterSearchOption}
                    notFoundContent="Không tìm thấy bàn phù hợp"
                    disabled={tablesLoading}
                    suffixIcon={<ChevronDown size={16} aria-hidden="true" />}
                    popupClassName="new-order-search-select__popup"
                    aria-label="Tìm và chọn bàn"
                  />
                </div>

                <div className="form-group form-group--searchable">
                  <label className="sr-only" htmlFor="new-order-category">
                    Tìm và lọc theo danh mục
                  </label>
                  <ChefHat size={16} className="form-group__icon" />
                  <SearchSelect
                    id="new-order-category"
                    className="new-order-search-select"
                    value={selectedCategoryId || ALL_CATEGORY_ID}
                    onChange={handleCategoryChange}
                    options={categorySelectOptions}
                    showSearch
                    optionFilterProp="label"
                    filterOption={filterSearchOption}
                    notFoundContent="Không tìm thấy danh mục"
                    suffixIcon={<ChevronDown size={16} aria-hidden="true" />}
                    popupClassName="new-order-search-select__popup"
                    aria-label="Tìm và lọc theo danh mục"
                  />
                </div>

                <button
                  type="button"
                  className="cart-toggle"
                  onClick={() => setShowCart(true)}
                  disabled={currentOrder.length === 0}
                >
                  <ShoppingCart size={20} />
                  <span>Xem giỏ</span>
                  {currentOrder.length > 0 ? (
                    <span className="cart-toggle__badge">
                      {currentOrder.length}
                    </span>
                  ) : null}
                </button>
              </div>

              <div className="controls__row controls__row--bottom">
                <div className="searchbox">
                  <Search className="searchbox__icon" size={16} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Tìm món ăn, từ khóa, danh mục..."
                    className="searchbox__input"
                    aria-label="Tìm món ăn"
                  />
                </div>

                <div className="new-order-modal__sessions" aria-label="Ca phục vụ">
                  {sessions.map((session) => (
                    <button
                      type="button"
                      key={session.value}
                      onClick={() => {
                        setSelectedTimeSlot(session.value);
                        setSelectedCategoryId("");
                      }}
                      className={`session-tab ${
                        selectedTimeSlot === session.value
                          ? "session-tab--active"
                          : ""
                      }`}
                    >
                      {session.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="new-order-modal__grid-wrapper">
              <div className="menu-section-meta">
                <div>
                  <span>
                    <Clock3 size={14} /> Thực đơn {selectedSessionLabel}
                  </span>
                  <strong>
                    {itemsLoading
                      ? "Đang tải món"
                      : `${filteredDishes.length} món phù hợp`}
                  </strong>
                </div>

                <div className="menu-section-meta__tags">
                  <span>{selectedFloorLabel}</span>
                  <span>{activeCategoryLabel}</span>
                  {hasActiveFilters ? (
                    <button type="button" onClick={resetFilters}>
                      Xóa lọc
                    </button>
                  ) : null}
                </div>
              </div>

              {itemsLoading ? (
                <MenuSkeleton />
              ) : filteredDishes.length === 0 ? (
                <div className="empty-state empty-state--menu" aria-live="polite">
                  <div className="empty-state__icon">
                    <Search size={22} />
                  </div>
                  <strong>Không có món phù hợp</strong>
                  <span>Thử đổi từ khóa, danh mục hoặc ca phục vụ.</span>
                  {hasActiveFilters ? (
                    <button type="button" onClick={resetFilters}>
                      Xóa bộ lọc
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="menu-grid">
                  {filteredDishes.map((dish) => (
                    <DishCard key={dish.id} dish={dish} onAdd={addToOrder} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {showCart ? (
            <div className="cart-overlay" onClick={() => setShowCart(false)}>
              <aside
                className="cart-panel"
                onClick={(event) => event.stopPropagation()}
                aria-label="Giỏ hàng đơn mới"
              >
                <div className="cart-panel__header">
                  <div className="cart-panel__title">
                    <span>
                      <ShoppingCart /> Đơn hàng mới
                    </span>
                    {currentTable ? (
                      <span className="cart-panel__table">
                        Bàn {currentTable.code}
                      </span>
                    ) : (
                      <span className="cart-panel__table cart-panel__table--muted">
                        Chưa chọn bàn
                      </span>
                    )}
                  </div>
                  <div className="cart-panel__header-actions">
                    <button
                      type="button"
                      className="cart-panel__clear"
                      onClick={() => setCurrentOrder([])}
                      title="Xóa tất cả"
                      disabled={currentOrder.length === 0}
                    >
                      <Eraser size={14} /> Xóa
                    </button>
                    <button
                      type="button"
                      className="cart-panel__close"
                      onClick={() => setShowCart(false)}
                      aria-label="Đóng giỏ hàng"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="cart-panel__body">
                  <div className="cart-panel__context">
                    <span>
                      <SlidersHorizontal size={14} /> {selectedFloorLabel}
                    </span>
                    <span>
                      <ClipboardList size={14} /> {activeCategoryLabel}
                    </span>
                  </div>

                  {currentOrder.length === 0 ? (
                    <div className="empty-state empty-state--cart">
                      <div className="empty-state__icon">
                        <ShoppingCart size={22} />
                      </div>
                      <strong>Giỏ hàng trống</strong>
                      <span>Thêm món từ thực đơn để tạo đơn mới.</span>
                    </div>
                  ) : (
                    currentOrder.map((item) => (
                      <div key={item._lineId} className="order-item">
                        <div className="order-item__details">
                          <p className="order-item__name">
                            {item.name || item.menuItem?.name}
                          </p>
                          {item.method || item.cookingOption ? (
                            <p className="order-item__method">
                              {item.method || item.cookingOption}
                            </p>
                          ) : null}
                          <div className="order-item__prices">
                            <span>{formatCurrency(item.price)}</span>
                            <span className="order-item__line-total">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                          </div>
                        </div>

                        <div className="order-item__qty-controls">
                          <button
                            type="button"
                            onClick={() =>
                              updateItemQty(item._lineId, item.quantity - 1)
                            }
                            aria-label="Giảm số lượng"
                          >
                            <Minus size={14} />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() =>
                              updateItemQty(item._lineId, item.quantity + 1)
                            }
                            aria-label="Tăng số lượng"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <button
                          type="button"
                          className="order-item__remove-btn"
                          onClick={() => removeItem(item._lineId)}
                          aria-label="Xóa món"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="cart-panel__footer">
                  <div className="order-totals">
                    <div className="order-totals__line">
                      <span>Số món</span>
                      <span>{cartQuantity}</span>
                    </div>
                    <div className="order-totals__line">
                      <span>Tạm tính</span>
                      <span>{formatCurrency(totals.subtotal)}</span>
                    </div>
                    <div className="order-totals__line order-totals__line--grand">
                      <span>Tổng cộng</span>
                      <span>{formatCurrency(totals.total)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="save-button"
                    onClick={handleSaveOrder}
                    disabled={!canSave}
                    aria-busy={isSaving}
                  >
                    {isSaving ? (
                      <Loader className="spinner" size={20} />
                    ) : (
                      <Plus size={20} />
                    )}
                    {isSaving ? "Đang lưu" : "Lưu đơn hàng"}
                  </button>
                </div>
              </aside>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
};

export default NewOrderModal;
