import React, { useEffect, useState } from "react";
import Modal from "../../../../common/Modal";
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
import "./CategoryModalPolish.scss";

const INITIAL_FORM = {
  id: null,
  name: "",
  icon: "🍽️",
  description: "",
};

const CategoryModal = ({ isOpen, restaurantId, timeSlot, onClose }) => {
  const { showNotification } = useNotification();
  const [viewMode, setViewMode] = useState("list");
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
      entityType: "category-menu",
      recordId: formData.id || null,
      context: timeSlot || "all-day",
      schemaVersion: "2",
    },
    formValue: formData,
    isDirty,
    sanitize: (value) => ({
      id: value?.id || null,
      name: value?.name || "",
      icon: value?.icon || "🍽️",
      description: value?.description || "",
    }),
    onRestore: (draft) => {
      setViewMode("form");
      setFormData((current) => ({ ...current, ...draft }));
    },
    notify: showNotification,
  });

  const {
    categoryMenus,
    categoryMenuLoading,
    categoryMenuError: _categoryMenuError,
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

  const switchToEdit = (categoryMenu) => {
    setFormData({
      id: categoryMenu.id || categoryMenu._id,
      name: categoryMenu.name || "",
      icon:
        categoryMenu.icon || resolveCategoryIcon(categoryMenu.name || ""),
      description: categoryMenu.description || "",
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
    setFormData((current) => ({ ...current, [field]: value }));
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: "" }));
    }
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.name.trim()) {
      nextErrors.name = "Vui lòng nhập tên nhóm thực đơn";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        icon: formData.icon || "🍽️",
        description: formData.description?.trim() || null,
      };

      if (formData.id) {
        await updateCategoryMenu({ id: formData.id, ...payload });
      } else {
        await createCategoryMenu({ restaurantId, ...payload });
      }
      clearDraft();
      showNotification("Đã lưu nhóm thực đơn.", "success", 2200);
      switchToList();
    } catch (error) {
      console.error(error);
      setErrors({ submit: error.message || "Đã có lỗi xảy ra." });
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
          `Không thể xóa nhóm thực đơn “${pendingDeleteGroup.name}”. Vui lòng thử lại.`,
        );
        return;
      }

      setPendingDeleteGroup(null);
      setDeleteError("");
      setViewMode("list");
    } catch (error) {
      console.error(error);
      setDeleteError(
        error?.message ||
          `Không thể xóa nhóm thực đơn “${pendingDeleteGroup.name}”. Vui lòng thử lại.`,
      );
    } finally {
      setIsDeletingCategoryMenu(false);
    }
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredList = (categoryMenus || []).filter((categoryMenu) =>
    (categoryMenu.name || "").toLowerCase().includes(normalizedSearch),
  );

  const requestClose = () => requestCloseWithDraft(onClose);
  const isFormView = viewMode === "form";

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      size="md"
      className="modern-category-modal"
      autoWrapBody={false}
    >
      <Modal.Header className={isFormView ? "with-back" : ""}>
        {isFormView && (
          <button
            type="button"
            className="btn-back"
            onClick={switchToList}
            aria-label="Quay lại danh sách nhóm thực đơn"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="header-content">
          <h3>
            {isFormView
              ? formData.id
                ? "Cập nhật nhóm thực đơn"
                : "Tạo nhóm thực đơn mới"
              : "Quản lý nhóm thực đơn"}
          </h3>
          <p>
            {isFormView
              ? "Nhóm thực đơn dùng để gom nhiều menu liên quan với nhau."
              : "Gom thực đơn theo bộ menu hoặc mục đích hiển thị."}
          </p>
        </div>
        <button
          type="button"
          className="btn-close-modal"
          onClick={requestClose}
          aria-label="Đóng quản lý nhóm thực đơn"
        >
          <X size={20} />
        </button>
      </Modal.Header>

      <Modal.Body className="category-modal-body">
        <div className="category-modal-content">
          {viewMode === "list" && (
            <div className="view-section fade-in-slide">
              <div className="list-toolbar">
                <label className="search-box" htmlFor="menu-group-search">
                  <Search size={18} className="search-icon" aria-hidden="true" />
                  <input
                    id="menu-group-search"
                    name="menuGroupSearch"
                    type="search"
                    placeholder="Tìm nhóm thực đơn…"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      className="search-clear"
                      onClick={(event) => {
                        event.preventDefault();
                        setSearchTerm("");
                      }}
                      aria-label="Xóa từ khóa tìm nhóm thực đơn"
                    >
                      <X size={16} />
                    </button>
                  )}
                </label>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={switchToCreate}
                >
                  <Plus size={18} />
                  <span>Thêm nhóm</span>
                </button>
              </div>

              {pendingDeleteGroup && (
                <div
                  className="delete-confirm-card"
                  role="alertdialog"
                  aria-live="polite"
                >
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
                      {isDeletingCategoryMenu ? "Đang xóa…" : "Xóa nhóm"}
                    </button>
                  </div>
                </div>
              )}

              <div className="list-body custom-scrollbar">
                {categoryMenuLoading ? (
                  <div className="state-loading">
                    <div className="spinner" aria-hidden="true" />
                    <span>Đang tải dữ liệu…</span>
                  </div>
                ) : filteredList.length === 0 ? (
                  <div className="state-empty">
                    <div className="empty-icon-bg">
                      <LayoutGrid size={32} />
                    </div>
                    <p className="main-text">
                      {searchTerm
                        ? "Không tìm thấy nhóm phù hợp"
                        : "Chưa có nhóm thực đơn nào"}
                    </p>
                    <p className="sub-text">
                      {searchTerm
                        ? "Thử từ khóa ngắn hơn hoặc xóa bộ lọc tìm kiếm."
                        : "Tạo nhóm đầu tiên để gom các menu cùng chủ đề hoặc mục đích hiển thị."}
                    </p>
                  </div>
                ) : (
                  <div className="category-list">
                    {filteredList.map((categoryMenu) => {
                      const categoryId = categoryMenu.id || categoryMenu._id;
                      const isPendingDelete =
                        pendingDeleteGroup?.id === categoryId;

                      return (
                        <div key={categoryId} className="category-item-card">
                          <div className="card-visual">
                            <span>
                              {categoryMenu.icon ||
                                resolveCategoryIcon(categoryMenu.name || "")}
                            </span>
                          </div>
                          <div className="card-info">
                            <span className="cat-name">{categoryMenu.name}</span>
                            <span className="cat-desc">
                              {categoryMenu.description || "Chưa có mô tả"}
                            </span>
                          </div>
                          <div className="card-actions">
                            <button
                              type="button"
                              className="action-btn edit"
                              onClick={() => switchToEdit(categoryMenu)}
                              title="Chỉnh sửa nhóm thực đơn"
                              aria-label={`Chỉnh sửa nhóm ${categoryMenu.name}`}
                              disabled={isDeletingCategoryMenu}
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              type="button"
                              className="action-btn delete"
                              onClick={() => handleRequestDelete(categoryMenu)}
                              title="Xóa nhóm thực đơn"
                              aria-label={`Xóa nhóm ${categoryMenu.name}`}
                              disabled={
                                isDeletingCategoryMenu && isPendingDelete
                              }
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
              <div className="form-body custom-scrollbar">
                <div className="form-group">
                  <label htmlFor="menu-group-name">
                    Tên nhóm thực đơn <span className="req">*</span>
                  </label>
                  <input
                    id="menu-group-name"
                    type="text"
                    className={errors.name ? "error" : ""}
                    value={formData.name}
                    onChange={(event) =>
                      handleInputChange("name", event.target.value)
                    }
                    placeholder="Ví dụ: Menu gia đình, Combo cuối tuần…"
                    autoFocus
                    disabled={isSubmitting}
                  />
                  {errors.name && (
                    <span className="err-msg" role="alert">
                      {errors.name}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="menu-group-description">Mô tả ngắn</label>
                  <textarea
                    id="menu-group-description"
                    rows={3}
                    value={formData.description}
                    onChange={(event) =>
                      handleInputChange("description", event.target.value)
                    }
                    placeholder="Mô tả hiển thị bên dưới tên nhóm thực đơn…"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <span className="form-label">Biểu tượng đại diện</span>
                  <div className="icon-picker-container">
                    <div className="selected-preview" aria-label="Biểu tượng đã chọn">
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
                          aria-label={`Chọn biểu tượng ${icon}`}
                          aria-pressed={formData.icon === icon}
                          disabled={isSubmitting}
                        >
                          {icon}
                          {formData.icon === icon && (
                            <span className="check-mark" aria-hidden="true">
                              <Check size={10} />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="custom-icon-input" htmlFor="menu-group-icon">
                    <span>Hoặc nhập ký tự/icon khác:</span>
                    <input
                      id="menu-group-icon"
                      type="text"
                      value={formData.icon}
                      maxLength={2}
                      onChange={(event) =>
                        handleInputChange("icon", event.target.value)
                      }
                      disabled={isSubmitting}
                    />
                  </label>
                </div>

                {errors.submit && (
                  <div className="global-error" role="alert">
                    {errors.submit}
                  </div>
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
                    <>Đang lưu…</>
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
      </Modal.Body>
    </Modal>
  );
};

export default CategoryModal;
