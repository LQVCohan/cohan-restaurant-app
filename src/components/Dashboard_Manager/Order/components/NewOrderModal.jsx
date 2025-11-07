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
} from "lucide-react";

// ✅ MỚI: Import Modal chung
// (Hãy đảm bảo đường dẫn này đúng với cấu trúc dự án của bạn)
import Modal from "../../../../components/common/Modal";

// --- Import các hook ---
import useOrderManagement from "../../../../hooks/useOrderManagement";
import useFloorManagement from "../../../../hooks/useFloorManagement";
import useTableManagement from "../../../../hooks/useTableManagement";
import useMenuManagement from "../../../../hooks/useMenuManagement";
import { useNotification } from "@/hooks/useNotification";

// --- CSS ---
import "./NewOrderModal.scss"; // Import SCSS cho layout bên trong

// --- Helper Functions ---
const formatCurrency = (value) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value || 0);
};

// --- Component Card Món Ăn (Nội bộ) ---
// (Logic component DishCard không đổi)
const DishCard = ({ dish, onAdd }) => {
  const [showMethods, setShowMethods] = useState(false);
  const hasMethods =
    dish.preparationMethods && dish.preparationMethods.length > 0;
  const defaultPrep = dish._defaultPreparation;

  const handleAdd = (prepMethod = null) => {
    let priceForHook;
    if (dish.basePrice > 0) {
      priceForHook = dish.basePrice;
    } else {
      priceForHook = prepMethod ? prepMethod.price : 0;
    }

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

  const cardClasses = [
    "dish-card",
    showMethods ? "dish-card--methods-open" : "",
  ]
    .join(" ")
    .trim();

  if (showMethods) {
    return (
      <div className={cardClasses}>
        <button
          onClick={() => setShowMethods(false)}
          className="dish-card__close-methods"
        >
          <X size={14} />
        </button>
        <h4 className="dish-card__name">{dish.name}</h4>
        <div className="dish-card__methods-list">
          {(dish.preparationMethods || []).map((method, index) => (
            <button
              key={method.name || index}
              onClick={() => handleAdd(method)}
              className="dish-card__method-btn"
            >
              {method.name}
              {dish.basePrice === 0 && (
                <span className="dish-card__method-price">
                  {formatCurrency(method.price)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <button onClick={handleAddDefault} className={cardClasses}>
      <div>
        <h4 className="dish-card__name">{dish.name}</h4>
        {hasMethods && (
          <span className="dish-card__meta">
            (Có {dish.preparationMethods.length} cách chế biến)
          </span>
        )}
      </div>
      <p className="dish-card__price">{formatCurrency(dish._displayPrice)}</p>
    </button>
  );
};

// --- Component Modal Chính (ĐÃ CẬP NHẬT) ---
const NewOrderModal = ({ isOpen, onClose, restaurantId, onSuccess }) => {
  const { showNotification } = useNotification?.() || {
    showNotification: (msg, type) => console.log(type || "info", msg),
  };

  // --- State cho context của hook (Giữ nguyên) ---
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

  // --- Khởi tạo hook TẠO ĐƠN (Giữ nguyên) ---
  const { addToOrder, updateItemQty, removeItem, saveOrder, totals } =
    useOrderManagement(posContext);

  // --- Khởi tạo các hook LẤY DỮ LIỆU (Giữ nguyên) ---
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

  // --- State nội bộ (Giữ nguyên) ---
  const [isSaving, setIsSaving] = useState(false);

  // --- Logic lọc/map dữ liệu (Giữ nguyên) ---
  const availableTables = useMemo(() => {
    return tables.filter(
      (t) =>
        t.status === "available" &&
        (activeLevel === null || t.floorLevel === activeLevel)
    );
  }, [tables, activeLevel]);

  const sessions = useMemo(() => {
    const availableSet = new Set(menus.map((m) => m.timeSlot));
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

  const dishesGroupedByCategory = useMemo(() => {
    const groups = new Map();
    (itemsWithPrice || []).forEach((item) => {
      const catId = item.categoryId || "other";
      // Tạm dùng categoryId làm tên nếu không có
      const catName =
        item.category?.name || `Danh mục #${catId.substring(0, 5)}`;

      if (!groups.has(catId)) {
        groups.set(catId, { id: catId, name: catName, dishes: [] });
      }
      groups.get(catId).dishes.push(item);
    });
    return Array.from(groups.values());
  }, [itemsWithPrice]);

  // --- Hàm xử lý sự kiện (Giữ nguyên) ---
  const handleTableChange = (e) => {
    const tableCode = e.target.value;
    const selectedTable = tables.find((t) => t.code === tableCode);
    setCurrentTable(selectedTable || null);
  };

  const handleFloorChange = (e) => {
    const level = e.target.value;
    setActiveLevel(level ? Number(level) : null);
    setCurrentTable(null);
  };

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
    const result = await saveOrder({
      persist: true,
      restaurantId: restaurantId,
    });
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
    // Reset state của đơn hàng nháp
    setCurrentTable(null);
    setCurrentOrder([]);
    setTableOrders({});
    setIsSaving(false);
    // Gọi hàm onClose từ component cha (OrderManagement)
    onClose();
  };

  const isLoading = tablesLoading || floorsLoading;

  // ✅ THAY ĐỔI CHÍNH: Bọc layout trong <Modal>
  // Component <Modal> sẽ tự xử lý việc ẩn/hiện dựa trên `isOpen`
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Tạo Đơn Hàng Mới"
      size="xl" // Dùng size "xl" (80rem) từ Modal.scss
    >
      {/* Layout 2 cột sẽ được render bên trong <div class="modal__content">
        Chúng ta cần 1 class wrapper để override padding của .modal__content
      */}
      <div className="new-order-modal-layout">
        {/* Cột trái: Chọn Bàn & Menu (Không đổi) */}
        <section className="new-order-modal__menu-col">
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
                  {floors.map((floor) => (
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
                  disabled={isLoading || availableTables.length === 0}
                >
                  <option value="">
                    {isLoading ? "Đang tải bàn..." : "--- Chọn bàn ---"}
                  </option>
                  {availableTables.map((table) => (
                    <option key={table.id} value={table.code}>
                      {table.code}{" "}
                      {table.floorLevel ? `(Tầng ${table.floorLevel})` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="form-group__chevron" />
              </div>
            </div>

            <nav className="new-order-modal__sessions">
              {sessions.map((session) => (
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

          <div className="new-order-modal__grid-wrapper">
            {itemsLoading && (
              <div className="loading-overlay">
                <Loader className="spinner" size={32} />
                <p>Đang tải menu...</p>
              </div>
            )}
            {!itemsLoading && dishesGroupedByCategory.length === 0 && (
              <div className="empty-state">
                Không tìm thấy món ăn cho buổi này.
              </div>
            )}
            {dishesGroupedByCategory.map((category) => (
              <div key={category.id} className="menu-category">
                <h3 className="menu-category__title">{category.name}</h3>
                <div className="menu-category__dish-grid">
                  {(category.dishes || []).map((dish) => (
                    <DishCard key={dish.id} dish={dish} onAdd={addToOrder} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Cột phải: Đơn Hàng Nháp (Không đổi) */}
        <aside className="new-order-modal__draft-col">
          <h3 className="draft-col__header">
            Đơn hàng:{" "}
            <span>{currentTable ? currentTable.code : "(Chưa chọn bàn)"}</span>
          </h3>

          <div className="draft-col__item-list">
            {currentOrder.length === 0 && (
              <div className="empty-state">Vui lòng chọn món từ menu.</div>
            )}
            {currentOrder.map((item) => (
              <div key={item._lineId} className="order-item">
                <div className="order-item__details">
                  <p className="order-item__name">{item.name}</p>
                  {item.method && (
                    <p className="order-item__method">
                      Cách chế biến: {item.method}
                    </p>
                  )}
                  <p className="order-item__price">
                    {formatCurrency(item.price)}
                  </p>
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
                  onClick={() => removeItem(item._lineId)}
                  className="order-item__remove-btn"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
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
              disabled={
                isSaving ||
                !currentTable ||
                currentOrder.length === 0 ||
                isLoading
              }
              className="save-button"
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
