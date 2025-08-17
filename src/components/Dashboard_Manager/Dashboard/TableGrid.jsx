import React from "react";
import "../../Dashboard_Manager/Styles/TableGrid.scss";

const TableGrid = ({
  tables,
  onTableClick,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusCounts,
  activeArea,
  onAreaChange,
}) => {
  const areas = [
    { id: "outdoor", icon: "🌳", name: "Ngoài trời", count: "8 bàn" },
    { id: "indoor", icon: "🏠", name: "Trong nhà", count: "12 bàn" },
    { id: "upstairs", icon: "🏢", name: "Tầng 2", count: "6 bàn" },
    { id: "takeaway", icon: "🥡", name: "Mang về", count: "4 quầy" },
  ];

  const getStatusClass = (status) => {
    const statusClasses = {
      available: "available",
      occupied: "occupied",
      reserved: "reserved",
      cleaning: "cleaning",
    };
    return statusClasses[status] || "available";
  };

  const getStatusText = (status) => {
    const statusTexts = {
      available: "Trống",
      occupied: "Có khách",
      reserved: "Đã đặt",
      cleaning: "Dọn dẹp",
    };
    return statusTexts[status] || "Trống";
  };

  return (
    <div className="table-grid-container">
      {/* Table Controls */}
      <div className="table-controls">
        <div className="table-search">
          <input
            type="text"
            className="search-input"
            placeholder="Tìm kiếm bàn theo số hoặc trạng thái..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="status-filters">
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="all">Tất cả ({statusCounts.all})</option>
            <option value="available">Trống ({statusCounts.available})</option>
            <option value="occupied">Có khách ({statusCounts.occupied})</option>
            <option value="reserved">Đã đặt ({statusCounts.reserved})</option>
            <option value="cleaning">Dọn dẹp ({statusCounts.cleaning})</option>
          </select>
        </div>
      </div>

      {/* Area Tabs */}
      <div className="area-tabs">
        {areas.map((area) => (
          <button
            key={area.id}
            className={`area-tab ${activeArea === area.id ? "active" : ""}`}
            onClick={() => onAreaChange(area.id)}
          >
            <span className="area-icon">{area.icon}</span>
            <span className="area-name">{area.name}</span>
            <span className="area-count">{area.count}</span>
          </button>
        ))}
      </div>

      {/* Table Grid */}
      <div className="table-grid">
        <div className="table-row">
          {tables.map((table) => (
            <div
              key={table.id}
              className={`table-item ${getStatusClass(table.status)}`}
              onClick={() => onTableClick(table)}
            >
              <div className="table-number">{table.id}</div>
              <div className="table-seats">{table.seats} chỗ</div>
              <div className="table-status">{getStatusText(table.status)}</div>
              {table.time && <div className="table-time">{table.time}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="table-legend">
        <div className="legend-item">
          <div className="legend-color available"></div>
          <span>Trống</span>
        </div>
        <div className="legend-item">
          <div className="legend-color occupied"></div>
          <span>Có khách</span>
        </div>
        <div className="legend-item">
          <div className="legend-color reserved"></div>
          <span>Đã đặt</span>
        </div>
        <div className="legend-item">
          <div className="legend-color cleaning"></div>
          <span>Dọn dẹp</span>
        </div>
      </div>
    </div>
  );
};

export default TableGrid;
