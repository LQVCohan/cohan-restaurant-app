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
    const toNumberOrNull = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    return (filteredMenu || []).map((it) => {
      const variants = Array.isArray(it._normalizedVariants)
        ? it._normalizedVariants
        : Array.isArray(it.servingVariants)
        ? it.servingVariants
        : [];
      const defaultVariant =
        it._defaultVariant ||
        variants.find((v) => v?.isDefault) ||
        (variants.length === 1 ? variants[0] : null);

      const prices = variants
        .map((v) => toNumberOrNull(v?.price))
        .filter((p) => p !== null && p >= 0);
      const minPrice = prices.length ? Math.min(...prices) : null;
      const maxPrice = prices.length ? Math.max(...prices) : null;

      const computedRange =
        !defaultVariant && minPrice !== null
          ? { min: minPrice, max: maxPrice ?? minPrice }
          : null;

      const displayPrice =
        toNumberOrNull(defaultVariant?.price) ??
        toNumberOrNull(it._displayPrice) ??
        toNumberOrNull(minPrice);

      const priceRange = it._priceRange || computedRange;
      const hasRange =
        !!priceRange && priceRange.min !== priceRange.max && priceRange.min !== null;

      const priceText = hasRange
        ? `${formatPrice(priceRange.min)} - ${formatPrice(priceRange.max)}`
        : displayPrice !== null
        ? formatPrice(displayPrice)
        : "Chưa có giá";

      const isByWeight =
        defaultVariant?.mode === "BY_WEIGHT" ||
        (defaultVariant?.sellUnit && defaultVariant.sellUnit !== "portion");
      const unit = isByWeight
        ? defaultVariant?.sellUnit || "kg"
        : it._displayUnit || "portion";
      const cookingOption = defaultVariant?.name || "";

      return {
        ...it,
        _displayPrice: displayPrice,
        _priceText: priceText,
        _priceRange: priceRange,
        _defaultVariant: defaultVariant,
        _variants: variants,
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

  const toFinitePrice = useCallback((v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }, []);

  const addMenuItemToOrder = useCallback(
    (menuItem, options = {}) => {
      if (!menuItem) return;

      const {
        variant = null,
        quantity = 1,
        unit,
        note = "",
        price,
        proofImages = [],
        cookingOption,
        variantName,
        variantKey,
        servingKey,
      } = options;

      const resolvedPrice =
        toFinitePrice(price) ??
        toFinitePrice(variant?.price) ??
        toFinitePrice(menuItem._displayPrice ?? menuItem.price);

      if (resolvedPrice === null) {
        openModal(menuItem);
        return;
      }

      const chosenUnit =
        unit ||
        (variant?.mode === "BY_WEIGHT"
          ? variant?.sellUnit || "kg"
          : "portion");

      const core = {
        id: menuItem?.id,
        dishId: menuItem?.id,
        menuId: menuItem?.menuId,
        categoryId: menuItem?.categoryId,
        name: menuItem?.name,
        image: menuItem?.thumbImage,
        thumbImage: menuItem?.thumbImage,
        price: resolvedPrice,
        defaultServingKey:
          menuItem?.defaultServingKey ||
          menuItem?._defaultVariant?.key ||
          "",
      };

      addToOrder?.({
        menuItem: core,
        cookingOption: cookingOption || variant?.name || variantName || "",
        variantName: variantName || cookingOption || variant?.name || "",
        variantKey: variantKey || variant?.key || "",
        servingKey: servingKey || variant?.key || core.defaultServingKey,
        unit: chosenUnit,
        note,
        quantity,
        price: resolvedPrice,
        proofImages: proofImages || [],
      });
    },
    [addToOrder, openModal, toFinitePrice]
  );

  const handleModalAdd = useCallback(
    (payload) => {
    const {
      menuItem,
      quantity = 1,
      cookingOption,
      variantName,
      variantKey,
      servingKey,
      unit,
      note,
      price,
      proofImages,
      variant,
    } = payload || {};

    addMenuItemToOrder(menuItem, {
      variant: variant || null,
      variantName: variantName || cookingOption,
      variantKey,
      servingKey,
      unit,
      note,
      quantity,
      price,
      proofImages: proofImages || [],
        cookingOption,
      });
      closeModal();
    },
    [addMenuItemToOrder, closeModal]
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
            const priceLabel =
              item._priceText ||
              (item._displayPrice !== null && item._displayPrice !== undefined
                ? formatPrice(item._displayPrice)
                : "Chưa có giá");
            const weightUnit =
              item._priceRange || !item._unit
                ? null
                : ["kg", "g"].includes(String(item._unit).toLowerCase())
                ? String(item._unit).toLowerCase()
                : null;
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
                  {/* Quick Add Overlay Button */}
                  <div
                    className={cls.overlayAdd}
                    onClick={(e) => {
                      e.stopPropagation();
                      const variant =
                        item._defaultVariant ||
                        (Array.isArray(item._variants) &&
                        item._variants.length === 1
                          ? item._variants[0]
                          : null);

                    if (!variant && item._priceRange) {
                      openModal(item);
                      return;
                      }

                      addMenuItemToOrder(item, { variant });
                    }}
                    role="button"
                    tabIndex={-1}
                  >
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
                      {priceLabel}
                      {weightUnit && (
                        <span className={cls.unit}> /{weightUnit}</span>
                      )}
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
