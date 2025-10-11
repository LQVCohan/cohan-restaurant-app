import React, { useState } from "react";
import { apiService } from "../../services/apiService";
import styles from "../../styles/Homepage/SearchSection.module.scss";

const SearchSection = ({ onAddToCart }) => {
  const [filters, setFilters] = useState({
    name: "",
    category: "",
    priceRange: "",
    area: "",
  });
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortBy, setSortBy] = useState("name");
  const [viewMode, setViewMode] = useState("grid");

  const categories = [
    { value: "", label: "Tất cả danh mục" },
    { value: "vietnamese", label: "Món Việt" },
    { value: "fastfood", label: "Fast Food" },
    { value: "pizza", label: "Pizza" },
    { value: "asian", label: "Món Á" },
    { value: "dessert", label: "Tráng miệng" },
    { value: "drink", label: "Đồ uống" },
  ];

  const priceRanges = [
    { value: "", label: "Tất cả mức giá" },
    { value: "0-50000", label: "Dưới 50,000đ" },
    { value: "50000-100000", label: "50,000đ - 100,000đ" },
    { value: "100000-200000", label: "100,000đ - 200,000đ" },
    { value: "200000-999999999", label: "Trên 200,000đ" },
  ];

  const areas = [
    { value: "", label: "Tất cả khu vực" },
    { value: "district1", label: "Quận 1" },
    { value: "district3", label: "Quận 3" },
    { value: "district7", label: "Quận 7" },
    { value: "binhthanh", label: "Bình Thạnh" },
    { value: "tanbinh", label: "Tân Bình" },
  ];

  const sortOptions = [
    { value: "name", label: "Tên món ăn" },
    { value: "price-asc", label: "Giá thấp đến cao" },
    { value: "price-desc", label: "Giá cao đến thấp" },
    { value: "restaurant", label: "Nhà hàng" },
  ];

  const handleInputChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setIsSearching(true);
    setHasSearched(true);

    try {
      const results = await apiService.searchFood(filters);
      const sortedResults = sortResults(results, sortBy);
      setSearchResults(sortedResults);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const sortResults = (results, sortType) => {
    const sorted = [...results];

    switch (sortType) {
      case "price-asc":
        return sorted.sort((a, b) => a.price - b.price);
      case "price-desc":
        return sorted.sort((a, b) => b.price - a.price);
      case "restaurant":
        return sorted.sort((a, b) => a.restaurant.localeCompare(b.restaurant));
      case "name":
      default:
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
  };

  const handleSortChange = (newSortBy) => {
    setSortBy(newSortBy);
    if (searchResults.length > 0) {
      const sortedResults = sortResults(searchResults, newSortBy);
      setSearchResults(sortedResults);
    }
  };

  const clearFilters = () => {
    setFilters({
      name: "",
      category: "",
      priceRange: "",
      area: "",
    });
    setSearchResults([]);
    setHasSearched(false);
  };

  const handleQuickSearch = (category) => {
    setFilters((prev) => ({ ...prev, category }));
    // Auto search when quick filter is clicked
    setTimeout(() => {
      const searchEvent = { preventDefault: () => {} };
      handleSearch(searchEvent);
    }, 100);
  };

  return (
    <section className={styles.searchSection}>
      <div className="container">
        <h3 className={styles.title}>🔍 Tìm kiếm món ăn</h3>
        <p className={styles.subtitle}>
          Khám phá hàng nghìn món ăn ngon từ các nhà hàng uy tín
        </p>

        {/* Quick Filter Buttons */}
        <div className={styles.quickFilters}>
          {categories.slice(1).map((category) => (
            <button
              key={category.value}
              className={`${styles.quickFilterBtn} ${
                filters.category === category.value ? styles.active : ""
              }`}
              onClick={() => handleQuickSearch(category.value)}
            >
              {category.label}
            </button>
          ))}
        </div>

        <form className={styles.form} onSubmit={handleSearch}>
          <div className={styles.grid}>
            <div className={styles.group}>
              <label className={styles.label}>Tên món ăn</label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Nhập tên món ăn..."
                  value={filters.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                />
                <span className={styles.inputIcon}>🍽️</span>
              </div>
            </div>

            <div className={styles.group}>
              <label className={styles.label}>Danh mục</label>
              <select
                className={styles.select}
                value={filters.category}
                onChange={(e) => handleInputChange("category", e.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.group}>
              <label className={styles.label}>Khoảng giá</label>
              <select
                className={styles.select}
                value={filters.priceRange}
                onChange={(e) =>
                  handleInputChange("priceRange", e.target.value)
                }
              >
                {priceRanges.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.group}>
              <label className={styles.label}>Khu vực</label>
              <select
                className={styles.select}
                value={filters.area}
                onChange={(e) => handleInputChange("area", e.target.value)}
              >
                {areas.map((area) => (
                  <option key={area.value} value={area.value}>
                    {area.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.searchBtn}
              disabled={isSearching}
            >
              {isSearching ? (
                <>
                  <span className={styles.spinner}></span>
                  Đang tìm...
                </>
              ) : (
                <>🔍 Tìm kiếm</>
              )}
            </button>

            <button
              type="button"
              className={styles.clearBtn}
              onClick={clearFilters}
            >
              🗑️ Xóa bộ lọc
            </button>
          </div>
        </form>

        {hasSearched && (
          <div className={styles.results}>
            <div className={styles.resultsHeader}>
              <div className={styles.resultsInfo}>
                <h4 className={styles.resultsTitle}>
                  Kết quả tìm kiếm ({searchResults.length} món)
                </h4>
                {searchResults.length > 0 && (
                  <p className={styles.resultsSubtitle}>
                    Tìm thấy {searchResults.length} món ăn phù hợp
                  </p>
                )}
              </div>

              {searchResults.length > 0 && (
                <div className={styles.resultsControls}>
                  <div className={styles.sortGroup}>
                    <label className={styles.sortLabel}>Sắp xếp:</label>
                    <select
                      className={styles.sortSelect}
                      value={sortBy}
                      onChange={(e) => handleSortChange(e.target.value)}
                    >
                      {sortOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.viewToggle}>
                    <button
                      className={`${styles.viewBtn} ${
                        viewMode === "grid" ? styles.active : ""
                      }`}
                      onClick={() => setViewMode("grid")}
                    >
                      ⊞
                    </button>
                    <button
                      className={`${styles.viewBtn} ${
                        viewMode === "list" ? styles.active : ""
                      }`}
                      onClick={() => setViewMode("list")}
                    >
                      ☰
                    </button>
                  </div>
                </div>
              )}
            </div>

            {isSearching ? (
              <div className={styles.loading}>
                <div className={styles.loadingSpinner}></div>
                <p>Đang tìm kiếm món ăn ngon cho bạn...</p>
              </div>
            ) : (
              <div className={`${styles.resultsGrid} ${styles[viewMode]}`}>
                {searchResults.length === 0 ? (
                  <div className={styles.noResults}>
                    <div className={styles.noResultsIcon}>🔍</div>
                    <h5 className={styles.noResultsTitle}>
                      Không tìm thấy món ăn phù hợp
                    </h5>
                    <p className={styles.noResultsText}>
                      Vui lòng thử lại với từ khóa khác hoặc điều chỉnh bộ lọc
                    </p>
                    <button className={styles.resetBtn} onClick={clearFilters}>
                      🔄 Đặt lại bộ lọc
                    </button>
                  </div>
                ) : (
                  searchResults.map((food) => (
                    <div key={food.id} className={styles.foodCard}>
                      <div className={styles.foodImage}>
                        <span className={styles.foodIcon}>{food.icon}</span>
                        <div className={styles.foodBadge}>
                          {
                            categories.find((c) => c.value === food.category)
                              ?.label
                          }
                        </div>
                      </div>
                      <div className={styles.foodContent}>
                        <h5 className={styles.foodName}>{food.name}</h5>
                        <p className={styles.foodRestaurant}>
                          🏪 {food.restaurant}
                        </p>
                        <div className={styles.foodMeta}>
                          <span className={styles.foodArea}>
                            📍 {areas.find((a) => a.value === food.area)?.label}
                          </span>
                        </div>
                        <div className={styles.foodFooter}>
                          <span className={styles.foodPrice}>
                            {food.price.toLocaleString()}đ
                          </span>
                          <button
                            className={styles.addBtn}
                            onClick={() => onAddToCart(food)}
                          >
                            ➕ Thêm
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default SearchSection;
