import React, { useState } from "react";
import Modal from "../../../../common/Modal";
import "./PromotionModal.scss";

const PromotionModal = ({ isOpen, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "percentage", // 'percentage', 'fixed', 'buy_get'
    value: "",
    minOrder: "",
    maxDiscount: "",
    startDate: "",
    endDate: "",
    applicableItems: [],
    isActive: true,
  });

  const [errors, setErrors] = useState({});

  const promotionTypes = [
    { value: "percentage", label: "Giảm theo phần trăm (%)" },
    { value: "fixed", label: "Giảm số tiền cố định (VNĐ)" },
    { value: "buy_get", label: "Mua X tặng Y" },
  ];

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Tên khuyến mãi là bắt buộc";
    }

    if (!formData.value) {
      newErrors.value = "Giá trị khuyến mãi là bắt buộc";
    }

    if (!formData.startDate) {
      newErrors.startDate = "Ngày bắt đầu là bắt buộc";
    }

    if (!formData.endDate) {
      newErrors.endDate = "Ngày kết thúc là bắt buộc";
    }

    if (
      formData.startDate &&
      formData.endDate &&
      formData.startDate >= formData.endDate
    ) {
      newErrors.endDate = "Ngày kết thúc phải sau ngày bắt đầu";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const promotionData = {
      ...formData,
      value: parseFloat(formData.value),
      minOrder: formData.minOrder ? parseFloat(formData.minOrder) : 0,
      maxDiscount: formData.maxDiscount
        ? parseFloat(formData.maxDiscount)
        : null,
    };

    onSave(promotionData);

    // Reset form
    setFormData({
      name: "",
      description: "",
      type: "percentage",
      value: "",
      minOrder: "",
      maxDiscount: "",
      startDate: "",
      endDate: "",
      applicableItems: [],
      isActive: true,
    });
    setErrors({});
  };

  const handleClose = () => {
    setFormData({
      name: "",
      description: "",
      type: "percentage",
      value: "",
      minOrder: "",
      maxDiscount: "",
      startDate: "",
      endDate: "",
      applicableItems: [],
      isActive: true,
    });
    setErrors({});
    onClose();
  };

  const getValueLabel = () => {
    switch (formData.type) {
      case "percentage":
        return "Phần trăm giảm (%)";
      case "fixed":
        return "Số tiền giảm (VNĐ)";
      case "buy_get":
        return "Số lượng mua";
      default:
        return "Giá trị";
    }
  };

  const getValuePlaceholder = () => {
    switch (formData.type) {
      case "percentage":
        return "Ví dụ: 10 (giảm 10%)";
      case "fixed":
        return "Ví dụ: 50000 (giảm 50,000 VNĐ)";
      case "buy_get":
        return "Ví dụ: 2 (mua 2 tặng 1)";
      default:
        return "";
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Tạo khuyến mãi mới"
      size="lg"
      className="promotion-modal"
    >
      <form onSubmit={handleSubmit} className="promotion-form">
        {/* Basic Information */}
        <div className="form-section">
          <h4 className="section-title">📋 Thông tin cơ bản</h4>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Tên khuyến mãi *</label>
              <input
                type="text"
                className={`form-input ${
                  errors.name ? "form-input--error" : ""
                }`}
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Ví dụ: Giảm giá cuối tuần"
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Loại khuyến mãi</label>
              <select
                className="form-select"
                value={formData.type}
                onChange={(e) => handleInputChange("type", e.target.value)}
              >
                {promotionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mô tả khuyến mãi</label>
            <textarea
              className="form-textarea"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Mô tả chi tiết về chương trình khuyến mãi..."
              rows="3"
            />
          </div>
        </div>

        {/* Promotion Details */}
        <div className="form-section">
          <h4 className="section-title">💰 Chi tiết khuyến mãi</h4>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">{getValueLabel()} *</label>
              <input
                type="number"
                className={`form-input ${
                  errors.value ? "form-input--error" : ""
                }`}
                value={formData.value}
                onChange={(e) => handleInputChange("value", e.target.value)}
                placeholder={getValuePlaceholder()}
                min="0"
                step={formData.type === "fixed" ? "1000" : "1"}
              />
              {errors.value && (
                <span className="form-error">{errors.value}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Đơn hàng tối thiểu (VNĐ)</label>
              <input
                type="number"
                className="form-input"
                value={formData.minOrder}
                onChange={(e) => handleInputChange("minOrder", e.target.value)}
                placeholder="Ví dụ: 100000"
                min="0"
                step="1000"
              />
            </div>

            {formData.type === "percentage" && (
              <div className="form-group">
                <label className="form-label">Giảm tối đa (VNĐ)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.maxDiscount}
                  onChange={(e) =>
                    handleInputChange("maxDiscount", e.target.value)
                  }
                  placeholder="Ví dụ: 50000"
                  min="0"
                  step="1000"
                />
              </div>
            )}
          </div>
        </div>

        {/* Time Period */}
        <div className="form-section">
          <h4 className="section-title">📅 Thời gian áp dụng</h4>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Ngày bắt đầu *</label>
              <input
                type="datetime-local"
                className={`form-input ${
                  errors.startDate ? "form-input--error" : ""
                }`}
                value={formData.startDate}
                onChange={(e) => handleInputChange("startDate", e.target.value)}
              />
              {errors.startDate && (
                <span className="form-error">{errors.startDate}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Ngày kết thúc *</label>
              <input
                type="datetime-local"
                className={`form-input ${
                  errors.endDate ? "form-input--error" : ""
                }`}
                value={formData.endDate}
                onChange={(e) => handleInputChange("endDate", e.target.value)}
              />
              {errors.endDate && (
                <span className="form-error">{errors.endDate}</span>
              )}
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="form-section">
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                className="checkbox-input"
                checked={formData.isActive}
                onChange={(e) =>
                  handleInputChange("isActive", e.target.checked)
                }
              />
              <span className="checkbox-text">Kích hoạt khuyến mãi ngay</span>
            </label>
          </div>
        </div>

        {/* Preview */}
        <div className="form-section">
          <h4 className="section-title">👁️ Xem trước</h4>
          <div className="promotion-preview">
            <div className="preview-card">
              <div className="preview-header">
                <h5 className="preview-title">
                  {formData.name || "Tên khuyến mãi"}
                </h5>
                <span
                  className={`preview-status ${
                    formData.isActive
                      ? "preview-status--active"
                      : "preview-status--inactive"
                  }`}
                >
                  {formData.isActive ? "Đang hoạt động" : "Tạm dừng"}
                </span>
              </div>
              <p className="preview-description">
                {formData.description ||
                  "Mô tả khuyến mãi sẽ hiển thị ở đây..."}
              </p>
              <div className="preview-details">
                <div className="preview-detail">
                  <strong>Loại:</strong>{" "}
                  {promotionTypes.find((t) => t.value === formData.type)?.label}
                </div>
                {formData.value && (
                  <div className="preview-detail">
                    <strong>Giá trị:</strong> {formData.value}
                    {formData.type === "percentage" && "%"}
                    {formData.type === "fixed" && " VNĐ"}
                  </div>
                )}
                {formData.minOrder && (
                  <div className="preview-detail">
                    <strong>Đơn tối thiểu:</strong>{" "}
                    {parseInt(formData.minOrder).toLocaleString("vi-VN")} VNĐ
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleClose}
          >
            Hủy
          </button>
          <button type="submit" className="btn btn--primary">
            Tạo khuyến mãi
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PromotionModal;
