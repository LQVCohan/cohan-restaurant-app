// src/pages/Restaurant/MenuManagement/components/CategoryModal/CategoryModal.jsx
import React, { useState, useEffect } from "react";
import Modal from "../../../../common/Modal";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiArrowLeft,
  FiSearch,
  FiLayout,
} from "react-icons/fi";
import { useCategoryManagement } from "../../../../../hooks/useCategoryManagement";
import "./CategoryModal.scss";

const COMMON_ICONS = [
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
  "🔥",
  "❄️",
  "🌱",
  "🌶️",
  "⭐",
  "🆕",
  "👨‍🍳",
  "🍷",
];

const INITIAL_FORM = {
  id: null,
  name: "",
  icon: "🍽️", // FE-only
  description: "",
};

const CategoryModal = ({ isOpen, restaurantId, timeSlot, onClose }) => {
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'form'
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    categoryMenus,
    categoryMenuLoading,
    categoryMenuError,
    createCategoryMenu,
    updateCategoryMenu,
    deleteCategoryMenu,
  } = useCategoryManagement({
    restaurantId,
    timeSlot,
    loadCategories: false,
    loadTopCategories: false,
    loadCategoryMenus: isOpen, // chỉ query khi modal mở
  });

  useEffect(() => {
    if (!isOpen) return;
    setViewMode("list");
    setFormData(INITIAL_FORM);
    setErrors({});
    setSearchTerm("");
  }, [isOpen]);

  const switchToCreate = () => {
    setFormData(INITIAL_FORM);
    setErrors({});
    setViewMode("form");
  };

  const switchToEdit = (cat) => {
    setFormData({
      id: cat.id || cat._id,
      name: cat.name || "",
      // BE không lưu icon, FE dùng default
      icon: "🍽️",
      description: cat.description || "",
    });
    setErrors({});
    setViewMode("form");
  };

  const switchToList = () => {
    setViewMode("list");
    setErrors({});
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = "Tên danh mục không được để trống";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (!restaurantId) {
      setErrors({ submit: "Thiếu thông tin nhà hàng (restaurantId)." });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
      };

      if (formData.id) {
        await updateCategoryMenu({
          id: formData.id,
          ...payload,
        });
      } else {
        await createCategoryMenu({
          restaurantId,
          ...payload,
          // coverImage / isActive có thể thêm sau nếu cần
        });
      }

      switchToList();
    } catch (err) {
      console.error(err);
      setErrors({ submit: err.message || "Đã có lỗi xảy ra." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Bạn có chắc muốn xóa danh mục này? Các menu liên quan có thể bị ảnh hưởng."
      )
    )
      return;
    try {
      await deleteCategoryMenu(id);
    } catch (err) {
      alert("Lỗi khi xóa: " + (err.message || "Không xác định"));
    }
  };

  const filteredList = (categoryMenus || []).filter((c) =>
    (c.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        viewMode === "list"
          ? "Quản lý Danh mục Menu (CategoryMenu)"
          : formData.id
          ? "Cập nhật Danh mục"
          : "Tạo Danh mục mới"
      }
      size="medium"
      className="category-modal"
    >
      <div className="category-modal__body">
        {/* LIST VIEW */}
        {viewMode === "list" && (
          <div className="view-list fade-in">
            <div className="list-toolbar">
              <div className="search-box">
                <FiSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Tìm kiếm danh mục..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button className="btn-add" onClick={switchToCreate}>
                <FiPlus /> Mới
              </button>
            </div>

            <div className="list-content custom-scrollbar">
              {categoryMenuLoading ? (
                <div className="state-text">Đang tải dữ liệu...</div>
              ) : categoryMenuError ? (
                <div className="state-text error">
                  Lỗi: {categoryMenuError.message}
                </div>
              ) : filteredList.length === 0 ? (
                <div className="state-empty">
                  <div className="empty-icon">
                    <FiLayout />
                  </div>
                  <p>Chưa có danh mục nào.</p>
                  <button onClick={switchToCreate}>Tạo ngay</button>
                </div>
              ) : (
                <div className="category-list">
                  {filteredList.map((cat) => (
                    <div key={cat.id || cat._id} className="category-item">
                      <div className="cat-info">
                        <div className="cat-icon">🍽️</div>
                        <div className="cat-text">
                          <span className="cat-name">{cat.name}</span>
                          {cat.description && (
                            <span className="cat-desc">{cat.description}</span>
                          )}
                        </div>
                      </div>
                      <div className="cat-actions">
                        <button
                          className="action-btn edit"
                          onClick={() => switchToEdit(cat)}
                          title="Chỉnh sửa"
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={() => handleDelete(cat.id || cat._id)}
                          title="Xóa"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* FORM VIEW */}
        {viewMode === "form" && (
          <form onSubmit={handleSubmit} className="view-form fade-in">
            <div className="form-content custom-scrollbar">
              <div className="form-group">
                <label>
                  Tên danh mục <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className={errors.name ? "error" : ""}
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="VD: Thực đơn chính, Menu khuyến mãi..."
                  autoFocus
                />
                {errors.name && <span className="err-msg">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label>Biểu tượng (chỉ hiển thị ở giao diện)</label>
                <div className="icon-picker">
                  <div className="icon-grid">
                    {COMMON_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        className={`icon-btn ${
                          formData.icon === icon ? "active" : ""
                        }`}
                        onClick={() => handleInputChange("icon", icon)}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  <div className="custom-icon-input">
                    <span>Hoặc nhập icon khác:</span>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) =>
                        handleInputChange("icon", e.target.value)
                      }
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Mô tả ngắn</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Mô tả hiển thị bên dưới tên danh mục..."
                />
              </div>

              {errors.submit && (
                <div className="global-error">{errors.submit}</div>
              )}
            </div>

            <div className="form-footer">
              <button
                type="button"
                className="btn-back"
                onClick={switchToList}
                disabled={isSubmitting}
              >
                <FiArrowLeft /> Quay lại
              </button>
              <button
                type="submit"
                className="btn-save"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Đang lưu..."
                  : formData.id
                  ? "Cập nhật"
                  : "Tạo mới"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default CategoryModal;
