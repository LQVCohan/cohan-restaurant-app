import React from "react";
import "./ActionsCard.scss";

const ActionsCard = ({
  filters,
  onFiltersChange,
  onCreatePromotion,
  onExport,
}) => {
  const handleSearchChange = (e) => {
    onFiltersChange({ search: e.target.value });
  };

  const handleStatusChange = (e) => {
    onFiltersChange({ status: e.target.value });
  };

  return (
    <div className="actions-card">
      <div className="search-section">
        <input
          type="text"
          className="search-input"
          placeholder="🔍 Tìm kiếm khuyến mãi..."
          value={filters.search}
          onChange={handleSearchChange}
        />
        <select
          className="status-filter"
          value={filters.status}
          onChange={handleStatusChange}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="scheduled">Đã lên lịch</option>
          <option value="expired">Đã hết hạn</option>
          <option value="draft">Bản nháp</option>
        </select>
      </div>

      <div className="action-buttons">
        <button className="btn btn-secondary" onClick={onExport}>
          📊 Báo Cáo
        </button>
        <button className="btn btn-primary" onClick={onCreatePromotion}>
          ➕ Tạo KM
        </button>
      </div>
    </div>
  );
};

export default ActionsCard;
