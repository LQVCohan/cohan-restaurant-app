import React, { useState, useEffect } from "react";
import Modal from "../../../common/Modal";
import Button from "../../../common/Button";
import "./ItemModal.scss";

const ItemModal = ({ isOpen, onClose, onSave, item = null }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "main",
    price: "",
    status: "available",
    prepTime: "",
    ingredients: "",
    notes: "",
    image: null,
  });

  const [errors, setErrors] = useState({});
  const [imagePreview, setImagePreview] = useState(null);

  // Reset form when modal opens/closes or item changes
  useEffect(() => {
    if (isOpen) {
      if (item) {
        // Edit mode - populate form with existing item data
        setFormData({
          name: item.name || "",
          description: item.description || "",
          category: item.category || "main",
          price: item.price.toString() || "",
          status: item.status || "available",
          prepTime: item.prepTime.toString() || "",
          ingredients: item.ingredients || "",
          notes: item.notes || "",
          image: null,
        });
        setImagePreview(item.image || null);
      } else {
        // Add mode - reset form
        setFormData({
          name: "",
          description: "",
          category: "main",
          price: "",
          status: "available",
          prepTime: "",
          ingredients: "",
          notes: "",
          image: null,
        });
        setImagePreview(null);
      }
      setErrors({});
    }
  }, [isOpen, item]);

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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        image: file,
      }));

      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Tên món ăn là bắt buộc";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Mô tả là bắt buộc";
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      newErrors.price = "Giá phải lớn hơn 0";
    }

    if (!formData.prepTime || parseInt(formData.prepTime) <= 0) {
      newErrors.prepTime = "Thời gian chuẩn bị phải lớn hơn 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      const submitData = {
        ...formData,
        price: parseFloat(formData.price),
        prepTime: parseInt(formData.prepTime),
      };

      // If editing, include the item ID
      if (item) {
        submitData.id = item.id;
      }

      onSave(submitData);
      onClose();
    }
  };

  const isEditMode = item !== null;
  const modalTitle = isEditMode ? "✏️ Chỉnh sửa món ăn" : "➕ Thêm món ăn mới";

  const modalFooter = (
    <div className="item-modal__actions">
      <Button variant="outline" onClick={onClose}>
        ❌ Hủy
      </Button>
      <Button variant="primary" onClick={handleSubmit}>
        {isEditMode ? "💾 Cập nhật" : "✅ Thêm món"}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      size="lg"
      footer={modalFooter}
      className="item-modal"
    >
      <form onSubmit={handleSubmit} className="item-modal__form">
        <div className="item-modal__grid">
          {/* Name Field */}
          <div className="item-modal__field">
            <label className="item-modal__label">🍽️ Tên món ăn *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`item-modal__input ${
                errors.name ? "item-modal__input--error" : ""
              }`}
              placeholder="Nhập tên món ăn..."
            />
            {errors.name && (
              <span className="item-modal__error">{errors.name}</span>
            )}
          </div>

          {/* Category Field */}
          <div className="item-modal__field">
            <label className="item-modal__label">📂 Danh mục</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="item-modal__select"
            >
              <option value="main">🍖 Món chính</option>
              <option value="appetizer">🥗 Khai vị</option>
              <option value="dessert">🍰 Tráng miệng</option>
              <option value="drink">🥤 Đồ uống</option>
              <option value="soup">🍲 Súp</option>
              <option value="salad">🥙 Salad</option>
            </select>
          </div>

          {/* Price Field */}
          <div className="item-modal__field">
            <label className="item-modal__label">💰 Giá (VNĐ) *</label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleInputChange}
              className={`item-modal__input ${
                errors.price ? "item-modal__input--error" : ""
              }`}
              placeholder="0"
              min="0"
              step="1000"
            />
            {errors.price && (
              <span className="item-modal__error">{errors.price}</span>
            )}
          </div>

          {/* Status Field */}
          <div className="item-modal__field">
            <label className="item-modal__label">📊 Trạng thái</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="item-modal__select"
            >
              <option value="available">✅ Có sẵn</option>
              <option value="limited">⚠️ Hạn chế</option>
              <option value="unavailable">❌ Hết hàng</option>
            </select>
          </div>

          {/* Prep Time Field */}
          <div className="item-modal__field">
            <label className="item-modal__label">
              ⏱️ Thời gian chuẩn bị (phút) *
            </label>
            <input
              type="number"
              name="prepTime"
              value={formData.prepTime}
              onChange={handleInputChange}
              className={`item-modal__input ${
                errors.prepTime ? "item-modal__input--error" : ""
              }`}
              placeholder="0"
              min="1"
            />
            {errors.prepTime && (
              <span className="item-modal__error">{errors.prepTime}</span>
            )}
          </div>

          {/* Description Field - Full Width */}
          <div className="item-modal__field item-modal__field--full">
            <label className="item-modal__label">📝 Mô tả *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className={`item-modal__textarea ${
                errors.description ? "item-modal__input--error" : ""
              }`}
              placeholder="Mô tả món ăn..."
              rows="3"
            />
            {errors.description && (
              <span className="item-modal__error">{errors.description}</span>
            )}
          </div>

          {/* Ingredients Field - Full Width */}
          <div className="item-modal__field item-modal__field--full">
            <label className="item-modal__label">🥬 Nguyên liệu</label>
            <textarea
              name="ingredients"
              value={formData.ingredients}
              onChange={handleInputChange}
              className="item-modal__textarea"
              placeholder="Liệt kê các nguyên liệu..."
              rows="2"
            />
          </div>

          {/* Notes Field - Full Width */}
          <div className="item-modal__field item-modal__field--full">
            <label className="item-modal__label">📋 Ghi chú</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              className="item-modal__textarea"
              placeholder="Ghi chú thêm..."
              rows="2"
            />
          </div>

          {/* Image Upload Field - Full Width */}
          <div className="item-modal__field item-modal__field--full">
            <label className="item-modal__label">🖼️ Hình ảnh</label>
            <div className="item-modal__image-upload">
              <input
                type="file"
                onChange={handleImageChange}
                className="item-modal__file-input"
                accept="image/*"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="item-modal__file-label">
                📁 Chọn hình ảnh
              </label>
              {imagePreview && (
                <div className="item-modal__image-preview">
                  <img src={imagePreview} alt="Preview" />
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default ItemModal;
