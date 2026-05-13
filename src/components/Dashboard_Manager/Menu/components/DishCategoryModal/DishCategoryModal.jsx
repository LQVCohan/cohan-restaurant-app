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
      schemaVersion: "1",
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
      icon: resolveCategoryIcon(category?.name || ""),
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

    if (pendingDeleteCategory.menuItemCount > 0) {
      setDeleteError(
        `Danh mục đang có ${pendingDeleteCategory.menuItemCount} món. Hãy chuyển món sang danh mục khác trước khi xóa.`
      );
      return;
    }

    setIsDeletingCategory(true);
    setDeleteError("");

    try {
      const deleted = await deleteCategory(pendingDeleteCategory.id);
      if (!deleted) {
        setDeleteError(
          `Không thể xóa danh mục "${pendingDeleteCategory.name}". Vui lòng thử lại.`
        );
        return;
      }
      await refetchAll?.();
      onSave?.();
      setPendingDeleteCategory(null);
    } catch (error) {
      setDeleteError(
        error?.message ||
          `Không thể xóa danh mục "${pendingDeleteCategory.name}". Vui lòng thử lại.`
      );
    } finally {
      setIsDeletingCategory(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => requestCloseWithDraft(onClose)}
      size="md"
      className="dish-category-modal"
    >
      <div className="dcm-container">
        {viewMode === "list" && (
          <div className="dcm-view">
            <div className="dcm-header">
              <div>
                <h3>Quản lý Danh mục món</h3>
                <p>Nhóm các món ăn như Khai vị, Món chính, Đồ uống hoặc Tráng miệng.</p>
              </div>
              <button className="dcm-close" onClick={() => requestCloseWithDraft(onClose)}>
                <X size={20} />
              </button>
            </div>

            <div className="dcm-toolbar">
              <div className="dcm-search">
                <Search size={18} />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Tìm danh mục món..."
                />
              </div>
              <button className="dcm-primary" onClick={switchToCreate}>
                <Plus size={18} /> Thêm danh mục
              </button>
            </div>

            {categoriesError && (
              <div className="dcm-alert dcm-alert--danger">
                <AlertCircle size={18} /> {categoriesError.message}
              </div>
            )}

            {pendingDeleteCategory && (
              <div className="dcm-delete-card" role="alertdialog" aria-live="polite">
                <AlertCircle size={18} />
                <div className="dcm-delete-card__content">
                  <strong>Xóa danh mục món</strong>
                  <p>
                    Bạn có chắc chắn muốn xóa
                    <b>{` ${pendingDeleteCategory.name}`}</b>?
                  </p>
                  {pendingDeleteCategory.menuItemCount > 0 && (
                    <small>
                      Danh mục này đang có {pendingDeleteCategory.menuItemCount} món.
                    </small>
                  )}
                  {deleteError && <div className="dcm-error">{deleteError}</div>}
                </div>
                <div className="dcm-delete-card__actions">
                  <button onClick={handleCancelDelete} disabled={isDeletingCategory}>
                    Hủy
                  </button>
                  <button
                    className="danger"
                    onClick={handleConfirmDelete}
                    disabled={isDeletingCategory}
                  >
                    {isDeletingCategory ? "Đang xóa..." : "Xóa"}
                  </button>
                </div>
              </div>
            )}

            <div className="dcm-list">
              {categoriesLoading ? (
                <div className="dcm-state">Đang tải danh mục món...</div>
              ) : filteredCategories.length === 0 ? (
                <div className="dcm-empty">
                  <Tags size={34} />
                  <strong>Chưa có danh mục món</strong>
                  <span>Tạo danh mục đầu tiên để thêm món vào đúng nhóm.</span>
                </div>
              ) : (
                filteredCategories.map((category) => {
                  const id = getCategoryId(category);
                  return (
                    <div className="dcm-card" key={id}>
                      <div className="dcm-card__icon">
                        {resolveCategoryIcon(category?.name || "")}
                      </div>
                      <div className="dcm-card__info">
                        <strong>{category?.name}</strong>
                        <span>
                          {Number(category?.menuItemCount || 0)} món · Thứ tự {category?.order ?? 0}
                          {category?.isActive === false ? " · Tạm ẩn" : ""}
                        </span>
                      </div>
                      <div className="dcm-card__actions">
                        <button onClick={() => switchToEdit(category)} title="Sửa danh mục">
                          <Edit3 size={16} />
                        </button>
                        <button onClick={() => handleRequestDelete(category)} title="Xóa danh mục">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {viewMode === "form" && (
          <form className="dcm-view" onSubmit={handleSubmit}>
            <div className="dcm-header dcm-header--form">
              <button type="button" className="dcm-back" onClick={switchToList}>
                <ArrowLeft size={20} />
              </button>
              <div>
                <h3>{formData.id ? "Cập nhật danh mục món" : "Tạo danh mục món"}</h3>
                <p>Danh mục này dùng để phân loại món trong khung giờ đang chọn.</p>
              </div>
            </div>

            <div className="dcm-form-body">
              <div className="dcm-form-group">
                <label>Tên danh mục món *</label>
                <input
                  value={formData.name}
                  onChange={(event) => handleInputChange("name", event.target.value)}
                  placeholder="VD: Món chính, Đồ uống, Tráng miệng..."
                  autoFocus
                />
                {errors.name && <span>{errors.name}</span>}
              </div>

              <div className="dcm-form-row">
                <div className="dcm-form-group">
                  <label>Thứ tự hiển thị</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.order}
                    onChange={(event) => handleInputChange("order", event.target.value)}
                  />
                  {errors.order && <span>{errors.order}</span>}
                </div>

                <label className="dcm-toggle">
                  <input
                    type="checkbox"
                    checked={formData.isActive !== false}
                    onChange={(event) =>
                      handleInputChange("isActive", event.target.checked)
                    }
                  />
                  <span>Kích hoạt</span>
                </label>
              </div>

              <div className="dcm-form-group">
                <label>Biểu tượng gợi ý</label>
                <div className="dcm-icon-picker">
                  {COMMON_CATEGORY_ICONS.map((icon) => (
                    <button
                      type="button"
                      key={icon}
                      className={formData.icon === icon ? "active" : ""}
                      onClick={() => handleInputChange("icon", icon)}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <small>Biểu tượng hiện chỉ dùng để hỗ trợ nhận diện nhanh trên giao diện.</small>
              </div>

              {errors.submit && <div className="dcm-alert dcm-alert--danger">{errors.submit}</div>}
            </div>

            <div className="dcm-footer">
              <button type="button" onClick={switchToList} disabled={isSubmitting}>
                Hủy
              </button>
              <button className="dcm-primary" type="submit" disabled={isSubmitting}>
                <Save size={16} /> {isSubmitting ? "Đang lưu..." : "Lưu danh mục"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default DishCategoryModal;
