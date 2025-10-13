import React from "react";
import "./TableItem.scss";

const TableItem = ({
  table,
  availability,
  isRecommended,
  guestCount,
  onClick,
}) => {
  const getTableIcon = () => {
    if (table.capacity <= 2) return "🪑";
    if (table.capacity <= 4) return "🍽️";
    if (table.capacity <= 6) return "🏛️";
    return "🏰";
  };

  const getStatusClass = () => {
    if (!availability.isAvailable) {
      switch (availability.status) {
        case "occupied":
          return "table-item--occupied";
        case "reserved":
          return "table-item--reserved";
        case "maintenance":
          return "table-item--maintenance";
        default:
          return "table-item--unavailable";
      }
    }
    return isRecommended ? "table-item--recommended" : "table-item--available";
  };

  const getStatusText = () => {
    if (!availability.isAvailable) {
      switch (availability.status) {
        case "occupied":
          return "Đang có khách";
        case "reserved":
          return "Đã đặt trước";
        case "maintenance":
          return "Bảo trì";
        default:
          return "Không khả dụng";
      }
    }
    return isRecommended ? "Phù hợp" : "Có sẵn";
  };

  const isCapacityMatch = table.capacity >= guestCount;

  return (
    <div
      className={`table-item ${getStatusClass()} ${
        !isCapacityMatch ? "table-item--small" : ""
      }`}
      onClick={onClick}
    >
      {/* Recommended Badge */}
      {isRecommended && (
        <div className="table-badge table-badge--recommended">⭐ Đề xuất</div>
      )}

      {/* Table Visual */}
      <div className="table-visual">
        <div className="table-icon">{getTableIcon()}</div>
        <div className="table-number">Bàn {table.number}</div>
      </div>

      {/* Table Info */}
      <div className="table-info">
        <div className="table-capacity">👥 {table.capacity} chỗ ngồi</div>

        {table.features && table.features.length > 0 && (
          <div className="table-features">
            {table.features.slice(0, 2).map((feature, index) => (
              <span key={index} className="feature-tag">
                {feature}
              </span>
            ))}
            {table.features.length > 2 && (
              <span className="feature-more">+{table.features.length - 2}</span>
            )}
          </div>
        )}

        <div className="table-location">
          📍 {table.location || "Vị trí tiêu chuẩn"}
        </div>
      </div>

      {/* Status */}
      <div className="table-status">
        <span className="status-text">{getStatusText()}</span>
        {availability.nextAvailable && (
          <span className="next-available">
            Trống lúc {availability.nextAvailable}
          </span>
        )}
      </div>

      {/* Price */}
      {table.reservationFee && (
        <div className="table-price">
          💰 {table.reservationFee.toLocaleString("vi-VN")}đ
        </div>
      )}

      {/* Capacity Warning */}
      {!isCapacityMatch && (
        <div className="capacity-warning">⚠️ Chỉ đủ {table.capacity} người</div>
      )}
    </div>
  );
};

export default TableItem;
