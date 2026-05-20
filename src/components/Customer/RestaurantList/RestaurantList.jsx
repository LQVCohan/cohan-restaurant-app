import React, { useMemo, useState, useEffect, useContext, useRef } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useNavigate, useLocation } from "react-router-dom";

// Components
import DiscoveryHero from "./components/DiscoveryHero/DiscoveryHero";
import FiltersSidebar from "./components/FiltersSidebar/FiltersSidebar";
import RestaurantCard from "./components/RestaurantCard/RestaurantCard";
import LoadingSpinner from "@/components/common/LoadingSpinner";

import { useRestaurants } from "../../../hooks/useRestaurants";
import { AuthContext } from "../../../context/AuthContext";

// Styles
import "./RestaurantList.scss";

/* =========================
   GraphQL Query
   ========================= */
const GET_RESTAURANTS = gql`
  query GetRestaurants($limit: Int, $cursor: ID, $filter: RestaurantFilter) {
    publicRestaurants(limit: $limit, cursor: $cursor, filter: $filter) {
      edges {
        cursor
        node {
          id
          name
          description
          cuisineType
          priceRange
          avgRating
          coverImage
          avatar
          openingStatus
          openingStatusReason
          canReserve
          canOrder
          reviewCount
          businessStatus
          publicationStatus
          address {
            district
            city
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

const LIMIT = 12;

const RestaurantList = ({ restaurantFilter }) => {
  // Nhận filter từ props (nếu có từ Router)
  const navigate = useNavigate();
  const location = useLocation();
  const { token, isAuthenticated } = useContext(AuthContext) || {};
  const [currentView, setCurrentView] = useState("grid");

  // Data States
  const [accumulated, setAccumulated] = useState([]);
  const [endCursor, setEndCursor] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Filter States
  const [quickFilter, setQuickFilter] = useState(null); // Filter từ Hero

  // --- MAPPING DATA FOR HOOK ---
  const source = useMemo(() => {
    return accumulated.map((node) => ({
      id: node.id,
      name: node.name,
      description: node.description,
      cuisine: node.cuisineType,
      priceRange: node.priceRange,
      avgRating: node.avgRating,
      district: node.address?.district,
      city: node.address?.city,
      image: node.coverImage || node.avatar || "/default-dishes.jpg",
      openingStatus: node.openingStatus, canReserve: node.canReserve, canOrder: node.canOrder, reviewCount: node.reviewCount,
    }));
  }, [accumulated]);

  // Hook xử lý lọc client-side (nếu cần) & quản lý state filter
  const {
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    favorites,
    filters,
    filteredRestaurants,
    currentRestaurants,
    handleFilterChange,
    handleClearFilters,
    handleToggleFavorite,
  } = useRestaurants(source, { itemsPerPage: 10000 });

  // --- CONVERT FILTER TO GRAPHQL ---
  const gqlFilters = useMemo(() => {
    let minRating = 0;
    if (filters.ratings.includes("5")) minRating = 5;
    else if (filters.ratings.includes("4")) minRating = 4;
    else if (quickFilter === "rating") minRating = 4.5; // Quick filter logic

    return {
      city: filters.cities?.[0] || undefined,
      district: filters.districts?.[0] || undefined,
      cuisineTypes: filters.cuisines.length ? filters.cuisines : undefined,
      minRating: minRating || undefined,
      priceRange: filters.priceRanges.length ? filters.priceRanges : undefined,
      search: searchTerm?.trim() || restaurantFilter?.search || undefined,
      openNow: quickFilter === "open" ? true : undefined,
    };
  }, [filters, searchTerm, restaurantFilter, quickFilter]);

  // --- QUERY DATA ---
  const filterKey = JSON.stringify(gqlFilters);
  const prevFilterKeyRef = useRef(filterKey);
  const isFetchingMoreRef = useRef(false);

  const { data, loading, error, fetchMore } = useQuery(
    GET_RESTAURANTS,
    {
      variables: {
        limit: LIMIT,
        filter: gqlFilters,
      },
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    }
  );

  useEffect(() => {
    if (prevFilterKeyRef.current !== filterKey) {
      prevFilterKeyRef.current = filterKey;
      setAccumulated([]);
      setEndCursor(null);
      setHasNextPage(false);
    }
  }, [filterKey]);

  // Handle initial/refetch load (avoid clobbering local merged list during fetchMore)
  useEffect(() => {
    if (!data?.publicRestaurants) return;
    if (isFetchingMoreRef.current) return;

    const edges = data.publicRestaurants.edges ?? [];
    setAccumulated(edges.map(({ node }) => node));
    setEndCursor(data.publicRestaurants.pageInfo?.endCursor ?? null);
    setHasNextPage(!!data.publicRestaurants.pageInfo?.hasNextPage);
  }, [data]);

  // Handle Load More
  const handleLoadMore = async () => {
    if (!hasNextPage || !endCursor) return;

    isFetchingMoreRef.current = true;
    try {
      const more = await fetchMore({
        variables: {
          limit: LIMIT,
          cursor: endCursor,
          filter: gqlFilters,
        },
      });
      const edgesMore = more?.data?.publicRestaurants?.edges ?? [];
      setAccumulated((prev) => {
        const map = new Map(prev.map((x) => [x.id, x]));
        edgesMore.forEach(({ node }) => map.set(node.id, node));
        return [...map.values()];
      });
      setEndCursor(more?.data?.publicRestaurants?.pageInfo?.endCursor ?? null);
      setHasNextPage(!!more?.data?.publicRestaurants?.pageInfo?.hasNextPage);
    } finally {
      isFetchingMoreRef.current = false;
    }
  };


  // --- HANDLERS ---
  const handleQuickFilter = (type) => {
    setQuickFilter(type);
    if (type === "rating") setSortBy("rating");
    // Scroll xuống list
    document
      .querySelector(".results-area")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const handleMakeReservation = (event, restaurantId) => {
    event.stopPropagation();
    navigate(`/restaurant/${restaurantId}/layout`);
  };

  const handleFavoriteAction = (event, restaurantId) => {
    event?.stopPropagation?.();
    if (!isAuthenticated || !token) {
      navigate("/login", { state: { from: location } });
      return;
    }
    handleToggleFavorite(event, restaurantId);
  };

  return (
    <div className="restaurant-list-page">
      {/* 1. DISCOVERY HERO */}
      <div className="hero-wrapper">
        <DiscoveryHero onQuickFilter={handleQuickFilter} />
      </div>

      {/* 2. MAIN CONTENT */}
      <div className="list-container">
        <div className="content-layout">
          {/* Sidebar */}
          <aside className="sidebar-wrapper">
            <FiltersSidebar
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearFilters={() => {
                handleClearFilters();
                setQuickFilter(null);
              }}
            />
          </aside>

          {/* Results Grid */}
          <main className="results-area">
            {/* Toolbar */}
            <div className="results-header">
              <div className="header-left">
                <h2 className="results-title">
                  {loading && accumulated.length === 0
                    ? "Đang tải dữ liệu..."
                    : error
                    ? "Không thể tải dữ liệu"
                    : `Tìm thấy ${data?.publicRestaurants?.totalCount ?? filteredRestaurants.length} nhà hàng`}
                </h2>
                <div className="view-toggles">
                  <button
                    className={`toggle-btn ${
                      currentView === "grid" ? "active" : ""
                    }`}
                    onClick={() => setCurrentView("grid")}
                  >
                    ⊞
                  </button>
                  <button
                    className={`toggle-btn ${
                      currentView === "list" ? "active" : ""
                    }`}
                    onClick={() => setCurrentView("list")}
                  >
                    ☰
                  </button>
                </div>
              </div>

              <div className="header-right">
                <select
                  className="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="relevance">✨ Liên quan nhất</option>
                  <option value="rating">⭐ Đánh giá cao</option>
                  <option value="price-low">💲 Giá thấp đến cao</option>
                  
                </select>
              </div>
            </div>

            {/* List Content */}
            {loading && accumulated.length === 0 && (
              <div className="state-box loading">
                <LoadingSpinner size="large" />
              </div>
            )}

            {error && accumulated.length === 0 && (
              <div className="state-box error">Không thể tải dữ liệu nhà hàng.</div>
            )}

            {!loading && !error && accumulated.length === 0 && (
              <div className="state-box empty">Không tìm thấy nhà hàng phù hợp.</div>
            )}

            {accumulated.length > 0 && (
              <>
                <div className={`restaurants-display mode-${currentView}`}>
                  {currentRestaurants.map((restaurant, index) => (
                    <div
                      key={restaurant.id}
                      className="card-wrapper"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <RestaurantCard
                        restaurant={restaurant}
                        variant={currentView}
                        isFavorited={favorites.has(restaurant.id)}
                        onToggleFavorite={handleFavoriteAction}
                        onMakeReservation={handleMakeReservation}
                        onViewDetails={(id) => navigate(`/restaurant/${id}`)}
                      />
                    </div>
                  ))}
                </div>

                <div className="load-more-container">
                  {hasNextPage ? (
                    <button
                      className="btn-load-more"
                      onClick={handleLoadMore}
                      disabled={loading && accumulated.length === 0}
                    >
                      {loading ? "Đang tải..." : "Xem thêm nhà hàng"}
                    </button>
                  ) : (
                    <span className="end-text">Bạn đã xem hết danh sách.</span>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default RestaurantList;
