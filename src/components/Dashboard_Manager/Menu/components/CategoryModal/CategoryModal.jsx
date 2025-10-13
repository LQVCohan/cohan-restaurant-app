import React, { useState } from "react";
import Modal from "../../../../common/Modal";
import "./CategoryModal.scss";

const CategoryModal = ({ isOpen, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: "",
    icon: "",
    description: "",
  });

  const [errors, setErrors] = useState({});

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
      newErrors.name = "Tên danh mục là bắt buộc";
    }

    if (!formData.icon.trim()) {
      newErrors.icon = "Vui lòng chọn icon";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSave({
      name: formData.name.trim(),
      icon: formData.icon,
      description: formData.description.trim(),
    });

    // Reset form
    setFormData({
      name: "",
      icon: "",
      description: "",
    });
    setErrors({});
  };

  const handleClose = () => {
    setFormData({
      name: "",
      icon: "",
      description: "",
    });
    setErrors({});
    onClose();
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

        <div className="form-group">
          <label className="form-label">Mô tả</label>
          <textarea
            className="form-textarea"
            value={formData.description}
            onChange={(e) => handleInputChange("description", e.target.value)}
            placeholder="Mô tả ngắn về danh mục này..."
            rows="3"
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleClose}
          >
            Hủy
          </button>
          <button type="submit" className="btn btn--primary">
            Tạo danh mục
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CategoryModal;
