import React, { useState } from "react";
import { useReservation } from "../../../../../hooks/useReservation";
import { formatAddress } from "../../../../../utils/formatters";
import "./ReservationForm.scss";

const ReservationForm = ({ restaurant, show, onClose }) => {
  const [formData, setFormData] = useState({
    date: "",
    time: "",
    guests: 2,
    name: "",
    phone: "",
    email: "",
    specialRequests: "",
  });

  const {
    loading,
    error,
    success,
    availableSlots,
    submitReservation,
    checkAvailability,
  } = useReservation();

  const [showSuccess, setShowSuccess] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Check availability when date changes
    if (name === "date" && value) {
      checkAvailability(restaurant.id, value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const reservationData = {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      ...formData,
    };

    const result = await submitReservation(reservationData);

    if (result.success) {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
        // Reset form
        setFormData({
          date: "",
          time: "",
          guests: 2,
          name: "",
          phone: "",
          email: "",
          specialRequests: "",
        });
      }, 3000);
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30); // 30 days from now
    return maxDate.toISOString().split("T")[0];
  };

  const guestOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  if (!show) return null;

  return (
    <div className="reservation-overlay" onClick={onClose}>
      <div className="reservation-form" onClick={(e) => e.stopPropagation()}>
        <div className="reservation-header">
          <h2 className="reservation-title">
            📅 Đặt bàn tại {restaurant.name}
          </h2>
          <button className="reservation-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {showSuccess ? (
          <div className="reservation-success">
            <div className="success-icon">✅</div>
            <h3>Đặt bàn thành công!</h3>
            <p>Chúng tôi đã gửi thông tin xác nhận đến email của bạn.</p>
            <div className="success-details">
              <div className="detail-item">
                <span className="detail-label">📅 Ngày:</span>
                <span className="detail-value">{formData.date}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">🕒 Giờ:</span>
                <span className="detail-value">{formData.time}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">👥 Số khách:</span>
                <span className="detail-value">{formData.guests} người</span>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="reservation-form-content">
            {error && (
              <div className="form-error">
                <span className="error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div className="form-grid">
              {/* Date Selection */}
              <div className="form-group">
                <label htmlFor="date" className="form-label">
                  📅 Chọn ngày
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  min={getMinDate()}
                  max={getMaxDate()}
                  required
                  className="form-input"
                />
              </div>

              {/* Guest Count */}
              <div className="form-group">
                <label htmlFor="guests" className="form-label">
                  👥 Số khách
                </label>
                <select
                  id="guests"
                  name="guests"
                  value={formData.guests}
                  onChange={handleInputChange}
                  required
                  className="form-select"
                >
                  {guestOptions.map((num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? "người" : "người"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Time Selection */}
            {formData.date && (
              <div className="form-group">
                <label className="form-label">🕒 Chọn giờ</label>
                <div className="time-slots">
                  {availableSlots.length === 0 ? (
                    <div className="no-slots">
                      <span className="no-slots-icon">😔</span>
                      <p>Không có khung giờ trống cho ngày này</p>
                    </div>
                  ) : (
                    availableSlots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        className={`time-slot ${
                          formData.time === slot.time
                            ? "time-slot--selected"
                            : ""
                        } ${!slot.available ? "time-slot--disabled" : ""}`}
                        onClick={() =>
                          slot.available &&
                          setFormData((prev) => ({ ...prev, time: slot.time }))
                        }
                        disabled={!slot.available}
                      >
                        {slot.time}
                        {!slot.available && (
                          <span className="slot-status">Đã đầy</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Customer Information */}
            <div className="form-section">
              <h3 className="section-title">👤 Thông tin khách hàng</h3>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="name" className="form-label">
                    Họ và tên *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="form-input"
                    placeholder="Nhập họ và tên"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone" className="form-label">
                    Số điện thoại *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className="form-input"
                    placeholder="0xxx xxx xxx"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="email@example.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="specialRequests" className="form-label">
                  Yêu cầu đặc biệt
                </label>
                <textarea
                  id="specialRequests"
                  name="specialRequests"
                  value={formData.specialRequests}
                  onChange={handleInputChange}
                  className="form-textarea"
                  placeholder="Ví dụ: Bàn gần cửa sổ, sinh nhật, dị ứng thực phẩm..."
                  rows="3"
                />
              </div>
            </div>

            {/* Restaurant Info */}
            <div className="reservation-info">
              <h4>📋 Thông tin đặt bàn</h4>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-icon">🏪</span>
                  <span>{restaurant.name}</span>
                </div>
                <div className="info-item">
                  <span className="info-icon">📍</span>
                  <span>{formatAddress(restaurant.address)}</span>
                </div>
                <div className="info-item">
                  <span className="info-icon">📞</span>
                  <span>{restaurant.phone}</span>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="form-terms">
              <p>
                <strong>📝 Lưu ý:</strong>
              </p>
              <ul>
                <li>Vui lòng đến đúng giờ đã đặt</li>
                <li>Nếu muốn hủy, vui lòng thông báo trước 2 tiếng</li>
                <li>Bàn sẽ được giữ trong 15 phút kể từ giờ đặt</li>
                <li>
                  Nhà hàng có quyền từ chối phục vụ nếu không tuân thủ quy định
                </li>
              </ul>
            </div>

            {/* Submit Button */}
            <div className="form-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={onClose}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={
                  loading ||
                  !formData.date ||
                  !formData.time ||
                  !formData.name ||
                  !formData.phone
                }
              >
                {loading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Đang xử lý...
                  </>
                ) : (
                  "✅ Xác nhận đặt bàn"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ReservationForm;
