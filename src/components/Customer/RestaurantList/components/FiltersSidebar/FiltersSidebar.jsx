import React from "react";
import "./FiltersSidebar.scss";

const FilterItem = ({ id, label, count, checked, onChange }) => (
  <div className="filters__item">
    <input
      type="checkbox"
      id={id}
      className="filters__checkbox"
      checked={checked}
      onChange={onChange}
    />
    <label htmlFor={id} className="filters__label">
      {label}
    </label>
    <span className="filters__count">{count}</span>
  </div>
);

const FiltersSidebar = ({
  filters,
  onFilterChange,
  onClearFilters,
  showFilters,
}) => {
  const hasActiveFilters =
    filters.districts.length > 0 ||
    filters.cuisines.length > 0 ||
    filters.ratings.length > 0;

  return (
    <aside className={`filters ${showFilters ? "filters--show" : ""}`}>
      <div className="filters__header">
        <h2 className="filters__title">🔧 Bộ lọc tìm kiếm</h2>
        {hasActiveFilters && (
          <button className="filters__clear-all" onClick={onClearFilters}>
            Xóa tất cả
          </button>
        )}
      </div>

      <div className="filters__section">
        <div className="filters__section-title">📍 Khu vực</div>
        <div className="filters__group">
          <FilterItem
            id="district1"
            label="Quận 1"
            count="45"
            checked={filters.districts.includes("Quận 1")}
            onChange={() => onFilterChange("districts", "Quận 1")}
          />
          <FilterItem
            id="district3"
            label="Quận 3"
            count="32"
            checked={filters.districts.includes("Quận 3")}
            onChange={() => onFilterChange("districts", "Quận 3")}
          />
          <FilterItem
            id="district7"
            label="Quận 7"
            count="28"
            checked={filters.districts.includes("Quận 7")}
            onChange={() => onFilterChange("districts", "Quận 7")}
          />
          <FilterItem
            id="binhthanh"
            label="Bình Thạnh"
            count="21"
            checked={filters.districts.includes("Bình Thạnh")}
            onChange={() => onFilterChange("districts", "Bình Thạnh")}
          />
        </div>
      </div>

      <div className="filters__section">
        <div className="filters__section-title">🍜 Loại ẩm thực</div>
        <div className="filters__group">
          <FilterItem
            id="vietnamese"
            label="Việt Nam"
            count="67"
            checked={filters.cuisines.includes("Việt Nam")}
            onChange={() => onFilterChange("cuisines", "Việt Nam")}
          />
          <FilterItem
            id="korean"
            label="Hàn Quốc"
            count="23"
            checked={filters.cuisines.includes("Hàn Quốc")}
            onChange={() => onFilterChange("cuisines", "Hàn Quốc")}
          />
          <FilterItem
            id="japanese"
            label="Nhật Bản"
            count="18"
            checked={filters.cuisines.includes("Nhật Bản")}
            onChange={() => onFilterChange("cuisines", "Nhật Bản")}
          />
          <FilterItem
            id="chinese"
            label="Trung Hoa"
            count="15"
            checked={filters.cuisines.includes("Trung Hoa")}
            onChange={() => onFilterChange("cuisines", "Trung Hoa")}
          />
          <FilterItem
            id="western"
            label="Âu Mỹ"
            count="12"
            checked={filters.cuisines.includes("Âu Mỹ")}
            onChange={() => onFilterChange("cuisines", "Âu Mỹ")}
          />
        </div>
      </div>

      <div className="filters__section">
        <div className="filters__section-title">⭐ Đánh giá</div>
        <div className="filters__group">
          <FilterItem
            id="rating5"
            label="5 sao"
            count="12"
            checked={filters.ratings.includes("5")}
            onChange={() => onFilterChange("ratings", "5")}
          />
          <FilterItem
            id="rating4"
            label="4+ sao"
            count="89"
            checked={filters.ratings.includes("4")}
            onChange={() => onFilterChange("ratings", "4")}
          />
          <FilterItem
            id="rating3"
            label="3+ sao"
            count="124"
            checked={filters.ratings.includes("3")}
            onChange={() => onFilterChange("ratings", "3")}
          />
        </div>
      </div>

      <div className="filters__section">
        <div className="filters__section-title">💰 Mức giá</div>
        <div className="filters__group">
          <FilterItem
            id="price1"
            label="Dưới 100k"
            count="34"
            checked={filters.priceRanges?.includes("under-100k")}
            onChange={() => onFilterChange("priceRanges", "under-100k")}
          />
          <FilterItem
            id="price2"
            label="100k - 300k"
            count="56"
            checked={filters.priceRanges?.includes("100k-300k")}
            onChange={() => onFilterChange("priceRanges", "100k-300k")}
          />
          <FilterItem
            id="price3"
            label="Trên 300k"
            count="23"
            checked={filters.priceRanges?.includes("over-300k")}
            onChange={() => onFilterChange("priceRanges", "over-300k")}
          />
        </div>
      </div>

      <button className="filters__clear-btn" onClick={onClearFilters}>
        🗑️ Xóa tất cả bộ lọc
      </button>
    </aside>
  );
};

export default FiltersSidebar;
