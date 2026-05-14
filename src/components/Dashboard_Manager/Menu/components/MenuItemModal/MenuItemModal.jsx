import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Save,
  Plus,
  Trash2,
  ChefHat,
  DollarSign,
  Clock,
  Info,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Modal from "../../../../common/Modal";
import LocalImagePicker from "../../../../common/LocalImagePicker";
import "./MenuItemModal.scss";

import useMenuManagement from "../../../../../hooks/useMenuManagement";
import { useRecipes } from "../../../../../hooks/useRecipes";
import useModalDraft from "../../../../../hooks/useModalDraft";

const getGraphQLErrorMessage = (
  error,
  fallback = "Không thể lưu món ăn."
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

  return error?.message || fallback;
};

const cloneIngredients = (ingredients = []) =>
  Array.isArray(ingredients)
    ? ingredients.map((ingredient) => ({
        ingredientId: ingredient?.ingredientId,
        qty: Number(ingredient?.qty || 0),
        unit: ingredient?.unit || ingredient?.baseUnit || "",
        wastePct: Number(ingredient?.wastePct || 0),
      }))
    : [];

const normalizeVariantNameForCompare = (name) =>
  String(name ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");

const normalizeDefaultVariant = (variants = []) => {
  if (!Array.isArray(variants) || !variants.length) return [];

  let defaultIndex = variants.findIndex((variant) => !!variant?.isDefault);
  if (defaultIndex < 0) defaultIndex = 0;

  return variants.map((variant, index) => ({
    ...variant,
    isDefault: index === defaultIndex,
  }));
};

const findMatchingExistingVariant = (method, existingVariants = []) => {
  const methodKey = String(method?.key || "").trim();
  if (methodKey) {
    const matchedByKey = existingVariants.find(
      (variant) => String(variant?.key || "").trim() === methodKey
    );
    if (matchedByKey) return matchedByKey;
  }

  const normalizedName = normalizeVariantNameForCompare(method?.name);
  if (!normalizedName) return null;

  return (
    existingVariants.find(
      (variant) =>
        normalizeVariantNameForCompare(variant?.name) === normalizedName
    ) || null
  );
};

const validatePreparationMethods = (methods = []) => {
  if (!Array.isArray(methods) || !methods.length) {
    throw new Error("Vui lòng thêm ít nhất một biến thể hợp lệ.");
  }

  return methods.map((method, index) => {
    const name = String(method?.name || "").trim();
    if (!name) {
      throw new Error(`Vui lòng nhập tên cho biến thể #${index + 1}.`);
    }

    const hasPrice =
      method?.price !== "" &&
      method?.price !== null &&
      method?.price !== undefined;
    const price = Number(method?.price);

    if (!hasPrice || !Number.isFinite(price) || price < 0) {
      throw new Error(
        `Giá của biến thể "${name}" phải là số lớn hơn hoặc bằng 0.`
      );
    }

    return {
      ...method,
      name,
      price,
    };
  });
};

const MENU_ITEM_STATUS_OPTIONS = [
  { value: "available", label: "Sẵn sàng" },
  { value: "out_of_stock", label: "Hết hàng" },
  { value: "unavailable", label: "Tạm dừng" },
  { value: "hidden", label: "Ẩn khỏi menu" },
];

const MENU_ITEM_STATUS_SET = new Set(
  MENU_ITEM_STATUS_OPTIONS.map(({ value }) => value)
);

const normalizeMenuItemStatus = (status) =>
  MENU_ITEM_STATUS_SET.has(status) ? status : "available";

const buildRecipeForm = (methods = [], existingVariants = []) => {
  const normalizedMethods = validatePreparationMethods(methods);

  return {
    servingVariants: normalizeDefaultVariant(
      normalizedMethods.map((method, index) => {
        const existingVariant = findMatchingExistingVariant(
          method,
          existingVariants
        );
        const fallbackKey =
          method.name.toLowerCase().replace(/\s+/g, "_") || `sv_${index}`;
        const mode = method.mode || existingVariant?.mode || "PORTION";
        const ingredients = existingVariant
          ? cloneIngredients(existingVariant.ingredients)
          : Array.isArray(method.ingredients)
          ? cloneIngredients(method.ingredients)
          : [];

        return {
          key: method.key || existingVariant?.key || fallbackKey,
          name: method.name,
          mode,
          sellQty: Number(method.sellQty ?? existingVariant?.sellQty ?? 1) || 1,
          sellUnit:
            method.sellUnit ||
            existingVariant?.sellUnit ||
            (mode === "BY_WEIGHT" ? "kg" : "portion"),
          ingredients,
          price: method.price,
          isDefault: !!method.isDefault,
        };
      })
    ),
  };
};

const hasVerifiedRecipeData = (recipeItem) =>
  !!(recipeItem?._rawRecipeId || recipeItem?._rawRecipe);

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
    status: normalizeMenuItemStatus(),
    thumbImage: "",
    description: "",
    preparationMethods: [],
  });

  const [imgError, setImgError] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const savedMenuItemIdRef = useRef(null);

  const pushToast = (text, type = "success") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((i) => i.id !== id)), 3000);
  };

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

  const {
    recipes: recipeItems,
    updateRecipe,
    ensureRecipeLoaded,
    recipeDetailsByMenuItemId,
  } = useRecipes(restaurantId, timeSlot, {
    search: null,
    categoryId: null,
  });

  const currentRecipeItem = useMemo(
    () =>
      Array.isArray(recipeItems) && editId
        ? recipeItems.find(
            (item) => String(item?.menuItemId || item?.id) === String(editId)
          )
        : null,
    [recipeItems, editId]
  );

  const recipeDetailState = useMemo(
    () => (editId ? recipeDetailsByMenuItemId[String(editId)] || null : null),
    [recipeDetailsByMenuItemId, editId]
  );

  const verifiedCurrentRecipeItem = useMemo(
    () => (hasVerifiedRecipeData(currentRecipeItem) ? currentRecipeItem : null),
    [currentRecipeItem]
  );

  const verifiedRecipeItem = useMemo(() => {
    if (verifiedCurrentRecipeItem) return verifiedCurrentRecipeItem;
    if (
      recipeDetailState?.status === "loaded" &&
      hasVerifiedRecipeData(recipeDetailState?.recipe)
    ) {
      return recipeDetailState.recipe;
    }
    return null;
  }, [verifiedCurrentRecipeItem, recipeDetailState]);

  const existingServingVariants = useMemo(
    () =>
      Array.isArray(verifiedRecipeItem?.servingVariants)
        ? verifiedRecipeItem.servingVariants
        : [],
    [verifiedRecipeItem]
  );

  const recipeGuardStatus = useMemo(() => {
    if (!editId) return "ready";
    if (verifiedRecipeItem) return "ready";
    if (recipeDetailState?.status === "missing") return "ready";
    if (recipeDetailState?.status === "error") return "error";
    return "loading";
  }, [editId, verifiedRecipeItem, recipeDetailState]);

  const isRecipeGuardPending = !!editId && recipeGuardStatus === "loading";
  const isRecipeGuardBlocked = !!editId && recipeGuardStatus === "error";

  const defaultMethod = {
    key: "",
    name: "",
    price: "",
    cookTime: "",
    mode: "PORTION",
    sellQty: 1,
    sellUnit: "portion",
    ingredients: [],
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
      route:
        typeof window !== "undefined" ? window.location.pathname : "unknown",
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
      status: normalizeMenuItemStatus(v?.status),
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

  useEffect(() => {
    if (!isOpen || !editId || !restaurantId || verifiedCurrentRecipeItem) return;
    if (["loading", "loaded", "missing"].includes(recipeDetailState?.status)) {
      return;
    }
    ensureRecipeLoaded(editId);
  }, [
    isOpen,
    editId,
    restaurantId,
    verifiedCurrentRecipeItem,
    recipeDetailState,
    ensureRecipeLoaded,
  ]);

  useEffect(() => {
    if (isOpen) {
      setImgError(false);
      setIsSubmitting(false);
      submitLockRef.current = false;
      savedMenuItemIdRef.current = editId || null;

      if (editId && currentItem) {
        const sourceVariants =
          existingServingVariants.length > 0
            ? existingServingVariants
            : Array.isArray(currentItem.servingVariants)
            ? currentItem.servingVariants
            : [];

        const methods =
          sourceVariants.length > 0
            ? normalizeDefaultVariant(
                sourceVariants.map((sv) => ({
                  key: sv.key || "",
                  name: sv.name || "",
                  price: typeof sv.price === "number" ? sv.price : "",
                  cookTime: currentItem.avgPrepTimeMin || "",
                  mode: sv.mode || "PORTION",
                  sellQty: sv.sellQty || 1,
                  sellUnit: sv.sellUnit || "portion",
                  ingredients: Array.isArray(sv.ingredients)
                    ? cloneIngredients(sv.ingredients)
                    : [],
                  isDefault: !!sv.isDefault,
                }))
              )
            : [{ ...defaultMethod }];

        setFormData({
          name: currentItem.name || "",
          categoryId:
            currentItem.categoryId ||
            currentItem.category?.id ||
            currentItem.category ||
            "",
          status: normalizeMenuItemStatus(currentItem.status),
          thumbImage: currentItem.thumbImage || "",
          description: currentItem.description || "",
          preparationMethods: methods,
        });
      } else {
        setFormData({
          name: "",
          categoryId: "",
          status: normalizeMenuItemStatus(),
          thumbImage: "",
          description: "",
          preparationMethods: [{ ...defaultMethod }],
        });
      }
    } else {
      setIsSubmitting(false);
      submitLockRef.current = false;
      savedMenuItemIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, currentItem, isOpen]);

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
      preparationMethods: prev.preparationMethods.map((method, currentIndex) =>
        currentIndex === index ? { ...method, [field]: value } : method
      ),
    }));
  };

  const addPM = () => {
    if (isSubmitting) return;

    setFormData((prev) => ({
      ...prev,
      preparationMethods: [
        ...prev.preparationMethods,
        { ...defaultMethod, isDefault: false },
      ],
    }));
  };

  const removePM = (index) => {
    if (isSubmitting) return;

    if (formData.preparationMethods.length > 1) {
      setFormData((prev) => ({
        ...prev,
        preparationMethods: prev.preparationMethods.filter(
          (_, currentIndex) => currentIndex !== index
        ),
      }));
    } else {
      pushToast("Cần ít nhất một cách chế biến", "error");
    }
  };

  const handleRetryRecipeLoad = async () => {
    if (!editId || isSubmitting || isRecipeGuardPending) return;

    const nextState = await ensureRecipeLoaded(editId);
    if (nextState?.status === "error") {
      pushToast(
        `Không thể tải dữ liệu recipe: ${getGraphQLErrorMessage(
          nextState.error,
          "Vui lòng thử lại."
        )}`,
        "error"
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitLockRef.current) return;
    if (isRecipeGuardPending) {
      pushToast("Đang tải dữ liệu recipe, vui lòng chờ thêm một chút.", "error");
      return;
    }
    if (isRecipeGuardBlocked) {
      await handleRetryRecipeLoad();
      return;
    }
    if (!restaurantId) {
      pushToast("Lỗi: Thiếu ID nhà hàng", "error");
      return;
    }

    const itemName = String(formData.name || "").trim();
    if (!itemName) {
      pushToast("Vui lòng nhập tên món ăn.", "error");
      return;
    }

    const categoryId = String(formData.categoryId || "").trim();
    if (!categoryId) {
      pushToast("Vui lòng chọn danh mục món.", "error");
      return;
    }

    let normalizedMethods;
    try {
      normalizedMethods = validatePreparationMethods(formData.preparationMethods);
    } catch (error) {
      pushToast(error.message, "error");
      return;
    }

    const cookTimes = normalizedMethods
      .map((method) => parseInt(method.cookTime, 10))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const avgPrepTimeMin =
      cookTimes.length > 0
        ? Math.round(
            cookTimes.reduce((sum, value) => sum + value, 0) /
              cookTimes.length
          )
        : undefined;

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const menuItemPayload = {
        name: itemName,
        categoryId,
        status: normalizeMenuItemStatus(formData.status),
        description: formData.description,
        ...(Number.isFinite(avgPrepTimeMin) ? { avgPrepTimeMin } : {}),
        ...(formData.thumbImage?.trim()
          ? { thumbImage: formData.thumbImage.trim() }
          : {}),
      };

      let targetMenuItemId = editId || savedMenuItemIdRef.current || null;

      try {
        if (targetMenuItemId) {
          await updateMenuItem({ id: targetMenuItemId, ...menuItemPayload });
        } else {
          const created = await createMenuItem({
            ...menuItemPayload,
            timeSlot,
          });
          targetMenuItemId = created?.id;
          savedMenuItemIdRef.current = targetMenuItemId || null;
        }
      } catch (error) {
        pushToast(getGraphQLErrorMessage(error), "error");
        return;
      }

      if (!targetMenuItemId) {
        pushToast("Không nhận được ID món ăn sau khi lưu.", "error");
        return;
      }

      try {
        const recipeForm = buildRecipeForm(
          normalizedMethods,
          existingServingVariants
        );
        await updateRecipe(targetMenuItemId, recipeForm);
      } catch (error) {
        const actionLabel = editId ? "cập nhật" : "tạo";
        pushToast(
          `Món đã ${actionLabel} nhưng biến thể/recipe chưa lưu thành công: ${getGraphQLErrorMessage(
            error,
            "Không thể lưu recipe."
          )}`,
          "error"
        );
        return;
      }

      try {
        await onSave?.();
      } catch (error) {
        pushToast(
          `Đã lưu món và recipe nhưng không thể làm mới danh sách: ${getGraphQLErrorMessage(
            error,
            "Không thể làm mới dữ liệu."
          )}`,
          "error"
        );
        return;
      }

      clearDraft();
      pushToast(
        editId ? "Lưu thay đổi món ăn thành công!" : "Tạo món mới thành công!",
        "success"
      );
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const isSaving = isSubmitting;
  const isSubmitDisabled = isSaving || isRecipeGuardPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleRequestClose}
      size="xl"
      className="menu-item-modal-modern"
    >
      <Modal.Header onClose={handleRequestClose}>
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
                disabled={isSaving}
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
                  disabled={isSaving}
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
                  disabled={isSaving}
                >
                  {MENU_ITEM_STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption.value} value={statusOption.value}>
                      {statusOption.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Hình ảnh món</label>
              <LocalImagePicker
                value={formData.thumbImage || ""}
                onChange={(value) => handleInputChange("thumbImage", value)}
                disabled={isSaving}
                ownerKey={editId || savedMenuItemIdRef.current || restaurantId || "menu-item-draft"}
                purpose="menu-item-thumb"
                label="Chọn ảnh món"
                placeholder="Chưa có ảnh món"
                helperText="Ảnh sẽ được resize thành bản thumb 320px và preview 960px để tải nhanh, tốn ít bộ nhớ."
              />
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
                disabled={isSaving}
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
                disabled={isSaving}
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
                        disabled={isSaving}
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
                        disabled={isSaving}
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
                        disabled={isSaving}
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
                        disabled={isSaving}
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
          onClick={handleRequestClose}
          disabled={isSaving}
        >
          Đóng
        </button>
        <button
          type={isRecipeGuardBlocked ? "button" : "submit"}
          form={isRecipeGuardBlocked ? undefined : "menu-form"}
          className="btn-primary"
          disabled={isSubmitDisabled}
          onClick={isRecipeGuardBlocked ? handleRetryRecipeLoad : undefined}
        >
          {isSaving ? (
            "Đang lưu..."
          ) : isRecipeGuardPending ? (
            "Đang tải dữ liệu recipe..."
          ) : isRecipeGuardBlocked ? (
            "Thử tải lại recipe"
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
