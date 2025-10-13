import React from "react";
import "./ReservationSummary.scss";

const ReservationSummary = ({
  restaurant,
  selectedDate,
  selectedTimeSlot,
  guestCount,
  availableTablesCount,
}) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const getSummaryStatus = () => {
    if (availableTablesCount === 0) {
      return {
        icon: "❌",
        title: "Không có bàn trống",
        message: "Thử chọn giờ khác hoặc giảm số khách",
        color: "danger",
      };
    } else if (availableTablesCount <= 3) {
      return {
        icon: "⚠️",
        title: "Còn ít bàn trống",
        message: "Nên đặt bàn sớm để đảm bảo có chỗ",
        color: "warning",
      };
    } else {
      return {
        icon: "✅",
        title: "Có nhiều bàn trống",
        message: "Bạn có thể chọn bàn phù hợp",
        color: "success",
      };
    }
  };

  const status = getSummaryStatus();

  return (
    <div className="reservation-summary">
      <div className="summary-card">
        <div className="summary-header">
          <h3 className="summary-title">📋 Tóm tắt đặt bàn</h3>
          <div className={`status-badge status-badge--${status.color}`}>
            <span className="status-icon">{status.icon}</span>
            <span className="status-text">{status.title}</span>
          </div>
        </div>

        <div className="summary-content">
          <div className="booking-info">
            <div className="info-row">
              <span className="info-label">🏪 Nhà hàng:</span>
              <span className="info-value">{restaurant.name}</span>
            </div>

            <div className="info-row">
              <span className="info-label">📅 Ngày:</span>
              <span className="info-value">{formatDate(selectedDate)}</span>
            </div>

            <div className="info-row">
              <span className="info-label">🕐 Giờ:</span>
              <span className="info-value">{selectedTimeSlot}</span>
            </div>

            <div className="info-row">
              <span className="info-label">👥 Số khách:</span>
              <span className="info-value">{guestCount} người</span>
            </div>
          </div>

          <div className="availability-info">
            <div className="availability-count">
              <span className="count-number">{availableTablesCount}</span>
              <span className="count-label">bàn có sẵn</span>
            </div>

            <p className="availability-message">{status.message}</p>
          </div>
        </div>

        <div className="summary-actions">
          <div className="tips">
            <h4 className="tips-title">💡 Gợi ý</h4>
            <ul className="tips-list">
              <li>Chọn bàn có nhãn "Đề xuất" để phù hợp nhất với số khách</li>
              <li>Bàn gần cửa sổ thường có view đẹp hơn</li>
              <li>Đặt bàn trước 2 tiếng để được ưu tiên</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationSummary;
