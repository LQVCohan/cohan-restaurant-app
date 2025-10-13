import React, { useState } from "react";
import "./TableFilters.scss";

const TableFilters = ({
  selectedDate,
  onDateChange,
  selectedTimeSlot,
  onTimeSlotChange,
  guestCount,
  onGuestCountChange,
  tableFilters,
  onFiltersChange,
  availableTablesCount,
}) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const timeSlots = [
    { value: "11:00", label: "11:00 - Trưa" },
    { value: "11:30", label: "11:30" },
    { value: "12:00", label: "12:00" },
    { value: "12:30", label: "12:30" },
    { value: "13:00", label: "13:00" },
    { value: "17:00", label: "17:00 - Tối" },
    { value: "17:30", label: "17:30" },
    { value: "18:00", label: "18:00" },
    { value: "18:30", label: "18:30" },
    { value: "19:00", label: "19:00" },
    { value: "19:30", label: "19:30" },
    { value: "20:00", label: "20:00" },
    { value: "20:30", label: "20:30" },
  ];

  const areas = ["Khu vực chính", "Khu VIP", "Sân thượng", "Phòng riêng"];
  const features = [
    "Gần cửa sổ",
    "Yên tĩnh",
    "Có view",
    "Gần bar",
    "Phù hợp gia đình",
  ];

  const handleFilterChange = (key, value) => {
    onFiltersChange({
      ...tableFilters,
      [key]: value,
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      area: "",
      features: [],
      capacity: "",
      priceRange: { min: "", max: "" },
    });
  };

  const hasActiveFilters =
    tableFilters.area ||
    tableFilters.features?.length > 0 ||
    tableFilters.capacity ||
    tableFilters.priceRange?.min ||
    tableFilters.priceRange?.max;

  return (
    <div className="table-filters">
      {/* Main Filters */}
      <div className="filters-main">
        <div className="filter-group">
          <label className="filter-label">📅 Ngày đặt bàn</label>
          <input
            type="date"
            className="filter-input"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
          />
        </div>

        <div className="filter-group">
          <label className="filter-label">🕐 Giờ đặt bàn</label>
          <select
            className="filter-select"
            value={selectedTimeSlot}
            onChange={(e) => onTimeSlotChange(e.target.value)}
          >
            <option value="">Chọn giờ</option>
            {timeSlots.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">👥 Số khách</label>
          <div className="guest-counter">
            <button
              className="counter-btn"
              onClick={() => onGuestCountChange(Math.max(1, guestCount - 1))}
              disabled={guestCount <= 1}
            >
              -
            </button>
            <span className="counter-value">{guestCount}</span>
            <button
              className="counter-btn"
              onClick={() => onGuestCountChange(Math.min(20, guestCount + 1))}
              disabled={guestCount >= 20}
            >
              +
            </button>
          </div>
        </div>

        <div className="filter-actions">
          <button
            className={`advanced-toggle ${
              showAdvancedFilters ? "advanced-toggle--active" : ""
            }`}
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            🎛️ Bộ lọc nâng cao
          </button>

          {hasActiveFilters && (
            <button className="clear-filters" onClick={clearFilters}>
              🗑️ Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="filters-advanced">
          <div className="advanced-grid">
            <div className="filter-group">
              <label className="filter-label">📍 Khu vực</label>
              <select
                className="filter-select"
                value={tableFilters.area || ""}
                onChange={(e) => handleFilterChange("area", e.target.value)}
              >
                <option value="">Tất cả khu vực</option>
                {areas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">🪑 Sức chứa tối thiểu</label>
              <select
                className="filter-select"
                value={tableFilters.capacity || ""}
                onChange={(e) => handleFilterChange("capacity", e.target.value)}
              >
                <option value="">Không giới hạn</option>
                <option value="2">2+ chỗ ngồi</option>
                <option value="4">4+ chỗ ngồi</option>
                <option value="6">6+ chỗ ngồi</option>
                <option value="8">8+ chỗ ngồi</option>
              </select>
            </div>

            <div className="filter-group filter-group--full">
              <label className="filter-label">✨ Tiện ích</label>
              <div className="features-grid">
                {features.map((feature) => (
                  <label key={feature} className="feature-checkbox">
                    <input
                      type="checkbox"
                      checked={
                        tableFilters.features?.includes(feature) || false
                      }
                      onChange={(e) => {
                        const currentFeatures = tableFilters.features || [];
                        const newFeatures = e.target.checked
                          ? [...currentFeatures, feature]
                          : currentFeatures.filter((f) => f !== feature);
                        handleFilterChange("features", newFeatures);
                      }}
                    />
                    <span>{feature}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div className="filters-summary">
        <div className="summary-text">
          {selectedDate && selectedTimeSlot ? (
            <>
              🎯 Tìm thấy <strong>{availableTablesCount}</strong> bàn phù hợp
              {guestCount > 1 && ` cho ${guestCount} khách`}
            </>
          ) : (
            "📋 Vui lòng chọn ngày và giờ để xem bàn trống"
          )}
        </div>
      </div>
    </div>
  );
};

export default TableFilters;
