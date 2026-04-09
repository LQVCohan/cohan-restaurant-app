// src/pages/OrderManagement/components/NewOrderModal.jsx
import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Plus,
  Minus,
  Trash2,
  Bookmark,
  ChevronDown,
  Loader,
  Layers,
  Search,
  Eraser,
  Image as ImageIcon,
  ShoppingCart,
  ChefHat,
} from "lucide-react";

import Modal from "../../../../components/common/Modal";
import useOrderManagement from "../../../../hooks/useOrderManagement";
import useFloorManagement from "../../../../hooks/useFloorManagement";
import useTableManagement from "../../../../hooks/useTableManagement";
import useMenuManagement from "../../../../hooks/useMenuManagement";
import { useNotification } from "@/hooks/useNotification";
import useModalDraft from "../../../../hooks/useModalDraft";

import "./NewOrderModal.scss";

// --- Helpers ---
const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value || 0);

// ---------------------- DishCard Component ----------------------
const DishCard = ({ dish, onAdd }) => {
  const [showMethods, setShowMethods] = useState(false);

  const hasMethods =
    Array.isArray(dish.preparationMethods) &&
    dish.preparationMethods.length > 0;
  const defaultPrep = dish._defaultPreparation;
  const imageUrl = dish.imageUrl || null;

  const handleAdd = (prepMethod = null) => {
    const priceForHook =
      dish.basePrice > 0 ? dish.basePrice : prepMethod ? prepMethod.price : 0;

    onAdd({
      menuItem: dish,
      quantity: 1,
      cookingOption: prepMethod ? prepMethod.name : "",
      price: priceForHook,
    });
    setShowMethods(false);
  };

  const handleAddDefault = () => {
    if (hasMethods) {
      setShowMethods(true);
    } else {
      handleAdd(defaultPrep);
    }
  };

  return (
    <div
      className={`dish-card ${showMethods ? "dish-card--methods-open" : ""}`}
    >
      {/* Click Area */}
      <div
        className="dish-card__click"
        onClick={handleAddDefault}
        role="button"
        tabIndex={0}
      >
        <div className="dish-card__thumb">
          {imageUrl ? (
            <img src={imageUrl} alt={dish.name} loading="lazy" />
          ) : (
            <div className="dish-card__thumb--placeholder">
              <ImageIcon size={24} />
            </div>
          )}
        </div>

        <div className="dish-card__info">
          <h4 className="dish-card__name" title={dish.name}>
            {dish.name}
          </h4>

          <div className="dish-card__meta-row">
            {hasMethods && (
              <span className="badge badge--info">
                {dish.preparationMethods.length} option
              </span>
            )}
            {dish.basePrice === 0 && (
              <span className="badge badge--warning">Giá thay đổi</span>
            )}
          </div>

          <p className="dish-card__price">
            {formatCurrency(dish._displayPrice)}
          </p>
        </div>
      </div>

      {/* Quick Add Button */}
      <button
        className="dish-card__add"
        title="Thêm nhanh"
        onClick={(e) => {
          e.stopPropagation();
          handleAddDefault();
        }}
      >
        <Plus size={18} />
      </button>

      {/* Preparation Methods Popup */}
      {showMethods && (
        <div
          className="dish-card__methods-pop"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="dish-card__methods-title">
            Chọn cách chế biến
            <button
              onClick={() => setShowMethods(false)}
              className="dish-card__methods-close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="dish-card__methods-list">
            {(dish.preparationMethods || []).map((method, idx) => (
              <button
                key={method.name || idx}
                onClick={() => handleAdd(method)}
                className="dish-card__method-btn"
              >
                <span>{method.name}</span>
                {dish.basePrice === 0 && <b>{formatCurrency(method.price)}</b>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------- Main Modal Component ----------------------
const NewOrderModal = ({ isOpen, onClose, restaurantId, onSuccess }) => {
  const { showNotification } = useNotification?.() || {
    showNotification: () => {},
  };

  // State
  const [currentTable, setCurrentTable] = useState(null);
  const [currentOrder, setCurrentOrder] = useState([]);
  const [tableOrders, setTableOrders] = useState({});
  const [showCart, setShowCart] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const hasDirtyForm =
    !!currentTable ||
    currentOrder.length > 0 ||
    !!query.trim() ||
    !!selectedCategoryId;

  const { requestCloseWithDraft, clearDraft } = useModalDraft({
    enabled: isOpen,
    draftIdentity: {
      module: "order",
      modal: "new-order-modal",
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: "create",
      entityType: "order",
      recordId: null,
      context: String(restaurantId || "default"),
      schemaVersion: "1",
    },
    formValue: {
      currentTableCode: currentTable?.code || "",
      currentOrder,
      query,
      selectedCategoryId,
      selectedTimeSlot,
      activeLevel,
    },
    isDirty: hasDirtyForm,
    sanitize: (v) => ({
      currentTableCode: v?.currentTableCode || "",
      currentOrder: Array.isArray(v?.currentOrder)
        ? v.currentOrder.map((row) => ({
            menuItemId: row?.menuItem?.id || row?.menuItemId || "",
            menuItemName: row?.menuItem?.name || row?.menuItemName || "",
            quantity: Number(row?.quantity || 0),
            cookingOption: row?.cookingOption || "",
            price: Number(row?.price || 0),
            note: row?.note || "",
          }))
        : [],
      query: v?.query || "",
      selectedCategoryId: v?.selectedCategoryId || "",
      selectedTimeSlot: v?.selectedTimeSlot || "",
      activeLevel: v?.activeLevel ?? null,
    }),
    onRestore: (draft) => {
      const restoredTable = (tables || []).find(
        (t) => t.code === draft?.currentTableCode,
      );
      setCurrentTable(restoredTable || null);
      setCurrentOrder(Array.isArray(draft?.currentOrder) ? draft.currentOrder : []);
      setQuery(draft?.query || "");
      setSelectedCategoryId(draft?.selectedCategoryId || "");
      if (draft?.selectedTimeSlot) setSelectedTimeSlot(draft.selectedTimeSlot);
      if (draft?.activeLevel !== undefined) setActiveLevel(draft.activeLevel);
      showNotification(
        "Ảnh/file minh hoạ món không được khôi phục tự động trong đơn nháp.",
        "info",
        2600,
      );
    },
    notify: showNotification,
  });

  // Context Mock for Hooks
  const posContext = useMemo(
    () => ({
      currentOrder,
      setCurrentOrder,
      currentTable,
      tableOrders,
      setTableOrders,
    }),
    [currentOrder, currentTable, tableOrders]
  );

  // Business Logic Hooks
  const { addToOrder, updateItemQty, removeItem, saveOrder, totals } =
    useOrderManagement(posContext);

  const { floors, floorsLoading: _FLOORS_LOADING, activeLevel, setActiveLevel } =
    useFloorManagement({ restaurantId });

  const { tables, tablesLoading } = useTableManagement({ restaurantId });

  const {
    menus,
    itemsWithPrice,
    itemsLoading,
    selectedTimeSlot,
    setSelectedTimeSlot,
  } = useMenuManagement({ restaurantId });

  // -- Derived State --
  const availableTables = useMemo(
    () =>
      (tables || []).filter(
        (t) =>
          t.status === "available" &&
          (activeLevel === null || t.floorLevel === activeLevel)
      ),
    [tables, activeLevel]
  );

  const sessions = useMemo(() => {
    const availableSet = new Set((menus || []).map((m) => m.timeSlot));
    const slotMap = {
      breakfast: "Sáng",
      lunch: "Trưa",
      dinner: "Tối",
      late_night: "Đêm",
    };
    return ["breakfast", "lunch", "dinner", "late_night"]
      .filter((slot) => availableSet.has(slot))
      .map((slot) => ({ value: slot, label: slotMap[slot] || slot }));
  }, [menus]);

  // Set default session
  useEffect(() => {
    if (!selectedTimeSlot && sessions.length > 0) {
      setSelectedTimeSlot(sessions[0].value);
    }
  }, [sessions, selectedTimeSlot, setSelectedTimeSlot]);

  // Categories
  const categoryOptions = useMemo(() => {
    const uniqueCats = new Map();
    (itemsWithPrice || []).forEach((item) => {
      const catId = item.categoryId || "other";
      if (!uniqueCats.has(catId)) {
        uniqueCats.set(catId, item.category?.name || "Khác");
      }
    });
    return [
      { id: "", name: "Tất cả danh mục" },
      ...Array.from(uniqueCats.entries()).map(([id, name]) => ({ id, name })),
    ];
  }, [itemsWithPrice]);

  // Filter Items
  const filteredDishes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (itemsWithPrice || []).filter((d) => {
      if (
        selectedCategoryId &&
        (d.categoryId || "other") !== selectedCategoryId
      )
        return false;
      if (!normalizedQuery) return true;
      const text = [d.name, d.searchKeywords, d.category?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(normalizedQuery);
    });
  }, [itemsWithPrice, selectedCategoryId, query]);

  // -- Handlers --
  const handleTableChange = (e) => {
    const tableCode = e.target.value;
    setCurrentTable((tables || []).find((t) => t.code === tableCode) || null);
  };

  const handleSaveOrder = async () => {
    if (!currentTable) return showNotification("Vui lòng chọn bàn!", "error");
    if (!currentOrder.length)
      return showNotification("Chọn ít nhất 1 món!", "error");

    setIsSaving(true);
    const result = await saveOrder({ persist: true, restaurantId });
    setIsSaving(false);

    if (result.success) {
      showNotification("Tạo đơn hàng thành công!", "success");
      clearDraft();
      onSuccess?.();
      closeModalNow();
    } else {
      showNotification(`Lỗi: ${result.message}`, "error");
    }
  };

  const closeModalNow = () => {
    setCurrentTable(null);
    setCurrentOrder([]);
    setShowCart(false);
    setQuery("");
    setSelectedCategoryId("");
    onClose();
  };

  const canSave = !isSaving && !!currentTable && currentOrder.length > 0;

  // -- Render --
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => requestCloseWithDraft(closeModalNow)}
      title="Tạo Đơn Hàng Mới"
      size="xl"
    >
      <div className="new-order-modal">
        <div className="new-order-modal-layout">
          {/* LEFT: Menu & Controls */}
          <section className="new-order-modal__menu-col">
            {/* Header Controls */}
            <div className="new-order-modal__controls">
              {/* Row 1: Floor - Table - Category - CartTrigger */}
              <div className="controls__row controls__row--top">
                <div className="form-group">
                  <Layers size={16} className="form-group__icon" />
                  <select
                    value={activeLevel ?? ""}
                    onChange={(e) => {
                      setActiveLevel(
                        e.target.value ? Number(e.target.value) : null
                      );
                      setCurrentTable(null);
                    }}
                    className="form-group__select"
                  >
                    <option value="">Tất cả tầng</option>
                    {(floors || []).map((f) => (
                      <option key={f.id} value={f.level}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="form-group__chevron" />
                </div>

                <div className="form-group">
                  <Bookmark size={16} className="form-group__icon" />
                  <select
                    value={currentTable?.code || ""}
                    onChange={handleTableChange}
                    className="form-group__select"
                    disabled={tablesLoading}
                  >
                    <option value="">-- Chọn bàn --</option>
                    {availableTables.map((t) => (
                      <option key={t.id} value={t.code}>
                        {t.code} {t.floorLevel ? `(Tầng ${t.floorLevel})` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="form-group__chevron" />
                </div>

                <div className="form-group">
                  <ChefHat size={16} className="form-group__icon" />
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="form-group__select"
                  >
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="form-group__chevron" />
                </div>

                <button
                  className="cart-toggle"
                  onClick={() => setShowCart(true)}
                  disabled={currentOrder.length === 0}
                >
                  <ShoppingCart size={20} />
                  <span>Giỏ hàng</span>
                  {currentOrder.length > 0 && (
                    <span className="cart-toggle__badge">
                      {currentOrder.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Row 2: Search - Session Tabs */}
              <div className="controls__row controls__row--bottom">
                <div className="searchbox">
                  <Search className="searchbox__icon" size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Tìm món ăn..."
                    className="searchbox__input"
                  />
                </div>

                <div className="new-order-modal__sessions">
                  {sessions.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setSelectedTimeSlot(s.value)}
                      className={`session-tab ${
                        selectedTimeSlot === s.value
                          ? "session-tab--active"
                          : ""
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Menu Grid */}
            <div className="new-order-modal__grid-wrapper">
              {itemsLoading ? (
                <div className="loading-overlay">
                  <Loader className="spinner" size={32} />
                  <span>Đang tải thực đơn...</span>
                </div>
              ) : filteredDishes.length === 0 ? (
                <div className="empty-state">
                  <span>Không tìm thấy món phù hợp.</span>
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

          {/* RIGHT: Cart Drawer */}
          {showCart && (
            <div className="cart-overlay" onClick={() => setShowCart(false)}>
              <div className="cart-panel" onClick={(e) => e.stopPropagation()}>
                <div className="cart-panel__header">
                  <div className="cart-panel__title">
                    <span>
                      <ShoppingCart /> Đơn hàng mới
                    </span>
                    {currentTable && (
                      <span className="cart-panel__table">
                        Bàn {currentTable.code}
                      </span>
                    )}
                  </div>
                  <div className="cart-panel__header-actions">
                    <button
                      className="cart-panel__clear"
                      onClick={() => setCurrentOrder([])}
                      title="Xóa tất cả"
                    >
                      <Eraser size={14} /> Xóa
                    </button>
                    <button
                      className="cart-panel__close"
                      onClick={() => setShowCart(false)}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="cart-panel__body">
                  {currentOrder.length === 0 ? (
                    <div className="empty-state">Giỏ hàng trống</div>
                  ) : (
                    currentOrder.map((item) => (
                      <div key={item._lineId} className="order-item">
                        <div className="order-item__details">
                          <p className="order-item__name">{item.name}</p>
                          {item.method && (
                            <p className="order-item__method">
                              ({item.method})
                            </p>
                          )}
                          <div className="order-item__prices">
                            {formatCurrency(item.price)}
                            <span className="order-item__line-total">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                          </div>
                        </div>

                        <div className="order-item__qty-controls">
                          <button
                            onClick={() =>
                              updateItemQty(item._lineId, item.quantity - 1)
                            }
                          >
                            <Minus size={14} />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            onClick={() =>
                              updateItemQty(item._lineId, item.quantity + 1)
                            }
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <button
                          className="order-item__remove-btn"
                          onClick={() => removeItem(item._lineId)}
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
                      <span>Tạm tính</span>
                      <span>{formatCurrency(totals.subtotal)}</span>
                    </div>
                    <div className="order-totals__line order-totals__line--grand">
                      <span>Tổng cộng</span>
                      <span>{formatCurrency(totals.total)}</span>
                    </div>
                  </div>

                  <button
                    className="save-button"
                    onClick={handleSaveOrder}
                    disabled={!canSave}
                  >
                    {isSaving ? (
                      <Loader className="spinner" size={20} />
                    ) : (
                      <Plus size={20} />
                    )}
                    {isSaving ? "Đang xử lý..." : "Lưu Đơn Hàng"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default NewOrderModal;
