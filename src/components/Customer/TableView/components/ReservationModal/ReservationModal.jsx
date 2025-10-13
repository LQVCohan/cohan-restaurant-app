import React, { useState } from "react";
import Modal from "../../../../common/Modal";
import "./ReservationModal.scss";

const ReservationModal = ({
  isOpen,
  onClose,
  table,
  restaurant,
  selectedDate,
  selectedTimeSlot,
  guestCount,
  onSubmit,
  isLoading,
}) => {
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    specialRequests: "",
    occasion: "",
  });

  const [errors, setErrors] = useState({});

  const occasions = [
    "Sinh nhật",
    "Kỷ niệm",
    "Hẹn hò",
    "Họp mặt gia đình",
    "Tiệc công ty",
    "Khác",
  ];

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.customerName.trim()) {
      newErrors.customerName = "Vui lòng nhập họ tên";
    }

    if (!formData.customerPhone.trim()) {
      newErrors.customerPhone = "Vui lòng nhập số điện thoại";
    } else if (
      !/^[0-9]{10,11}$/.test(formData.customerPhone.replace(/\s/g, ""))
    ) {
      newErrors.customerPhone = "Số điện thoại không hợp lệ";
    }

    if (
      formData.customerEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail)
    ) {
      newErrors.customerEmail = "Email không hợp lệ";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit(formData);
  };

  const handleClose = () => {
    setFormData({
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      specialRequests: "",
      occasion: "",
    });
    setErrors({});
    onClose();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (!table) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Đặt bàn"
      size="large"
      className="reservation-modal"
    >
      <div className="reservation-content">
        {/* Booking Summary */}
        <div className="booking-summary">
          <h3 className="summary-title">📋 Thông tin đặt bàn</h3>

          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">🏪 Nhà hàng:</span>
              <span className="summary-value">{restaurant.name}</span>
            </div>

            <div className="summary-item">
              <span className="summary-label">🪑 Bàn số:</span>
              <span className="summary-value">{table.number}</span>
            </div>

            <div className="summary-item">
              <span className="summary-label">📅 Ngày:</span>
              <span className="summary-value">{formatDate(selectedDate)}</span>
            </div>

            <div className="summary-item">
              <span className="summary-label">🕐 Giờ:</span>
              <span className="summary-value">{selectedTimeSlot}</span>
            </div>

            <div className="summary-item">
              <span className="summary-label">👥 Số khách:</span>
              <span className="summary-value">{guestCount} người</span>
            </div>

            {table.reservationFee && (
              <div className="summary-item">
                <span className="summary-label">💰 Phí đặt bàn:</span>
                <span className="summary-value">
                  {table.reservationFee.toLocaleString("vi-VN")}đ
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Customer Form */}
        <form onSubmit={handleSubmit} className="reservation-form">
          <h3 className="form-title">👤 Thông tin khách hàng</h3>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Họ và tên *</label>
              <input
                type="text"
                className={`form-input ${
                  errors.customerName ? "form-input--error" : ""
                }`}
                value={formData.customerName}
                onChange={(e) =>
                  handleInputChange("customerName", e.target.value)
                }
                placeholder="Nhập họ và tên"
              />
              {errors.customerName && (
                <span className="form-error">{errors.customerName}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Số điện thoại *</label>
              <input
                type="tel"
                className={`form-input ${
                  errors.customerPhone ? "form-input--error" : ""
                }`}
                value={formData.customerPhone}
                onChange={(e) =>
                  handleInputChange("customerPhone", e.target.value)
                }
                placeholder="Nhập số điện thoại"
              />
              {errors.customerPhone && (
                <span className="form-error">{errors.customerPhone}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className={`form-input ${
                  errors.customerEmail ? "form-input--error" : ""
                }`}
                value={formData.customerEmail}
                onChange={(e) =>
                  handleInputChange("customerEmail", e.target.value)
                }
                placeholder="Nhập email (không bắt buộc)"
              />
              {errors.customerEmail && (
                <span className="form-error">{errors.customerEmail}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Dịp đặc biệt</label>
              <select
                className="form-select"
                value={formData.occasion}
                onChange={(e) => handleInputChange("occasion", e.target.value)}
              >
                <option value="">Chọn dịp (không bắt buộc)</option>
                {occasions.map((occasion) => (
                  <option key={occasion} value={occasion}>
                    {occasion}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Yêu cầu đặc biệt</label>
            <textarea
              className="form-textarea"
              value={formData.specialRequests}
              onChange={(e) =>
                handleInputChange("specialRequests", e.target.value)
              }
              placeholder="Ví dụ: Trang trí sinh nhật, yêu cầu về món ăn, vị trí ngồi..."
              rows="4"
            />
          </div>

          {/* Terms */}
          <div className="terms-section">
            <h4 className="terms-title">📜 Điều khoản đặt bàn</h4>
            <ul className="terms-list">
              <li>
                Vui lòng đến đúng giờ đã đặt, chúng tôi chỉ giữ bàn trong 15
                phút
              </li>
              <li>Phí đặt bàn sẽ được trừ vào hóa đơn thanh toán</li>
              <li>Hủy đặt bàn trước 2 tiếng để được hoàn phí</li>
              <li>Liên hệ hotline để thay đổi thông tin đặt bàn</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleClose}
              disabled={isLoading}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isLoading}
            >
              {isLoading ? "⏳ Đang xử lý..." : "🎉 Xác nhận đặt bàn"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ReservationModal;
