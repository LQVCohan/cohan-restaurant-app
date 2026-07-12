import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  LayoutGrid,
  List,
  MapPin,
  Moon,
  RotateCcw,
  Search,
  ShoppingBag,
  Star,
  Sun,
  Sunrise,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { AuthContext } from "../../../../context/AuthContext";
import useFoodPreferences from "../../../../hooks/useFoodPreferences";
import { useActiveMenuPromotions } from "../../../../hooks/useActiveMenuPromotions";
import {
  analyzeMenuItemForFoodPreferences,
  hasMeaningfulFoodPreferences,
  sortMenuItemsByFoodPreference,
} from "../../../../utils/foodPreferenceMatcher";
import {
  buildFoodDetailPath,
  buildFoodDetailState,
} from "../../../../utils/customerFoodNavigation";
import { getCannotOrderReason } from "../../../../utils/restaurantStatus";
import { shouldShowMenuItemToCustomer } from "../../../../utils/menuItemAvailability";
import MenuItemCard from "./MenuItemCard";
import "../styles/MenuDetailView.scss";
import "../styles/MenuNamedSelector.scss";

export const GET_CUSTOMER_MENUS = gql`
  query GetCustomerMenusForMenuDetail($restaurantId: ID!) {
    customerMenus(restaurantId: $restaurantId) {
      id
      restaurantId
      timeSlot
      name
      description
      coverImage
      isActive
    }
  }
`;

export const GET_CATEGORIES = gql`
  query GetCategoriesForCustomerMenu(
    $restaurantId: ID!
    $timeSlot: TimeSlot!
    $menuId: ID
  ) {
    customerMenuCategories(
      restaurantId: $restaurantId
      timeSlot: $timeSlot
      menuId: $menuId
    ) {
      id
      name
      order
      isActive
    }
  }
`;

export const GET_MENU_ITEMS_FOR_CUSTOMER_MENU = gql`
  query GetMenuItemsForCustomerMenu(
    $filter: MenuItemFilter!
    $limit: Int = 24
    $cursor: ID
  ) {
    menuItemsConnection(limit: $limit, cursor: $cursor, filter: $filter) {
      pageInfo {
        endCursor
        hasNextPage
      }
      edges {
        cursor
        node {
          id
          restaurantId
          menuId
          categoryId
          name
          description
          basePrice
          defaultServingKey
          hasByWeightVariant
          thumbImage
          status
          avgPrepTimeMin
          inventoryStatus
          maxAvailable
          stockWarnings
          labels
          foodType
          meatTypes
          dietTags
          allergenTags
          tasteProfile {
            containsOnion
            containsCilantro
            sugar
            spice
          }
          rate
          orderCounter
          servingVariants {
            key
            mode
            sellQty
            sellUnit
            name
            price
            isDefault
          }
        }
      }
    }
  }
`;

const TIME_SLOTS = [
  { id: "breakfast", label: "Bữa sáng", icon: Sunrise },
  { id: "lunch", label: "Bữa trưa", icon: Sun },
  { id: "dinner", label: "Bữa tối", icon: UtensilsCrossed },
  { id: "late_night", label: "Ăn đêm", icon: Moon },
];

const SORT_OPTIONS = [
  { value: "default", label: "Mặc định" },
  { value: "name_asc", label: "Tên A–Z" },
  { value: "price_asc", label: "Giá thấp đến cao" },
  { value: "price_desc", label: "Giá cao đến thấp" },
];

const MenuDetailView = ({
  restaurant,
  canOrder = true,
  initialTimeSlot = null,
  initialMenuId = null,
  lockedTimeSlot = null,
  serviceAt = null,
  onBack,
  onOpenFoodDetail,
  onMenuSelectionChange,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeMenuId = useMemo(
    () => new URLSearchParams(location.search).get("menuId"),
    [location.search],
  );
  const preferredMenuId = initialMenuId || routeMenuId || null;
  const [timeSlot, setTimeSlot] = useState(initialTimeSlot || "lunch");
  const [selectedMenuId, setSelectedMenuId] = useState(preferredMenuId);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState("default");
  const [viewMode, setViewMode] = useState("grid");
  const [prioritizeFoodPreferences, setPrioritizeFoodPreferences] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");

  const { isAuthenticated } = useContext(AuthContext);
  const { preferences } = useFoodPreferences({ skip: !isAuthenticated });
  const hasFoodPreferences = hasMeaningfulFoodPreferences(preferences);
  const restaurantId = restaurant?.id || restaurant?._id || "";
  const activeSlot = TIME_SLOTS.find((slot) => slot.id === timeSlot);
  const bookingSlot = TIME_SLOTS.find((slot) => slot.id === lockedTimeSlot);
  const matchesBookingTimeSlot =
    !lockedTimeSlot || timeSlot === lockedTimeSlot;
  const canOrderSelectedSlot = canOrder && matchesBookingTimeSlot;
  const { getPromotionForMenuItem, getPromotionLabel } =
    useActiveMenuPromotions(restaurantId);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (initialTimeSlot) setTimeSlot(initialTimeSlot);
  }, [initialTimeSlot]);

  useEffect(() => {
    if (preferredMenuId) setSelectedMenuId(preferredMenuId);
  }, [preferredMenuId]);

  const {
    data: menusData,
    loading: menusLoading,
    error: menusError,
    refetch: refetchMenus,
  } = useQuery(GET_CUSTOMER_MENUS, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const menus = useMemo(
    () =>
      (menusData?.customerMenus || []).filter(
        (menu) => menu?.id && menu.isActive !== false,
      ),
    [menusData?.customerMenus],
  );

  const menusBySlot = useMemo(() => {
    const grouped = new Map(TIME_SLOTS.map((slot) => [slot.id, []]));
    for (const menu of menus) {
      if (grouped.has(menu.timeSlot)) grouped.get(menu.timeSlot).push(menu);
    }
    return grouped;
  }, [menus]);

  const slotMenus = menusBySlot.get(timeSlot) || [];
  const selectedMenu =
    slotMenus.find((menu) => String(menu.id) === String(selectedMenuId)) || null;

  useEffect(() => {
    if (menusLoading || menusError || !menus.length || slotMenus.length) return;
    if (lockedTimeSlot) return;
    const fallbackSlot = TIME_SLOTS.find(
      (slot) => (menusBySlot.get(slot.id) || []).length > 0,
    );
    if (fallbackSlot && fallbackSlot.id !== timeSlot) {
      setTimeSlot(fallbackSlot.id);
      setSelectedMenuId(null);
    }
  }, [lockedTimeSlot, menus, menusBySlot, menusError, menusLoading, slotMenus.length, timeSlot]);

  useEffect(() => {
    if (!slotMenus.length) {
      if (selectedMenuId) setSelectedMenuId(null);
      return;
    }

    const current = slotMenus.find(
      (menu) => String(menu.id) === String(selectedMenuId),
    );
    const requested = slotMenus.find(
      (menu) => String(menu.id) === String(preferredMenuId),
    );
    const nextMenu = current || requested || slotMenus[0];
    if (String(nextMenu.id) !== String(selectedMenuId)) {
      setSelectedMenuId(nextMenu.id);
    }
  }, [preferredMenuId, selectedMenuId, slotMenus]);

  useEffect(() => {
    setActiveCat("all");
    setLoadMoreError("");
  }, [timeSlot, selectedMenuId]);

  useEffect(() => {
    if (!selectedMenu?.id) return;

    const params = new URLSearchParams(location.search);
    params.set("restaurantId", String(restaurantId));
    params.set("timeSlot", String(timeSlot));
    params.set("menuId", String(selectedMenu.id));
    const nextSearch = params.toString();
    if (nextSearch !== location.search.replace(/^\?/, "")) {
      navigate(
        { pathname: location.pathname, search: `?${nextSearch}` },
        { replace: true, state: location.state },
      );
    }

    onMenuSelectionChange?.({
      restaurantId,
      timeSlot,
      menuId: selectedMenu.id,
      menu: selectedMenu,
    });
  }, [
    location.pathname,
    location.search,
    location.state,
    navigate,
    onMenuSelectionChange,
    restaurantId,
    selectedMenu,
    timeSlot,
  ]);

  const {
    data: categoriesData,
    loading: categoriesLoading,
    error: categoriesError,
  } = useQuery(GET_CATEGORIES, {
    variables: { restaurantId, timeSlot, menuId: selectedMenuId },
    skip: !restaurantId || !selectedMenuId,
    fetchPolicy: "cache-and-network",
  });

  const categories = useMemo(
    () =>
      [...(categoriesData?.customerMenuCategories || [])]
        .filter((category) => category?.id && category.isActive !== false)
        .sort(
          (left, right) =>
            (left.order || 0) - (right.order || 0) ||
            String(left.name || "").localeCompare(String(right.name || ""), "vi"),
        ),
    [categoriesData?.customerMenuCategories],
  );

  const activeCategory = categories.find(
    (category) => String(category.id) === String(activeCat),
  );

  const menuItemFilter = useMemo(
    () => ({
      restaurantId,
      timeSlot,
      menuId: selectedMenuId,
      ...(activeCat !== "all" ? { categoryId: activeCat } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      sort,
    }),
    [activeCat, debouncedSearch, restaurantId, selectedMenuId, sort, timeSlot],
  );

  const {
    data: menuData,
    loading: menuLoading,
    error: menuError,
    fetchMore,
    refetch,
  } = useQuery(GET_MENU_ITEMS_FOR_CUSTOMER_MENU, {
    variables: { filter: menuItemFilter, limit: 24, cursor: null },
    skip: !restaurantId || !selectedMenuId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const rawItems = useMemo(
    () =>
      (menuData?.menuItemsConnection?.edges || [])
        .map((edge) => edge?.node)
        .filter(
          (item) =>
            item && String(item.menuId) === String(selectedMenuId || ""),
        ),
    [menuData?.menuItemsConnection?.edges, selectedMenuId],
  );
  const pageInfo = menuData?.menuItemsConnection?.pageInfo;

  const visibleItems = useMemo(() => {
    const withMetadata = rawItems
      .filter(shouldShowMenuItemToCustomer)
      .map((item) => {
        const promotion = getPromotionForMenuItem(item);
        return {
          ...item,
          promotion,
          promotionLabel: getPromotionLabel(promotion),
          foodPreferenceMeta:
            isAuthenticated && hasFoodPreferences
              ? analyzeMenuItemForFoodPreferences(item, preferences)
              : null,
        };
      });

    if (
      sort !== "default" ||
      !isAuthenticated ||
      !hasFoodPreferences ||
      !prioritizeFoodPreferences
    ) {
      return withMetadata;
    }
    return sortMenuItemsByFoodPreference(withMetadata, preferences);
  }, [
    getPromotionForMenuItem,
    getPromotionLabel,
    hasFoodPreferences,
    isAuthenticated,
    preferences,
    prioritizeFoodPreferences,
    rawItems,
    sort,
  ]);

  const hasActiveFilters =
    Boolean(search.trim()) || activeCat !== "all" || sort !== "default";

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setActiveCat("all");
    setSort("default");
  };

  const handleTimeSlotChange = (slotId) => {
    if (!menusLoading && !(menusBySlot.get(slotId) || []).length) return;
    setTimeSlot(slotId);
    setSelectedMenuId(null);
  };

  const handleMenuChange = (menuId) => {
    setSelectedMenuId(menuId);
    setActiveCat("all");
    setLoadMoreError("");
  };

  const handleBack = () => {
    if (!lockedTimeSlot && !serviceAt) navigate("/cus-menu");
    onBack?.();
  };

  const handleLoadMore = async () => {
    if (!pageInfo?.hasNextPage || !pageInfo?.endCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadMoreError("");
    try {
      await fetchMore({
        variables: {
          filter: menuItemFilter,
          limit: 24,
          cursor: pageInfo.endCursor,
        },
        updateQuery: (previous, { fetchMoreResult }) => {
          const nextConnection = fetchMoreResult?.menuItemsConnection;
          if (!nextConnection) return previous;
          const previousEdges = previous?.menuItemsConnection?.edges || [];
          const seen = new Set(
            previousEdges.map((edge) => edge?.node?.id).filter(Boolean),
          );
          return {
            menuItemsConnection: {
              ...nextConnection,
              edges: [
                ...previousEdges,
                ...(nextConnection.edges || []).filter(
                  (edge) => !seen.has(edge?.node?.id),
                ),
              ],
            },
          };
        },
      });
    } catch {
      setLoadMoreError("Không thể tải thêm món. Vui lòng thử lại.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const getDetailNavigation = (item) => {
    const state = buildFoodDetailState(item, {
      restaurantId: item?.restaurantId || restaurantId,
      timeSlot,
      menuId: selectedMenuId,
      categoryId: item?.categoryId || null,
      serviceAt,
      selectedVariantKey:
        item?.defaultServingKey ||
        item?.servingVariants?.find((variant) => variant?.isDefault)?.key ||
        item?.servingVariants?.[0]?.key ||
        null,
    });
    return { state, to: buildFoodDetailPath(item?.id, state) };
  };

  const openDetail = (item) => {
    const navigation = getDetailNavigation(item);
    onOpenFoodDetail?.(item?.id, navigation.state);
  };

  const renderSkeletons = () => (
    <div
      className={`menu-grid ${viewMode === "list" ? "list-view" : ""}`}
      aria-hidden="true"
    >
      {Array.from({ length: 8 }).map((_, index) => (
        <article className="menu-item-skeleton" key={index}>
          <div className="skeleton-thumb" />
          <div className="skeleton-content">
            <span />
            <span />
            <span />
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <div className="menu-detail-view fade-in">
      <header className="menu-header">
        <div className="header-content">
          <div className="top-row">
            <button type="button" onClick={handleBack} className="back-btn">
              <ArrowLeft size={18} aria-hidden="true" />
              Quay lại
            </button>

            <div className="restaurant-title-block">
              <p className="restaurant-kicker">Thực đơn theo khung giờ</p>
              <h2>{restaurant?.name || "Thực đơn"}</h2>
              <div className="restaurant-meta">
                {restaurant?.rating ? (
                  <span>
                    <Star size={14} aria-hidden="true" /> {restaurant.rating}
                  </span>
                ) : null}
                <span>
                  <ShoppingBag size={14} aria-hidden="true" />
                  {canOrder ? "Đang nhận đơn" : "Đang tạm ngưng nhận đơn"}
                </span>
                {restaurant?.address ? (
                  <span>
                    <MapPin size={14} aria-hidden="true" /> {restaurant.address}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="header-actions">
              <div className="search-box" role="search">
                <Search size={19} aria-hidden="true" />
                <input
                  type="search"
                  name="menuSearch"
                  autoComplete="off"
                  aria-label="Tìm món theo tên hoặc mô tả"
                  placeholder="Tìm theo tên hoặc mô tả món…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search ? (
                  <button
                    type="button"
                    className="search-box__clear"
                    onClick={() => {
                      setSearch("");
                      setDebouncedSearch("");
                    }}
                    aria-label="Xóa từ khóa tìm món"
                  >
                    <X size={17} aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <label className="menu-sort-control">
                <span className="menu-sort-control__label">Sắp xếp</span>
                <select
                  name="menuSort"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="view-toggle" aria-label="Chọn kiểu hiển thị món">
                <button
                  type="button"
                  aria-label="Hiển thị dạng lưới"
                  className={viewMode === "grid" ? "active" : ""}
                  aria-pressed={viewMode === "grid"}
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid size={19} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Hiển thị dạng danh sách"
                  className={viewMode === "list" ? "active" : ""}
                  aria-pressed={viewMode === "list"}
                  onClick={() => setViewMode("list")}
                >
                  <List size={20} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <nav className="tabs-row" aria-label="Chọn bữa ăn">
            {TIME_SLOTS.map((slot) => {
              const SlotIcon = slot.icon;
              const hasMenus = (menusBySlot.get(slot.id) || []).length > 0;
              const disabled = !menusLoading && !hasMenus;
              return (
                <button
                  type="button"
                  key={slot.id}
                  className={`tab ${timeSlot === slot.id ? "active" : ""}`}
                  aria-pressed={timeSlot === slot.id}
                  disabled={disabled}
                  title={disabled ? `${slot.label} chưa có thực đơn` : undefined}
                  onClick={() => handleTimeSlotChange(slot.id)}
                >
                  <SlotIcon size={18} aria-hidden="true" />
                  {slot.label}
                  {!menusLoading && hasMenus ? (
                    <small>{menusBySlot.get(slot.id).length}</small>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <section className="named-menu-selector" aria-labelledby="named-menu-title">
            <div className="named-menu-selector__heading">
              <div>
                <span>Bước 2</span>
                <h3 id="named-menu-title">Chọn thực đơn</h3>
              </div>
              {slotMenus.length ? (
                <small>
                  {slotMenus.length} lựa chọn cho {activeSlot?.label?.toLowerCase()}
                </small>
              ) : null}
            </div>

            {menusLoading && !menus.length ? (
              <div className="named-menu-selector__loading" aria-label="Đang tải thực đơn">
                <span />
                <span />
              </div>
            ) : menusError ? (
              <div className="named-menu-selector__error" role="alert">
                <div>
                  <CircleAlert size={18} aria-hidden="true" />
                  <span>Không thể tải danh sách thực đơn.</span>
                </div>
                <button type="button" onClick={() => refetchMenus?.()}>
                  Tải lại
                </button>
              </div>
            ) : slotMenus.length ? (
              <div className="named-menu-selector__list">
                {slotMenus.map((menu) => {
                  const active = String(menu.id) === String(selectedMenuId);
                  return (
                    <button
                      type="button"
                      key={menu.id}
                      className={active ? "active" : ""}
                      aria-pressed={active}
                      onClick={() => handleMenuChange(menu.id)}
                    >
                      <span className="named-menu-selector__check" aria-hidden="true">
                        {active ? <Check size={16} /> : null}
                      </span>
                      <span className="named-menu-selector__copy">
                        <strong>{menu.name || "Thực đơn"}</strong>
                        <small>{menu.description || "Xem các món thuộc thực đơn này"}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="named-menu-selector__empty" role="status">
                <UtensilsCrossed size={20} aria-hidden="true" />
                <div>
                  <strong>Chưa có thực đơn cho {activeSlot?.label?.toLowerCase()}</strong>
                  <span>Hãy chọn một khung giờ khác đang có thực đơn.</span>
                </div>
              </div>
            )}
          </section>

          {isAuthenticated && hasFoodPreferences ? (
            <label className="food-preference-toggle">
              <input
                type="checkbox"
                checked={prioritizeFoodPreferences}
                onChange={(event) =>
                  setPrioritizeFoodPreferences(event.target.checked)
                }
              />
              <span>Ưu tiên món phù hợp khẩu vị của tôi</span>
            </label>
          ) : null}
        </div>
      </header>

      <section className="grid-container menu-detail-container">
        {selectedMenu ? (
          <nav className="category-filter" aria-label="Danh mục món ăn">
            <div className="pills">
              {categoriesError ? (
                <div className="category-warning" role="status">
                  Không tải được danh mục. Đang hiển thị tất cả món.
                </div>
              ) : null}
              <button
                type="button"
                className={activeCat === "all" ? "active" : ""}
                onClick={() => setActiveCat("all")}
              >
                Tất cả
              </button>
              {categories.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  className={activeCat === category.id ? "active" : ""}
                  onClick={() => setActiveCat(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </nav>
        ) : null}

        {selectedMenu ? (
          <div className="menu-results-context" aria-live="polite">
            <div className="menu-results-context__copy">
              <span>
                {activeSlot?.label || "Thực đơn"} · {selectedMenu.name}
              </span>
              <strong>
                {menuLoading
                  ? "Đang cập nhật…"
                  : `Đang hiển thị ${visibleItems.length} món`}
              </strong>
              <small>{activeCategory?.name || "Tất cả danh mục"}</small>
            </div>
            {hasActiveFilters ? (
              <button type="button" onClick={resetFilters}>
                <RotateCcw size={16} aria-hidden="true" />
                Đặt lại bộ lọc
              </button>
            ) : null}
          </div>
        ) : null}

        {!matchesBookingTimeSlot ? (
          <div className="menu-inline-note" role="alert">
            <strong>Món không thuộc khung giờ đặt bàn.</strong>{" "}
            Lịch của bạn dùng thực đơn {bookingSlot?.label || lockedTimeSlot}.
          </div>
        ) : !canOrder ? (
          <div className="menu-inline-note" role="status">
            <strong>Bạn vẫn có thể xem chi tiết và chọn món trước.</strong>{" "}
            {getCannotOrderReason(restaurant?.openingStatus)}
          </div>
        ) : null}

        {!selectedMenu && !menusLoading && !menusError ? (
          <div className="menu-state" role="status">
            <span>
              <UtensilsCrossed size={22} aria-hidden="true" />
            </span>
            <h3>Chưa có thực đơn trong khung giờ này</h3>
            <p>Chọn một bữa ăn khác để xem các thực đơn đang phục vụ.</p>
          </div>
        ) : menuLoading && !rawItems.length ? (
          renderSkeletons()
        ) : menuError ? (
          <div className="menu-state menu-state--error" role="alert">
            <span>
              <CircleAlert size={22} aria-hidden="true" />
            </span>
            <h3>Không thể tải món của {selectedMenu?.name || "thực đơn"}</h3>
            <p>Vui lòng kiểm tra kết nối rồi thử lại.</p>
            <button type="button" onClick={() => refetch?.()}>
              Tải lại
            </button>
          </div>
        ) : selectedMenu && !visibleItems.length ? (
          <div className="menu-state" role="status">
            <span>
              {debouncedSearch ? (
                <Search size={22} aria-hidden="true" />
              ) : (
                <UtensilsCrossed size={22} aria-hidden="true" />
              )}
            </span>
            <h3>
              {debouncedSearch
                ? "Chưa tìm thấy món phù hợp"
                : activeCat !== "all"
                  ? "Chưa có món trong danh mục này"
                  : `${selectedMenu.name} chưa có món để hiển thị`}
            </h3>
            <p>
              {debouncedSearch
                ? "Thử từ khóa ngắn hơn hoặc đổi danh mục."
                : activeCat !== "all"
                  ? "Chọn danh mục khác hoặc xem tất cả món."
                  : "Chọn một thực đơn khác trong cùng khung giờ."}
            </p>
            {hasActiveFilters ? (
              <button type="button" onClick={resetFilters}>
                Đặt lại bộ lọc
              </button>
            ) : null}
          </div>
        ) : selectedMenu ? (
          <>
            <div
              className={`menu-grid ${viewMode === "list" ? "list-view" : ""}`}
              aria-live="polite"
            >
              {visibleItems.map((item) => {
                const navigation = getDetailNavigation(item);
                return (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    to={navigation.to}
                    state={navigation.state}
                    disabled={!canOrderSelectedSlot}
                    onClick={openDetail}
                  />
                );
              })}
            </div>

            {loadMoreError ? (
              <div className="menu-inline-error" role="alert">
                {loadMoreError}
              </div>
            ) : null}

            {pageInfo?.hasNextPage ? (
              <div className="menu-load-more-wrap">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  aria-busy={isLoadingMore}
                >
                  {isLoadingMore ? "Đang tải thêm…" : "Xem thêm món"}
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {selectedMenu && categoriesLoading && !categories.length ? (
          <div className="menu-inline-note" aria-live="polite">
            Đang tải danh mục của {selectedMenu.name}...
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default MenuDetailView;
