// src/pages/Restaurant/MenuManagement/components/MenuModal/MenuModal.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  FiX,
  FiUploadCloud,
  FiCheck,
  FiImage,
  FiPlus,
  FiChevronDown,
} from "react-icons/fi";
import "./MenuModal.scss";

const TIME_SLOTS = [
  { value: "breakfast", label: "Bữa Sáng" },
  { value: "lunch", label: "Bữa Trưa" },
  { value: "dinner", label: "Bữa Tối" },
  { value: "late_night", label: "Ăn Khuya" },
];

const INITIAL_STATE = {
  id: null,
  name: "",
  description: "",
  timeSlot: "breakfast",
  categoryMenuId: "",
  coverImage: "",
  isActive: true,
};

const MenuModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  categoryMenus = [],
  isSubmitting = false,
  createCategoryMenu,
  restaurantId,
}) => {
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [errors, setErrors] = useState({});

  // Dropdown states
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const [isAddingNewCat, setIsAddingNewCat] = useState(false);
  const [quickCatName, setQuickCatName] = useState("");
  const [quickCatSaving, setQuickCatSaving] = useState(false);

  const initialSnapshotRef = useRef(INITIAL_STATE);
  const catDropdownRef = useRef(null);

  const isEditMode = !!initialData;

  // Load initial data on open
  useEffect(() => {
    if (!isOpen) return;

    const next = {
      id: initialData?.id || initialData?._id || null,
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      timeSlot: initialData?.timeSlot ?? "breakfast",
      categoryMenuId: initialData?.categoryMenuId ?? "",
      coverImage: initialData?.coverImage ?? "",
      isActive:
        typeof initialData?.isActive === "boolean"
          ? initialData.isActive
          : true,
    };

    setFormData(next);
    setErrors({});
    setIsCatDropdownOpen(false);
    setIsAddingNewCat(false);
    setQuickCatName("");
    setQuickCatSaving(false);
    initialSnapshotRef.current = next;
  }, [isOpen, initialData]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        catDropdownRef.current &&
        !catDropdownRef.current.contains(event.target)
      ) {
        setIsCatDropdownOpen(false);
        if (!quickCatSaving) {
          setIsAddingNewCat(false);
          setQuickCatName("");
        }
      }
    };

    if (isCatDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCatDropdownOpen, quickCatSaving]);

  // Dirty check
  const isDirty = useMemo(() => {
    const snap = initialSnapshotRef.current || INITIAL_STATE;
    const same =
      snap.id === formData.id &&
      snap.name === formData.name &&
      (snap.description || "") === (formData.description || "") &&
      (snap.timeSlot || "breakfast") === (formData.timeSlot || "breakfast") &&
      (snap.categoryMenuId || "") === (formData.categoryMenuId || "") &&
      (snap.coverImage || "") === (formData.coverImage || "") &&
      !!snap.isActive === !!formData.isActive;

    if (!same) return true;
    if (quickCatName.trim()) return true;

    return false;
  }, [formData, quickCatName]);

  // ❗ FIXED — Move this hook ABOVE any return
  const selectedCategoryName = useMemo(() => {
    const found = categoryMenus.find(
      (c) => (c.id || c._id) === formData.categoryMenuId
    );
    return found ? found.name : "";
  }, [categoryMenus, formData.categoryMenuId]);

  // ❗ SAFE NOW — Early return happens AFTER all hooks
  if (!isOpen) return null;

  const handleFieldChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSelectCategory = (catId) => {
    setFormData((prev) => ({ ...prev, categoryMenuId: catId }));
    if (errors.categoryMenuId) {
      setErrors((prev) => ({ ...prev, categoryMenuId: "" }));
    }
    setIsCatDropdownOpen(false);
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.name.trim()) nextErrors.name = "Tên menu là bắt buộc";
    if (!formData.timeSlot) nextErrors.timeSlot = "Khung giờ là bắt buộc";
    if (!formData.categoryMenuId)
      nextErrors.categoryMenuId = "Vui lòng chọn danh mục gốc";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      id: formData.id || null,
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      timeSlot: formData.timeSlot || "breakfast",
      categoryMenuId: formData.categoryMenuId || null,
      coverImage: formData.coverImage.trim() || null,
      isActive: !!formData.isActive,
    };

    onSubmit?.(payload);
  };

  const handleRequestClose = () => {
    if (isDirty) {
      const ok = window.confirm(
        "Bạn có thay đổi chưa lưu. Bạn có chắc chắn muốn đóng?"
      );
      if (!ok) return;
    }
    onClose?.();
  };

  // Quick add new category
  const handleStartAddCat = () => setIsAddingNewCat(true);

  const handleCancelAddCat = () => {
    setIsAddingNewCat(false);
    setQuickCatName("");
  };

  const handleQuickCatSave = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();

    const name = quickCatName.trim();
    if (!name || !createCategoryMenu) return;

    try {
      setQuickCatSaving(true);
      const created = await createCategoryMenu({
        restaurantId,
        name,
        isActive: true,
      });

      const newId = created?.id || created?._id;
      if (newId) {
        setFormData((prev) => ({ ...prev, categoryMenuId: newId }));
        if (errors.categoryMenuId) {
          setErrors((prev) => ({ ...prev, categoryMenuId: "" }));
        }
      }

      setQuickCatName("");
      setIsAddingNewCat(false);
      setIsCatDropdownOpen(false);
    } catch (err) {
      alert(err?.message || "Lỗi khi tạo danh mục mới");
    } finally {
      setQuickCatSaving(false);
    }
  };

  return (
    <div className="menu-modal__overlay">
      <div className="menu-modal__container">
        {/* Header */}
        <div className="menu-modal__header">
          <h2>{isEditMode ? "Cập nhật Menu" : "Thêm Menu mới"}</h2>
          <button
            type="button"
            className="menu-modal__close-btn"
            onClick={handleRequestClose}
          >
            <FiX />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="menu-modal__form">
          <div className="menu-modal__content">
            {/* Name */}
            <div className="menu-modal__form-group">
              <label className="menu-modal__label">
                Tên Menu <span className="menu-modal__req">*</span>
              </label>
              <input
                type="text"
                name="name"
                className={`menu-modal__input ${
                  errors.name ? "menu-modal__input--error" : ""
                }`}
                value={formData.name}
                onChange={handleFieldChange}
                placeholder="Ví dụ: Breakfast Menu"
                autoFocus
              />
              {errors.name && (
                <p className="menu-modal__error-text">{errors.name}</p>
              )}
            </div>

            {/* Row: Timeslot + Category Dropdown */}
            <div className="menu-modal__row">
              {/* Time Slot */}
              <div className="menu-modal__form-group menu-modal__col">
                <label className="menu-modal__label">
                  Khung giờ <span className="menu-modal__req">*</span>
                </label>
                <div className="menu-modal__select-wrapper">
                  <select
                    name="timeSlot"
                    value={formData.timeSlot}
                    onChange={handleFieldChange}
                    disabled={isEditMode}
                    className={
                      errors.timeSlot ? "menu-modal__input--error" : ""
                    }
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot.value} value={slot.value}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.timeSlot && (
                  <p className="menu-modal__error-text">{errors.timeSlot}</p>
                )}
              </div>

              {/* CategoryMenu Custom Dropdown */}
              <div className="menu-modal__form-group menu-modal__col">
                <label className="menu-modal__label">
                  Danh mục gốc <span className="menu-modal__req">*</span>
                </label>

                <div
                  className="menu-modal__category-select"
                  ref={catDropdownRef}
                >
                  <div
                    className={`menu-modal__category-display ${
                      !formData.categoryMenuId && errors.categoryMenuId
                        ? "menu-modal__input--error"
                        : ""
                    }`}
                    onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
                  >
                    <span
                      style={{
                        color: formData.categoryMenuId ? "#0f172a" : "#94a3b8",
                      }}
                    >
                      {selectedCategoryName || "-- Chọn danh mục --"}
                    </span>
                    <FiChevronDown
                      style={{
                        transform: isCatDropdownOpen
                          ? "rotate(180deg)"
                          : "rotate(0)",
                        transition: "transform 0.2s",
                      }}
                    />
                  </div>

                  {isCatDropdownOpen && (
                    <div className="menu-modal__category-dropdown">
                      <ul className="menu-modal__category-list">
                        {categoryMenus.length === 0 && (
                          <li className="menu-modal__category-empty">
                            Chưa có danh mục nào
                          </li>
                        )}

                        {categoryMenus.map((cat) => {
                          const val = cat.id || cat._id;
                          const isSelected = val === formData.categoryMenuId;
                          return (
                            <li
                              key={val}
                              className={`menu-modal__category-option ${
                                isSelected ? "is-selected" : ""
                              }`}
                              onClick={() => handleSelectCategory(val)}
                            >
                              {cat.name}
                              {isSelected && <FiCheck />}
                            </li>
                          );
                        })}
                      </ul>

                      {/* Add New Category */}
                      <div className="menu-modal__category-add">
                        {!isAddingNewCat ? (
                          <button
                            type="button"
                            className="menu-modal__category-add-btn"
                            onClick={handleStartAddCat}
                          >
                            <FiPlus /> Tạo danh mục mới
                          </button>
                        ) : (
                          <div className="menu-modal__category-add-inline">
                            <input
                              type="text"
                              className="menu-modal__input menu-modal__input--sm"
                              placeholder="Tên danh mục..."
                              value={quickCatName}
                              onChange={(e) => setQuickCatName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleQuickCatSave(e);
                                }
                              }}
                              autoFocus
                            />

                            <button
                              type="button"
                              className="menu-modal__btn--sm primary"
                              onClick={handleQuickCatSave}
                              disabled={quickCatSaving || !quickCatName.trim()}
                            >
                              {quickCatSaving ? "..." : <FiCheck />}
                            </button>

                            <button
                              type="button"
                              className="menu-modal__btn--sm ghost"
                              onClick={handleCancelAddCat}
                              disabled={quickCatSaving}
                            >
                              <FiX />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {errors.categoryMenuId && (
                  <p className="menu-modal__error-text">
                    {errors.categoryMenuId}
                  </p>
                )}
              </div>
            </div>

            {/* Cover Image */}
            <div className="menu-modal__form-group">
              <label className="menu-modal__label">Link ảnh bìa (URL)</label>
              <div className="menu-modal__image-row">
                <div className="menu-modal__input-with-icon">
                  <FiUploadCloud className="menu-modal__field-icon" />
                  <input
                    type="url"
                    name="coverImage"
                    className="menu-modal__input"
                    value={formData.coverImage || ""}
                    onChange={handleFieldChange}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                <div className="menu-modal__img-preview">
                  {formData.coverImage ? (
                    <img
                      src={formData.coverImage}
                      alt="Preview"
                      onError={(e) => {
                        e.target.src =
                          "https://via.placeholder.com/120?text=No+Image";
                      }}
                    />
                  ) : (
                    <div className="menu-modal__img-placeholder">
                      <FiImage />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="menu-modal__form-group">
              <label className="menu-modal__label">Mô tả ngắn</label>
              <textarea
                name="description"
                className="menu-modal__textarea"
                value={formData.description || ""}
                onChange={handleFieldChange}
                rows={3}
                placeholder="Mô tả về các món trong thực đơn này..."
              />
            </div>

            {/* Status */}
            <div className="menu-modal__form-group menu-modal__toggle-row">
              <label className="menu-modal__switch">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={!!formData.isActive}
                  onChange={handleFieldChange}
                />
                <span className="menu-modal__slider menu-modal__slider--round" />
              </label>

              <div className="menu-modal__toggle-text">
                <span>Kích hoạt menu này</span>
                <small>Menu sẽ hiển thị trên ứng dụng của khách hàng</small>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="menu-modal__footer">
            <button
              type="button"
              className="menu-modal__btn menu-modal__btn--ghost"
              onClick={handleRequestClose}
              disabled={isSubmitting}
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              className="menu-modal__btn menu-modal__btn--primary"
              disabled={isSubmitting}
            >
              <FiCheck />
              <span style={{ marginLeft: 6 }}>
                {isEditMode ? "Lưu thay đổi" : "Tạo Menu"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MenuModal;
