// src/pages/Restaurant/MenuManagement/components/CategoryModal/CategoryModal.jsx
import React, { useState } from "react";
import Modal from "../../../../common/Modal";
import "./CategoryModal.scss";
import { useCategoryManagement } from "../../../../../hooks/useCategoryManagement";

const CategoryModal = ({ isOpen, restaurantId, timeSlot, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: "",
    icon: "",
    description: "",
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // dùng hook mới: quản lý Category
  const { createCategory } = useCategoryManagement({
    restaurantId,
    timeSlot,
  });

  const commonIcons = [
    "🥗",
    "🍽️",
    "🍰",
    "🥤",
    "🍜",
    "🍚",
    "🍲",
    "🥖",
    "🍕",
    "🍔",
    "🌮",
    "🍣",
    "🍤",
    "🥘",
    "🍖",
    "🥩",
    "🍗",
    "🥓",
    "🧀",
    "🥞",
    "🍳",
    "🥯",
    "🍞",
    "🥨",
  ];

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error khi user sửa
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
      newErrors.name = "Tên danh mục là bắt buộc";
    }

    if (!formData.icon.trim()) {
      newErrors.icon = "Vui lòng chọn icon";
    }

    if (!restaurantId) {
      newErrors.restaurantId = "Thiếu thông tin nhà hàng";
    }

    if (!timeSlot) {
      newErrors.timeSlot = "Thiếu khung giờ áp dụng";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      name: "",
      icon: "",
      description: "",
    });
    setErrors({});
    setSubmitting(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSubmitting(true);

      // ⚠️ BE KHÔNG LƯU ICON / DESCRIPTION
      // -> chỉ gửi đúng schema CreateCategoryInput
      const created = await createCategory({
        restaurantId,
        timeSlot,
        name: formData.name.trim(),
        // nếu cần thứ tự thì sau này có UI sort -> sửa order
        order: 0,
      });

      // FE giữ icon & description để map hiển thị
      onSave?.(created, {
        icon: formData.icon,
        description: formData.description.trim(),
      });

      resetForm();
    } catch (err) {
      console.error("Create category error:", err);
      setErrors((prev) => ({
        ...prev,
        submit: err.message || "Có lỗi xảy ra khi tạo danh mục",
      }));
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Thêm danh mục mới"
      size="medium"
      className="category-modal"
    >
      <form onSubmit={handleSubmit} className="category-form">
        {/* Tên danh mục */}
        <div className="form-group">
          <label className="form-label">Tên danh mục *</label>
          <input
            type="text"
            className={`form-input ${errors.name ? "form-input--error" : ""}`}
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder="Ví dụ: Món khai vị, Món chính..."
          />
          {errors.name && <span className="form-error">{errors.name}</span>}
        </div>

        {/* Icon danh mục - chỉ dùng trên FE */}
        <div className="form-group">
          <label className="form-label">Icon danh mục *</label>
          <div className="icon-selector">
            <div className="icon-grid">
              {commonIcons.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`icon-option ${
                    formData.icon === icon ? "icon-option--selected" : ""
                  }`}
                  onClick={() => handleInputChange("icon", icon)}
                >
                  {icon}
                </button>
              ))}
            </div>
            <div className="custom-icon">
              <input
                type="text"
                className="form-input"
                value={formData.icon}
                onChange={(e) => handleInputChange("icon", e.target.value)}
                placeholder="Hoặc nhập emoji/icon tùy chỉnh"
              />
            </div>
          </div>
          {errors.icon && <span className="form-error">{errors.icon}</span>}
        </div>

        {/* Mô tả chỉ giữ FE */}
        <div className="form-group">
          <label className="form-label">Mô tả (chỉ dùng hiển thị FE)</label>
          <textarea
            className="form-textarea"
            value={formData.description}
            onChange={(e) => handleInputChange("description", e.target.value)}
            placeholder="Mô tả ngắn về danh mục này..."
            rows="3"
          />
        </div>

        {/* Error chung */}
        {errors.restaurantId && (
          <div className="form-error form-error--global">
            {errors.restaurantId}
          </div>
        )}
        {errors.timeSlot && (
          <div className="form-error form-error--global">{errors.timeSlot}</div>
        )}
        {errors.submit && (
          <div className="form-error form-error--global">{errors.submit}</div>
        )}

        {/* Actions */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleClose}
            disabled={submitting}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting}
          >
            {submitting ? "Đang tạo..." : "Tạo danh mục"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CategoryModal;
