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
  ChevronRight,
  ChevronDown as ChevronDownIcon,
  Eraser,
  Image as ImageIcon,
} from "lucide-react";

// Modal dùng chung
import Modal from "../../../../components/common/Modal";

// Hooks dữ liệu
import useOrderManagement from "../../../../hooks/useOrderManagement";
import useFloorManagement from "../../../../hooks/useFloorManagement";
import useTableManagement from "../../../../hooks/useTableManagement";
import useMenuManagement from "../../../../hooks/useMenuManagement";
import { useNotification } from "@/hooks/useNotification";

// Styles
import "./NewOrderModal.scss";

// Helpers
const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value || 0
  );

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

  // POS Context cho hook Order
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

  // Hooks lấy dữ liệu
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

  // Bàn khả dụng (theo tầng đang chọn)
  const availableTables = useMemo(() => {
    return (tables || []).filter(
      (t) =>
        t.status === "available" &&
        (activeLevel === null || t.floorLevel === activeLevel)
    );
  }, [tables, activeLevel]);

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

  // Nhóm món theo danh mục
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

  // --------- Làm đẹp: Tìm kiếm & Accordion danh mục ----------
  const [query, setQuery] = useState("");
  const [expandedCats, setExpandedCats] = useState(new Set());

  // Mặc định mở toàn bộ khi có dữ liệu
  useEffect(() => {
    setExpandedCats(new Set(dishesGroupedByCategory.map((c) => c.id)));
  }, [dishesGroupedByCategory]);

  // Tự mở tất cả khi đang tìm kiếm
  useEffect(() => {
    if (query.trim()) {
      setExpandedCats(new Set(dishesGroupedByCategory.map((c) => c.id)));
    }
  }, [query, dishesGroupedByCategory]);

  const toggleCat = (id) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return dishesGroupedByCategory;
    return dishesGroupedByCategory
      .map((g) => ({
        ...g,
        dishes: (g.dishes || []).filter((d) =>
          [d.name, d.searchKeywords, d.category?.name]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        ),
      }))
      .filter((g) => g.dishes.length > 0);
  }, [dishesGroupedByCategory, normalizedQuery]);

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Tạo Đơn Hàng Mới"
      size="xl"
    >
      <div className="new-order-modal-layout">
        {/* LEFT: Menu & chọn bàn */}
        <section className="new-order-modal__menu-col">
          {/* Sticky filters */}
          <div className="new-order-modal__controls">
            <div className="controls__table-filter">
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
            </div>

            {/* Search + Sessions */}
            <div className="controls__quick">
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

          {/* Grid menu */}
          <div className="new-order-modal__grid-wrapper">
            {itemsLoading && (
              <div className="loading-overlay">
                <Loader className="spinner" size={32} />
                <p>Đang tải menu...</p>
              </div>
            )}

            {!itemsLoading && filteredGroups.length === 0 && (
              <div className="empty-state">Không tìm thấy món phù hợp.</div>
            )}

            {filteredGroups.map((category) => {
              const isOpen = expandedCats.has(category.id);
              return (
                <div key={category.id} className="menu-category">
                  <button
                    className="menu-category__title"
                    onClick={() => toggleCat(category.id)}
                    title={isOpen ? "Thu gọn" : "Mở rộng"}
                  >
                    <span className="menu-category__caret">
                      {isOpen ? (
                        <ChevronDownIcon size={18} />
                      ) : (
                        <ChevronRight size={18} />
                      )}
                    </span>
                    <span className="menu-category__name">{category.name}</span>
                    <span className="menu-category__count">
                      {category.dishes.length} món
                    </span>
                  </button>

                  {isOpen && (
                    <div className="menu-category__dish-grid">
                      {(category.dishes || []).map((dish) => (
                        <DishCard
                          key={dish.id}
                          dish={dish}
                          onAdd={addToOrder}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* RIGHT: Đơn nháp */}
        <aside className="new-order-modal__draft-col">
          <div className="draft-col__header">
            <div className="draft-col__title">
              Đơn hàng{" "}
              <span className="draft-col__table">
                {currentTable ? currentTable.code : "(Chưa chọn bàn)"}
              </span>
            </div>

            <div className="draft-col__actions">
              <button
                className="btn btn--ghost"
                onClick={clearDraft}
                disabled={currentOrder.length === 0}
                title="Xóa đơn nháp"
              >
                <Eraser size={16} />
                Xóa đơn
              </button>
            </div>
          </div>

          <div className="draft-col__item-list">
            {currentOrder.length === 0 && (
              <div className="empty-state">Vui lòng chọn món từ menu.</div>
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

          <footer className="draft-col__footer">
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
                canSave ? "Lưu đơn hàng (Enter)" : "Chưa đủ thông tin để lưu"
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
        </aside>
      </div>
    </Modal>
  );
};

export default NewOrderModal;
