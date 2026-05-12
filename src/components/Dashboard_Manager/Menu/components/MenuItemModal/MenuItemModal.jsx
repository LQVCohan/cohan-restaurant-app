import React, { useState, useEffect, useMemo } from "react";
import {
  Save,
  Plus,
  Trash2,
  Image as ImageIcon,
  ChefHat,
  DollarSign,
  Clock,
  Info,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Modal from "../../../../common/Modal";
import "./MenuItemModal.scss";

import useMenuManagement from "../../../../../hooks/useMenuManagement";
import { useRecipes } from "../../../../../hooks/useRecipes";
import useModalDraft from "../../../../../hooks/useModalDraft";

const MenuItemModal = ({
  isOpen,
  editId,
  categories,
  menuItems,
  restaurantId,
  timeSlot,
  onSave,
  onClose,
}) => {
  // --- STATE ---
  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    status: "available",
    thumbImage: "",
    description: "",
    preparationMethods: [],
  });

  const [imgError, setImgError] = useState(false);
  const [toasts, setToasts] = useState([]);

  // --- HELPER: Toast ---
  const pushToast = (text, type = "success") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((i) => i.id !== id)), 3000);
  };

  // --- DATA LOADING & HOOKS ---
  const currentItem = useMemo(
    () =>
      Array.isArray(menuItems) && editId
        ? menuItems.find((i) => i.id === editId)
        : null,
    [menuItems, editId]
  );

  const { createMenuItem, updateMenuItem } = useMenuManagement({
    restaurantId,
    defaultTimeSlot: timeSlot,
    pageSize: 1,
    useConnection: false,
  });

  const { updateRecipe, loading: recipeLoading } = useRecipes(
    restaurantId,
    timeSlot,
    { search: null, categoryId: null }
  );

  const defaultMethod = {
    key: "",
    name: "",
    price: "",
    cookTime: "",
    mode: "PORTION",
    sellQty: 1,
    sellUnit: "portion",
    isDefault: true,
  };
  const isDirty = useMemo(() => {
    const hasValues =
      (formData.name || "").trim() ||
      formData.categoryId ||
      (formData.description || "").trim() ||
      (formData.thumbImage || "").trim() ||
      (Array.isArray(formData.preparationMethods) &&
        formData.preparationMethods.some(
          (m) =>
            (m?.name || "").trim() ||
            m?.price !== "" ||
            m?.cookTime !== ""
        ));
    return !!hasValues;
  }, [formData]);

  const { requestCloseWithDraft, clearDraft } = useModalDraft({
    enabled: isOpen,
    draftIdentity: {
      module: "menu",
      modal: "menu-item-modal",
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: editId ? "edit" : "create",
      entityType: "menu-item",
      recordId: editId || null,
      context: timeSlot || "all-day",
      schemaVersion: "1",
    },
    formValue: formData,
    isDirty,
    sanitize: (v) => ({
      name: v?.name || "",
      categoryId: v?.categoryId || "",
      status: v?.status || "available",
      thumbImage: v?.thumbImage || "",
      description: v?.description || "",
      preparationMethods: Array.isArray(v?.preparationMethods)
        ? v.preparationMethods
        : [],
    }),
    onRestore: (draft) => setFormData((prev) => ({ ...prev, ...draft })),
    notify: (message, type) =>
      pushToast(message, type === "error" ? "error" : "success"),
  });

  // --- EFFECT: Load Data ---
  useEffect(() => {
    if (isOpen) {
      setImgError(false);
      if (editId && currentItem) {
        const svList = Array.isArray(currentItem.servingVariants)
          ? currentItem.servingVariants
          : [];
        const methods =
          svList.length > 0
            ? svList.map((sv) => ({
                key: sv.key || "",
                name: sv.name || "",
                price: typeof sv.price === "number" ? sv.price : "",
                cookTime: currentItem.avgPrepTimeMin || "",
                unit: sv.sellUnit || "portion",
                mode: sv.mode || "PORTION",
                sellQty: sv.sellQty || 1,
                sellUnit: sv.sellUnit || "portion",
                isDefault: !!sv.isDefault,
              }))
            : [{ ...defaultMethod }];

        setFormData({
          name: currentItem.name || "",
          categoryId:
            currentItem.categoryId ||
            currentItem.category?.id ||
            currentItem.category ||
            "",
          status: currentItem.status || "available",
          thumbImage: currentItem.thumbImage || "",
          description: currentItem.description || "",
          preparationMethods: methods,
        });
      } else {
        setFormData({
          name: "",
          categoryId: "",
          status: "available",
          thumbImage: "",
          description: "",
          preparationMethods: [{ ...defaultMethod }],
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, currentItem, isOpen]);

  // --- HANDLERS ---
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === "thumbImage") setImgError(false);
  };

  const handlePMChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      preparationMethods: prev.preparationMethods.map((m, i) =>
        i === index ? { ...m, [field]: value } : m
      ),
    }));
  };

  const addPM = () => {
    setFormData((prev) => ({
      ...prev,
      preparationMethods: [...prev.preparationMethods, { ...defaultMethod }],
    }));
  };

  const removePM = (index) => {
    if (formData.preparationMethods.length > 1) {
      setFormData((prev) => ({
        ...prev,
        preparationMethods: prev.preparationMethods.filter(
          (_, i) => i !== index
        ),
      }));
    } else {
      pushToast("Cần ít nhất một cách chế biến", "error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!restaurantId) return pushToast("Lỗi: Thiếu ID nhà hàng", "error");
    if (!formData.name.trim() || !formData.categoryId)
      return pushToast(
        "Vui lòng nhập tên và chọn danh mục món",
        "error"
      );

    const validPM = formData.preparationMethods.filter(
      (m) => m.name.trim() && m.price !== "" && m.price >= 0
    );

    if (!validPM.length)
      return pushToast(
        "Vui lòng nhập Tên và Giá cho ít nhất một biến thể.",
        "error"
      );

    const cookTimes = validPM
      .map((m) => parseInt(m.cookTime, 10))
      .filter((n) => Number.isFinite(n) && n >= 0);
    const avgPrepTimeMin =
      cookTimes.length > 0
        ? Math.round(cookTimes.reduce((a, b) => a + b, 0) / cookTimes.length)
        : undefined;

    try {
      const menuItemPayload = {
        name: formData.name,
        categoryId: formData.categoryId,
        status: formData.status,
        description: formData.description,
        ...(Number.isFinite(avgPrepTimeMin) ? { avgPrepTimeMin } : {}),
        ...(formData.thumbImage?.trim()
          ? { thumbImage: formData.thumbImage.trim() }
          : {}),
      };

      let targetMenuItemId = editId;
      if (editId) {
        await updateMenuItem({ id: editId, ...menuItemPayload });
      } else {
        const created = await createMenuItem({
          ...menuItemPayload,
          timeSlot,
        });
        targetMenuItemId = created?.id;
      }

      const recipeForm = {
        description: formData.description,
        servingVariants: formData.preparationMethods.map((m, idx) => {
          const fallbackKey =
            (m.name || "").toLowerCase().replace(/\s+/g, "_") || `sv_${idx}`;
          return {
            key: m.key || fallbackKey,
            mode: m.mode || "PORTION",
            sellQty: Number(m.sellQty || 1),
            sellUnit:
              m.sellUnit || (m.mode === "BY_WEIGHT" ? "kg" : "portion"),
            name: m.name,
            ingredients: [],
            price: Number(m.price) || 0,
            isDefault: idx === 0 || m.isDefault,
          };
        }),
      };

      if (targetMenuItemId) {
        await updateRecipe(targetMenuItemId, recipeForm);
      }

      pushToast("Lưu món ăn thành công!", "success");
      clearDraft();
      onSave?.();
    } catch (err) {
      console.error(err);
      pushToast(`Lỗi: ${err.message}`, "error");
    }
  };

  const isSaving = recipeLoading;

  const renderImagePreview = () => {
    if (formData.thumbImage && !imgError) {
      return (
        <div className="img-preview loaded">
          <img
            src={formData.thumbImage}
            alt="Preview"
            onError={() => setImgError(true)}
          />
        </div>
      );
    }
    return (
      <div className="img-preview placeholder">
        <ImageIcon size={20} className="icon" />
        <span>URL Ảnh</span>
      </div>
    );
  };

  // --- RENDER ---
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => requestCloseWithDraft(onClose)}
      size="xl"
      className="menu-item-modal-modern"
    >
      <Modal.Header onClose={() => requestCloseWithDraft(onClose)}>
        {editId ? "Chỉnh sửa món ăn" : "Thêm món mới"}
      </Modal.Header>

      <Modal.Body>
        <form
          id="menu-form"
          onSubmit={handleSubmit}
          className="modern-form-layout"
        >
          <div className="left-col">
            <h4 className="col-title">
              <Info size={18} /> Thông tin chung
            </h4>

            <div className="form-group">
              <label>
                Tên món ăn <span className="req">*</span>
              </label>
              <input
                type="text"
                className="modern-input"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Ví dụ: Phở Bò Tái"
                required
                autoFocus
              />
            </div>

            <div className="row-2-col">
              <div className="form-group">
                <label>
                  Danh mục món <span className="req">*</span>
                </label>
                <select
                  className="modern-select"
                  value={formData.categoryId}
                  onChange={(e) =>
                    handleInputChange("categoryId", e.target.value)
                  }
                  required
                >
                  <option value="">-- Chọn danh mục món --</option>
                  {categories?.map((c) => (
                    <option key={c.id || c._id} value={c.id || c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Trạng thái</label>
                <select
                  className="modern-select"
                  value={formData.status}
                  onChange={(e) => handleInputChange("status", e.target.value)}
                >
                  <option value="available">Sẵn sàng</option>
                  <option value="unavailable">Tạm hết</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Hình ảnh (URL)</label>
              <div className="image-input-wrapper">
                <input
                  type="text"
                  className="modern-input"
                  value={formData.thumbImage}
                  onChange={(e) =>
                    handleInputChange("thumbImage", e.target.value)
                  }
                  placeholder="https://example.com/image.jpg"
                />
                {renderImagePreview()}
              </div>
            </div>

            <div className="form-group">
              <label>Mô tả</label>
              <textarea
                className="modern-textarea"
                rows="4"
                value={formData.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                placeholder="Mô tả ngắn về hương vị, thành phần..."
              />
            </div>
          </div>

          <div className="right-col">
            <div className="header-action">
              <h4 className="col-title">
                <ChefHat size={18} /> Biến thể & Giá
              </h4>
              <button type="button" className="btn-add-variant" onClick={addPM}>
                <Plus size={16} /> Thêm mới
              </button>
            </div>

            <div className="methods-scroll-container">
              {formData.preparationMethods.map((method, index) => (
                <div key={index} className="method-card">
                  <div className="method-card-header">
                    <span className="badge-index">#{index + 1}</span>
                    {formData.preparationMethods.length > 1 && (
                      <button
                        type="button"
                        className="btn-remove"
                        onClick={() => removePM(index)}
                        title="Xóa biến thể này"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="method-grid">
                    <div className="form-group full-width">
                      <label>
                        Tên biến thể <span className="req">*</span>
                      </label>
                      <input
                        type="text"
                        className="modern-input small"
                        value={method.name}
                        onChange={(e) =>
                          handlePMChange(index, "name", e.target.value)
                        }
                        placeholder="VD: Size Lớn"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>
                        <DollarSign size={12} /> Giá bán
                      </label>
                      <input
                        type="number"
                        className="modern-input small"
                        value={method.price}
                        onChange={(e) =>
                          handlePMChange(index, "price", e.target.value)
                        }
                        placeholder="0"
                        min="0"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>
                        <Clock size={12} /> Phút
                      </label>
                      <input
                        type="number"
                        className="modern-input small"
                        value={method.cookTime}
                        onChange={(e) =>
                          handlePMChange(index, "cookTime", e.target.value)
                        }
                        placeholder="10"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        <div className="toast-wrapper">
          {toasts.map((t) => (
            <div key={t.id} className={`toast-item ${t.type}`}>
              {t.type === "success" ? (
                <CheckCircle2 size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => requestCloseWithDraft(onClose)}
        >
          Đóng
        </button>
        <button
          type="submit"
          form="menu-form"
          className="btn-primary"
          disabled={isSaving}
        >
          {isSaving ? (
            "Đang lưu..."
          ) : (
            <>
              <Save size={18} /> {editId ? "Lưu thay đổi" : "Tạo món mới"}
            </>
          )}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default MenuItemModal;
