// src/components/Dashboard_Manager/POS/components/CenterPanel.jsx
import React, { useState, useMemo, useCallback } from "react";
import cls from "./CenterPanel.module.scss";
import { usePos } from "../../../../../context/PosContext";
import { formatPrice } from "../../utils/format";
import MenuItemModal from "../modals/MenuItemModal";

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

  // gắn _displayPrice + unit + defaultCooking
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

      const unit = it.byWeight ? "kg" : "portion";
      const cookingOption = defaultPrep?.name || "";

      return {
        ...it,
        _displayPrice: displayPrice,
        _unit: unit,
        _defaultCooking: cookingOption,
      };
    });
  }, [filteredMenu]);

  // modal state
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

      // menuItem ở đây là object đầy đủ từ API menu
      if (!menuItem) return;

      addToOrder?.({
        menuItem: {
          id: menuItem.id,
          dishId: menuItem.id,
          name: menuItem.name,
          price:
            price ?? Number(menuItem._displayPrice ?? menuItem.price ?? 0) ?? 0,
          // 👇 cố gắng map cho đủ
          menuId: menuItem.menuId ?? menuItem.menu?.id ?? null,
          categoryId: menuItem.categoryId ?? menuItem.category?.id ?? null,
        },
        cookingOption,
        unit,
        note,
        quantity,
        price,
      });

      closeModal();
    },
    [addToOrder, closeModal]
  );

  return (
    <div className={cls.wrapper}>
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

      <div className={cls.grid}>
        {withDisplay.map((item) => {
          const price = Number(item._displayPrice || 0);
          const thumb = item.thumbImage;
          const emoji = item.emoji || "🍽️";

          return (
            <div
              key={item.id}
              className={cls.card}
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

      <MenuItemModal
        isOpen={modalOpen}
        item={selectedItem}
        onAdd={handleModalAdd}
        onClose={closeModal}
      />
    </div>
  );
}
