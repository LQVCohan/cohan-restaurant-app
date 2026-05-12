import React, { useState, useEffect, useMemo, useRef } from "react";
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

const DEFAULT_METHOD = {
  key: "",
  name: "",
  price: "",
  cookTime: "",
  mode: "PORTION",
  sellQty: 1,
  sellUnit: "portion",
  isDefault: true,
  ingredients: [],
};

const getErrorMessage = (error, fallback = "Đã có lỗi xảy ra.") => {
  const graphQlMessage = error?.graphQLErrors
    ?.map((entry) => entry?.message)
    .filter(Boolean)
    .join("; ");

  if (graphQlMessage) return graphQlMessage;

  const networkErrors = error?.networkError?.result?.errors;
  if (Array.isArray(networkErrors) && networkErrors.length > 0) {
    const networkMessage = networkErrors
      .map((entry) => entry?.message)
      .filter(Boolean)
      .join("; ");

    if (networkMessage) return networkMessage;
  }

  return error?.message || fallback;
};

const normalizeVariantNameForMatch = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");

const buildExistingVariantLookup = (variants = []) => {
  const byKey = new Map();
  const byName = new Map();

  variants.forEach((variant) => {
    const key = String(variant?.key || "").trim();
    const normalizedName = normalizeVariantNameForMatch(variant?.name || "");

    if (key && !byKey.has(key)) {
      byKey.set(key, variant);
    }

    if (normalizedName && !byName.has(normalizedName)) {
      byName.set(normalizedName, variant);
    }
  });

  return { byKey, byName };
};

const findExistingVariant = (method, lookup) => {
  if (!lookup) return null;

  const key = String(method?.key || "").trim();
  if (key && lookup.byKey.has(key)) {
    return lookup.byKey.get(key);
  }

  const normalizedName = normalizeVariantNameForMatch(method?.name || "");
  if (normalizedName && lookup.byName.has(normalizedName)) {
    return lookup.byName.get(normalizedName);
  }

  return null;
};

const normalizeDefaultMethods = (methods = []) => {
  const cloned = methods.map((method) => ({ ...method }));
  if (!cloned.length) return cloned;

  let defaultIndex = cloned.findIndex((method) => method?.isDefault);
  if (defaultIndex < 0) defaultIndex = 0;

  return cloned.map((method, index) => ({
    ...method,
    isDefault: index === defaultIndex,
  }));
};

const enrichMethodsWithExistingVariants = (methods = [], existingVariants = []) => {
  if (!Array.isArray(methods) || methods.length === 0) return methods;
  if (!Array.isArray(existingVariants) || existingVariants.length === 0) {
    return normalizeDefaultMethods(methods);
  }

  const lookup = buildExistingVariantLookup(existingVariants);

  return normalizeDefaultMethods(
    methods.map((method) => {
      const matched = findExistingVariant(method, lookup);
      if (!matched) {
        return method;
      }

      const existingIngredients = Array.isArray(matched.ingredients)
        ? matched.ingredients
        : Array.isArray(matched.components)
        ? matched.components
        : [];

      return {
        ...method,
        key: method?.key || matched?.key || "",
        mode: method?.mode || matched?.mode || "PORTION",
        sellQty:
          method?.sellQty ?? matched?.sellQty ?? DEFAULT_METHOD.sellQty,
        sellUnit:
          method?.sellUnit || matched?.sellUnit || DEFAULT_METHOD.sellUnit,
        isDefault:
          typeof method?.isDefault === "boolean"
            ? method.isDefault
            : !!matched?.isDefault,
        ingredients: Array.isArray(method?.ingredients)
          ? method.ingredients
          : existingIngredients,
      };
    })
  );
};

const buildRecipeServingVariants = (methods = [], existingVariants = []) => {
  const lookup = buildExistingVariantLookup(existingVariants);

  return normalizeDefaultMethods(methods).map((method, index) => {
    const matched = findExistingVariant(method, lookup);
    const fallbackKey =
      String(method?.name || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_") || `sv_${index}`;

    const mode = method?.mode || matched?.mode || "PORTION";
    const sellQty = Number(
      method?.sellQty ?? matched?.sellQty ?? DEFAULT_METHOD.sellQty
    );
    const sellUnit =
      method?.sellUnit ||
      matched?.sellUnit ||
      (mode === "BY_WEIGHT" ? "kg" : "portion");

    const ingredients = Array.isArray(method?.ingredients)
      ? method.ingredients
      : Array.isArray(matched?.ingredients)
      ? matched.ingredients
      : Array.isArray(matched?.components)
      ? matched.components
      : [];

    return {
      key: String(method?.key || matched?.key || fallbackKey).trim(),
      name: String(method?.name || matched?.name || "").trim(),
      mode,
      sellQty: Number.isFinite(sellQty) && sellQty > 0 ? sellQty : 1,
      sellUnit,
      ingredients,
      price: Number(method?.price),
      isDefault: !!method?.isDefault,
    };
  });
};

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [persistedMenuItemId, setPersistedMenuItemId] = useState(null);

  const submitGuardRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const pushToast = (text, type = "success") => {
    const id = Date.now();
    setToasts((current) => [...current, { id, text, type }]);
    setTimeout(
      () => setToasts((current) => current.filter((item) => item.id !== id)),
      3000
    );
  };

  const effectiveItemId = editId || persistedMenuItemId;

  const currentItem = useMemo(
    () =>
      Array.isArray(menuItems) && effectiveItemId
        ? menuItems.find((item) => String(item.id) === String(effectiveItemId))
        : null,
    [menuItems, effectiveItemId]
  );

  const { createMenuItem, updateMenuItem } = useMenuManagement({
    restaurantId,
    defaultTimeSlot: timeSlot,
    pageSize: 1,
    useConnection: false,
  });

  const { recipes, updateRecipe } = useRecipes(
    restaurantId,
    timeSlot,
    { search: null, categoryId: null }
  );

  const currentRecipeItem = useMemo(
    () =>
      Array.isArray(recipes) && effectiveItemId
        ? recipes.find((item) => String(item.id) === String(effectiveItemId))
        : null,
    [recipes, effectiveItemId]
  );

  const isDirty = useMemo(() => {
    const hasValues =
      (formData.name || "").trim() ||
      formData.categoryId ||
      (formData.description || "").trim() ||
      (formData.thumbImage || "").trim() ||
      (Array.isArray(formData.preparationMethods) &&
        formData.preparationMethods.some(
          (method) =>
            (method?.name || "").trim() ||
            method?.price !== "" ||
            method?.cookTime !== ""
        ));

    return !!hasValues;
  }, [formData]);

  const { requestCloseWithDraft, clearDraft } = useModalDraft({
    enabled: isOpen,
    draftIdentity: {
      module: "menu",
      modal: "menu-item-modal",
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: effectiveItemId ? "edit" : "create",
      entityType: "menu-item",
      recordId: effectiveItemId || null,
      context: timeSlot || "all-day",
      schemaVersion: "1",
    },
    formValue: formData,
    isDirty,
    sanitize: (value) => ({
      name: value?.name || "",
      categoryId: value?.categoryId || "",
      status: value?.status || "available",
      thumbImage: value?.thumbImage || "",
      description: value?.description || "",
      preparationMethods: Array.isArray(value?.preparationMethods)
        ? value.preparationMethods
        : [],
    }),
    onRestore: (draft) => setFormData((prev) => ({ ...prev, ...draft })),
    notify: (message, type) =>
      pushToast(message, type === "error" ? "error" : "success"),
  });

  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      submitGuardRef.current = false;
      setIsSubmitting(false);
      setPersistedMenuItemId(null);
      return;
    }

    if (hasInitializedRef.current) return;
    if (editId && !currentItem && !currentRecipeItem) return;

    const sourceItem = currentRecipeItem || currentItem;
    setImgError(false);

    if (editId && sourceItem) {
      const sourceVariants = Array.isArray(sourceItem.servingVariants)
        ? sourceItem.servingVariants
        : [];
      const methods =
        sourceVariants.length > 0
          ? sourceVariants.map((variant) => ({
              key: variant.key || "",
              name: variant.name || variant.preparationMethodName || "",
              price:
                typeof variant.price === "number" ? variant.price : "",
              cookTime:
                sourceItem.avgPrepTimeMin ?? currentItem?.avgPrepTimeMin ?? "",
              mode: variant.mode || "PORTION",
              sellQty: variant.sellQty || 1,
              sellUnit: variant.sellUnit || "portion",
              isDefault: !!variant.isDefault,
              ingredients: Array.isArray(variant.ingredients)
                ? variant.ingredients
                : Array.isArray(variant.components)
                ? variant.components
                : [],
            }))
          : [{ ...DEFAULT_METHOD }];

      setPersistedMenuItemId(editId);
      setFormData({
        name: sourceItem.name || currentItem?.name || "",
        categoryId:
          sourceItem.categoryId ||
          currentItem?.categoryId ||
          currentItem?.category?.id ||
          currentItem?.category ||
          "",
        status: sourceItem.status || currentItem?.status || "available",
        thumbImage: sourceItem.thumbImage || currentItem?.thumbImage || "",
        description:
          sourceItem.description || currentItem?.description || "",
        preparationMethods: enrichMethodsWithExistingVariants(
          methods,
          sourceVariants
        ),
      });
    } else {
      setFormData({
        name: "",
        categoryId: "",
        status: "available",
        thumbImage: "",
        description: "",
        preparationMethods: [{ ...DEFAULT_METHOD }],
      });
    }

    hasInitializedRef.current = true;
  }, [isOpen, editId, currentItem, currentRecipeItem]);

  useEffect(() => {
    if (!isOpen || !effectiveItemId || !currentRecipeItem?.servingVariants?.length) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      preparationMethods: enrichMethodsWithExistingVariants(
        prev.preparationMethods,
        currentRecipeItem.servingVariants
      ),
    }));
  }, [isOpen, effectiveItemId, currentRecipeItem]);

  const handleRequestClose = () => {
    if (isSubmitting) return;
    requestCloseWithDraft(onClose);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === "thumbImage") setImgError(false);
  };

  const handlePMChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      preparationMethods: prev.preparationMethods.map((method, itemIndex) =>
        itemIndex === index ? { ...method, [field]: value } : method
      ),
    }));
  };

  const addPM = () => {
    setFormData((prev) => ({
      ...prev,
      preparationMethods: [...prev.preparationMethods, { ...DEFAULT_METHOD, isDefault: false }],
    }));
  };

  const removePM = (index) => {
    if (formData.preparationMethods.length <= 1) {
      pushToast("Cần ít nhất một biến thể", "error");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      preparationMethods: normalizeDefaultMethods(
        prev.preparationMethods.filter((_, itemIndex) => itemIndex !== index)
      ),
    }));
  };

  const validateForm = () => {
    if (!restaurantId) return "Lỗi: Thiếu ID nhà hàng";
    if (!formData.name.trim()) return "Vui lòng nhập tên món ăn";
    if (!formData.categoryId) return "Vui lòng chọn danh mục món";

    const methods = Array.isArray(formData.preparationMethods)
      ? formData.preparationMethods
      : [];

    if (!methods.length) {
      return "Vui lòng tạo ít nhất một biến thể hợp lệ.";
    }

    for (let index = 0; index < methods.length; index += 1) {
      const method = methods[index];
      const variantName = String(method?.name || "").trim();
      const priceValue = Number(method?.price);

      if (!variantName) {
        return `Biến thể #${index + 1}: vui lòng nhập tên biến thể.`;
      }

      if (!Number.isFinite(priceValue) || priceValue < 0) {
        return `Biến thể #${index + 1}: giá bán phải là số lớn hơn hoặc bằng 0.`;
      }
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitGuardRef.current) return;

    const validationMessage = validateForm();
    if (validationMessage) {
      pushToast(validationMessage, "error");
      return;
    }

    submitGuardRef.current = true;
    setIsSubmitting(true);

    let targetMenuItemId = effectiveItemId;
    let menuItemSaved = false;
    let recipeSaved = false;
    const isEditingExistingItem = !!effectiveItemId;

    try {
      const cookTimes = formData.preparationMethods
        .map((method) => parseInt(method.cookTime, 10))
        .filter((value) => Number.isFinite(value) && value >= 0);
      const avgPrepTimeMin =
        cookTimes.length > 0
          ? Math.round(cookTimes.reduce((sum, value) => sum + value, 0) / cookTimes.length)
          : undefined;

      const menuItemPayload = {
        name: formData.name.trim(),
        categoryId: formData.categoryId,
        status: formData.status,
        description: formData.description.trim(),
        ...(Number.isFinite(avgPrepTimeMin) ? { avgPrepTimeMin } : {}),
        ...(formData.thumbImage?.trim()
          ? { thumbImage: formData.thumbImage.trim() }
          : {}),
      };

      if (targetMenuItemId) {
        const updated = await updateMenuItem({
          id: targetMenuItemId,
          ...menuItemPayload,
        });

        if (!updated?.id) {
          throw new Error("Không nhận được phản hồi hợp lệ khi cập nhật món ăn.");
        }
      } else {
        const created = await createMenuItem({
          ...menuItemPayload,
          timeSlot,
        });

        if (!created?.id) {
          throw new Error("Không nhận được phản hồi hợp lệ khi tạo món ăn.");
        }

        targetMenuItemId = created.id;
        setPersistedMenuItemId(created.id);
      }

      menuItemSaved = true;

      const existingVariants =
        currentRecipeItem?.servingVariants || currentItem?.servingVariants || [];
      const normalizedMethods = normalizeDefaultMethods(formData.preparationMethods);
      const recipeForm = {
        notes: currentRecipeItem?.notes ?? "",
        isActive: currentRecipeItem?.isActive ?? true,
        servingVariants: buildRecipeServingVariants(
          normalizedMethods,
          existingVariants
        ),
      };

      await updateRecipe(targetMenuItemId, recipeForm);
      recipeSaved = true;

      if (onSave) {
        await onSave();
      }

      clearDraft();
      pushToast("Lưu món ăn thành công!", "success");
    } catch (error) {
      console.error(error);
      const message = getErrorMessage(
        error,
        "Đã có lỗi xảy ra khi lưu món ăn."
      );

      if (!menuItemSaved) {
        pushToast(message, "error");
      } else if (!recipeSaved) {
        pushToast(
          `Món ăn đã được ${
            isEditingExistingItem ? "cập nhật" : "tạo"
          } nhưng biến thể/recipe chưa lưu thành công: ${message}`,
          "error"
        );
      } else {
        pushToast(
          `Đã lưu món ăn và biến thể nhưng không thể cập nhật danh sách: ${message}`,
          "error"
        );
      }
    } finally {
      submitGuardRef.current = false;
      setIsSubmitting(false);
    }
  };

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleRequestClose}
      size="xl"
      className="menu-item-modal-modern"
    >
      <Modal.Header onClose={handleRequestClose}>
        {effectiveItemId ? "Chỉnh sửa món ăn" : "Thêm món mới"}
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
                  {categories?.map((category) => (
                    <option
                      key={category.id || category._id}
                      value={category.id || category._id}
                    >
                      {category.name}
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
              <button
                type="button"
                className="btn-add-variant"
                onClick={addPM}
                disabled={isSubmitting}
              >
                <Plus size={16} /> Thêm mới
              </button>
            </div>

            <div className="methods-scroll-container">
              {formData.preparationMethods.map((method, index) => (
                <div key={method.key || index} className="method-card">
                  <div className="method-card-header">
                    <span className="badge-index">#{index + 1}</span>
                    {formData.preparationMethods.length > 1 && (
                      <button
                        type="button"
                        className="btn-remove"
                        onClick={() => removePM(index)}
                        title="Xóa biến thể này"
                        disabled={isSubmitting}
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
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast-item ${toast.type}`}>
              {toast.type === "success" ? (
                <CheckCircle2 size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
              <span>{toast.text}</span>
            </div>
          ))}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleRequestClose}
          disabled={isSubmitting}
        >
          Đóng
        </button>
        <button
          type="submit"
          form="menu-form"
          className="btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            "Đang lưu..."
          ) : (
            <>
              <Save size={18} /> {effectiveItemId ? "Lưu thay đổi" : "Tạo món mới"}
            </>
          )}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default MenuItemModal;
