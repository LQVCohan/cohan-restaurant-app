// src/components/Dashboard_Manager/POS/components/panels/CenterPanel.jsx
import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { gql, useLazyQuery, useQuery } from "@apollo/client";
import cls from "./CenterPanel.module.scss";
import { usePos } from "../../../../../context/PosContext";
import { formatPrice } from "../../utils/format";
import MenuItemModal from "../modals/MenuItemModal";
import { useActiveMenuPromotions } from "@/hooks/useActiveMenuPromotions";
import { MENU_AVAILABILITY_SOCKET_EVENT } from "@/hooks/useSocketOrder";
import {
  buildPosCategoryTabs,
  filterPosMenuByCategory,
  hasPosCategory,
  POS_ALL_CATEGORY_KEY,
} from "./posMenuCategoryUtils";

const SEARCH_SUGGESTIONS = gql`
  query PosSearchSuggestions($query: String!, $timeSlot: TimeSlot) {
    searchSuggestions(query: $query, timeSlot: $timeSlot, limitPerType: 6) {
      menuItems {
        id
        name
        timeSlot
        thumbImage
        basePrice
      }
    }
  }
`;

const POS_MENU_CATEGORIES = gql`
  query PosMenuCategories($restaurantId: ID!, $timeSlot: TimeSlot!) {
    categories(restaurantId: $restaurantId, timeSlot: $timeSlot) {
      id
      name
      order
      isActive
      menuItemCount
    }
  }
`;

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

function getMenuItemIdFromAvailabilityEvent(evt) {
  return evt?.menuItemId || evt?.menuId || evt?.dishId || null;
}

export default function CenterPanel() {
  const {
    restaurantId,
    filteredMenu,
    setSearchTerm,
    addToOrder,
    timeSlotOptions,
    selectedTimeSlot,
    setSelectedTimeSlot,
  } = usePos();

  const [searchValue, setSearchValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [availabilityOverrides, setAvailabilityOverrides] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(
    POS_ALL_CATEGORY_KEY,
  );
  const hideTimerRef = useRef(null);
  const suggestionRequestRef = useRef(0);

  useEffect(() => {
    const handleAvailabilityEvent = (event) => {
      const evt = event?.detail?.event;
      if (!evt?.type) return;
      if (
        evt.restaurantId &&
        restaurantId &&
        String(evt.restaurantId) !== String(restaurantId)
      ) {
        return;
      }
      const menuItemId = getMenuItemIdFromAvailabilityEvent(evt);
      if (!menuItemId) return;

      if (evt.type === "MENU_ITEM_OUT_OF_STOCK") {
        setAvailabilityOverrides((prev) => ({
          ...prev,
          [String(menuItemId)]: {
            status: "out_of_stock",
            reason: evt.reason || "reserve_failed",
            updatedAt: Date.now(),
          },
        }));
      }

      if (evt.type === "MENU_ITEM_AVAILABLE_AGAIN") {
        setAvailabilityOverrides((prev) => ({
          ...prev,
          [String(menuItemId)]: {
            status: "available",
            reason: evt.source || "available_again",
            updatedAt: Date.now(),
          },
        }));
      }
    };

    window.addEventListener(
      MENU_AVAILABILITY_SOCKET_EVENT,
      handleAvailabilityEvent,
    );
    return () =>
      window.removeEventListener(
        MENU_AVAILABILITY_SOCKET_EVENT,
        handleAvailabilityEvent,
      );
  }, [restaurantId]);

  const recentKey = useMemo(
    () => `pos_recent_searches_${restaurantId || "na"}`,
    [restaurantId],
  );

  const [loadSuggestions, { error: suggestionsError }] = useLazyQuery(
    SEARCH_SUGGESTIONS,
    { fetchPolicy: "network-only" },
  );

  const {
    data: menuCategoriesData,
    error: menuCategoriesError,
  } = useQuery(POS_MENU_CATEGORIES, {
    variables: {
      restaurantId,
      timeSlot: selectedTimeSlot,
    },
    skip: !restaurantId || !selectedTimeSlot,
    fetchPolicy: "cache-and-network",
    errorPolicy: "all",
  });

  useEffect(() => {
    if (!recentKey) return;
    try {
      const raw = localStorage.getItem(recentKey);
      const parsed = JSON.parse(raw || "[]");
      if (Array.isArray(parsed)) setRecentSearches(parsed);
    } catch {
      setRecentSearches([]);
    }
  }, [recentKey]);

  useEffect(() => {
    if (suggestionsError) {
      console.error("POS searchSuggestions error:", suggestionsError);
    }
  }, [suggestionsError]);

  useEffect(() => {
    if (menuCategoriesError) {
      console.error("POS menu categories error:", menuCategoriesError);
    }
  }, [menuCategoriesError]);

  useEffect(() => {
    const query = searchValue.trim();
    if (!query) {
      suggestionRequestRef.current += 1;
      setSuggestions([]);
      return;
    }
    const requestId = suggestionRequestRef.current + 1;
    suggestionRequestRef.current = requestId;
    const timer = setTimeout(async () => {
      try {
        const { data } = await loadSuggestions({
          variables: {
            query,
            timeSlot: selectedTimeSlot || null,
          },
        });
        if (requestId !== suggestionRequestRef.current) return;
        const items = data?.searchSuggestions?.menuItems || [];
        setSuggestions(items);
      } catch (error) {
        if (requestId !== suggestionRequestRef.current) return;
        console.error("POS searchSuggestions error:", error);
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchValue, selectedTimeSlot, loadSuggestions]);

  const categoryTabs = useMemo(
    () => buildPosCategoryTabs(menuCategoriesData?.categories || []),
    [menuCategoriesData],
  );

  useEffect(() => {
    setSelectedCategory(POS_ALL_CATEGORY_KEY);
  }, [restaurantId, selectedTimeSlot]);

  useEffect(() => {
    if (!hasPosCategory(categoryTabs, selectedCategory)) {
      setSelectedCategory(POS_ALL_CATEGORY_KEY);
    }
  }, [categoryTabs, selectedCategory]);

  const menuBySelectedCategory = useMemo(
    () => filterPosMenuByCategory(filteredMenu, selectedCategory),
    [filteredMenu, selectedCategory],
  );

  const onSelectCategory = (categoryKey) =>
    setSelectedCategory(String(categoryKey || POS_ALL_CATEGORY_KEY));
  const { getPromotionForMenuItem, getPromotionLabel } =
    useActiveMenuPromotions(restaurantId);
  const withDisplay = useMemo(() => {
    const toNumberOrNull = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    return (menuBySelectedCategory || []).map((it) => {
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
        !!priceRange &&
        priceRange.min !== priceRange.max &&
        priceRange.min !== null;

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
      const activePromotion = getPromotionForMenuItem(it);
      const promotionLabel = getPromotionLabel(activePromotion);
      const availabilityOverride =
        availabilityOverrides[String(it.id)] || null;
      const baseStatus = String(
        it.status || it.availabilityStatus || "",
      ).toLowerCase();
      const isOutOfStock =
        availabilityOverride?.status === "out_of_stock" ||
        (!availabilityOverride &&
          ["out_of_stock", "unavailable", "sold_out"].includes(baseStatus));
      return {
        ...it,
        _displayPrice: displayPrice,
        _priceText: priceText,
        _priceRange: priceRange,
        _defaultVariant: defaultVariant,
        _variants: variants,
        _unit: unit,
        _defaultCooking: cookingOption,
        _promotion: activePromotion,
        _promotionLabel: promotionLabel,
        _availabilityOverride: availabilityOverride,
        _isOutOfStock: isOutOfStock,
      };
    });
  }, [
    menuBySelectedCategory,
    getPromotionForMenuItem,
    getPromotionLabel,
    availabilityOverrides,
  ]);

  // Modal logic
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const openModal = useCallback((item) => {
    if (item?._isOutOfStock) return;
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
      if (!menuItem || menuItem?._isOutOfStock) return;

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
          menuItem?.defaultServingKey || menuItem?._defaultVariant?.key || "",
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
    [addToOrder, openModal, toFinitePrice],
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
    [addMenuItemToOrder, closeModal],
  );

  const persistRecentSearch = useCallback(
    (value) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      setRecentSearches((prev) => {
        const next = [trimmed, ...(prev || []).filter((v) => v !== trimmed)];
        const capped = next.slice(0, 6);
        try {
          localStorage.setItem(recentKey, JSON.stringify(capped));
        } catch {}
        return capped;
      });
    },
    [recentKey],
  );

  const handleSearchChange = useCallback(
    (e) => {
      const value = e.target.value;
      setSearchValue(value);
      setSearchTerm?.(value);
      if (!showSuggestions) setShowSuggestions(true);
    },
    [setSearchTerm, showSuggestions],
  );

  const handleSearchBlur = useCallback(() => {
    hideTimerRef.current = setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  }, []);

  const handleSearchFocus = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setShowSuggestions(true);
  }, []);

  const handleSuggestionPick = useCallback(
    (value) => {
      setSearchValue(value);
      setSearchTerm?.(value);
      persistRecentSearch(value);
      setShowSuggestions(false);
    },
    [persistRecentSearch, setSearchTerm],
  );

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

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
              value={searchValue}
              onChange={handleSearchChange}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  persistRecentSearch(searchValue);
                  setShowSuggestions(false);
                }
              }}
            />
            {showSuggestions &&
              (recentSearches.length > 0 || suggestions.length > 0) && (
                <div className={cls.searchDropdown}>
                  {suggestions.length > 0 && (
                    <div className={cls.searchSection}>
                      <div className={cls.searchSectionTitle}>Gợi ý</div>
                      {suggestions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={cls.searchItem}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSuggestionPick(item.name)}
                        >
                          {item.thumbImage ? (
                            <img
                              src={item.thumbImage}
                              alt={item.name}
                              className={cls.searchThumb}
                            />
                          ) : (
                            <span className={cls.searchEmoji}>🍽️</span>
                          )}
                          <div className={cls.searchText}>
                            <span className={cls.searchName}>{item.name}</span>
                            {typeof item.basePrice === "number" && (
                              <span className={cls.searchMeta}>
                                {formatPrice(item.basePrice)}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {recentSearches.length > 0 && (
                    <div className={cls.searchSection}>
                      <div className={cls.searchSectionTitle}>Gần đây</div>
                      {recentSearches.map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={cls.searchItem}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSuggestionPick(value)}
                        >
                          <span className={cls.searchEmoji}>🕘</span>
                          <div className={cls.searchText}>
                            <span className={cls.searchName}>{value}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      </div>

      {/* TABS AREA */}
      <div className={cls.tabsScroll}>
        <div className={cls.tabs}>
          {categoryTabs.map((category) => (
            <button
              key={category.key}
              type="button"
              className={`${cls.tab} ${
                selectedCategory === category.key ? cls.tabActive : ""
              }`}
              onClick={() => onSelectCategory(category.key)}
            >
              {category.label}
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
            const isOutOfStock = Boolean(item._isOutOfStock);

            return (
              <div
                key={item.id}
                className={`${cls.card} ${
                  isOutOfStock ? cls.cardOutOfStock : ""
                }`}
                data-menu-id={item.id}
                onClick={() => openModal(item)}
                role="button"
                tabIndex={isOutOfStock ? -1 : 0}
                aria-disabled={isOutOfStock}
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
                  {isOutOfStock && (
                    <div className={cls.stockBadge}>Hết món</div>
                  )}
                  {!isOutOfStock &&
                    item._availabilityOverride?.status === "available" && (
                      <div className={cls.availableBadge}>Có lại</div>
                    )}
                  {item._promotionLabel && !isOutOfStock && (
                    <div
                      className={cls.promoBadge}
                      title={item._promotion?.name || "Ưu đãi"}
                    >
                      {item._promotionLabel}
                    </div>
                  )}
                  {/* Quick Add Overlay Button */}
                  {!isOutOfStock && (
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
                      title="Thêm nhanh"
                    >
                      <span>+</span>
                    </div>
                  )}
                </div>

                {/* Content Area */}
                <div className={cls.cardContent}>
                  <h3 className={cls.cardName} title={item.name}>
                    {item.name}
                  </h3>
                  {item._promotion?.name && !isOutOfStock && (
                    <div className={cls.promoName}>{item._promotion.name}</div>
                  )}
                  {item.description && (
                    <p className={cls.cardDesc}>{item.description}</p>
                  )}
                  {isOutOfStock && (
                    <div className={cls.stockHint}>
                      Có thể đăng ký nhắc từ banner phía trên khi khách vẫn muốn
                      món này.
                    </div>
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
