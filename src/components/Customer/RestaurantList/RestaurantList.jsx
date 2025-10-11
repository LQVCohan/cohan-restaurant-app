import React, { useState } from "react";
import Header from "./components/Header/Header";
import SearchHero from "./components/SearchHero/SearchHero";
import FiltersSidebar from "./components/FiltersSidebar/FiltersSidebar";
import RestaurantCard from "./components/RestaurantCard/RestaurantCard";
import Pagination from "./components/Pagination/Pagination";
import Footer from "./components/Footer/Footer";
import { useRestaurants } from "../../../hooks/useRestaurants";
import "./RestaurantList.scss";

const RestaurantList = () => {
  const [currentView, setCurrentView] = useState("grid");
  const [showFilters, setShowFilters] = useState(false);

  const {
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    sortBy,
    setSortBy,
    favorites,
    filters,
    filteredRestaurants,
    currentRestaurants,
    totalPages,
    handleFilterChange,
    handleClearFilters,
    handleToggleFavorite,
  } = useRestaurants();

  const handleSearch = () => {
    setCurrentPage(1);
  };

  const handleMakeReservation = (event, restaurantId) => {
    event.stopPropagation();
    // Logic đặt bàn
    console.log("Đặt bàn cho nhà hàng:", restaurantId);
  };

  const handleViewDetails = (restaurantId) => {
    // Logic xem chi tiết
    console.log("Xem chi tiết nhà hàng:", restaurantId);
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="restaurant-list">
      <Header />
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
            onClearFilters={handleClearFilters}
            showFilters={showFilters}
          />

          <main className="results">
            <button
              className="filter-toggle"
              onClick={() => setShowFilters(!showFilters)}
            >
              🔧 Bộ lọc tìm kiếm
            </button>

            <div className="results__header">
              <div className="results__info">
                <div className="results__count">
                  Tìm thấy {filteredRestaurants.length} nhà hàng
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

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default RestaurantList;
