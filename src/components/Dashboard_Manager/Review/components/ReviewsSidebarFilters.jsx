import React from "react";
import "./ReviewsSidebarFilters.scss";

const ratingOptions = [
  { value: 5, label: "(5 sao)" },
  { value: 4, label: "(4 sao)" },
  { value: 3, label: "(3 sao)" },
  { value: 2, label: "(2 sao)" },
  { value: 1, label: "(1 sao)" },
];

const ReviewsSidebarFilters = ({ filters, onChange }) => {
  const handleRatingToggle = (value) => {
    const current = filters.ratings || [];
    const exists = current.includes(value);
    const next = exists
      ? current.filter((v) => v !== value)
      : [...current, value];

    onChange({ ...filters, ratings: next });
  };

  const handleSelectChange = (key) => (e) => {
    onChange({ ...filters, [key]: e.target.value });
  };

  return (
    <aside className="reviews-sidebar">
      <h3 className="reviews-sidebar__title">🔍 Bộ lọc</h3>

      {/* Rating */}
      <div className="reviews-sidebar__group">
        <span className="reviews-sidebar__label">Đánh giá</span>
        <div className="reviews-sidebar__rating-list">
          {ratingOptions.map((opt) => (
            <label key={opt.value} className="reviews-sidebar__rating-item">
              <input
                type="checkbox"
                checked={(filters.ratings || []).includes(opt.value)}
                onChange={() => handleRatingToggle(opt.value)}
              />
              <div className="reviews-sidebar__rating-item-stars">
                <span className="star">
                  {"★".repeat(opt.value) + "☆".repeat(5 - opt.value)}
                </span>
              </div>
              <span className="reviews-sidebar__rating-item-text">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="reviews-sidebar__group">
        <label className="reviews-sidebar__label">Trạng thái</label>
        <select
          className="reviews-sidebar__select"
          value={filters.status || ""}
          onChange={handleSelectChange("status")}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="published">Đã xuất bản</option>
          <option value="pending">Chờ duyệt</option>
          <option value="hidden">Đã ẩn</option>
        </select>
      </div>

      {/* Time */}
      <div className="reviews-sidebar__group">
        <label className="reviews-sidebar__label">Thời gian</label>
        <select
          className="reviews-sidebar__select"
          value={filters.time || ""}
          onChange={handleSelectChange("time")}
        >
          <option value="">Tất cả thời gian</option>
          <option value="today">Hôm nay</option>
          <option value="week">Tuần này</option>
          <option value="month">Tháng này</option>
          <option value="quarter">Quý này</option>
        </select>
      </div>

      {/* Images */}
      <div className="reviews-sidebar__group">
        <label className="reviews-sidebar__label">Có hình ảnh</label>
        <select
          className="reviews-sidebar__select"
          value={filters.image || ""}
          onChange={handleSelectChange("image")}
        >
          <option value="">Tất cả</option>
          <option value="with-images">Có hình ảnh</option>
          <option value="no-images">Không có hình ảnh</option>
        </select>
      </div>

      {/* Restaurant */}
      <div className="reviews-sidebar__group">
        <label className="reviews-sidebar__label">Nhà hàng</label>
        <select
          className="reviews-sidebar__select"
          value={filters.restaurant || ""}
          onChange={handleSelectChange("restaurant")}
        >
          <option value="">Tất cả nhà hàng</option>
          <option value="foodhub_main">
            FoodHub Restaurant - Chi nhánh chính
          </option>
          <option value="foodhub_district1">FoodHub Restaurant - Quận 1</option>
          <option value="foodhub_district3">FoodHub Restaurant - Quận 3</option>
          <option value="foodhub_hanoi">FoodHub Restaurant - Hà Nội</option>
          <option value="foodhub_danang">FoodHub Restaurant - Đà Nẵng</option>
        </select>
      </div>

      {/* Verified */}
      <div className="reviews-sidebar__group">
        <label className="reviews-sidebar__label">Khách hàng xác thực</label>
        <select
          className="reviews-sidebar__select"
          value={filters.verified || ""}
          onChange={handleSelectChange("verified")}
        >
          <option value="">Tất cả</option>
          <option value="verified">Đã xác thực</option>
          <option value="unverified">Chưa xác thực</option>
        </select>
      </div>
    </aside>
  );
};

export default ReviewsSidebarFilters;
