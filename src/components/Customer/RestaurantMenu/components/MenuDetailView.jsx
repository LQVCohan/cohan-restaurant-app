import React, { useState, useMemo, useEffect, useContext } from "react";
import { gql, useQuery } from "@apollo/client";
import MenuItemCard from "./MenuItemCard";
import { useActiveMenuPromotions } from "../../../../hooks/useActiveMenuPromotions";
import { shouldShowMenuItemToCustomer } from "../../../../utils/menuItemAvailability";
import { AuthContext } from "../../../../context/AuthContext";
import useFoodPreferences from "../../../../hooks/useFoodPreferences";
import {
  analyzeMenuItemForFoodPreferences,
  sortMenuItemsByFoodPreference,
  hasMeaningfulFoodPreferences,
} from "../../../../utils/foodPreferenceMatcher";
import "../styles/MenuDetailView.scss";
import { buildFoodDetailState } from "../../../../utils/customerFoodNavigation";
import { getCannotOrderReason } from "../../../../utils/restaurantStatus";

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
    $limit: Int = 100
    $cursor: ID
  ) {
    menuItemsConnection(limit: $limit, cursor: $cursor, filter: $filter) {
      pageInfo {
        endCursor
        hasNextPage
      }
      edges {
        node {
          id
          restaurantId
          menuId
          categoryId
          name
          description
          basePrice
          hasByWeightVariant
          thumbImage
          status
          avgPrepTimeMin
          inventoryStatus
          stockWarnings
          labels
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
          }
        }
      }
    }
  }
`;

const ITEMS_PER_PAGE = 8;

const TIME_SLOTS = [
  { id: "breakfast", label: "Bữa sáng", icon: "🍳" },
  { id: "lunch", label: "Bữa trưa", icon: "☀️" },
  { id: "dinner", label: "Bữa tối", icon: "🌙" },
  { id: "late_night", label: "Ăn đêm", icon: "🦉" },
];

const MenuDetailView = ({ restaurant, canOrder = true, onBack, onOpenFoodDetail }) => {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");
  const [timeSlot, setTimeSlot] = useState("lunch");
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [prioritizeFoodPreferences, setPrioritizeFoodPreferences] = useState(true);
  const { isAuthenticated } = useContext(AuthContext);
  const { preferences } = useFoodPreferences({ skip: !isAuthenticated });
  const hasFoodPreferences = hasMeaningfulFoodPreferences(preferences);
  const restaurantId = restaurant?.id || restaurant?._id || "";
  const { getPromotionForMenuItem, getPromotionLabel } =
    useActiveMenuPromotions(restaurantId);

  const { data: categoriesData, loading: categoriesLoading, error: categoriesError } =
    useQuery(GET_CATEGORIES, {
      variables: { restaurantId, timeSlot },
      skip: !restaurantId,
      fetchPolicy: "network-only",
    });

  const categories = useMemo(
    () =>
      [...(categoriesData?.customerMenuCategories || [])]
        .filter((cat) => cat?.id && cat.isActive !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0)),
    [categoriesData?.customerMenuCategories],
  );

  useEffect(() => {
    setActiveCat("all");
    setCurrentPage(1);
  }, [timeSlot]);

  const menuItemFilter = useMemo(
    () => ({
      restaurantId,
      timeSlot,
      ...(activeCat !== "all" ? { categoryId: activeCat } : {}),
    }),
    [activeCat, restaurantId, timeSlot],
  );

  const { data: menuData, loading: menuLoading, error: menuError, fetchMore } = useQuery(
    GET_MENU_ITEMS_FOR_CUSTOMER_MENU,
    {
      variables: {
        filter: menuItemFilter,
        limit: 100,
        cursor: null,
      },
      skip: !restaurantId,
      fetchPolicy: "network-only",
    },
  );

  const rawMenuItems = useMemo(() => {
    const edges = menuData?.menuItemsConnection?.edges || [];
    return edges.map((edge) => edge.node).filter(Boolean);
  }, [menuData]);

  const menuPageInfo = menuData?.menuItemsConnection?.pageInfo;

  const itemsWithPromotion = useMemo(
    () =>
      rawMenuItems.map((item) => {
        const activePromotion = getPromotionForMenuItem(item);
        return {
          ...item,
          promotion: activePromotion,
          promotionLabel: getPromotionLabel(activePromotion),
        };
      }),
    [getPromotionForMenuItem, getPromotionLabel, rawMenuItems],
  );

  const itemsWithFoodPreferenceMeta = useMemo(() => {
    return itemsWithPromotion.map((item) => ({
      ...item,
      foodPreferenceMeta: isAuthenticated && hasFoodPreferences
        ? analyzeMenuItemForFoodPreferences(item, preferences)
        : null,
    }));
  }, [hasFoodPreferences, isAuthenticated, itemsWithPromotion, preferences]);

  const filteredItems = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();
    const baseItems = itemsWithFoodPreferenceMeta.filter((item) => {
      if (!shouldShowMenuItemToCustomer(item)) return false;
      if (activeCat !== "all" && item.categoryId !== activeCat) return false;
      if (!lowerSearch) return true;
      return String(item.name || "").toLowerCase().includes(lowerSearch);
    });

    if (!isAuthenticated || !hasFoodPreferences || !prioritizeFoodPreferences) {
      return baseItems;
    }

    return sortMenuItemsByFoodPreference(baseItems, preferences);
  }, [
    activeCat,
    isAuthenticated,
    hasFoodPreferences,
    itemsWithFoodPreferenceMeta,
    preferences,
    prioritizeFoodPreferences,
    search,
  ]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const currentItems = filteredItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [timeSlot, activeCat, search, rawMenuItems.length]);

  const handleLoadMore = async () => {
    if (!menuPageInfo?.hasNextPage || !menuPageInfo?.endCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    setLoadMoreError("");

    try {
      await fetchMore({
        variables: {
          filter: menuItemFilter,
          limit: 100,
          cursor: menuPageInfo.endCursor,
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult?.menuItemsConnection) return prev;

          const prevEdges = prev?.menuItemsConnection?.edges || [];
          const nextEdges = fetchMoreResult.menuItemsConnection.edges || [];
          const seen = new Set(prevEdges.map((edge) => edge?.node?.id).filter(Boolean));
          const merged = [...prevEdges, ...nextEdges.filter((edge) => !seen.has(edge?.node?.id))];

          return {
            menuItemsConnection: {
              ...fetchMoreResult.menuItemsConnection,
              edges: merged,
              __typename:
                prev?.menuItemsConnection?.__typename ||
                fetchMoreResult.menuItemsConnection.__typename,
            },
          };
        },
      });
    } catch (_error) {
      setLoadMoreError("Không thể tải thêm món. Vui lòng thử lại.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const isLoading = menuLoading || (categoriesLoading && activeCat !== "all");
  const renderMenuSkeletons = () => (
    <div className={`menu-grid ${viewMode === "list" ? "list-view" : ""}`} aria-hidden="true">
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
                {restaurant?.rating && <span>★ {restaurant.rating}</span>}
                <span>{canOrder ? "Đang nhận đơn" : "Tạm dừng nhận đơn"}</span>
                {restaurant?.address && <span>{restaurant.address}</span>}
              </div>
            </div>
            <div className="header-actions">
              <label className="search-box">
                <span aria-hidden="true">🔍</span>
                <input
                  placeholder="Tìm món trong thực đơn"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
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
                <span aria-hidden="true">{slot.icon}</span>{slot.label}
              </button>
            ))}
          </nav>
          {isAuthenticated && hasFoodPreferences && (
            <label className="food-preference-toggle">
              <input
                type="checkbox"
                checked={prioritizeFoodPreferences}
                onChange={(e) => setPrioritizeFoodPreferences(e.target.checked)}
              />
              <span>Ưu tiên khẩu vị của tôi</span>
            </label>
          )}
        </div>
      </header>

      <section className="grid-container menu-detail-container">
        <nav className="category-filter" aria-label="Danh mục món ăn">
          <div className="pills">
            {categoriesError && (
              <div className="category-warning" role="status">
                Không tải được danh mục. Đang hiển thị theo "Tất cả".
              </div>
            )}
            <button
              type="button"
              className={activeCat === "all" ? "active" : ""}
              onClick={() => setActiveCat("all")}
            >
              Tất cả
            </button>
            {categories.map((cat) => (
              <button
                type="button"
                key={cat.id}
                className={activeCat === cat.id ? "active" : ""}
                onClick={() => setActiveCat(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </nav>

        {!canOrder && (
          <div className="menu-inline-note">
            {getCannotOrderReason(restaurant?.openingStatus)}
          </div>
        )}
        {isLoading ? (
          renderMenuSkeletons()
        ) : menuError ? (
          <div className="menu-state menu-state--error" role="alert">
            <span>!</span>
            <h3>Không thể tải thực đơn</h3>
            <p>Vui lòng thử lại sau ít phút hoặc chọn khung giờ khác.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="menu-state">
            <span>🍜</span>
            <h3>{search.trim() ? "Chưa tìm thấy món phù hợp" : "Chưa có món trong mục này"}</h3>
            <p>{search.trim() ? "Thử từ khóa ngắn hơn hoặc đổi danh mục để xem thêm món đã tải." : "Đổi bữa ăn hoặc danh mục khác để khám phá các lựa chọn đang mở bán."}</p>
          </div>
        ) : (
          <>
            {menuPageInfo?.hasNextPage && (
              <div className="menu-inline-note">Đang hiển thị tối đa 100 món đầu tiên cho bộ lọc hiện tại.</div>
            )}
            {loadMoreError && <div className="menu-inline-error">{loadMoreError}</div>}
            <div
              className={`menu-grid ${viewMode === "list" ? "list-view" : ""}`}
            >
              {currentItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  disabled={!canOrder}
                  onClick={(clickedItem) => {
                    if (!canOrder) return;
                    onOpenFoodDetail?.(
                      clickedItem?.id,
                      buildFoodDetailState(clickedItem, {
                        restaurantId: clickedItem?.restaurantId || restaurantId,
                        timeSlot,
                        categoryId: clickedItem?.categoryId || null,
                      }),
                    );
                  }}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)} aria-label="Trang trước">
                  &lt;
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    type="button"
                    key={idx}
                    className={currentPage === idx + 1 ? "active" : ""}
                    aria-current={currentPage === idx + 1 ? "page" : undefined}
                    onClick={() => setCurrentPage(idx + 1)}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)} aria-label="Trang sau">
                  &gt;
                </button>
              </div>
            )}
            {menuPageInfo?.hasNextPage && (
              <div className="menu-load-more-wrap">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  aria-busy={isLoadingMore}
                >
                  {isLoadingMore ? "Đang tải thêm..." : "Tải thêm món"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default MenuDetailView;
