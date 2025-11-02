// src/components/Dashboard_Manager/POS/components/panels/CenterPanel.jsx
import React, { useState, useMemo, useCallback } from "react";
import cls from "./CenterPanel.module.scss";
import { usePos } from "../../../../../context/PosContext";
import { formatPrice } from "../../utils/format";
import MenuItemModal from "../modals/MenuItemModal";
import { flyToOrder } from "../../../../../utils/flyToOrder";

export default function CenterPanel() {
  const {
    filteredMenu,
    currentCategory,
    setCurrentCategory,
    setSearchTerm,
    addToOrder,

    timeSlotOptions,
    selectedTimeSlot,
    setSelectedTimeSlot,
  } = usePos();

  // Tabs danh mục
  const categoryTabs = useMemo(
    () => [
      { key: "all", label: "Tất cả" },
      { key: "appetizer", label: "Khai vị" },
      { key: "main", label: "Món chính" },
      { key: "seafood", label: "Hải sản" },
      { key: "hotpot", label: "Lẩu" },
      { key: "drink", label: "Đồ uống" },
      { key: "dessert", label: "Tráng miệng" },
    ],
    []
  );

  const onSelectCategory = (cat) => setCurrentCategory?.(cat);

  // chuẩn hóa để hiển thị giá
  const withDisplay = useMemo(() => {
    return (filteredMenu || []).map((it) => {
      const base = Number(it.basePrice ?? 0);
      const defaultPrep =
        Array.isArray(it.preparationMethods) && it.preparationMethods.length > 0
          ? it.preparationMethods.find((p) => p?.isDefault) ||
            it.preparationMethods[0]
          : null;
      const prepPrice = Number(defaultPrep?.price ?? 0);

      const displayPrice =
        base > 0
          ? base
          : Number.isFinite(prepPrice) && prepPrice > 0
          ? prepPrice
          : Number(it.price ?? 0);

      const unit = it.byWeight ? "Kg" : "Phần";
      const cookingOption = defaultPrep?.name || "Bình thường";

      return {
        ...it,
        _displayPrice: displayPrice,
        _unit: unit,
        _defaultCooking: cookingOption,
      };
    });
  }, [filteredMenu]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const openModal = useCallback((item) => {
    setSelectedItem(item);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedItem(null);
  }, []);

  // khi bấm "thêm" từ modal
  const handleModalAdd = useCallback(
    (payload) => {
      const {
        menuItem,
        quantity = 1,
        cookingOption,
        unit,
        note,
        price,
      } = payload || {};
      // giữ lại đủ thông tin id, menuId, categoryId để server ko la
      const core = {
        id: menuItem?.id,
        dishId: menuItem?.id,
        menuId: menuItem?.menuId,
        categoryId: menuItem?.categoryId,
        name: menuItem?.name,
        price: Number(price ?? menuItem?._displayPrice ?? menuItem?.price ?? 0),
      };

      addToOrder?.({
        menuItem: core,
        cookingOption,
        unit,
        note,
        quantity,
        price: core.price,
      });
      closeModal();
    },
    [addToOrder, closeModal]
  );

  return (
    <div className={cls.wrapper}>
      {/* Header: tiêu đề + (tuỳ chọn) select khung giờ + ô tìm kiếm */}
      <div className={cls.header}>
        <h2 style={{ color: "#0c4a6e", fontWeight: 700, margin: 0 }}>
          Thực đơn
        </h2>

        <div className={cls.search}>
          {Array.isArray(timeSlotOptions) &&
            timeSlotOptions.length > 0 &&
            typeof setSelectedTimeSlot === "function" && (
              <select
                className={cls.input}
                style={{ width: 180 }}
                value={selectedTimeSlot || ""}
                onChange={(e) => setSelectedTimeSlot(e.target.value || null)}
                title="Chọn khung giờ hiển thị menu"
              >
                {timeSlotOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}

          <input
            className={cls.input}
            placeholder="Tìm kiếm món ăn..."
            onChange={(e) => setSearchTerm?.(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs danh mục */}
      <div className={cls.tabs}>
        {categoryTabs.map((c) => (
          <button
            key={c.key}
            className={`${cls.tab} ${
              currentCategory === c.key ? cls.tabActive : ""
            }`}
            onClick={() => onSelectCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Lưới món ăn – cho cuộn riêng */}
      <div className={cls.grid} style={{ overflowY: "auto" }}>
        {withDisplay.map((item) => {
          const price = Number(item._displayPrice || 0);
          const thumb = item.thumbImage;
          const emoji = item.emoji || "🍽️";

          return (
            <div
              key={item.id}
              className={cls.card}
              data-menu-id={item.id}
              onClick={() => openModal(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && openModal(item)}
              title={`${item.name} — ${formatPrice(price)}`}
            >
              <div className={cls.image}>
                {thumb ? (
                  <img
                    src={thumb}
                    alt={item.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                    loading="lazy"
                  />
                ) : (
                  <span aria-hidden="true">{emoji}</span>
                )}
              </div>

              <div className={cls.info}>
                <div className={cls.name}>{item.name}</div>
                <div className={cls.price}>
                  {formatPrice(price)}
                  {item.byWeight ? (
                    <span
                      style={{ marginLeft: 6, fontSize: 12, color: "#6b7280" }}
                    >
                      /kg
                    </span>
                  ) : null}
                </div>
                {item.description ? (
                  <div className={cls.desc}>{item.description}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal cho item */}
      <MenuItemModal
        isOpen={modalOpen}
        item={selectedItem}
        onAdd={handleModalAdd}
        onClose={closeModal}
      />
    </div>
  );
}
