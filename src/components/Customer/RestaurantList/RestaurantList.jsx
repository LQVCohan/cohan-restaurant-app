import React, { useMemo, useState, useEffect, useContext } from "react";
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
    restaurants(limit: $limit, cursor: $cursor, restaurantFilter: $filter) {
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
          status
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
  const [addressFilterState, setAddressFilterState] = useState(undefined);
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
      status: node.status || "open",
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
      cuisineTypes: filters.cuisines.length ? filters.cuisines : undefined,
      minRating: minRating || undefined,
      priceRange: filters.priceRanges.length ? filters.priceRanges : undefined,
      search: searchTerm?.trim() || restaurantFilter?.search || undefined, // Ưu tiên search local -> prop
    };
  }, [filters, searchTerm, restaurantFilter, quickFilter]);

  // Sync Address Filter
  useEffect(() => {
    const city = filters.cities?.[0] || filters.city || undefined;
    const district = filters.districts?.[0] || undefined;
    const nextAF = city || district ? { city, district } : undefined;
    setAddressFilterState((prev) =>
      JSON.stringify(prev) === JSON.stringify(nextAF) ? prev : nextAF
    );
  }, [filters]);

  // --- QUERY DATA ---
  const { data, loading, error, fetchMore, refetch } = useQuery(
    GET_RESTAURANTS,
    {
      variables: {
        limit: LIMIT,
        addressFilter: addressFilterState,
        filter: gqlFilters,
      },
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    }
  );

  // Handle Initial Load
  useEffect(() => {
    if (!data?.restaurants) return;
    const edges = data.restaurants.edges ?? [];
    setAccumulated(edges.map(({ node }) => node));
    setEndCursor(data.restaurants.pageInfo?.endCursor ?? null);
    setHasNextPage(!!data.restaurants.pageInfo?.hasNextPage);
  }, [data]);

  // Handle Load More
  const handleLoadMore = async () => {
    if (!hasNextPage || !endCursor) return;
    const more = await fetchMore({
      variables: {
        limit: LIMIT,
        cursor: endCursor,
        addressFilter: addressFilterState,
        filter: gqlFilters,
      },
      updateQuery: (prev, { fetchMoreResult }) => fetchMoreResult || prev,
    });
    const edgesMore = more?.data?.restaurants?.edges ?? [];
    setAccumulated((prev) => [...prev, ...edgesMore.map(({ node }) => node)]);
    setEndCursor(more?.data?.restaurants?.pageInfo?.endCursor ?? null);
    setHasNextPage(!!more?.data?.restaurants?.pageInfo?.hasNextPage);
  };

  // Refetch when filters change
  useEffect(() => {
    refetch({
      limit: LIMIT,
      cursor: null,
      addressFilter: addressFilterState,
      filter: gqlFilters,
    });
  }, [addressFilterState, gqlFilters, refetch]);

  // --- HANDLERS ---
  const handleQuickFilter = (type) => {
    setQuickFilter(type);
    if (type === "distance") setSortBy("distance");
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
                setAddressFilterState(undefined);
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
                    : `Tìm thấy ${filteredRestaurants.length} nhà hàng`}
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
                  <option value="distance">📍 Gần nhất</option>
                </select>
              </div>
            </div>

            {/* List Content */}
            {loading && accumulated.length === 0 && (
              <div className="state-box loading">
                <LoadingSpinner size="large" />
              </div>
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
                      disabled={loading}
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
