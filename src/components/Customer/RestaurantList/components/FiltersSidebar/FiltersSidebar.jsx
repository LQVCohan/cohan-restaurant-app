import React from "react";
import "./FiltersSidebar.scss";

// --- DỮ LIỆU CẤU HÌNH (MOCK DATA) ---
const DISTRICTS = [
  { id: "Quan 1", label: "Quận 1", count: 45 },
  { id: "Quan 3", label: "Quận 3", count: 32 },
  { id: "Quan 7", label: "Quận 7", count: 28 },
  { id: "Binh Thanh", label: "Bình Thạnh", count: 21 },
  { id: "Tan Binh", label: "Tân Bình", count: 15 },
  { id: "Thu Duc", label: "TP. Thủ Đức", count: 40 },
];

const CUISINES = [
  { id: "Vietnamese", label: "Việt Nam", count: 67 },
  { id: "Korean", label: "Hàn Quốc", count: 23 },
  { id: "Japanese", label: "Nhật Bản", count: 18 },
  { id: "Chinese", label: "Trung Hoa", count: 15 },
  { id: "Western", label: "Âu Mỹ", count: 12 },
  { id: "Bubble Tea", label: "Trà sữa", count: 55 },
];

const RATINGS = [
  { id: "5", label: "5 sao (Tuyệt vời)", count: 12 },
  { id: "4", label: "4+ sao (Rất tốt)", count: 89 },
  { id: "3", label: "3+ sao (Tốt)", count: 124 },
];

const PRICES = [
  { id: "under-100k", label: "Dưới 100k", count: 34 },
  { id: "100k-300k", label: "100k - 300k", count: 56 },
  { id: "over-300k", label: "Trên 300k", count: 23 },
];

// Component Checkbox Item
const FilterItem = ({ label, count, checked, onChange }) => (
  <label className="filter-item">
    <div className="checkbox-wrapper">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="real-checkbox"
      />
      <span className="custom-checkbox"></span>
    </div>
    <span className="filter-label">{label}</span>
    <span className="filter-count">{count}</span>
  </label>
);

const FiltersSidebar = ({
  filters = { districts: [], cuisines: [], ratings: [], priceRanges: [] },
  onFilterChange,
  onClearFilters,
}) => {
  // Kiểm tra xem có filter nào đang active không để hiện nút Reset
  const hasActiveFilters =
    filters.districts?.length > 0 ||
    filters.cuisines?.length > 0 ||
    filters.ratings?.length > 0 ||
    filters.priceRanges?.length > 0;

  // Helper gọi hàm change
  const handleChange = (group, value) => {
    onFilterChange && onFilterChange(group, value);
  };

  return (
    <div className="filters-sidebar">
      {/* Header */}
      <div className="filters-header">
        <h3 className="title">
          <span className="icon">🌪️</span> Bộ lọc
        </h3>
        {hasActiveFilters && (
          <button className="btn-reset" onClick={onClearFilters}>
            Làm mới
          </button>
        )}
      </div>

      <div className="filters-body">
        {/* 1. KHU VỰC */}
        <section className="filter-section">
          <h4 className="section-title">📍 Khu vực</h4>
          <div className="filter-list">
            {DISTRICTS.map((item) => (
              <FilterItem
                key={item.id}
                label={item.label}
                count={item.count}
                checked={filters.districts?.includes(item.label)}
                onChange={() => handleChange("districts", item.label)}
              />
            ))}
          </div>
        </section>

        <div className="divider"></div>

        {/* 2. ẨM THỰC */}
        <section className="filter-section">
          <h4 className="section-title">🍜 Loại ẩm thực</h4>
          <div className="filter-list">
            {CUISINES.map((item) => (
              <FilterItem
                key={item.id}
                label={item.label}
                count={item.count}
                checked={filters.cuisines?.includes(item.label)}
                onChange={() => handleChange("cuisines", item.label)}
              />
            ))}
          </div>
        </section>

        <div className="divider"></div>

        {/* 3. ĐÁNH GIÁ */}
        <section className="filter-section">
          <h4 className="section-title">⭐ Đánh giá</h4>
          <div className="filter-list">
            {RATINGS.map((item) => (
              <FilterItem
                key={item.id}
                label={item.label}
                count={item.count}
                checked={filters.ratings?.includes(item.id)}
                onChange={() => handleChange("ratings", item.id)}
              />
            ))}
          </div>
        </section>

        <div className="divider"></div>

        {/* 4. MỨC GIÁ */}
        <section className="filter-section">
          <h4 className="section-title">💰 Mức giá</h4>
          <div className="filter-list">
            {PRICES.map((item) => (
              <FilterItem
                key={item.id}
                label={item.label}
                count={item.count}
                checked={filters.priceRanges?.includes(item.id)}
                onChange={() => handleChange("priceRanges", item.id)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default FiltersSidebar;
