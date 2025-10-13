import React from "react";
import Modal from "../../../../common/Modal";
import "./TableDetailsModal.scss";

const TableDetailsModal = ({
  isOpen,
  onClose,
  table,
  selectedDate,
  selectedTimeSlot,
  availability,
}) => {
  if (!table || !availability) return null;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusInfo = () => {
    switch (availability.status) {
      case "occupied":
        return {
          icon: "🔴",
          title: "Bàn đang có khách",
          description: "Bàn này hiện đang được sử dụng",
          color: "danger",
        };
      case "reserved":
        return {
          icon: "🟡",
          title: "Bàn đã được đặt trước",
          description: "Bàn này đã có khách đặt trước",
          color: "warning",
        };
      case "maintenance":
        return {
          icon: "🔧",
          title: "Bàn đang bảo trì",
          description: "Bàn này tạm thời không thể sử dụng",
          color: "gray",
        };
      default:
        return {
          icon: "❌",
          title: "Bàn không khả dụng",
          description: "Bàn này hiện không thể đặt",
          color: "danger",
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Bàn số ${table.number}`}
      size="medium"
      className="table-details-modal"
    >
      <div className="table-details">
        {/* Status Banner */}
        <div className={`status-banner status-banner--${statusInfo.color}`}>
          <div className="status-icon">{statusInfo.icon}</div>
          <div className="status-content">
            <h3 className="status-title">{statusInfo.title}</h3>
            <p className="status-description">{statusInfo.description}</p>
          </div>
        </div>

        {/* Table Information */}
        <div className="table-info-section">
          <h4 className="section-title">📋 Thông tin bàn</h4>

          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">🪑 Số chỗ ngồi:</span>
              <span className="info-value">{table.capacity} người</span>
            </div>

            <div className="info-item">
              <span className="info-label">📍 Vị trí:</span>
              <span className="info-value">
                {table.location || "Vị trí tiêu chuẩn"}
              </span>
            </div>

            <div className="info-item">
              <span className="info-label">🏛️ Khu vực:</span>
              <span className="info-value">
                {table.area || "Khu vực chính"}
              </span>
            </div>

            {table.reservationFee && (
              <div className="info-item">
                <span className="info-label">💰 Phí đặt bàn:</span>
                <span className="info-value">
                  {table.reservationFee.toLocaleString("vi-VN")}đ
                </span>
              </div>
            )}
          </div>

          {/* Features */}
          {table.features && table.features.length > 0 && (
            <div className="features-section">
              <h5 className="features-title">✨ Tiện ích</h5>
              <div className="features-list">
                {table.features.map((feature, index) => (
                  <span key={index} className="feature-tag">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Booking Information */}
        <div className="booking-info-section">
          <h4 className="section-title">📅 Thông tin đặt bàn</h4>

          <div className="booking-details">
            <div className="booking-item">
              <span className="booking-label">Ngày:</span>
              <span className="booking-value">{formatDate(selectedDate)}</span>
            </div>

            <div className="booking-item">
              <span className="booking-label">Giờ:</span>
              <span className="booking-value">{selectedTimeSlot}</span>
            </div>
          </div>
        </div>

        {/* Alternative Times */}
        {availability.alternativeTimes &&
          availability.alternativeTimes.length > 0 && (
            <div className="alternatives-section">
              <h4 className="section-title">🕐 Khung giờ khác có sẵn</h4>
              <div className="alternative-times">
                {availability.alternativeTimes.map((time, index) => (
                  <div key={index} className="time-slot">
                    <span className="time-value">{time}</span>
                    <span className="time-status">Có sẵn</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Next Available */}
        {availability.nextAvailable && (
          <div className="next-available-section">
            <div className="next-available-card">
              <div className="next-available-icon">⏰</div>
              <div className="next-available-content">
                <h5>Thời gian trống tiếp theo</h5>
                <p>{availability.nextAvailable}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn btn--secondary" onClick={onClose}>
            Đóng
          </button>

          {availability.alternativeTimes &&
            availability.alternativeTimes.length > 0 && (
              <button className="btn btn--primary">🔍 Xem giờ khác</button>
            )}
        </div>
      </div>
    </Modal>
  );
};

export default TableDetailsModal;
