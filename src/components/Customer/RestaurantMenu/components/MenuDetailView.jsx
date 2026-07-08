import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
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

export const GET_CATEGORIES = gql`
  query GetCategoriesForCustomerMenu($restaurantId: ID!, $timeSlot: TimeSlot!) {
    customerMenuCategories(restaurantId: $restaurantId, timeSlot: $timeSlot) {
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
  { id: "breakfast", label: "Bữa sáng", icon: "🍳" },
  { id: "lunch", label: "Bữa trưa", icon: "☀️" },
  { id: "dinner", label: "Bữa tối", icon: "🌙" },
  { id: "late_night", label: "Ăn đêm", icon: "🦉" },
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
  onBack,
  onOpenFoodDetail,
}) => {
  const [timeSlot, setTimeSlot] = useState("lunch");
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
  const { getPromotionForMenuItem, getPromotionLabel } =
    useActiveMenuPromotions(restaurantId);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setActiveCat("all");
  }, [timeSlot]);

  const {
    data: categoriesData,
    loading: categoriesLoading,
    error: categoriesError,
  } = useQuery(GET_CATEGORIES, {
    variables: { restaurantId, timeSlot },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const categories = useMemo(
    () =>
      [...(categoriesData?.customerMenuCategories || [])]
        .filter((category) => category?.id && category.isActive !== false)
        .sort((left, right) =>
          (left.order || 0) - (right.order || 0) ||
          String(left.name || "").localeCompare(String(right.name || ""), "vi"),
        ),
    [categoriesData?.customerMenuCategories],
  );

  const menuItemFilter = useMemo(
    () => ({
      restaurantId,
      timeSlot,
      ...(activeCat !== "all" ? { categoryId: activeCat } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      sort,
    }),
    [activeCat, debouncedSearch, restaurantId, sort, timeSlot],
  );

  const {
    data: menuData,
    loading: menuLoading,
    error: menuError,
    fetchMore,
    refetch,
  } = useQuery(GET_MENU_ITEMS_FOR_CUSTOMER_MENU, {
    variables: { filter: menuItemFilter, limit: 24, cursor: null },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const rawItems = useMemo(
    () =>
      (menuData?.menuItemsConnection?.edges || [])
        .map((edge) => edge?.node)
        .filter(Boolean),
    [menuData?.menuItemsConnection?.edges],
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
      categoryId: item?.categoryId || null,
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
            <button type="button" onClick={onBack} className="back-btn">
              <span aria-hidden="true">←</span> Quay lại
            </button>

            <div className="restaurant-title-block">
              <p className="restaurant-kicker">Thực đơn theo khung giờ</p>
              <h2>{restaurant?.name || "Thực đơn"}</h2>
              <div className="restaurant-meta">
                {restaurant?.rating ? <span>★ {restaurant.rating}</span> : null}
                <span>{canOrder ? "Đang nhận đơn" : "Đang tạm ngưng nhận đơn"}</span>
                {restaurant?.address ? <span>{restaurant.address}</span> : null}
              </div>
            </div>

            <div className="header-actions">
              <label className="search-box">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  name="menuSearch"
                  autoComplete="off"
                  placeholder="Tìm theo tên hoặc mô tả món…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              <label className="menu-sort-control">
                <span>Sắp xếp</span>
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
                  ⊞
                </button>
                <button
                  type="button"
                  aria-label="Hiển thị dạng danh sách"
                  className={viewMode === "list" ? "active" : ""}
                  aria-pressed={viewMode === "list"}
                  onClick={() => setViewMode("list")}
                >
                  ☰
                </button>
              </div>
            </div>
          </div>

          <nav className="tabs-row" aria-label="Chọn bữa ăn">
            {TIME_SLOTS.map((slot) => (
              <button
                type="button"
                key={slot.id}
                className={`tab ${timeSlot === slot.id ? "active" : ""}`}
                aria-pressed={timeSlot === slot.id}
                onClick={() => setTimeSlot(slot.id)}
              >
                <span aria-hidden="true">{slot.icon}</span>
                {slot.label}
              </button>
            ))}
          </nav>

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

        {!canOrder ? (
          <div className="menu-inline-note" role="status">
            <strong>Bạn vẫn có thể xem chi tiết và chọn món trước.</strong>{" "}
            {getCannotOrderReason(restaurant?.openingStatus)}
          </div>
        ) : null}

        {menuLoading && !rawItems.length ? (
          renderSkeletons()
        ) : menuError ? (
          <div className="menu-state menu-state--error" role="alert">
            <span>!</span>
            <h3>Không thể tải thực đơn</h3>
            <p>Vui lòng kiểm tra kết nối rồi thử lại.</p>
            <button type="button" onClick={() => refetch?.()}>
              Tải lại
            </button>
          </div>
        ) : !visibleItems.length ? (
          <div className="menu-state" role="status">
            <span>🍜</span>
            <h3>
              {debouncedSearch
                ? "Chưa tìm thấy món phù hợp"
                : "Chưa có món trong mục này"}
            </h3>
            <p>
              {debouncedSearch
                ? "Thử từ khóa ngắn hơn, đổi danh mục hoặc khung giờ."
                : "Đổi bữa ăn hoặc danh mục khác để xem thêm món."}
            </p>
          </div>
        ) : (
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
                    disabled={!canOrder}
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
        )}

        {categoriesLoading && !categories.length ? (
          <div className="menu-inline-note" aria-live="polite">
            Đang tải danh mục món...
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default MenuDetailView;
