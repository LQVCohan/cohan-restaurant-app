// src/pages/Restaurant/MenuManagement/components/MenuModal/MenuModal.jsx
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  FiX,
  FiCheck,
  FiPlus,
  FiChevronDown,
  FiSave,
  FiAlertCircle,
} from "react-icons/fi";
import "./MenuModal.scss";
import LocalImagePicker from "../../../../common/LocalImagePicker";
import { getImagePersistenceStatus } from "../../../../../utils/imagePersistence";
import {
  hasIconInCategoryName,
  resolveCategoryIcon,
} from "../../../../../utils/categoryIconMap";

const TIME_SLOTS = [
  { value: "breakfast", label: "Bữa Sáng" },
  { value: "lunch", label: "Bữa Trưa" },
  { value: "dinner", label: "Bữa Tối" },
  { value: "late_night", label: "Ăn Khuya" },
];

const getCategoryLabelWithIcon = (name = "") => {
  const safeName = String(name || "").trim();
  if (!safeName) return "";
  if (hasIconInCategoryName(safeName)) return safeName;
  return `${resolveCategoryIcon(safeName)} ${safeName}`;
};

const getErrorMessage = (
  error,
  fallbackMessage = "Không thể tạo nhóm thực đơn mới.",
) => {
  const graphQlMessage = error?.graphQLErrors
    ?.map((entry) => entry?.message)
    .filter(Boolean)
    .join("; ");

  if (graphQlMessage) return graphQlMessage;
  if (error?.networkError?.result?.errors?.length) {
    return error.networkError.result.errors
      .map((entry) => entry?.message)
      .filter(Boolean)
      .join("; ");
  }

  return error?.message || fallbackMessage;
};

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
  submitError = "",
}) => {
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [errors, setErrors] = useState({});

  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const [isAddingNewCat, setIsAddingNewCat] = useState(false);
  const [quickCatName, setQuickCatName] = useState("");
  const [quickCatSaving, setQuickCatSaving] = useState(false);
  const [quickCatError, setQuickCatError] = useState("");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [imageSyncStatus, setImageSyncStatus] = useState("idle");

  const initialSnapshotRef = useRef(INITIAL_STATE);
  const catDropdownRef = useRef(null);

  const isCopyMode =
    initialData?.__mode === "copy" || initialData?.isCopyDraft === true;

  const isEditMode = Boolean(
    initialData && !isCopyMode && (initialData.id || initialData._id),
  );
  useEffect(() => {
    if (!isOpen) return;

    const next = {
      id: isCopyMode ? null : initialData?.id || initialData?._id || null,
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
    setQuickCatError("");
    setShowDiscardConfirm(false);
    setImageSyncStatus("idle");
    initialSnapshotRef.current = next;
  }, [isOpen, initialData, isCopyMode]);

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
          setQuickCatError("");
        }
      }
    };

    if (isCatDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCatDropdownOpen, quickCatSaving]);

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

  const selectedCategoryName = useMemo(() => {
    const found = categoryMenus.find(
      (c) => (c.id || c._id) === formData.categoryMenuId,
    );
    return found ? found.name : "";
  }, [categoryMenus, formData.categoryMenuId]);

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

  const handleCoverImageChange = (value) => {
    setFormData((prev) => ({ ...prev, coverImage: value || "" }));
    setImageSyncStatus("idle");
  };

  const handleSelectCategory = (catId) => {
    setFormData((prev) => ({ ...prev, categoryMenuId: catId }));
    if (errors.categoryMenuId) {
      setErrors((prev) => ({ ...prev, categoryMenuId: "" }));
    }
    setQuickCatError("");
    setIsCatDropdownOpen(false);
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.name.trim()) nextErrors.name = "Tên menu là bắt buộc";
    if (!formData.timeSlot) nextErrors.timeSlot = "Khung giờ là bắt buộc";
    if (!formData.categoryMenuId)
      nextErrors.categoryMenuId = "Vui lòng chọn nhóm thực đơn";

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

  const handleDismissDiscardConfirm = useCallback(() => {
    if (isSubmitting || quickCatSaving) return;
    setShowDiscardConfirm(false);
  }, [isSubmitting, quickCatSaving]);

  const handleConfirmDiscard = useCallback(() => {
    if (isSubmitting || quickCatSaving) return;
    setShowDiscardConfirm(false);
    onClose?.();
  }, [isSubmitting, onClose, quickCatSaving]);

  const handleRequestClose = useCallback(() => {
    if (isSubmitting || quickCatSaving) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }

    setShowDiscardConfirm(false);
    onClose?.();
  }, [isDirty, isSubmitting, onClose, quickCatSaving]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (showDiscardConfirm) {
          handleDismissDiscardConfirm();
          return;
        }
        handleRequestClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleDismissDiscardConfirm,
    handleRequestClose,
    isOpen,
    showDiscardConfirm,
  ]);

  const handleStartAddCat = () => {
    setQuickCatError("");
    setIsAddingNewCat(true);
  };

  const handleCancelAddCat = () => {
    setIsAddingNewCat(false);
    setQuickCatName("");
    setQuickCatError("");
  };

  const handleQuickCatSave = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();

    const name = quickCatName.trim();
    if (!name) return;

    if (!restaurantId) {
      setQuickCatError("Không thể tạo nhóm thực đơn vì chưa chọn nhà hàng.");
      return;
    }

    if (!createCategoryMenu) {
      setQuickCatError(
        "Không thể tạo nhóm thực đơn lúc này. Vui lòng thử lại.",
      );
      return;
    }

    try {
      setQuickCatSaving(true);
      setQuickCatError("");
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
      setQuickCatError("");
    } catch (err) {
      setQuickCatError(
        getErrorMessage(
          err,
          "Không thể tạo nhóm thực đơn mới. Vui lòng thử lại.",
        ),
      );
    } finally {
      setQuickCatSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modern-modal-overlay"
      onClick={handleRequestClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modern-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>
            {isCopyMode
              ? "Sao chép Menu"
              : isEditMode
                ? "Cập nhật Menu"
                : "Thêm Menu mới"}
          </h2>
          <button
            type="button"
            className="btn-close"
            onClick={handleRequestClose}
          >
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body">
            {submitError && (
              <div
                role="alert"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "12px 14px",
                  marginBottom: 16,
                  borderRadius: 8,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#b91c1c",
                }}
              >
                <FiAlertCircle
                  size={18}
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                  {submitError}
                </p>
              </div>
            )}

            <div className="form-group">
              <label>
                Tên Menu <span className="req">*</span>
              </label>
              <input
                type="text"
                name="name"
                className={`modern-input ${errors.name ? "error" : ""}`}
                value={formData.name}
                onChange={handleFieldChange}
                placeholder="Ví dụ: Thực đơn sáng"
                autoFocus
              />
              {errors.name && <p className="error-text">{errors.name}</p>}
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label>
                  Khung giờ <span className="req">*</span>
                </label>
                <select
                  name="timeSlot"
                  value={formData.timeSlot}
                  onChange={handleFieldChange}
                  disabled={isEditMode}
                  className={`modern-select ${errors.timeSlot ? "error" : ""}`}
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
                {errors.timeSlot && (
                  <p className="error-text">{errors.timeSlot}</p>
                )}
              </div>

              <div className="form-group" ref={catDropdownRef}>
                <label>
                  Nhóm thực đơn <span className="req">*</span>
                </label>

                <div className="custom-select-wrapper">
                  <div
                    className={`custom-select-trigger ${
                      !formData.categoryMenuId && errors.categoryMenuId
                        ? "error"
                        : ""
                    }`}
                    onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
                  >
                    <span
                      className={!selectedCategoryName ? "placeholder" : ""}
                    >
                      {selectedCategoryName
                        ? getCategoryLabelWithIcon(selectedCategoryName)
                        : "-- Chọn nhóm thực đơn --"}
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
                    <div className="custom-dropdown-menu">
                      <ul className="dropdown-list">
                        {categoryMenus.length === 0 && (
                          <li className="empty-state">
                            Chưa có nhóm thực đơn nào
                          </li>
                        )}

                        {categoryMenus.map((cat) => {
                          const val = cat.id || cat._id;
                          const isSelected = val === formData.categoryMenuId;
                          return (
                            <li
                              key={val}
                              className={isSelected ? "selected" : ""}
                              onClick={() => handleSelectCategory(val)}
                            >
                              {getCategoryLabelWithIcon(cat.name)}
                              {isSelected && <FiCheck />}
                            </li>
                          );
                        })}
                      </ul>

                      <div className="quick-add-section">
                        {!isAddingNewCat ? (
                          <button
                            type="button"
                            className="btn-trigger-add"
                            onClick={handleStartAddCat}
                          >
                            <FiPlus /> Tạo nhóm thực đơn mới
                          </button>
                        ) : (
                          <div className="inline-add-form">
                            <input
                              type="text"
                              placeholder="Tên nhóm thực đơn..."
                              value={quickCatName}
                              onChange={(e) => {
                                setQuickCatName(e.target.value);
                                if (quickCatError) setQuickCatError("");
                              }}
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
                              className="btn-save"
                              onClick={handleQuickCatSave}
                              disabled={quickCatSaving || !quickCatName.trim()}
                              title="Lưu"
                            >
                              {quickCatSaving ? "..." : <FiCheck />}
                            </button>

                            <button
                              type="button"
                              className="btn-cancel"
                              onClick={handleCancelAddCat}
                              disabled={quickCatSaving}
                              title="Hủy"
                            >
                              <FiX />
                            </button>
                          </div>
                        )}

                        {quickCatError && (
                          <p className="error-text" style={{ marginTop: 8 }}>
                            {quickCatError}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {errors.categoryMenuId && (
                  <p className="error-text">{errors.categoryMenuId}</p>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Ảnh bìa</label>
              <LocalImagePicker
                value={formData.coverImage || ""}
                onChange={handleCoverImageChange}
                disabled={isSubmitting}
                ownerKey={formData.id || restaurantId || "menu-draft"}
                purpose="menu-cover"
                label="Chọn ảnh bìa"
                placeholder="Chưa có ảnh bìa"
                helperText="Ảnh sẽ được resize thành bản thumb 320px và preview 960px để tải nhanh, tốn ít bộ nhớ."
                onStatusChange={setImageSyncStatus}
              />
              {(imageSyncStatus === "localOnly" || getImagePersistenceStatus(formData.coverImage) === "localOnly") && (
                <small className="error-text">Ảnh đang lưu cục bộ trên trình duyệt này. Hãy đồng bộ server để xem được trên thiết bị khác.</small>
              )}
              {(imageSyncStatus === "synced" || getImagePersistenceStatus(formData.coverImage) === "synced") && (
                <small style={{ color: "#0f766e", display: "block", marginTop: 6 }}>Đã đồng bộ server.</small>
              )}
            </div>

            <div className="form-group">
              <label>Mô tả ngắn</label>
              <textarea
                name="description"
                className="modern-textarea"
                value={formData.description || ""}
                onChange={handleFieldChange}
                rows={3}
                placeholder="Mô tả về các món trong thực đơn này..."
              />
            </div>

            <div className="toggle-wrapper">
              <label className="switch">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={!!formData.isActive}
                  onChange={handleFieldChange}
                />
                <span className="slider"></span>
              </label>

              <div className="toggle-label">
                <span>Kích hoạt menu này</span>
                <small>Menu sẽ hiển thị trên ứng dụng của khách hàng</small>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-ghost"
              onClick={handleRequestClose}
              disabled={isSubmitting}
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              <FiSave />
              <span>
                {isCopyMode
                  ? "Tạo từ bản sao"
                  : isEditMode
                    ? "Lưu thay đổi"
                    : "Tạo Menu"}
              </span>
            </button>
          </div>
        </form>

        {showDiscardConfirm && (
          <div className="menu-modal-confirm-layer">
            <div
              className="menu-modal-confirm-card"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="menu-discard-confirm-title"
              aria-describedby="menu-discard-confirm-description"
            >
              <div className="menu-modal-confirm-icon">
                <FiAlertCircle size={18} />
              </div>

              <div className="menu-modal-confirm-content">
                <h3 id="menu-discard-confirm-title">Bỏ thay đổi chưa lưu?</h3>
                <p id="menu-discard-confirm-description">
                  Bạn đang có thay đổi chưa lưu trong menu này. Nếu tiếp tục
                  đóng, mọi chỉnh sửa hiện tại sẽ bị bỏ đi.
                </p>
              </div>

              <div className="menu-modal-confirm-actions">
                <button
                  type="button"
                  className="btn-confirm-cancel"
                  onClick={handleDismissDiscardConfirm}
                  disabled={isSubmitting || quickCatSaving}
                >
                  Tiếp tục chỉnh sửa
                </button>

                <button
                  type="button"
                  className="btn-confirm-discard"
                  onClick={handleConfirmDiscard}
                  disabled={isSubmitting || quickCatSaving}
                >
                  Bỏ thay đổi
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuModal;
