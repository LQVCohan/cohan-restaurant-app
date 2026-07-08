import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../../../common/Modal";
import Button from "../../../../common/Button";
import FormGroup from "../../../../common/Form/FormGroup";
import FormInput from "../../../../common/Form/FormInput";
import FormLabel from "../../../../common/Form/FormLabel";
import FormSelect from "../../../../common/Form/FormSelect";
import { getConvertibleUnits, toBaseQty } from "../../../../../utils/unitConversion";
import RecipeDishPickerModal from "./RecipeDishPickerModal";
import "./RecipeModal.scss";

const MENU_ITEM_STATUS_LABEL = {
  ACTIVE: "Có sẵn",
  AVAILABLE: "Có sẵn",
  INACTIVE: "Tạm ngưng",
  UNAVAILABLE: "Tạm ngưng",
};

const DEFAULT_VARIANT = {
  name: "Default",
  key: "default",
  mode: "PORTION",
  sellQty: 1,
  sellQtyText: "1",
  sellUnit: "portion",
  price: 0,
  isDefault: true,
  components: [],
};

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const formatMoney = (value) =>
  `${Number(value || 0).toLocaleString("vi-VN", {
    maximumFractionDigits: 0,
  })} đ`;

const toNumber = (value) => {
  if (value === "" || value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const sanitizeDecimalText = (value) => {
  const raw = String(value || "").replace(",", ".");
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
};

const getIngredientId = (component) =>
  component?.ingredientId || component?.ingredient?.id || component?.supplyId || "";

const getIngredientName = (component) =>
  component?.ingredient?.name || component?.ingredientName || component?.name || "";

const normalizeComponents = (components = []) =>
  (components || []).map((component) => {
    const ingredientId = getIngredientId(component);
    const ingredientName = getIngredientName(component);
    return {
      ingredientId,
      ingredientName,
      ingSearch: ingredientName,
      ingFocused: false,
      isEditingIngredient: !ingredientId,
      qty: component?.qty ?? component?.quantity ?? "",
      unit: component?.unit || component?.ingredient?.baseUnit || "g",
      wastePct: component?.wastePct ?? component?.waste ?? 0,
    };
  });

const normalizeVariants = (recipe, menuItemPrice = 0) => {
  const variants = recipe?.servingVariants || recipe?.variants || [];

  if (Array.isArray(variants) && variants.length > 0) {
    return variants.map((variant, index) => ({
      name: variant?.name || (index === 0 ? "Default" : `Biến thể ${index + 1}`),
      key: variant?.key || (index === 0 ? "default" : `variant_${index + 1}`),
      mode:
        variant?.mode ||
        (variant?.sellUnit && variant.sellUnit !== "portion"
          ? "BY_WEIGHT"
          : "PORTION"),
      sellQty: variant?.sellQty ?? variant?.quantity ?? 1,
      sellQtyText: String(variant?.sellQty ?? variant?.quantity ?? 1),
      sellUnit: variant?.sellUnit || variant?.unit || "portion",
      price: Number(variant?.price || variant?.menuPrice || menuItemPrice || 0),
      isDefault: Boolean(variant?.isDefault || index === 0),
      components: normalizeComponents(variant?.components || variant?.recipeItems || []),
    }));
  }

  return [
    {
      ...DEFAULT_VARIANT,
      price: Number(menuItemPrice || recipe?.menuPrice || 0),
      components: normalizeComponents(recipe?.components || recipe?.recipeItems || []),
    },
  ];
};

const getMenuItemPrice = (item, fallback = 0) =>
  Number(item?.price || item?.basePrice || item?.menuPrice || fallback || 0);

const RecipeModal = ({
  isOpen,
  onClose,
  recipe,
  menuItem,
  menuItems = [],
  ingredients = [],
  onSave,
  onDelete,
}) => {
  const [formData, setFormData] = useState({
    menuItemId: "",
    menuItemName: "",
    menuItemDescription: "",
    menuItemPrice: 0,
    status: "ACTIVE",
    servingVariants: [{ ...DEFAULT_VARIANT }],
  });
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDishPickerOpen, setIsDishPickerOpen] = useState(false);
  const [isDishInfoCollapsed, setIsDishInfoCollapsed] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const currentMenuItem = menuItem || recipe?.menuItem || null;
    const menuItemId =
      currentMenuItem?.id || recipe?.menuItemId || recipe?.menu_item_id || "";
    const menuItemName =
      currentMenuItem?.name || recipe?.menuItemName || recipe?.name || "";
    const menuItemPrice = getMenuItemPrice(currentMenuItem, recipe?.menuPrice || 0);
    const normalizedVariants = normalizeVariants(recipe, menuItemPrice);
    const hasDefault = normalizedVariants.some((variant) => variant.isDefault);

    setFormData({
      menuItemId,
      menuItemName,
      menuItemDescription:
        currentMenuItem?.description || recipe?.menuItemDescription || "",
      menuItemPrice,
      status: currentMenuItem?.status || recipe?.status || "ACTIVE",
      servingVariants: normalizedVariants.map((variant, index) => ({
        ...variant,
        isDefault: hasDefault ? Boolean(variant.isDefault) : index === 0,
      })),
    });
    setActiveVariantIndex(0);
    setErrors({});
    setIsDishInfoCollapsed(Boolean(menuItemId));
  }, [isOpen, recipe, menuItem]);

  const ingredientMap = useMemo(() => {
    const map = new Map();
    (ingredients || []).forEach((ingredient) => {
      if (ingredient?.id) map.set(String(ingredient.id), ingredient);
    });
    return map;
  }, [ingredients]);

  const dishRows = useMemo(
    () =>
      (menuItems || []).map((item) => ({
        id: item?.id || "",
        name: item?.name || "Chưa có tên",
        code: item?.code || item?.sku || "",
        description: item?.description || "",
        basePrice: getMenuItemPrice(item),
        status: item?.status || "ACTIVE",
        imageUrl: item?.imageUrl || item?.image || "",
        hasRecipe: Boolean(item?.recipeId || item?.hasRecipe),
        recipeId: item?.recipeId || null,
        _rawMenuItem: item,
      })),
    [menuItems],
  );

  const activeVariant = formData.servingVariants?.[activeVariantIndex] || null;
  const hasExistingRecipe = Boolean(recipe?.id);

  const findIngredient = (id) => ingredientMap.get(String(id));
  const isMissingIngredientId = (id) => Boolean(id && !findIngredient(id));

  const modeOptions = [
    { value: "PORTION", label: "Bán theo phần" },
    { value: "BY_WEIGHT", label: "Bán theo khối lượng" },
  ];

  const sellUnitOptions = [
    { value: "kg", label: "kg" },
    { value: "g", label: "g" },
  ];

  const getAllowedUnitsForIngredient = (ingredientId) => {
    const ingredient = findIngredient(ingredientId);
    if (!ingredient) return [];
    return getConvertibleUnits(
      ingredient.baseUnit || "g",
      ingredient.conversions || [],
    );
  };

  const getComponentBaseQuantity = (component) => {
    const ingredient = findIngredient(component?.ingredientId);
    if (!ingredient) return Number.NaN;
    return toBaseQty(
      component?.qty,
      component?.unit || ingredient.baseUnit,
      ingredient.baseUnit,
      ingredient.conversions || [],
    );
  };

  const calculateVariantCost = (variant) => {
    if (!variant) return null;
    let total = 0;

    for (const component of variant.components || []) {
      if (!component.ingredientId || isMissingIngredientId(component.ingredientId)) {
        return null;
      }

      const ingredient = findIngredient(component.ingredientId);
      const qtyBase = getComponentBaseQuantity(component);
      if (!ingredient || !Number.isFinite(qtyBase) || qtyBase <= 0) return null;

      const unitCost = Number(
        ingredient.costPerBaseUnit ||
          ingredient.avgCost ||
          ingredient.cost ||
          ingredient.price ||
          0,
      );
      const wasteMultiplier = 1 + Math.max(0, toNumber(component.wastePct)) / 100;
      total += qtyBase * unitCost * wasteMultiplier;
    }

    return total;
  };

  const activeCost = useMemo(
    () => calculateVariantCost(activeVariant),
    [activeVariant, ingredientMap],
  );

  const recipeSummary = useMemo(() => {
    const variants = formData.servingVariants || [];
    let validComponents = 0;
    let missingComponents = 0;

    variants.forEach((variant) => {
      (variant.components || []).forEach((component) => {
        if (component.ingredientId && isMissingIngredientId(component.ingredientId)) {
          missingComponents += 1;
        }
        if (
          component.ingredientId &&
          !isMissingIngredientId(component.ingredientId) &&
          Number.isFinite(getComponentBaseQuantity(component)) &&
          getComponentBaseQuantity(component) > 0
        ) {
          validComponents += 1;
        }
      });
    });

    return {
      totalVariants: variants.length,
      validComponents,
      missingComponents,
      defaultVariantName: variants.find((variant) => variant.isDefault)?.name || "Chưa chọn",
    };
  }, [formData.servingVariants, ingredientMap]);

  const activeVariantSummary = useMemo(() => {
    const components = activeVariant?.components || [];
    return {
      totalLines: components.length,
      readyLines: components.filter(
        (component) =>
          component.ingredientId &&
          !isMissingIngredientId(component.ingredientId) &&
          Number.isFinite(getComponentBaseQuantity(component)) &&
          getComponentBaseQuantity(component) > 0,
      ).length,
      displayPrice: formatMoney(activeVariant?.price || formData.menuItemPrice || 0),
    };
  }, [activeVariant, formData.menuItemPrice, ingredientMap]);

  const ingredientSuggestions = (keyword, selectedIds = new Set()) => {
    const q = normalizeText(keyword);
    return (ingredients || [])
      .filter((ingredient) => {
        if (!ingredient?.id || selectedIds.has(String(ingredient.id))) return false;
        if (!q) return true;
        return [ingredient.name, ingredient.sku, ingredient.category]
          .map(normalizeText)
          .some((value) => value.includes(q));
      })
      .slice(0, 12);
  };

  const setOnlyDefault = (index) => {
    setFormData((prev) => ({
      ...prev,
      servingVariants: prev.servingVariants.map((variant, variantIndex) => ({
        ...variant,
        isDefault: variantIndex === index,
      })),
    }));
  };

  const updateVariant = (index, patch) => {
    setFormData((prev) => ({
      ...prev,
      servingVariants: prev.servingVariants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant,
      ),
    }));
  };

  const updateComponent = (variantIndex, componentIndex, patch) => {
    setFormData((prev) => ({
      ...prev,
      servingVariants: prev.servingVariants.map((variant, currentVariantIndex) => {
        if (currentVariantIndex !== variantIndex) return variant;
        return {
          ...variant,
          components: (variant.components || []).map((component, currentComponentIndex) =>
            currentComponentIndex === componentIndex
              ? { ...component, ...patch }
              : component,
          ),
        };
      }),
    }));
  };

  const pickIngredient = (variantIndex, componentIndex, ingredientId) => {
    const ingredient = findIngredient(ingredientId);
    updateComponent(variantIndex, componentIndex, {
      ingredientId,
      ingredientName: ingredient?.name || "",
      ingSearch: ingredient?.name || "",
      unit: ingredient?.baseUnit || "g",
      ingFocused: false,
      isEditingIngredient: false,
    });
  };

  const addComponent = (variantIndex) => {
    setFormData((prev) => ({
      ...prev,
      servingVariants: prev.servingVariants.map((variant, currentIndex) => {
        if (currentIndex !== variantIndex) return variant;
        return {
          ...variant,
          components: [
            ...(variant.components || []),
            {
              ingredientId: "",
              ingredientName: "",
              ingSearch: "",
              ingFocused: false,
              isEditingIngredient: true,
              qty: "",
              unit: "g",
              wastePct: 0,
            },
          ],
        };
      }),
    }));
  };

  const removeComponent = (variantIndex, componentIndex) => {
    setFormData((prev) => ({
      ...prev,
      servingVariants: prev.servingVariants.map((variant, currentIndex) =>
        currentIndex === variantIndex
          ? {
              ...variant,
              components: (variant.components || []).filter(
                (_, currentComponentIndex) => currentComponentIndex !== componentIndex,
              ),
            }
          : variant,
      ),
    }));
  };

  const addVariant = () => {
    const nextIndex = formData.servingVariants.length + 1;
    const nextVariant = {
      ...DEFAULT_VARIANT,
      name: `Size ${nextIndex}`,
      key: `size_${nextIndex}`,
      isDefault: false,
      price: formData.menuItemPrice || 0,
    };
    setFormData((prev) => ({
      ...prev,
      servingVariants: [...prev.servingVariants, nextVariant],
    }));
    setActiveVariantIndex(formData.servingVariants.length);
  };

  const duplicateVariant = (index) => {
    const source = formData.servingVariants[index];
    if (!source) return;
    const copy = {
      ...source,
      name: `${source.name || "Biến thể"} copy`,
      key: `${source.key || "variant"}_copy_${Date.now()}`,
      isDefault: false,
      components: (source.components || []).map((component) => ({ ...component })),
    };
    setFormData((prev) => ({
      ...prev,
      servingVariants: [...prev.servingVariants, copy],
    }));
    setActiveVariantIndex(formData.servingVariants.length);
  };

  const removeVariant = (index) => {
    if (formData.servingVariants.length <= 1) return;
    const nextVariants = formData.servingVariants.filter((_, currentIndex) => currentIndex !== index);
    if (!nextVariants.some((variant) => variant.isDefault)) {
      nextVariants[0] = { ...nextVariants[0], isDefault: true };
    }
    setFormData((prev) => ({ ...prev, servingVariants: nextVariants }));
    setActiveVariantIndex(Math.max(0, Math.min(index - 1, nextVariants.length - 1)));
  };

  const handlePickDishRow = (row) => {
    const raw = row?._rawMenuItem || row || {};
    const menuItemPrice = getMenuItemPrice(raw, row?.basePrice || 0);
    setFormData((prev) => ({
      ...prev,
      menuItemId: raw.id || row?.id || "",
      menuItemName: raw.name || row?.name || "",
      menuItemDescription: raw.description || row?.description || "",
      menuItemPrice,
      status: raw.status || row?.status || "ACTIVE",
      servingVariants: prev.servingVariants.map((variant) => ({
        ...variant,
        price: Number(variant.price || menuItemPrice || 0),
      })),
    }));
    setErrors((prev) => ({ ...prev, menuItem: null }));
    setIsDishInfoCollapsed(true);
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.menuItemId) nextErrors.menuItem = "Vui lòng chọn món ăn.";
    if (!formData.servingVariants?.length) {
      nextErrors.variants = "Cần ít nhất một biến thể.";
    }
    if (!formData.servingVariants?.some((variant) => variant.isDefault)) {
      nextErrors.default = "Cần chọn biến thể mặc định.";
    }

    const keys = new Set();
    (formData.servingVariants || []).forEach((variant, index) => {
      if (!String(variant.name || "").trim()) {
        nextErrors.variantNames = "Tên biến thể là bắt buộc.";
      }
      const key = String(variant.key || "").trim();
      if (!key) nextErrors.keys = "Định danh biến thể là bắt buộc.";
      if (keys.has(key)) nextErrors.keys = "Định danh biến thể không được trùng.";
      keys.add(key);

      if (index === activeVariantIndex) {
        (variant.components || []).forEach((component, componentIndex) => {
          if (!component.ingredientId) {
            nextErrors[`component_${componentIndex}`] = `Dòng ${componentIndex + 1}: chưa chọn nguyên liệu.`;
            return;
          }
          if (toNumber(component.qty) <= 0) {
            nextErrors[`qty_${componentIndex}`] = `Dòng ${componentIndex + 1}: số lượng phải lớn hơn 0.`;
            return;
          }
          if (!Number.isFinite(getComponentBaseQuantity(component))) {
            nextErrors[`unit_${componentIndex}`] = `Dòng ${componentIndex + 1}: đơn vị không thể quy đổi về đơn vị gốc.`;
          }
        });
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const activeVariantErrors = useMemo(() => {
    if (!activeVariant) return [];
    const list = [];
    (activeVariant.components || []).forEach((component, index) => {
      if (!component.ingredientId) list.push(`Dòng ${index + 1}: chưa chọn nguyên liệu.`);
      if (isMissingIngredientId(component.ingredientId)) {
        list.push(`Dòng ${index + 1}: nguyên liệu không còn tồn tại trong kho.`);
      }
      if (toNumber(component.qty) <= 0) {
        list.push(`Dòng ${index + 1}: số lượng phải lớn hơn 0.`);
      } else if (
        component.ingredientId &&
        !isMissingIngredientId(component.ingredientId) &&
        !Number.isFinite(getComponentBaseQuantity(component))
      ) {
        list.push(`Dòng ${index + 1}: đơn vị không thể quy đổi về đơn vị gốc.`);
      }
    });
    return list;
  }, [activeVariant, ingredientMap]);

  const serializePayload = () => ({
    id: recipe?.id,
    menuItemId: formData.menuItemId,
    variants: (formData.servingVariants || []).map((variant) => ({
      name: variant.name,
      key: variant.key,
      mode: variant.mode,
      sellQty: variant.mode === "BY_WEIGHT" ? toNumber(variant.sellQtyText || variant.sellQty) : 1,
      sellUnit: variant.mode === "BY_WEIGHT" ? variant.sellUnit : "portion",
      price: toNumber(variant.price),
      isDefault: Boolean(variant.isDefault),
      components: (variant.components || []).map((component) => ({
        ingredientId: component.ingredientId,
        qty: toNumber(component.qty),
        unit: component.unit,
        wastePct: toNumber(component.wastePct),
      })),
    })),
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave?.(serializePayload());
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!recipe?.id) return;
    setDeleting(true);
    try {
      await onDelete?.(recipe.id);
    } finally {
      setDeleting(false);
    }
  };

  const closeModal = () => {
    setErrors({});
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={hasExistingRecipe ? "Cập nhật công thức món" : "Thêm công thức mới"}
        size="xl"
        className="storage-modal-shell recipe-modal-shell"
        autoWrapBody={false}
      >
        <form className="recipe-modal-form" onSubmit={handleSubmit}>
          <Modal.Body>
            <div className="recipe-section">
              <div className="section-header">
                <h3 className="section-title">🍽️ Thông tin món ăn</h3>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {formData.menuItemId && (
                    <button
                      type="button"
                      className="method-tab"
                      style={{ padding: "6px 12px", fontSize: 12 }}
                      onClick={() => setIsDishInfoCollapsed((value) => !value)}
                    >
                      {isDishInfoCollapsed ? "Mở rộng" : "Thu gọn"}
                    </button>
                  )}
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => setIsDishPickerOpen(true)}
                  >
                    {formData.menuItemId ? "🔁 Đổi món khác" : "🔎 Chọn món"}
                  </Button>
                </div>
              </div>

              {!formData.menuItemId ? (
                <div
                  style={{
                    padding: 22,
                    textAlign: "center",
                    border: "1px dashed rgba(196,186,170,.9)",
                    borderRadius: 16,
                    color: "#68716f",
                  }}
                >
                  <div style={{ fontWeight: 850, marginBottom: 10 }}>
                    Chưa có món ăn nào được chọn
                  </div>
                  <Button type="button" variant="primary" onClick={() => setIsDishPickerOpen(true)}>
                    Chọn món ngay
                  </Button>
                  {errors.menuItem && (
                    <div style={{ color: "#ba514b", marginTop: 10, fontSize: 13 }}>
                      {errors.menuItem}
                    </div>
                  )}
                </div>
              ) : isDishInfoCollapsed ? (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 18 }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16, color: "#1f2a2f" }}>
                      {formData.menuItemName}
                    </div>
                    <div style={{ color: "#64706d", fontSize: 13, marginTop: 4 }}>
                      {formData.menuItemDescription || "Không có mô tả"}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 760,
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: "#f1f5f1",
                          color: "#526f62",
                          border: "1px solid rgba(82,111,98,.18)",
                        }}
                      >
                        Trạng thái: {MENU_ITEM_STATUS_LABEL[formData.status] || "Không rõ"}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                    <div style={{ fontSize: 12, color: "#64706d" }}>Giá bán gốc</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#8a633f" }}>
                      {formatMoney(formData.menuItemPrice)}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <FormGroup>
                    <FormLabel>Tên món</FormLabel>
                    <FormInput value={formData.menuItemName} disabled />
                  </FormGroup>
                  <FormGroup>
                    <FormLabel>Giá bán gốc</FormLabel>
                    <FormInput value={formatMoney(formData.menuItemPrice)} disabled />
                  </FormGroup>
                </div>
              )}
            </div>

            <div className="recipe-section">
              <div className="section-header">
                <h4 className="section-title">⚖️ Cấu hình các biến thể định lượng</h4>
              </div>

              <div className="recipe-summary-grid">
                <div className="recipe-summary-card">
                  <strong>Tổng quan cấu hình</strong>
                  <div>Tổng số biến thể: <b>{recipeSummary.totalVariants}</b></div>
                  <div>Số dòng NL hợp lệ: <b>{recipeSummary.validComponents}</b></div>
                  <div>Biến thể mặc định: <b>{recipeSummary.defaultVariantName}</b></div>
                  {recipeSummary.missingComponents > 0 && (
                    <div className="recipe-danger-text">
                      Có {recipeSummary.missingComponents} dòng chưa có nguyên liệu bù.
                    </div>
                  )}
                </div>
                <div className="recipe-summary-card">
                  <strong>Thống kê biến thể hiện tại</strong>
                  <div>Tổng số dòng: <b>{activeVariantSummary.totalLines}</b></div>
                  <div>Dòng đã nhập đủ: <b>{activeVariantSummary.readyLines}</b></div>
                  <div>Hiển thị bán: <b>{activeVariantSummary.displayPrice}</b></div>
                </div>
              </div>

              {Object.values(errors).filter(Boolean).length > 0 && (
                <div className="recipe-missing-warning">
                  {Object.values(errors)
                    .filter(Boolean)
                    .slice(0, 4)
                    .map((error, index) => (
                      <div key={index}>⚠️ {error}</div>
                    ))}
                </div>
              )}

              {activeVariantErrors.length > 0 && (
                <div className="recipe-missing-warning">
                  {activeVariantErrors.slice(0, 5).map((error, index) => (
                    <div key={index}>⚠️ {error}</div>
                  ))}
                </div>
              )}

              <div className="method-tabs">
                {(formData.servingVariants || []).map((variant, index) => (
                  <button
                    key={`${variant.key}_${index}`}
                    type="button"
                    className={`method-tab ${activeVariantIndex === index ? "active" : ""}`}
                    onClick={() => setActiveVariantIndex(index)}
                  >
                    {variant.name || `Biến thể ${index + 1}`}
                    {variant.isDefault && <span style={{ marginLeft: 6 }}>★</span>}
                  </button>
                ))}
                <button type="button" className="method-tab" onClick={addVariant}>
                  + Thêm biến thể
                </button>
              </div>

              {activeVariant && (
                <div className="recipe-variant-editor">
                  <div className="recipe-variant-grid">
                    <FormGroup>
                      <FormLabel>Tên biến thể *</FormLabel>
                      <FormInput
                        value={activeVariant.name || ""}
                        placeholder="VD: Default, Size lớn…"
                        onChange={(event) => updateVariant(activeVariantIndex, { name: event.target.value })}
                      />
                    </FormGroup>
                    <FormGroup>
                      <FormLabel>Định danh (Key) *</FormLabel>
                      <FormInput
                        value={activeVariant.key || ""}
                        placeholder="VD: default, size_lon…"
                        onChange={(event) => updateVariant(activeVariantIndex, { key: event.target.value })}
                      />
                    </FormGroup>
                    <FormGroup>
                      <FormLabel>Chế độ bán *</FormLabel>
                      <FormSelect
                        options={modeOptions}
                        value={activeVariant.mode}
                        onChange={(event) => updateVariant(activeVariantIndex, { mode: event.target.value })}
                      />
                    </FormGroup>
                    {activeVariant.mode === "BY_WEIGHT" ? (
                      <div style={{ display: "flex", gap: 12 }}>
                        <FormGroup style={{ flex: 1 }}>
                          <FormLabel>Số lượng bán *</FormLabel>
                          <FormInput
                            value={activeVariant.sellQtyText || ""}
                            inputMode="decimal"
                            onChange={(event) =>
                              updateVariant(activeVariantIndex, {
                                sellQtyText: sanitizeDecimalText(event.target.value),
                              })
                            }
                          />
                        </FormGroup>
                        <FormGroup style={{ width: 105 }}>
                          <FormLabel>ĐVT</FormLabel>
                          <FormSelect
                            options={sellUnitOptions}
                            value={activeVariant.sellUnit}
                            onChange={(event) => updateVariant(activeVariantIndex, { sellUnit: event.target.value })}
                          />
                        </FormGroup>
                      </div>
                    ) : (
                      <FormGroup>
                        <FormLabel>Số lượng / ĐVT</FormLabel>
                        <FormInput value="1 phần" disabled />
                      </FormGroup>
                    )}
                    <FormGroup>
                      <FormLabel>{activeVariant.mode === "BY_WEIGHT" ? `Giá / ${activeVariant.sellUnit || "đơn vị"}` : "Giá / phần"}</FormLabel>
                      <FormInput
                        type="number"
                        min={0}
                        step={1000}
                        value={activeVariant.price === 0 ? "" : activeVariant.price}
                        onChange={(event) => updateVariant(activeVariantIndex, { price: event.target.value })}
                      />
                    </FormGroup>
                    <div className="recipe-default-check">
                      <label>
                        <input
                          type="checkbox"
                          checked={Boolean(activeVariant.isDefault)}
                          onChange={(event) => {
                            if (event.target.checked) setOnlyDefault(activeVariantIndex);
                          }}
                        />
                        Dùng làm biến thể mặc định
                      </label>
                    </div>
                  </div>

                  <div className="recipe-variant-actions">
                    <Button type="button" variant="secondary" size="sm" onClick={() => duplicateVariant(activeVariantIndex)}>
                      ⧉ Nhân bản
                    </Button>
                    <Button type="button" variant="danger" size="sm" onClick={() => removeVariant(activeVariantIndex)}>
                      🗑 Xóa biến thể này
                    </Button>
                  </div>

                  <div className="ingredient-table">
                    <div className="recipeIngredientLine header">
                      <div>Tên nguyên liệu</div>
                      <div className="right-align">Số lượng</div>
                      <div>ĐVT</div>
                      <div className="right-align">Hao hụt (%)</div>
                      <div style={{ textAlign: "center" }}>Xoá</div>
                    </div>

                    {(activeVariant.components || []).map((component, componentIndex) => {
                      const selectedIds = new Set(
                        (activeVariant.components || [])
                          .map((item) => String(item.ingredientId || ""))
                          .filter(Boolean),
                      );
                      selectedIds.delete(String(component.ingredientId || ""));
                      const suggestions = ingredientSuggestions(component.ingSearch, selectedIds);
                      const selectedIngredient = findIngredient(component.ingredientId);
                      const isMissing = isMissingIngredientId(component.ingredientId);

                      return (
                        <div
                          key={componentIndex}
                          className={`recipeIngredientLine ${isMissing ? "is-missing-ingredient" : ""}`}
                        >
                          <div style={{ position: "relative" }}>
                            {component.ingredientId && !component.isEditingIngredient ? (
                              <div className="recipe-ingredient-picked">
                                <strong title={selectedIngredient?.name || component.ingredientName || component.ingredientId}>
                                  {selectedIngredient?.name || component.ingredientName || `Chưa có nguyên liệu bù (${component.ingredientId})`}
                                </strong>
                                <button
                                  type="button"
                                  onClick={() => updateComponent(activeVariantIndex, componentIndex, { isEditingIngredient: true })}
                                  title="Thay đổi nguyên liệu"
                                >
                                  ✏️
                                </button>
                              </div>
                            ) : (
                              <FormInput
                                placeholder="🔍 Tìm nguyên liệu…"
                                value={component.ingSearch || ""}
                                onFocus={() => updateComponent(activeVariantIndex, componentIndex, { ingFocused: true })}
                                onBlur={() =>
                                  setTimeout(
                                    () => updateComponent(activeVariantIndex, componentIndex, { ingFocused: false }),
                                    160,
                                  )
                                }
                                onChange={(event) =>
                                  updateComponent(activeVariantIndex, componentIndex, {
                                    ingSearch: event.target.value,
                                    isEditingIngredient: true,
                                  })
                                }
                              />
                            )}

                            {component.isEditingIngredient !== false && component.ingFocused && (
                              <div className="ingredientSuggestDropdown">
                                {suggestions.length > 0 ? (
                                  <div className="ingredientSuggestGroup">
                                    <div className="ingredientSuggestTitle">Gợi ý nguyên liệu</div>
                                    <div style={{ padding: 4 }}>
                                      {suggestions.map((ingredient) => (
                                        <button
                                          key={ingredient.id}
                                          type="button"
                                          className="ingredientSuggestItem"
                                          onMouseDown={() => pickIngredient(activeVariantIndex, componentIndex, ingredient.id)}
                                        >
                                          {ingredient.name} ({ingredient.baseUnit || "unit"})
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="ingredientSuggestEmpty">Không tìm thấy</div>
                                )}
                              </div>
                            )}
                          </div>

                          <FormInput
                            value={component.qty || ""}
                            inputMode="decimal"
                            placeholder="0.00"
                            className="right-align"
                            onChange={(event) =>
                              updateComponent(activeVariantIndex, componentIndex, {
                                qty: sanitizeDecimalText(event.target.value),
                              })
                            }
                          />

                          <FormSelect
                            value={component.unit || ""}
                            options={
                              component.ingredientId
                                ? getAllowedUnitsForIngredient(component.ingredientId).map((unit) => ({ value: unit, label: unit }))
                                : []
                            }
                            disabled={!component.ingredientId}
                            onChange={(event) => updateComponent(activeVariantIndex, componentIndex, { unit: event.target.value })}
                          />

                          <FormInput
                            value={component.wastePct || ""}
                            inputMode="decimal"
                            placeholder="0"
                            className="right-align"
                            onChange={(event) =>
                              updateComponent(activeVariantIndex, componentIndex, {
                                wastePct: sanitizeDecimalText(event.target.value),
                              })
                            }
                          />

                          <button
                            type="button"
                            className="recipe-remove-line"
                            onClick={() => removeComponent(activeVariantIndex, componentIndex)}
                            title="Xoá dòng này"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}

                    <div style={{ padding: 12 }}>
                      <button
                        type="button"
                        className="recipe-add-line-btn"
                        onClick={() => addComponent(activeVariantIndex)}
                      >
                        + Thêm dòng nguyên liệu
                      </button>
                    </div>
                  </div>

                  <div className="variant-footer">
                    <span className="label">Tổng chi phí dự kiến cho biến thể này:</span>
                    <span className="value">
                      {activeCost === null ? "Không thể tính (N/A)" : formatMoney(activeCost)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Modal.Body>

          <Modal.Footer>
            <div className="recipe-modal-footer-actions">
              <Button type="button" variant="secondary" onClick={closeModal} disabled={saving || deleting}>
                Hủy bỏ
              </Button>
              {hasExistingRecipe && (
                <Button type="button" variant="danger" onClick={handleDeleteClick} disabled={saving || deleting}>
                  {deleting ? "Đang xoá…" : "Xóa công thức này"}
                </Button>
              )}
              <Button type="submit" variant="primary" disabled={saving || deleting || !formData.menuItemId}>
                {saving ? "Đang lưu…" : "💾 Lưu công thức"}
              </Button>
            </div>
          </Modal.Footer>
        </form>
      </Modal>

      <RecipeDishPickerModal
        isOpenPicker={isDishPickerOpen}
        onRequestClose={() => setIsDishPickerOpen(false)}
        dishRows={dishRows}
        onPickDishRow={handlePickDishRow}
      />
    </>
  );
};

export default RecipeModal;
