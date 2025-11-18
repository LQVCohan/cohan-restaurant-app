// src/pages/OrderManagement/components/NewOrderModal.jsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
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
} from "lucide-react";

import Modal from "../../../../components/common/Modal";

import useOrderManagement from "../../../../hooks/useOrderManagement";
import useFloorManagement from "../../../../hooks/useFloorManagement";
import useTableManagement from "../../../../hooks/useTableManagement";
import useMenuManagement from "../../../../hooks/useMenuManagement";
import { useNotification } from "@/hooks/useNotification";

import "./NewOrderModal.scss";

// Helpers
const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value || 0);

// ---------------------- DishCard ----------------------
const DishCard = ({ dish, onAdd }) => {
  const [showMethods, setShowMethods] = useState(false);

  const hasMethods =
    Array.isArray(dish.preparationMethods) &&
    dish.preparationMethods.length > 0;

  const defaultPrep = dish._defaultPreparation;

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

  const imageUrl = dish.imageUrl || null;

  return (
    <div
      className={`dish-card ${showMethods ? "dish-card--methods-open" : ""}`}
    >
      <div
        className="dish-card__click"
        aria-label={`Thêm ${dish.name}`}
        role="button"
        tabIndex={0}
        onClick={handleAddDefault}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAddDefault();
        }}
      >
        <div className="dish-card__thumb">
          {imageUrl ? (
            <img src={imageUrl} alt={dish.name} />
          ) : (
            <div className="dish-card__thumb--placeholder">
              <ImageIcon size={20} />
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
                {dish.preparationMethods.length} cách chế biến
              </span>
            )}
            {dish.basePrice === 0 && (
              <span className="badge badge--warning">Giá theo chế biến</span>
            )}
          </div>

          <p className="dish-card__price">
            {formatCurrency(dish._displayPrice)}
          </p>
        </div>
      </div>

      {/* Nút + nhanh */}
      <button
        className="dish-card__add"
        title="Thêm nhanh"
        onClick={(e) => {
          e.stopPropagation();
          handleAddDefault();
        }}
      >
        <Plus size={16} />
      </button>

      {/* Popup chọn cách chế biến */}
      {showMethods && (
        <div className="dish-card__methods-pop">
          <button
            onClick={() => setShowMethods(false)}
            className="dish-card__methods-close"
            title="Đóng"
          >
            <X size={14} />
          </button>
          <div className="dish-card__methods-title">{dish.name}</div>
          <div className="dish-card__methods-list">
            {(dish.preparationMethods || []).map((method, idx) => (
              <button
                key={method.name || idx}
                onClick={() => handleAdd(method)}
                className="dish-card__method-btn"
              >
                <span>{method.name}</span>
                {dish.basePrice === 0 && (
                  <span className="dish-card__method-price">
                    {formatCurrency(method.price)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------- Main Modal ----------------------
const NewOrderModal = ({ isOpen, onClose, restaurantId, onSuccess }) => {
  const { showNotification } = useNotification?.() || {
    showNotification: (msg, type) => console.log(type || "info", msg),
  };

  // POS-like state local
  const [currentTable, setCurrentTable] = useState(null);
  const [currentOrder, setCurrentOrder] = useState([]);
  const [tableOrders, setTableOrders] = useState({});

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

  // Hook tạo/lưu đơn
  const { addToOrder, updateItemQty, removeItem, saveOrder, totals } =
    useOrderManagement(posContext);

  // Dữ liệu cơ bản
  const { floors, floorsLoading, activeLevel, setActiveLevel } =
    useFloorManagement({ restaurantId });
  const { tables, tablesLoading } = useTableManagement({ restaurantId });
  const {
    menus,
    itemsWithPrice,
    itemsLoading,
    selectedTimeSlot,
    setSelectedTimeSlot,
  } = useMenuManagement({ restaurantId });

  const [isSaving, setIsSaving] = useState(false);

  // Giỏ hàng overlay
  const [showCart, setShowCart] = useState(false);

  // Bàn khả dụng (theo tầng)
  const availableTables = useMemo(
    () =>
      (tables || []).filter(
        (t) =>
          t.status === "available" &&
          (activeLevel === null || t.floorLevel === activeLevel)
      ),
    [tables, activeLevel]
  );

  // Phiên phục vụ
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

  useEffect(() => {
    if (!selectedTimeSlot && sessions.length > 0) {
      setSelectedTimeSlot(sessions[0].value);
    }
  }, [sessions, selectedTimeSlot, setSelectedTimeSlot]);

  // Nhóm danh mục
  const dishesGroupedByCategory = useMemo(() => {
    const groups = new Map();
    (itemsWithPrice || []).forEach((item) => {
      const catId = item.categoryId || "other";
      const catName =
        item.category?.name || `Danh mục #${String(catId).slice(0, 5)}`;
      if (!groups.has(catId)) {
        groups.set(catId, { id: catId, name: catName, dishes: [] });
      }
      groups.get(catId).dishes.push(item);
    });
    return Array.from(groups.values());
  }, [itemsWithPrice]);

  const categoryOptions = useMemo(
    () => [
      { id: "", name: "Tất cả danh mục" },
      ...dishesGroupedByCategory.map((c) => ({ id: c.id, name: c.name })),
    ],
    [dishesGroupedByCategory]
  );

  // Tìm kiếm + filter danh mục
  const [query, setQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const normalizedQuery = query.trim().toLowerCase();

  const filteredDishes = useMemo(() => {
    return (itemsWithPrice || []).filter((d) => {
      if (selectedCategoryId) {
        const catId = d.categoryId || "other";
        if (catId !== selectedCategoryId) return false;
      }

      if (!normalizedQuery) return true;

      const text = [d.name, d.searchKeywords, d.category?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(normalizedQuery);
    });
  }, [itemsWithPrice, selectedCategoryId, normalizedQuery]);

  // --------- Handlers ----------
  const handleTableChange = (e) => {
    const tableCode = e.target.value;
    const selectedTable = (tables || []).find((t) => t.code === tableCode);
    setCurrentTable(selectedTable || null);
  };

  const handleFloorChange = (e) => {
    const level = e.target.value;
    setActiveLevel(level ? Number(level) : null);
    setCurrentTable(null);
  };

  const handleCategoryChange = (e) => {
    setSelectedCategoryId(e.target.value);
  };

  const clearDraft = () => {
    setCurrentOrder([]);
    showNotification("Đã xóa đơn nháp.", "info");
  };

  const canSave =
    !isSaving &&
    !!currentTable &&
    currentOrder.length > 0 &&
    !(tablesLoading || floorsLoading);

  const handleSaveOrder = async () => {
    if (!currentTable) {
      showNotification("Vui lòng chọn bàn!", "error");
      return;
    }
    if (!currentOrder.length) {
      showNotification("Vui lòng chọn ít nhất 1 món!", "error");
      return;
    }
    setIsSaving(true);
    const result = await saveOrder({ persist: true, restaurantId });
    setIsSaving(false);

    if (result.success) {
      showNotification("Tạo đơn hàng thành công!", "success");
      onSuccess?.();
      handleClose();
    } else {
      showNotification(`Lỗi khi lưu đơn: ${result.message}`, "error");
    }
  };

  const handleClose = () => {
    setCurrentTable(null);
    setCurrentOrder([]);
    setTableOrders({});
    setIsSaving(false);
    setShowCart(false);
    onClose();
  };

  // Phím tắt: Esc đóng, Enter lưu
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "Enter" && canSave) handleSaveOrder();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, canSave]); // eslint-disable-line

  const isLoading = tablesLoading || floorsLoading;

  const toggleCart = () => setShowCart((v) => !v);

  const handleCartBackdropClick = (e) => {
    e.stopPropagation();
    setShowCart(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Tạo Đơn Hàng Mới"
      size="xl"
    >
      <div className="new-order-modal">
        <div className="new-order-modal-layout">
          {/* MAIN COLUMN: Chọn bàn + món */}
          <section className="new-order-modal__menu-col">
            {/* Controls */}
            <div className="new-order-modal__controls">
              <div className="controls__row controls__row--top">
                <div className="form-group form-group--floor">
                  <Layers size={16} className="form-group__icon" />
                  <select
                    value={activeLevel ?? ""}
                    onChange={handleFloorChange}
                    className="form-group__select"
                    disabled={floorsLoading}
                  >
                    <option value="">
                      {floorsLoading ? "Đang tải tầng..." : "Tất cả các tầng"}
                    </option>
                    {(floors || []).map((floor) => (
                      <option key={floor.id} value={floor.level}>
                        {floor.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="form-group__chevron" />
                </div>

                <div className="form-group form-group--table">
                  <Bookmark size={16} className="form-group__icon" />
                  <select
                    value={currentTable?.code || ""}
                    onChange={handleTableChange}
                    className="form-group__select"
                    disabled={isLoading || (availableTables || []).length === 0}
                  >
                    <option value="">
                      {isLoading ? "Đang tải bàn..." : "--- Chọn bàn ---"}
                    </option>
                    {(availableTables || []).map((table) => (
                      <option key={table.id} value={table.code}>
                        {table.code}{" "}
                        {table.floorLevel ? `(Tầng ${table.floorLevel})` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="form-group__chevron" />
                </div>

                {/* Danh mục */}
                <div className="form-group form-group--category">
                  <Layers size={16} className="form-group__icon" />
                  <select
                    value={selectedCategoryId}
                    onChange={handleCategoryChange}
                    className="form-group__select"
                  >
                    {categoryOptions.map((cat) => (
                      <option key={cat.id || "all"} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="form-group__chevron" />
                </div>

                {/* Cart icon */}
                <button
                  type="button"
                  className="cart-toggle"
                  onClick={toggleCart}
                  disabled={currentOrder.length === 0}
                  title={
                    currentOrder.length === 0
                      ? "Chưa có món trong giỏ"
                      : "Xem giỏ hàng"
                  }
                >
                  <ShoppingCart size={18} />
                  {currentOrder.length > 0 && (
                    <span className="cart-toggle__badge">
                      {currentOrder.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="controls__row controls__row--bottom">
                <div className="searchbox">
                  <Search className="searchbox__icon" size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Tìm món theo tên, danh mục…"
                    className="searchbox__input"
                  />
                </div>

                <nav className="new-order-modal__sessions">
                  {(sessions || []).map((session) => (
                    <button
                      key={session.value}
                      onClick={() => setSelectedTimeSlot(session.value)}
                      className={`session-tab ${
                        selectedTimeSlot === session.value
                          ? "session-tab--active"
                          : ""
                      }`}
                    >
                      {session.label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Grid món */}
            <div className="new-order-modal__grid-wrapper">
              {itemsLoading && (
                <div className="loading-overlay">
                  <Loader className="spinner" size={32} />
                  <p>Đang tải menu...</p>
                </div>
              )}

              {!itemsLoading && filteredDishes.length === 0 && (
                <div className="empty-state">Không tìm thấy món phù hợp.</div>
              )}

              {!itemsLoading && filteredDishes.length > 0 && (
                <div className="menu-grid">
                  {filteredDishes.map((dish) => (
                    <DishCard key={dish.id} dish={dish} onAdd={addToOrder} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* CART OVERLAY */}
          {showCart && (
            <div className="cart-overlay" onClick={handleCartBackdropClick}>
              <div className="cart-panel" onClick={(e) => e.stopPropagation()}>
                <div className="cart-panel__header">
                  <div className="cart-panel__title">
                    <ShoppingCart size={18} />
                    <span>Giỏ hàng</span>
                    <span className="cart-panel__table">
                      {currentTable
                        ? `Bàn ${currentTable.code}`
                        : "(Chưa chọn bàn)"}
                    </span>
                  </div>
                  <div className="cart-panel__header-actions">
                    <button
                      className="cart-panel__clear"
                      onClick={clearDraft}
                      disabled={currentOrder.length === 0}
                    >
                      <Eraser size={14} />
                      Xóa đơn
                    </button>
                    <button
                      className="cart-panel__close"
                      onClick={() => setShowCart(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div className="cart-panel__body">
                  {currentOrder.length === 0 && (
                    <div className="empty-state">
                      Chưa có món trong giỏ. Hãy chọn món từ menu bên dưới.
                    </div>
                  )}

                  {currentOrder.map((item) => {
                    const lineTotal = (item.price || 0) * (item.quantity || 0);
                    return (
                      <div key={item._lineId} className="order-item">
                        <div className="order-item__details">
                          <p className="order-item__name" title={item.name}>
                            {item.name}
                          </p>
                          {item.method && (
                            <p className="order-item__method">
                              Cách chế biến: {item.method}
                            </p>
                          )}
                          <div className="order-item__prices">
                            <span className="order-item__price">
                              {formatCurrency(item.price)}
                            </span>
                            <span className="order-item__line-total">
                              {formatCurrency(lineTotal)}
                            </span>
                          </div>
                        </div>

                        <div className="order-item__qty-controls">
                          <button
                            onClick={() =>
                              updateItemQty(item._lineId, item.quantity - 1)
                            }
                            title="Giảm"
                          >
                            <Minus size={14} />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            onClick={() =>
                              updateItemQty(item._lineId, item.quantity + 1)
                            }
                            title="Tăng"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <button
                          onClick={() => removeItem(item._lineId)}
                          className="order-item__remove-btn"
                          title="Xóa món"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <footer className="cart-panel__footer">
                  <div className="order-totals">
                    <div className="order-totals__line">
                      <span>Tạm tính</span>
                      <span>{formatCurrency(totals.subtotal)}</span>
                    </div>
                    <div className="order-totals__line">
                      <span>VAT (10%)</span>
                      <span>{formatCurrency(totals.tax)}</span>
                    </div>
                    <div className="order-totals__line">
                      <span>Phí phục vụ (5%)</span>
                      <span>{formatCurrency(totals.service)}</span>
                    </div>
                    <div className="order-totals__line order-totals__line--grand">
                      <span>Tổng cộng</span>
                      <span>{formatCurrency(totals.total)}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveOrder}
                    disabled={!canSave}
                    className="save-button"
                    title={
                      canSave
                        ? "Lưu đơn hàng (Enter)"
                        : "Chưa đủ thông tin để lưu"
                    }
                  >
                    {isSaving ? (
                      <Loader size={20} className="spinner" />
                    ) : (
                      <Plus size={20} />
                    )}
                    Lưu Đơn Hàng
                  </button>
                </footer>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default NewOrderModal;
