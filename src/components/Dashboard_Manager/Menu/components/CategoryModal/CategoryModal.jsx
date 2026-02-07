import React, { useState, useEffect } from "react";
import Modal from "../../../../common/Modal"; // Giả sử Modal này hỗ trợ render children
import {
  Plus,
  Edit3,
  Trash2,
  ArrowLeft,
  Search,
  LayoutGrid,
  Save,
  X,
  Check,
} from "lucide-react";
import { useCategoryManagement } from "../../../../../hooks/useCategoryManagement";
import { COMMON_CATEGORY_ICONS, resolveCategoryIcon } from "../../../../../utils/categoryIconMap";
import "./CategoryModal.scss";

const INITIAL_FORM = {
  id: null,
  name: "",
  icon: "🍽️",
  description: "",
};

const CategoryModal = ({ isOpen, restaurantId, timeSlot, onClose }) => {
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'form'
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hook giả lập logic (giữ nguyên logic của bạn)
  const {
    categoryMenus,
    categoryMenuLoading,
    categoryMenuError: _CATEGORY_MENU_ERROR,
    createCategoryMenu,
    updateCategoryMenu,
    deleteCategoryMenu,
  } = useCategoryManagement({
    restaurantId,
    timeSlot,
    loadCategories: false,
    loadTopCategories: false,
    loadCategoryMenus: isOpen,
  });

  useEffect(() => {
    if (!isOpen) return;
    setViewMode("list");
    setFormData(INITIAL_FORM);
    setErrors({});
    setSearchTerm("");
  }, [isOpen]);

  // --- ACTIONS ---
  const switchToCreate = () => {
    setFormData(INITIAL_FORM);
    setErrors({});
    setViewMode("form");
  };

  const switchToEdit = (cat) => {
    setFormData({
      id: cat.id || cat._id,
      name: cat.name || "",
      icon: resolveCategoryIcon(cat.name || ""),
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
      newErrors.name = "Vui lòng nhập tên danh mục";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        // icon: formData.icon (Nếu BE hỗ trợ lưu icon thì thêm vào đây)
      };

      if (formData.id) {
        await updateCategoryMenu({ id: formData.id, ...payload });
      } else {
        await createCategoryMenu({ restaurantId, ...payload });
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
    if (!window.confirm("Bạn có chắc muốn xóa danh mục này?")) return;
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
      title={null} // Tắt title mặc định để custom header đẹp hơn
      size="md"
      className="modern-category-modal"
    >
      <div className="modal-container">
        {/* --- VIEW: LIST --- */}
        {viewMode === "list" && (
          <div className="view-section fade-in-slide">
            <div className="modal-header">
              <div className="header-content">
                <h3>Quản lý Danh mục</h3>
                <p>Danh sách các nhóm món ăn trong thực đơn</p>
              </div>
              <button className="btn-close-modal" onClick={onClose}>
                <X size={20} />
              </button>
            </div>

            <div className="list-toolbar">
              <div className="search-box">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Tìm kiếm danh mục..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button className="btn-primary" onClick={switchToCreate}>
                <Plus size={18} />
                <span>Thêm mới</span>
              </button>
            </div>

            <div className="list-body custom-scrollbar">
              {categoryMenuLoading ? (
                <div className="state-loading">
                  <div className="spinner"></div>
                  <span>Đang tải dữ liệu...</span>
                </div>
              ) : filteredList.length === 0 ? (
                <div className="state-empty">
                  <div className="empty-icon-bg">
                    <LayoutGrid size={32} />
                  </div>
                  <p className="main-text">Chưa có danh mục nào</p>
                  <p className="sub-text">
                    Hãy tạo danh mục đầu tiên cho thực đơn của bạn
                  </p>
                </div>
              ) : (
                <div className="category-list">
                  {filteredList.map((cat) => (
                    <div key={cat.id || cat._id} className="category-item-card">
                      <div className="card-visual">
                        <span>{resolveCategoryIcon(cat.name || "")}</span>
                      </div>
                      <div className="card-info">
                        <span className="cat-name">{cat.name}</span>
                        <span className="cat-desc">
                          {cat.description || "Chưa có mô tả"}
                        </span>
                      </div>
                      <div className="card-actions">
                        <button
                          className="action-btn edit"
                          onClick={() => switchToEdit(cat)}
                          title="Chỉnh sửa"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={() => handleDelete(cat.id || cat._id)}
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- VIEW: FORM --- */}
        {viewMode === "form" && (
          <form onSubmit={handleSubmit} className="view-section fade-in-slide">
            <div className="modal-header with-back">
              <button type="button" className="btn-back" onClick={switchToList}>
                <ArrowLeft size={20} />
              </button>
              <div className="header-content">
                <h3>
                  {formData.id ? "Cập nhật Danh mục" : "Tạo Danh mục mới"}
                </h3>
              </div>
            </div>

            <div className="form-body custom-scrollbar">
              {/* Name Input */}
              <div className="form-group">
                <label>
                  Tên danh mục <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className={errors.name ? "error" : ""}
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="VD: Món Khai Vị, Đồ uống..."
                  autoFocus
                />
                {errors.name && <span className="err-msg">{errors.name}</span>}
              </div>

              {/* Description Input */}
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

              {/* Icon Picker */}
              <div className="form-group">
                <label>Biểu tượng đại diện</label>
                <div className="icon-picker-container">
                  <div className="selected-preview">
                    <span>{formData.icon}</span>
                  </div>
                  <div className="icon-grid custom-scrollbar">
                    {COMMON_CATEGORY_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        className={`icon-option ${
                          formData.icon === icon ? "active" : ""
                        }`}
                        onClick={() => handleInputChange("icon", icon)}
                      >
                        {icon}
                        {formData.icon === icon && (
                          <div className="check-mark">
                            <Check size={10} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="custom-icon-input">
                  <span>Hoặc nhập ký tự/icon khác:</span>
                  <input
                    type="text"
                    value={formData.icon}
                    maxLength={2}
                    onChange={(e) => handleInputChange("icon", e.target.value)}
                  />
                </div>
              </div>

              {errors.submit && (
                <div className="global-error">{errors.submit}</div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={switchToList}
                disabled={isSubmitting}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="btn-save"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>Đang lưu...</>
                ) : (
                  <>
                    <Save size={16} />
                    {formData.id ? "Lưu thay đổi" : "Tạo mới"}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default CategoryModal;
