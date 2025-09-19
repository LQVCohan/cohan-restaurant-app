import React, { useState, useEffect } from "react";
import { RESTAURANTS, PROMOTION_TYPES } from "../../../../../utils/constants";
import "./PromotionModal.scss";

const PromotionModal = ({ promotion, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    type: "",
    discountValue: "",
    minOrderValue: "",
    maxDiscount: "",
    startDate: "",
    endDate: "",
    usageLimit: "",
    targetAudience: "all",
    restaurantId: "",
    description: "",
    conditions: "",
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (promotion) {
      setFormData({
        name: promotion.name || "",
        code: promotion.code || "",
        type: promotion.type || "",
        discountValue: promotion.discountValue || "",
        minOrderValue: promotion.minOrderValue || "",
        maxDiscount: promotion.maxDiscount || "",
        startDate: promotion.startDate || "",
        endDate: promotion.endDate || "",
        usageLimit: promotion.usageLimit || "",
        targetAudience: promotion.targetAudience || "all",
        restaurantId: promotion.restaurantId || "",
        description: promotion.description || "",
        conditions: promotion.conditions ? promotion.conditions.join("\n") : "",
      });
    }
  }, [promotion]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Tên khuyến mãi là bắt buộc";
    }

    if (!formData.code.trim()) {
      newErrors.code = "Mã khuyến mãi là bắt buộc";
    }

    if (!formData.type) {
      newErrors.type = "Loại khuyến mãi là bắt buộc";
    }

    if (!formData.discountValue) {
      newErrors.discountValue = "Giá trị giảm là bắt buộc";
    }

    if (!formData.startDate) {
      newErrors.startDate = "Ngày bắt đầu là bắt buộc";
    }

    if (!formData.endDate) {
      newErrors.endDate = "Ngày kết thúc là bắt buộc";
    }

    if (!formData.restaurantId) {
      newErrors.restaurantId = "Nhà hàng là bắt buộc";
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
      discountValue: parseFloat(formData.discountValue),
      minOrderValue: formData.minOrderValue
        ? parseFloat(formData.minOrderValue)
        : null,
      maxDiscount: formData.maxDiscount
        ? parseFloat(formData.maxDiscount)
        : null,
      usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
      conditions: formData.conditions.split("\n").filter((c) => c.trim()),
      status: "active",
    };

    onSave(promotionData);
  };

  const handleSaveDraft = () => {
    const promotionData = {
      ...formData,
      discountValue: parseFloat(formData.discountValue) || 0,
      minOrderValue: formData.minOrderValue
        ? parseFloat(formData.minOrderValue)
        : null,
      maxDiscount: formData.maxDiscount
        ? parseFloat(formData.maxDiscount)
        : null,
      usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
      conditions: formData.conditions.split("\n").filter((c) => c.trim()),
      status: "draft",
    };

    onSave(promotionData);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {promotion ? "✏️ Chỉnh Sửa Khuyến Mãi" : "🎁 Tạo Khuyến Mãi Mới"}
          </h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Tên khuyến mãi *</label>
              <input
                type="text"
                name="name"
                className={`form-input ${errors.name ? "error" : ""}`}
                value={formData.name}
                onChange={handleInputChange}
              />
              {errors.name && (
                <span className="error-message">{errors.name}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Mã khuyến mãi *</label>
              <input
                type="text"
                name="code"
                className={`form-input ${errors.code ? "error" : ""}`}
                value={formData.code}
                onChange={handleInputChange}
              />
              {errors.code && (
                <span className="error-message">{errors.code}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Loại khuyến mãi *</label>
              <select
                name="type"
                className={`form-select ${errors.type ? "error" : ""}`}
                value={formData.type}
                onChange={handleInputChange}
              >
                <option value="">-- Chọn loại --</option>
                {Object.entries(PROMOTION_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              {errors.type && (
                <span className="error-message">{errors.type}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Giá trị giảm *</label>
              <input
                type="number"
                name="discountValue"
                className={`form-input ${errors.discountValue ? "error" : ""}`}
                value={formData.discountValue}
                onChange={handleInputChange}
              />
              {errors.discountValue && (
                <span className="error-message">{errors.discountValue}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Đơn hàng tối thiểu</label>
              <input
                type="number"
                name="minOrderValue"
                className="form-input"
                value={formData.minOrderValue}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Giảm tối đa</label>
              <input
                type="number"
                name="maxDiscount"
                className="form-input"
                value={formData.maxDiscount}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Ngày bắt đầu *</label>
              <input
                type="datetime-local"
                name="startDate"
                className={`form-input ${errors.startDate ? "error" : ""}`}
                value={formData.startDate}
                onChange={handleInputChange}
              />
              {errors.startDate && (
                <span className="error-message">{errors.startDate}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Ngày kết thúc *</label>
              <input
                type="datetime-local"
                name="endDate"
                className={`form-input ${errors.endDate ? "error" : ""}`}
                value={formData.endDate}
                onChange={handleInputChange}
              />
              {errors.endDate && (
                <span className="error-message">{errors.endDate}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Số lượng sử dụng</label>
              <input
                type="number"
                name="usageLimit"
                className="form-input"
                value={formData.usageLimit}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Đối tượng áp dụng</label>
              <select
                name="targetAudience"
                className="form-select"
                value={formData.targetAudience}
                onChange={handleInputChange}
              >
                <option value="all">Tất cả khách hàng</option>
                <option value="new">Khách hàng mới</option>
                <option value="vip">Khách VIP</option>
                <option value="birthday">Sinh nhật</option>
                <option value="inactive">Khách không hoạt động</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Nhà hàng áp dụng *</label>
              <select
                name="restaurantId"
                className={`form-select ${errors.restaurantId ? "error" : ""}`}
                value={formData.restaurantId}
                onChange={handleInputChange}
              >
                <option value="">-- Chọn nhà hàng --</option>
                {Object.entries(RESTAURANTS).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
              {errors.restaurantId && (
                <span className="error-message">{errors.restaurantId}</span>
              )}
            </div>

            <div className="form-group full-width">
              <label className="form-label">Mô tả khuyến mãi</label>
              <textarea
                name="description"
                className="form-textarea"
                placeholder="Mô tả chi tiết về khuyến mãi..."
                value={formData.description}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group full-width">
              <label className="form-label">Điều kiện áp dụng</label>
              <textarea
                name="conditions"
                className="form-textarea"
                placeholder="Các điều kiện và quy định áp dụng khuyến mãi (mỗi điều kiện một dòng)..."
                value={formData.conditions}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSaveDraft}
            >
              💾 Lưu Nháp
            </button>
            <button type="submit" className="btn btn-primary">
              🚀 {promotion ? "Cập Nhật" : "Tạo Khuyến Mãi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PromotionModal;
