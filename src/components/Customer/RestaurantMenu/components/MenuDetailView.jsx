import React, { useState, useMemo, useEffect } from "react";
import { gql, useQuery } from "@apollo/client";
import MenuItemCard from "./MenuItemCard";
import { useActiveMenuPromotions } from "../../../../hooks/useActiveMenuPromotions";
import { shouldShowMenuItemToCustomer } from "../../../../utils/menuItemAvailability";
import "../styles/MenuDetailView.scss";
import { buildFoodDetailState } from "../../../../utils/customerFoodNavigation";

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
          byWeight
          thumbImage
          status
          avgPrepTimeMin
          inventoryStatus
          stockWarnings
          servingVariants {
            key
            mode
            yieldQty
            yieldUnit
            name
            price
          }
        }
      }
    }
  }
`;

const ITEMS_PER_PAGE = 8;

const MenuDetailView = ({ restaurant, onBack, onOpenFoodDetail }) => {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");
  const [timeSlot, setTimeSlot] = useState("lunch");
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [currentPage, setCurrentPage] = useState(1);
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

  const filteredItems = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();
    return itemsWithPromotion.filter((item) => {
      if (!shouldShowMenuItemToCustomer(item)) return false;
      if (activeCat !== "all" && item.categoryId !== activeCat) return false;
      if (!lowerSearch) return true;
      return String(item.name || "").toLowerCase().includes(lowerSearch);
    });
  }, [activeCat, itemsWithPromotion, search]);

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

  return (
    <div className="fade-in">
      <header className="menu-header">
        <div className="header-content">
          <div className="top-row">
            <button onClick={onBack} className="back-btn">
              ⬅ Quay lại
            </button>
            <h2>{restaurant?.name || "Thực đơn"}</h2>
            <div className="search-box">
              <input
                placeholder="Tìm món..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span>🔍</span>
            </div>
            <div className="view-toggle">
              <button
                className={viewMode === "grid" ? "active" : ""}
                onClick={() => setViewMode("grid")}
              >
                ⊞
              </button>
              <button
                className={viewMode === "list" ? "active" : ""}
                onClick={() => setViewMode("list")}
              >
                ☰
              </button>
            </div>
          </div>
          <div className="tabs-row">
            {[
              { id: "breakfast", label: "🍳 Bữa Sáng" },
              { id: "lunch", label: "☀️ Bữa Trưa" },
              { id: "dinner", label: "🌙 Bữa Tối" },
              { id: "late_night", label: "🦉 Ăn Đêm" },
            ].map((s) => (
              <div
                key={s.id}
                className={`tab ${timeSlot === s.id ? "active" : ""}`}
                onClick={() => setTimeSlot(s.id)}
              >
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="grid-container">
        <div className="category-filter">
          <div className="pills">
            {categoriesError && (
              <div style={{ color: "#d97706", fontSize: "0.9rem", padding: "0.25rem 0.5rem" }}>
                Không tải được danh mục. Đang hiển thị theo "Tất cả".
              </div>
            )}
            <button
              className={activeCat === "all" ? "active" : ""}
              onClick={() => setActiveCat("all")}

            >
              Tất cả
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={activeCat === cat.id ? "active" : ""}
                onClick={() => setActiveCat(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#999" }}>
            Đang tải thực đơn...
          </div>
        ) : menuError ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#d32f2f" }}>
            Không thể tải thực đơn. Vui lòng thử lại.
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#999" }}>
            {search.trim() ? "Không tìm thấy món phù hợp trong danh sách đã tải." : "Không tìm thấy món nào."}
          </div>
        ) : (
          <>
            {menuPageInfo?.hasNextPage && (
              <div className="menu-inline-note">Đang hiển thị tối đa 100 món đầu tiên cho bộ lọc hiện tại.</div>
            )}
            {loadMoreError && <div className="menu-inline-error">{loadMoreError}</div>}
            <div
              className={`grid-container menu-grid ${viewMode === "list" ? "list-view" : ""}`}
              style={{ padding: 0 }}
            >
              {currentItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onClick={(clickedItem) =>
                    onOpenFoodDetail?.(
                      clickedItem?.id,
                      buildFoodDetailState(clickedItem, {
                        restaurantId: clickedItem?.restaurantId || restaurantId,
                        timeSlot,
                        categoryId: clickedItem?.categoryId || null,
                      }),
                    )
                  }
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
                  &lt;
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    className={currentPage === idx + 1 ? "active" : ""}
                    onClick={() => setCurrentPage(idx + 1)}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
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
                >
                  {isLoadingMore ? "Đang tải thêm..." : "Tải thêm món"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MenuDetailView;
