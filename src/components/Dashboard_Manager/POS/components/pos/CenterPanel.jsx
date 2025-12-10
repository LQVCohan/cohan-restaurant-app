// src/components/Dashboard_Manager/POS/components/panels/CenterPanel.jsx
import React, { useState, useMemo, useCallback } from "react";
import cls from "./CenterPanel.module.scss";
import { usePos } from "../../../../../context/PosContext";
import { formatPrice } from "../../utils/format";
import MenuItemModal from "../modals/MenuItemModal";

// Icon Search SVG
const SearchIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ opacity: 0.5 }}
  >
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

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

  // Modal logic
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
        proofImages,
      } = payload || {};
      const core = {
        id: menuItem?.id,
        dishId: menuItem?.id,
        menuId: menuItem?.menuId,
        categoryId: menuItem?.categoryId,
        name: menuItem?.name,
        image: menuItem?.thumbImage,
        price: Number(price ?? menuItem?._displayPrice ?? menuItem?.price ?? 0),
      };

      addToOrder?.({
        menuItem: core,
        cookingOption,
        unit,
        note,
        quantity,
        price: core.price,
        proofImages: proofImages || [],
      });
      closeModal();
    },
    [addToOrder, closeModal]
  );

  return (
    <div className={cls.wrapper}>
      {/* HEADER AREA */}
      <div className={cls.header}>
        <div className={cls.headerLeft}>
          <h2 className={cls.title}>Thực đơn</h2>
        </div>

        <div className={cls.actions}>
          {/* Time Slot Select */}
          {Array.isArray(timeSlotOptions) && timeSlotOptions.length > 0 && (
            <div className={cls.selectWrapper}>
              <select
                className={cls.selectInput}
                value={selectedTimeSlot || ""}
                onChange={(e) => setSelectedTimeSlot(e.target.value || null)}
              >
                {timeSlotOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Box */}
          <div className={cls.searchBox}>
            <span className={cls.searchIcon}>
              <SearchIcon />
            </span>
            <input
              className={cls.searchInput}
              placeholder="Tìm kiếm món ăn..."
              onChange={(e) => setSearchTerm?.(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* TABS AREA */}
      <div className={cls.tabsScroll}>
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
      </div>

      {/* MENU GRID */}
      <div className={cls.gridContainer}>
        <div className={cls.grid}>
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
              >
                {/* Image Area */}
                <div className={cls.cardImageWrapper}>
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={item.name}
                      className={cls.cardImg}
                      loading="lazy"
                    />
                  ) : (
                    <div className={cls.cardPlaceholder}>{emoji}</div>
                  )}
                  {/* Quick Add Overlay Button (Visual only) */}
                  <div className={cls.overlayAdd}>
                    <span>+</span>
                  </div>
                </div>

                {/* Content Area */}
                <div className={cls.cardContent}>
                  <h3 className={cls.cardName} title={item.name}>
                    {item.name}
                  </h3>

                  {item.description && (
                    <p className={cls.cardDesc}>{item.description}</p>
                  )}

                  <div className={cls.cardFooter}>
                    <div className={cls.priceTag}>
                      {formatPrice(price)}
                      {item.byWeight && <span className={cls.unit}> /kg</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
