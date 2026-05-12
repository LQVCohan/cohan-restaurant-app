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
  AlertCircle,
} from "lucide-react";
import { useCategoryManagement } from "../../../../../hooks/useCategoryManagement";
import {
  COMMON_CATEGORY_ICONS,
  resolveCategoryIcon,
} from "../../../../../utils/categoryIconMap";
import useModalDraft from "../../../../../hooks/useModalDraft";
import { useNotification } from "../../../../../hooks/useNotification";
import "./CategoryModal.scss";

const INITIAL_FORM = {
  id: null,
  name: "",
  icon: "🍽️",
  description: "",
};

const CategoryModal = ({ isOpen, restaurantId, timeSlot, onClose }) => {
  const { showNotification } = useNotification();
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'form'
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState(null);
  const [isDeletingCategoryMenu, setIsDeletingCategoryMenu] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const isDirty =
    viewMode === "form" &&
    (formData.name.trim() ||
      formData.description.trim() ||
      (formData.icon || "") !== "🍽️");

  const { requestCloseWithDraft, clearDraft } = useModalDraft({
    enabled: isOpen && viewMode === "form",
    draftIdentity: {
      module: "menu",
      modal: "category-modal",
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: formData.id ? "edit" : "create",
      entityType: "category",
      recordId: formData.id || null,
      context: timeSlot || "all-day",
      schemaVersion: "1",
    },
    formValue: formData,
    isDirty,
    sanitize: (v) => ({
      id: v?.id || null,
      name: v?.name || "",
      icon: v?.icon || "🍽️",
      description: v?.description || "",
    }),
    onRestore: (draft) => {
      setViewMode("form");
      setFormData((prev) => ({ ...prev, ...draft }));
    },
    notify: showNotification,
  });

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
    setPendingDeleteGroup(null);
    setIsDeletingCategoryMenu(false);
    setDeleteError("");
  }, [isOpen]);

  const switchToCreate = () => {
    setFormData(INITIAL_FORM);
    setErrors({});
    setPendingDeleteGroup(null);
    setDeleteError("");
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
    setPendingDeleteGroup(null);
    setDeleteError("");
    setViewMode("form");
  };

  const switchToList = () => {
    setViewMode("list");
    setErrors({});
    setPendingDeleteGroup(null);
    setDeleteError("");
    clearDraft();
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = "Vui lòng nhập tên nhóm thực đơn";
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
      clearDraft();
      showNotification(
        "Đã xóa dữ liệu nháp sau khi lưu nhóm thực đơn.",
        "success",
        2200
      );
      switchToList();
    } catch (err) {
      console.error(err);
      setErrors({ submit: err.message || "Đã có lỗi xảy ra." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestDelete = (categoryMenu) => {
    if (!categoryMenu) return;
    setPendingDeleteGroup({
      id: categoryMenu.id || categoryMenu._id,
      name: categoryMenu.name || "Nhóm thực đơn này",
    });
    setDeleteError("");
  };

  const handleCancelDelete = () => {
    if (isDeletingCategoryMenu) return;
    setPendingDeleteGroup(null);
    setDeleteError("");
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteGroup?.id || isDeletingCategoryMenu) return;

    setIsDeletingCategoryMenu(true);
    setDeleteError("");

    try {
      const deleted = await deleteCategoryMenu(pendingDeleteGroup.id);

      if (!deleted) {
        setDeleteError(
          `Không thể xóa nhóm thực đơn \"${pendingDeleteGroup.name}\". Vui lòng thử lại.`
        );
        return;
      }

      setPendingDeleteGroup(null);
      setDeleteError("");
      setViewMode("list");
    } catch (err) {
      console.error(err);
      setDeleteError(
        err?.message ||
          `Không thể xóa nhóm thực đơn \"${pendingDeleteGroup.name}\". Vui lòng thử lại.`
      );
    } finally {
      setIsDeletingCategoryMenu(false);
    }
  };

  const filteredList = (categoryMenus || []).filter((c) =>
    (c.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => requestCloseWithDraft(onClose)}
      title={null} // Tắt title mặc định để custom header đẹp hơn
      size="md"
      className="modern-category-modal"
    >
      <div className="modal-container">
        {viewMode === "list" && (
          <div className="view-section fade-in-slide">
            <div className="modal-header">
              <div className="header-content">
                <h3>Quản lý Nhóm thực đơn</h3>
                <p>
                  Danh sách các nhóm dùng để gom thực đơn theo bộ menu hoặc mục
                  đích hiển thị
                </p>
              </div>
              <button
                className="btn-close-modal"
                onClick={() => requestCloseWithDraft(onClose)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="list-toolbar">
              <div className="search-box">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Tìm kiếm nhóm thực đơn..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button className="btn-primary" onClick={switchToCreate}>
                <Plus size={18} />
                <span>Thêm nhóm</span>
              </button>
            </div>

            {pendingDeleteGroup && (
              <div className="delete-confirm-card" role="alertdialog" aria-live="polite">
                <div className="delete-confirm-card__icon">
                  <AlertCircle size={18} />
                </div>
                <div className="delete-confirm-card__content">
                  <p className="delete-confirm-card__title">Xóa nhóm thực đơn</p>
                  <p className="delete-confirm-card__message">
                    Bạn có chắc chắn muốn xóa
                    <strong>{` ${pendingDeleteGroup.name}`}</strong>?
                  </p>
                  <p className="delete-confirm-card__hint">
                    Nhóm này sẽ bị gỡ khỏi danh sách sau khi bạn xác nhận.
                  </p>
                  {deleteError && (
                    <div className="delete-confirm-card__error" role="alert">
                      {deleteError}
                    </div>
                  )}
                </div>
                <div className="delete-confirm-card__actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleCancelDelete}
                    disabled={isDeletingCategoryMenu}
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={handleConfirmDelete}
                    disabled={isDeletingCategoryMenu}
                  >
                    {isDeletingCategoryMenu ? "Đang xóa..." : "Xóa nhóm"}
                  </button>
                </div>
              </div>
            )}

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
                  <p className="main-text">Chưa có nhóm thực đơn nào</p>
                  <p className="sub-text">
                    Hãy tạo nhóm thực đơn đầu tiên để gom các menu cùng chủ đề
                    hoặc mục đích hiển thị.
                  </p>
                </div>
              ) : (
                <div className="category-list">
                  {filteredList.map((cat) => {
                    const categoryId = cat.id || cat._id;
                    const isPendingDelete = pendingDeleteGroup?.id === categoryId;

                    return (
                      <div key={categoryId} className="category-item-card">
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
                            title="Chỉnh sửa nhóm thực đơn"
                            disabled={isDeletingCategoryMenu}
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            className="action-btn delete"
                            onClick={() => handleRequestDelete(cat)}
                            title="Xóa nhóm thực đơn"
                            disabled={isDeletingCategoryMenu && isPendingDelete}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === "form" && (
          <form onSubmit={handleSubmit} className="view-section fade-in-slide">
            <div className="modal-header with-back">
              <button type="button" className="btn-back" onClick={switchToList}>
                <ArrowLeft size={20} />
              </button>
              <div className="header-content">
                <h3>
                  {formData.id
                    ? "Cập nhật Nhóm thực đơn"
                    : "Tạo Nhóm thực đơn mới"}
                </h3>
                <p>Nhóm thực đơn dùng để gom nhiều menu liên quan với nhau.</p>
              </div>
            </div>

            <div className="form-body custom-scrollbar">
              <div className="form-group">
                <label>
                  Tên nhóm thực đơn <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className={errors.name ? "error" : ""}
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="VD: Menu gia đình, Combo cuối tuần..."
                  autoFocus
                />
                {errors.name && <span className="err-msg">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label>Mô tả ngắn</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Mô tả hiển thị bên dưới tên nhóm thực đơn..."
                />
              </div>

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
                    {formData.id ? "Lưu thay đổi" : "Tạo nhóm"}
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
