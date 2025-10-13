import React, { useMemo, useState, useEffect } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useNavigate } from "react-router-dom";

import SearchHero from "./components/SearchHero/SearchHero";
import FiltersSidebar from "./components/FiltersSidebar/FiltersSidebar";
import RestaurantCard from "./components/RestaurantCard/RestaurantCard";
import Footer from "./components/Footer/Footer";

import { useRestaurants } from "../../../hooks/useRestaurants";
import "./RestaurantList.scss";

/* =========================
   GraphQL: cursor pagination + filter
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

const RestaurantList = () => {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState("grid");
  const [showFilters, setShowFilters] = useState(false);

  // 👉 State tích luỹ dữ liệu đã tải theo cursor
  const [accumulated, setAccumulated] = useState([]);
  const [endCursor, setEndCursor] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);

  // 👉 BE chỉ hỗ trợ addressFilter => rút từ bộ lọc FE (nếu muốn)
  // Ở đây minh hoạ: nếu user chọn đúng 1 district/city thì pass xuống BE
  const [addressFilter, setAddressFilter] = useState(undefined);

  // 1) Tạo filter gửi BE từ hook (cuisines, ratings, priceRanges, search)
  // - ratings FE: ["5","4","3"] -> chuyển thành minRating ~ 5 | 4 | 3
  // - priceRanges FE: ["under-100k","100k-300k","over-300k"] -> gửi nguyên mảng
  // - search lấy từ searchTerm
  const [searchTermLocal, setSearchTermLocal] = useState("");

  // 2) SOURCE cho hook sẽ đến từ accumulated (BE phân trang)
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
      image: node.coverImage || node.avatar || "",
      badges: [], // 👈 tránh lỗi .map() ở RestaurantCard nếu undefined
      status: node.status || "open",
    }));
  }, [accumulated]);

  // 3) Hook FE cho lọc/sắp xếp/ưu thích (lọc hiển thị UI)
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
  } = useRestaurants(source, { itemsPerPage: 10_000 }); // không phân trang FE

  // Đồng bộ searchTerm từ UI xuống state local để gửi BE
  useEffect(() => {
    setSearchTermLocal(searchTerm);
  }, [searchTerm]);

  // 4) Chuẩn hoá filter gửi BE (RestaurantFilter)
  const gqlFilters = useMemo(() => {
    // minRating: ưu tiên lớn nhất trong danh sách chọn
    let minRating = 0;
    if (filters.ratings.includes("5")) minRating = 5;
    else if (filters.ratings.includes("4")) minRating = 4;
    else if (filters.ratings.includes("3")) minRating = 3;

    return {
      cuisineTypes: filters.cuisines.length ? filters.cuisines : undefined,
      minRating: minRating || undefined,
      priceRange: filters.priceRanges.length ? filters.priceRanges : undefined,
      search: searchTermLocal?.trim() ? searchTermLocal.trim() : undefined,
    };
  }, [filters.cuisines, filters.priceRanges, filters.ratings, searchTermLocal]);

  // 5) Khi user đổi bộ lọc địa chỉ -> addressFilter xuống BE
  useEffect(() => {
    const city = filters.cities?.[0] || filters.city || undefined; // nếu có filter city riêng
    const district = filters.districts?.[0] || undefined;
    const nextAF = city || district ? { city, district } : undefined;

    setAddressFilter((prev) =>
      JSON.stringify(prev) === JSON.stringify(nextAF) ? prev : nextAF
    );
  }, [filters]);

  // 6) Query trang đầu
  const { data, loading, error, fetchMore, refetch, networkStatus } = useQuery(
    GET_RESTAURANTS,
    {
      variables: { limit: LIMIT, addressFilter, filter: gqlFilters },
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    }
  );

  // 7) Khi có trang đầu, nạp vào accumulated
  useEffect(() => {
    if (!data?.restaurants) return;
    const edges = data.restaurants.edges ?? [];
    const pageItems = edges.map(({ node }) => node);
    setAccumulated(pageItems);
    setEndCursor(data.restaurants.pageInfo?.endCursor ?? null);
    setHasNextPage(!!data.restaurants.pageInfo?.hasNextPage);
  }, [data]);

  // 8) Load thêm trang tiếp theo từ BE
  const handleLoadMore = async () => {
    if (!hasNextPage || !endCursor) return;
    const more = await fetchMore({
      variables: {
        limit: LIMIT,
        cursor: endCursor,
        addressFilter,
        filter: gqlFilters,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        return fetchMoreResult || prev;
      },
    });
    const edgesMore = more?.data?.restaurants?.edges ?? [];
    const itemsMore = edgesMore.map(({ node }) => node);
    setAccumulated((prev) => [...prev, ...itemsMore]);
    setEndCursor(more?.data?.restaurants?.pageInfo?.endCursor ?? null);
    setHasNextPage(!!more?.data?.restaurants?.pageInfo?.hasNextPage);
  };

  // 9) Khi addressFilter hoặc gqlFilters đổi → refetch trang đầu
  useEffect(() => {
    refetch({ limit: LIMIT, cursor: null, addressFilter, filter: gqlFilters });
    // reset accumulated sẽ được set lại ở effect khi data về
  }, [addressFilter, gqlFilters, refetch]);

  // Handlers
  const handleSearch = () => {
    // Đã đồng bộ searchTerm -> gqlFilters -> BE; refetch ở effect trên
  };

  const handleMakeReservation = (event, restaurantId) => {
    event.stopPropagation();
    navigate(`/restaurants/${restaurantId}/layout`);
  };

  const handleViewDetails = (restaurantId) => {
    navigate(`/restaurants/${restaurantId}`);
  };

  return (
    <div className="restaurant-list">
      <SearchHero
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onSearch={handleSearch}
      />

      <div className="container">
        <div className="content-layout">
          <FiltersSidebar
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={() => {
              handleClearFilters();
              setAddressFilter(undefined);
            }}
            showFilters={showFilters}
          />

          <main className="results">
            {/* <button
              className="filter-toggle"
              onClick={() => setShowFilters(!showFilters)}
            >
              🔧 Bộ lọc tìm kiếm
            </button> */}

            <div className="results__header">
              <div className="results__info">
                <div className="results__count">
                  {loading && accumulated.length === 0
                    ? "Đang tải…"
                    : error
                    ? "Lỗi tải dữ liệu"
                    : `Đang hiển thị ${filteredRestaurants.length} nhà hàng`}
                </div>
                <div className="results__view-toggle">
                  <button
                    className={`results__view-btn ${
                      currentView === "grid" ? "results__view-btn--active" : ""
                    }`}
                    onClick={() => setCurrentView("grid")}
                  >
                    ⊞ Lưới
                  </button>
                  <button
                    className={`results__view-btn ${
                      currentView === "list" ? "results__view-btn--active" : ""
                    }`}
                    onClick={() => setCurrentView("list")}
                  >
                    ☰ Danh sách
                  </button>
                </div>
              </div>

              <select
                className="results__sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="relevance">Liên quan nhất</option>
                <option value="rating">Đánh giá cao nhất</option>
                <option value="price-low">Giá thấp đến cao</option>
                <option value="distance">Khoảng cách gần nhất</option>
              </select>
            </div>

            {/* Loading lần đầu */}
            {loading && accumulated.length === 0 && (
              <div className="results__loading">Đang tải dữ liệu…</div>
            )}
            {error && !loading && accumulated.length === 0 && (
              <div className="results__error">Không tải được danh sách.</div>
            )}

            {/* Data */}
            {accumulated.length > 0 && (
              <>
                <div
                  className={`restaurants-grid restaurants-grid--${currentView}`}
                >
                  {currentRestaurants.map((restaurant) => (
                    <RestaurantCard
                      key={restaurant.id}
                      restaurant={restaurant}
                      isFavorited={favorites.has(restaurant.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onMakeReservation={handleMakeReservation}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </div>

                {/* Phân trang server: Tải thêm bằng cursor */}
                <div className="results__load-more">
                  {hasNextPage ? (
                    <button onClick={handleLoadMore} disabled={loading}>
                      {loading ? "Đang tải..." : "Tải thêm"}
                    </button>
                  ) : (
                    <span>Đã hiển thị tất cả kết quả hiện có.</span>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default RestaurantList;
