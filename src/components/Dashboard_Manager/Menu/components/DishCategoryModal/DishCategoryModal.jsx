import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../../../common/Modal";
import {
  Plus,
  Edit3,
  Trash2,
  ArrowLeft,
  Search,
  Tags,
  Save,
  X,
  AlertCircle,
} from "lucide-react";
import { useCategoryManagement } from "../../../../../hooks/useCategoryManagement";
import {
  COMMON_CATEGORY_ICONS,
  resolveCategoryIcon,
} from "../../../../../utils/categoryIconMap";
import useModalDraft from "../../../../../hooks/useModalDraft";
import { useNotification } from "../../../../../hooks/useNotification";
import "./DishCategoryModal.scss";
import "./DishCategoryModalPolish.scss";

const INITIAL_FORM = {
  id: null,
  name: "",
  icon: "🍽️",
  order: 1000,
  isActive: true,
};

const getCategoryId = (category) => category?.id || category?._id || null;

const DishCategoryModal = ({
  isOpen,
  restaurantId,
  timeSlot,
  onClose,
  onSave,
}) => {
  const { showNotification } = useNotification();
  const [viewMode, setViewMode] = useState("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const {
    categories,
    categoriesLoading,
    categoriesError,
    createCategory,
    updateCategory,
    deleteCategory,
    refetchAll,
  } = useCategoryManagement({
    restaurantId,
    timeSlot,
    loadCategories: isOpen,
    loadTopCategories: false,
    loadCategoryMenus: false,
  });

  const isDirty =
    viewMode === "form" &&
    (formData.name.trim() ||
      Number(formData.order) !== 1000 ||
      formData.isActive !== true ||
      (formData.icon || "") !== "🍽️");

  const { requestCloseWithDraft, clearDraft } = useModalDraft({
    enabled: isOpen && viewMode === "form",
    draftIdentity: {
      module: "menu",
      modal: "dish-category-modal",
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: formData.id ? "edit" : "create",
      entityType: "dish-category",
      recordId: formData.id || null,
      context: timeSlot || "all-day",
      schemaVersion: "2",
    },
    formValue: formData,
    isDirty,
    sanitize: (v) => ({
      id: v?.id || null,
      name: v?.name || "",
      icon: v?.icon || "🍽️",
      order: Number(v?.order || 1000),
      isActive: v?.isActive !== false,
    }),
    onRestore: (draft) => {
      setViewMode("form");
      setFormData((prev) => ({ ...prev, ...draft }));
    },
    notify: showNotification,
  });

  useEffect(() => {
    if (!isOpen) return;
    setViewMode("list");
    setSearchTerm("");
    setFormData(INITIAL_FORM);
    setErrors({});
    setPendingDeleteCategory(null);
    setIsDeletingCategory(false);
    setDeleteError("");
  }, [isOpen]);

  const filteredCategories = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return categories || [];
    return (categories || []).filter((category) =>
      String(category?.name || "").toLowerCase().includes(q)
    );
  }, [categories, searchTerm]);

  const switchToCreate = () => {
    setFormData(INITIAL_FORM);
    setErrors({});
    setPendingDeleteCategory(null);
    setDeleteError("");
    setViewMode("form");
  };

  const switchToEdit = (category) => {
    setFormData({
      id: getCategoryId(category),
      name: category?.name || "",
      icon: category?.icon || resolveCategoryIcon(category?.name || ""),
      order: Number(category?.order ?? 1000),
      isActive: category?.isActive !== false,
    });
    setErrors({});
    setPendingDeleteCategory(null);
    setDeleteError("");
    setViewMode("form");
  };

  const switchToList = () => {
    setViewMode("list");
    setErrors({});
    setPendingDeleteCategory(null);
    setDeleteError("");
    clearDraft();
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!restaurantId) nextErrors.submit = "Vui lòng chọn nhà hàng trước.";
    if (!timeSlot) nextErrors.submit = "Vui lòng chọn khung giờ trước.";
    if (!formData.name.trim()) nextErrors.name = "Vui lòng nhập tên danh mục món.";
    const order = Number(formData.order);
    if (!Number.isFinite(order) || order < 0) {
      nextErrors.order = "Thứ tự phải là số lớn hơn hoặc bằng 0.";
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
        restaurantId,
        timeSlot,
        name: formData.name.trim(),
        icon: formData.icon || "🍽️",
        order: Number(formData.order || 0),
        isActive: formData.isActive !== false,
      };

      const saved = formData.id
        ? await updateCategory({ id: formData.id, ...payload })
        : await createCategory(payload);

      if (!saved) {
        setErrors({ submit: "Không thể lưu danh mục món. Vui lòng thử lại." });
        return;
      }

      clearDraft();
      await refetchAll?.();
      onSave?.();
      switchToList();
    } catch (error) {
      setErrors({ submit: error?.message || "Đã có lỗi xảy ra." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestDelete = (category) => {
    const id = getCategoryId(category);
    if (!id) return;
    setPendingDeleteCategory({
      id,
      name: category?.name || "Danh mục này",
      menuItemCount: Number(category?.menuItemCount || 0),
    });
    setDeleteError("");
  };

  const handleCancelDelete = () => {
    if (isDeletingCategory) return;
    setPendingDeleteCategory(null);
    setDeleteError("");
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteCategory?.id || isDeletingCategory) return;

    setIsDeletingCategory(true);
    setDeleteError("");
    try {
      const ok = await deleteCategory(pendingDeleteCategory.id);
      if (!ok) {
        setDeleteError("Không thể xóa danh mục món. Vui lòng thử lại.");
        return;
      }

      await refetchAll?.();
      onSave?.();
      setPendingDeleteCategory(null);
    } catch (error) {
      setDeleteError(error?.message || "Không thể xóa danh mục món.");
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const handleClose = () => {
    if (viewMode === "form") {
      requestCloseWithDraft(onClose);
      return;
    }
    onClose?.();
  };

  const renderIconPicker = () => (
    <div className="dc-icon-picker">
      {COMMON_CATEGORY_ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          className={`dc-icon-btn ${formData.icon === icon ? "active" : ""}`}
          onClick={() => handleInputChange("icon", icon)}
          aria-label={`Chọn icon ${icon}`}
        >
          {icon}
        </button>
      ))}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      className="dish-category-modal"
    >
      <Modal.Header>
        {viewMode === "form" ? (
          <button type="button" className="dc-back-btn" onClick={switchToList}>
            <ArrowLeft size={18} />
          </button>
        ) : null}
        <span>{viewMode === "form" ? "Danh mục món" : "Quản lý danh mục món"}</span>
      </Modal.Header>

      <Modal.Body>
        {viewMode === "list" ? (
          <div className="dc-list-view">
            <div className="dc-toolbar">
              <div className="dc-search">
                <Search size={16} />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm danh mục món..."
                />
              </div>
              <button type="button" className="dc-primary-btn" onClick={switchToCreate}>
                <Plus size={16} /> Thêm danh mục
              </button>
            </div>

            {categoriesError && (
              <div className="dc-alert error">
                <AlertCircle size={16} /> {categoriesError.message}
              </div>
            )}

            {categoriesLoading ? (
              <div className="dc-empty">Đang tải danh mục...</div>
            ) : filteredCategories.length === 0 ? (
              <div className="dc-empty">
                <Tags size={34} />
                <strong>Chưa có danh mục món</strong>
                <span>Tạo danh mục để nhóm các món trong menu.</span>
              </div>
            ) : (
              <div className="dc-category-list">
                {filteredCategories.map((category) => (
                  <div key={getCategoryId(category)} className="dc-category-row">
                    <div className="dc-category-main">
                      <span className="dc-category-icon">
                        {category?.icon || resolveCategoryIcon(category?.name || "")}
                      </span>
                      <div>
                        <strong>{category.name}</strong>
                        <small>
                          {Number(category.menuItemCount || 0)} món · Thứ tự {category.order ?? 0}
                        </small>
                      </div>
                    </div>

                    <div className="dc-row-actions">
                      <button type="button" onClick={() => switchToEdit(category)}>
                        <Edit3 size={15} />
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleRequestDelete(category)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form className="dc-form" onSubmit={handleSubmit}>
            {errors.submit && <div className="dc-alert error">{errors.submit}</div>}

            <div className="dc-form-group">
              <label>Tên danh mục món</label>
              <input
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Ví dụ: Món chính, Đồ uống, Tráng miệng..."
              />
              {errors.name && <small className="dc-error-text">{errors.name}</small>}
            </div>

            <div className="dc-form-group">
              <label>Icon</label>
              {renderIconPicker()}
            </div>

            <div className="dc-form-group">
              <label>Thứ tự</label>
              <input
                type="number"
                min="0"
                value={formData.order}
                onChange={(e) => handleInputChange("order", e.target.value)}
              />
              {errors.order && <small className="dc-error-text">{errors.order}</small>}
            </div>

            <label className="dc-check-row">
              <input
                type="checkbox"
                checked={formData.isActive !== false}
                onChange={(e) => handleInputChange("isActive", e.target.checked)}
              />
              <span>Kích hoạt danh mục</span>
            </label>

            <div className="dc-footer-actions">
              <button type="button" className="dc-ghost-btn" onClick={switchToList}>
                <X size={16} /> Hủy
              </button>
              <button type="submit" className="dc-primary-btn" disabled={isSubmitting}>
                <Save size={16} /> {isSubmitting ? "Đang lưu..." : "Lưu danh mục"}
              </button>
            </div>
          </form>
        )}

        {pendingDeleteCategory && (
          <div className="dc-confirm-layer">
            <div className="dc-confirm-card">
              <AlertCircle size={22} />
              <h3>Xóa danh mục món?</h3>
              <p>
                Bạn sắp xóa <strong>{pendingDeleteCategory.name}</strong>. Nếu danh mục đang có món,
                hệ thống sẽ chặn để tránh mất liên kết dữ liệu.
              </p>
              {deleteError && <div className="dc-alert error">{deleteError}</div>}
              <div className="dc-confirm-actions">
                <button type="button" onClick={handleCancelDelete} disabled={isDeletingCategory}>
                  Hủy
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={handleConfirmDelete}
                  disabled={isDeletingCategory}
                >
                  {isDeletingCategory ? "Đang xóa..." : "Xóa"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default DishCategoryModal;
