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
  Eye,
  EyeOff,
  RotateCcw,
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
    <div
      className="dc-icon-picker"
      role="radiogroup"
      aria-labelledby="dc-icon-label"
    >
      {COMMON_CATEGORY_ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          role="radio"
          className={"dc-icon-btn" + (formData.icon === icon ? " active" : "")}
          onClick={() => handleInputChange("icon", icon)}
          aria-label={"Chọn biểu tượng " + icon}
          aria-checked={formData.icon === icon}
          title={"Chọn " + icon}
        >
          {icon}
        </button>
      ))}
    </div>
  );

  const hasSearch = Boolean(searchTerm.trim());

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      className="dish-category-modal"
    >
      <Modal.Header onClose={handleClose}>
        <div className="dc-header-content">
          {viewMode === "form" && (
            <button
              type="button"
              className="dc-back-btn"
              onClick={switchToList}
              aria-label="Quay lại danh sách danh mục"
              title="Quay lại"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          )}
          <div className="dc-heading">
            <strong>
              {viewMode === "form"
                ? formData.id
                  ? "Chỉnh sửa danh mục"
                  : "Thêm danh mục"
                : "Quản lý danh mục món"}
            </strong>
            <span>
              {viewMode === "form"
                ? "Thiết lập cách danh mục xuất hiện trên menu."
                : "Sắp xếp và kiểm soát các nhóm món trong khung giờ này."}
            </span>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body>
        {viewMode === "list" ? (
          <div className="dc-list-view">
            <div className="dc-toolbar">
              <div className="dc-search">
                <Search size={17} aria-hidden="true" />
                <label className="dc-visually-hidden" htmlFor="dish-category-search">
                  Tìm danh mục món
                </label>
                <input
                  id="dish-category-search"
                  type="search"
                  name="dish-category-search"
                  autoComplete="off"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Tìm theo tên danh mục…"
                />
              </div>
              <button type="button" className="dc-primary-btn" onClick={switchToCreate}>
                <Plus size={16} aria-hidden="true" /> Thêm danh mục
              </button>
            </div>

            {categoriesError && (
              <div className="dc-alert error" role="alert">
                <AlertCircle size={17} aria-hidden="true" />
                <span>Không thể tải danh mục. Vui lòng thử lại.</span>
                <button
                  type="button"
                  className="dc-alert-action"
                  onClick={() => refetchAll?.()}
                >
                  <RotateCcw size={14} aria-hidden="true" /> Thử lại
                </button>
              </div>
            )}

            {categoriesLoading ? (
              <div className="dc-skeleton-list" role="status" aria-live="polite">
                <span className="dc-visually-hidden">Đang tải danh mục…</span>
                {[0, 1, 2].map((item) => (
                  <div className="dc-skeleton-row" key={item}>
                    <span />
                    <div>
                      <i />
                      <i />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="dc-empty">
                <Tags size={34} aria-hidden="true" />
                <strong>
                  {hasSearch ? "Không tìm thấy danh mục" : "Chưa có danh mục món"}
                </strong>
                <span>
                  {hasSearch
                    ? <>Không có kết quả phù hợp với “{searchTerm.trim()}”.</>
                    : "Tạo danh mục để nhóm các món trong menu."}
                </span>
                {hasSearch && (
                  <button
                    type="button"
                    className="dc-clear-search"
                    onClick={() => setSearchTerm("")}
                  >
                    Xóa tìm kiếm
                  </button>
                )}
              </div>
            ) : (
              <div className="dc-category-list">
                {filteredCategories.map((category) => {
                  const isActive = category?.isActive !== false;
                  const categoryName = category?.name || "Danh mục";

                  return (
                    <div
                      key={getCategoryId(category)}
                      className={"dc-category-row" + (isActive ? "" : " is-inactive")}
                    >
                      <div className="dc-category-main">
                        <span className="dc-category-icon" aria-hidden="true">
                          {category?.icon || resolveCategoryIcon(categoryName)}
                        </span>
                        <div className="dc-category-copy">
                          <strong>{categoryName}</strong>
                          <div className="dc-category-meta">
                            <small>
                              {Number(category.menuItemCount || 0)} món · Vị trí{" "}
                              {category.order ?? 0}
                            </small>
                            <span
                              className={"dc-status-badge" + (isActive ? "" : " is-hidden")}
                            >
                              {isActive ? "Đang hiển thị" : "Đang ẩn"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="dc-row-actions">
                        <button
                          type="button"
                          onClick={() => switchToEdit(category)}
                          aria-label={"Chỉnh sửa danh mục " + categoryName}
                          title="Chỉnh sửa"
                        >
                          <Edit3 size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => handleRequestDelete(category)}
                          aria-label={"Xóa danh mục " + categoryName}
                          title="Xóa"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <form className="dc-form" onSubmit={handleSubmit} noValidate>
            {errors.submit && (
              <div className="dc-alert error" role="alert">
                <AlertCircle size={17} aria-hidden="true" />
                <span>{errors.submit}</span>
              </div>
            )}

            <div className="dc-form-layout">
              <section className="dc-form-panel" aria-labelledby="dc-details-label">
                <div className="dc-panel-heading">
                  <span id="dc-details-label">Thông tin danh mục</span>
                  <small>Tên và vị trí giúp món dễ tìm hơn trên menu.</small>
                </div>

                <div className="dc-form-group">
                  <label htmlFor="dc-category-name">Tên danh mục món</label>
                  <input
                    id="dc-category-name"
                    name="category-name"
                    type="text"
                    autoComplete="off"
                    value={formData.name}
                    onChange={(event) => handleInputChange("name", event.target.value)}
                    placeholder="Ví dụ: Món chính, Đồ uống…"
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={
                      errors.name ? "dc-name-help dc-name-error" : "dc-name-help"
                    }
                  />
                  <small id="dc-name-help" className="dc-field-help">
                    Dùng tên ngắn, rõ nghĩa để khách nhận biết nhanh.
                  </small>
                  {errors.name && (
                    <small id="dc-name-error" className="dc-error-text">
                      {errors.name}
                    </small>
                  )}
                </div>

                <div className="dc-form-group">
                  <label htmlFor="dc-category-order">Vị trí hiển thị</label>
                  <input
                    id="dc-category-order"
                    name="category-order"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={formData.order}
                    onChange={(event) => handleInputChange("order", event.target.value)}
                    aria-invalid={Boolean(errors.order)}
                    aria-describedby={
                      errors.order ? "dc-order-help dc-order-error" : "dc-order-help"
                    }
                  />
                  <small id="dc-order-help" className="dc-field-help">
                    Số nhỏ hơn sẽ xuất hiện trước.
                  </small>
                  {errors.order && (
                    <small id="dc-order-error" className="dc-error-text">
                      {errors.order}
                    </small>
                  )}
                </div>

                <label className="dc-status-control">
                  <input
                    className="dc-switch-input"
                    type="checkbox"
                    checked={formData.isActive !== false}
                    onChange={(event) =>
                      handleInputChange("isActive", event.target.checked)
                    }
                    aria-describedby="dc-status-help"
                  />
                  <span className="dc-switch" aria-hidden="true" />
                  <span className="dc-status-copy">
                    <strong>
                      {formData.isActive !== false
                        ? "Đang hiển thị trên menu"
                        : "Đang ẩn khỏi menu"}
                    </strong>
                    <small id="dc-status-help">
                      {formData.isActive !== false
                        ? "Khách có thể thấy danh mục này."
                        : "Danh mục vẫn được lưu để bật lại sau."}
                    </small>
                  </span>
                  {formData.isActive !== false ? (
                    <Eye size={18} aria-hidden="true" />
                  ) : (
                    <EyeOff size={18} aria-hidden="true" />
                  )}
                </label>
              </section>

              <section className="dc-form-panel dc-icon-panel" aria-labelledby="dc-icon-label">
                <div className="dc-panel-heading dc-icon-heading">
                  <div>
                    <span id="dc-icon-label">Biểu tượng nhận diện</span>
                    <small>Chọn biểu tượng phù hợp với nhóm món.</small>
                  </div>
                  <span className="dc-selected-icon" aria-label={"Đã chọn " + formData.icon}>
                    {formData.icon || "🍽️"}
                  </span>
                </div>
                {renderIconPicker()}
              </section>
            </div>

            <div className="dc-footer-actions">
              <button type="button" className="dc-ghost-btn" onClick={switchToList}>
                <X size={16} aria-hidden="true" /> Hủy
              </button>
              <button type="submit" className="dc-primary-btn" disabled={isSubmitting}>
                <Save size={16} aria-hidden="true" />
                {isSubmitting
                  ? "Đang lưu…"
                  : formData.id
                    ? "Lưu thay đổi"
                    : "Tạo danh mục"}
              </button>
            </div>
          </form>
        )}

        {pendingDeleteCategory && (
          <div
            className="dc-confirm-layer"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dc-delete-title"
            aria-describedby="dc-delete-description"
          >
            <div className="dc-confirm-card">
              <AlertCircle size={24} aria-hidden="true" />
              <h3 id="dc-delete-title">Xóa danh mục món?</h3>
              <p id="dc-delete-description">
                Bạn sắp xóa <strong>{pendingDeleteCategory.name}</strong>.{" "}
                {pendingDeleteCategory.menuItemCount > 0
                  ? `Danh mục đang có món nên hệ thống sẽ chặn thao tác để bảo vệ dữ liệu.`
                  : "Thao tác này không thể hoàn tác."}
              </p>
              {deleteError && (
                <div className="dc-alert error" role="alert">
                  {deleteError}
                </div>
              )}
              <div className="dc-confirm-actions">
                <button type="button" onClick={handleCancelDelete} disabled={isDeletingCategory}>
                  Giữ lại
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={handleConfirmDelete}
                  disabled={isDeletingCategory}
                >
                  {isDeletingCategory ? "Đang xóa…" : "Xóa danh mục"}
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
