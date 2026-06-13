import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../../../common/Modal";
import Button from "../../../../common/Button";
import FormGroup from "../../../../common/Form/FormGroup";
import FormInput from "../../../../common/Form/FormInput";
import FormLabel from "../../../../common/Form/FormLabel";
import FormSelect from "../../../../common/Form/FormSelect";
import RecipeDishPickerModal from "./RecipeDishPickerModal";
import "./RecipeModal.scss";

const MENU_ITEM_STATUS_LABEL = {
  ACTIVE: "Có sẵn",
  INACTIVE: "Tạm ngưng",
  AVAILABLE: "Có sẵn",
  UNAVAILABLE: "Tạm ngưng",
};

const DEFAULT_VARIANT = {
  name: "Default",
  key: "default",
  mode: "PORTION",
  sellQty: 1,
  sellUnit: "portion",
  price: 0,
  isDefault: true,
  components: [],
};

const uniqueByValue = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.value;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const cfmt = (value) =>
  Number(value || 0).toLocaleString("vi-VN", {
    maximumFractionDigits: 0,
  }) + " đ";

const toNumber = (value) => {
  if (value === "" || value == null) return 0;
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

const normalizeComponents = (components = []) =>
  (components || []).map((c) => ({
    ingredientId: c.ingredientId || c.ingredient?.id || "",
    ingredientName: c.ingredient?.name || c.ingredientName || "",
    ingSearch: c.ingredient?.name || c.ingredientName || "",
    ingFocused: false,
    isEditingIngredient: !c.ingredientId,
    qty: c.qty ?? c.quantity ?? "",
    unit: c.unit || c.ingredient?.baseUnit || "g",
    wastePct: c.wastePct ?? c.waste || 0,
  }));

const normalizeVariants = (recipe, menuItemPrice = 0) => {
  if (recipe?.servingVariants?.length) {
    return recipe.servingVariants.map((v, index) => ({
      name: v.name || (index === 0 ? "Default" : `Biến thể ${index + 1}`),
      key: v.key || (index === 0 ? "default" : `variant_${index + 1}`),
      mode: v.mode || (v.sellUnit && v.sellUnit !== "portion" ? "BY_WEIGHT" : "PORTION"),
      sellQty: v.sellQty ?? v.quantity ?? 1,
      sellQtyText: String(v.sellQty ?? v.quantity ?? 1),
      sellUnit: v.sellUnit || v.unit || "portion",
      price: Number(v.price || v.menuPrice || menuItemPrice || 0),
      isDefault: Boolean(v.isDefault || index === 0),
      components: normalizeComponents(v.components || v.recipeItems || []),
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
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [ingredientSuggestions, setIngredientSuggestions] = useState([]);
  const [isDishPickerOpen, setIsDishPickerOpen] = useState(false);
  const [isDishInfoCollapsed, setIsDishInfoCollapsed] = useState(true);
  const [previewWeight, setPreviewWeight] = useState(100);

  useEffect(() => {
    if (!isOpen) return;
    const currentMenuItem = menuItem || recipe?.menuItem || null;
    const menuItemId =
      currentMenuItem?.id || recipe?.menuItemId || recipe?.menu_item_id || "";
    const menuItemName =
      currentMenuItem?.name || recipe?.menuItemName || recipe?.name || "";
    const menuItemPrice = Number(
      currentMenuItem?.price || currentMenuItem?.basePrice || recipe?.menuPrice || 0,
    );
    const variants = normalizeVariants(recipe, menuItemPrice);
    const normalizedVariants = variants.map((v, index) => ({
      ...v,
      isDefault:
        variants.some((item) => item.isDefault) ? Boolean(v.isDefault) : index === 0,
    }));

    setFormData({
      menuItemId,
      menuItemName,
      menuItemDescription:
        currentMenuItem?.description || recipe?.menuItemDescription || "",
      menuItemPrice,
      status: currentMenuItem?.status || recipe?.status || "ACTIVE",
      servingVariants: normalizedVariants,
    });
    setActiveVariantIndex(0);
    setPreviewWeight(100);
    setErrors({});
    setIsDishInfoCollapsed(Boolean(menuItemId));
  }, [isOpen, recipe, menuItem]);

  const ingredientMap = useMemo(() => {
    const map = new Map();
    ingredients.forEach((ing) => map.set(String(ing.id), ing));
    return map;
  }, [ingredients]);

  const menuItemRecipeRows = useMemo(() => {
    const currentId = formData.menuItemId || menuItem?.id || recipe?.menuItemId;
    const recipeByMenuItem = new Map();

    (Array.isArray(recipe) ? recipe : recipe ? [recipe] : []).forEach((r) => {
      const mid = String(r?.menuItemId || r?.menuItem?.id || "");
      if (mid) recipeByMenuItem.set(mid, r);
    });

    return (menuItems || []).map((item) => {
      const itemId = String(item?.id || "");
      const itemRecipe = recipeByMenuItem.get(itemId);
      const isCurrent = currentId && String(currentId) === itemId;
      return {
        id: itemId,
        name: item?.name || "Chưa có tên",
        code: item?.code || item?.sku || "",
        description: item?.description || "",
        basePrice: Number(item?.price || item?.basePrice || item?.menuPrice || 0),
        status: item?.status || "ACTIVE",
        imageUrl: item?.imageUrl || item?.image || "",
        recipeId: itemRecipe?.id || (isCurrent ? recipe?.id : null),
        hasRecipe: Boolean(itemRecipe || isCurrent),
        _rawMenuItem: item,
      };
    });
  }, [formData.menuItemId, menuItem?.id, recipe, menuItems]);

  const currentMenuItemId = formData.menuItemId;
  const hasExistingRecipe = Boolean(recipe?.id);
  const activeVariant = formData.servingVariants?.[activeVariantIndex] || null;

  const getAllowedUnitsForIngredient = (ingredientId) => {
    const ing = ingredientMap.get(String(ingredientId));
    if (!ing) return ["g", "kg", "ml", "l", "unit"];
    const units = new Set([ing.baseUnit || "g"]);
    (ing.conversions || []).forEach((c) => {
      if (c?.from) units.add(c.from);
      if (c?.to) units.add(c.to);
    });
    return Array.from(units);
  };

  const findIngredient = (id) => ingredientMap.get(String(id));

  const isMissingIngredientId = (id) => Boolean(id && !findIngredient(id));

  const recipeMissingIngredientSummary = useMemo(() => {
    const lines = [];
    (formData.servingVariants || []).forEach((variant, variantIndex) => {
      (variant.components || []).forEach((comp, componentIndex) => {
        if (isMissingIngredientId(comp?.ingredientId)) {
          lines.push({ variantIndex, componentIndex, ingredientId: comp.ingredientId });
        }
      });
    });
    return { count: lines.length, lines };
  }, [formData.servingVariants, ingredientMap]);

  const activeVariantMissingIngredientLines = useMemo(() => {
    if (!activeVariant) return [];
    return (activeVariant.components || [])
      .map((comp, componentIndex) => ({ componentIndex, ingredientId: comp.ingredientId }))
      .filter((line) => isMissingIngredientId(line.ingredientId));
  }, [activeVariant, ingredientMap]);

  const ingredientOptionSearch = (keyword) => {
    const q = normalizeText(keyword);
    const items = ingredients
      .filter((ing) => {
        if (!q) return true;
        const name = normalizeText(ing.name);
        const sku = normalizeText(ing.sku);
        const cat = normalizeText(ing.category);
        return name.includes(q) || sku.includes(q) || cat.includes(q);
      })
      .slice(0, 20)
      .map((ing) => ({
        value: ing.id,
        label: `${ing.name} (${ing.baseUnit || "unit"})`,
        item: ing,
      }));
    return items;
  };

  const buildSuggestGroups = (searchText) => {
    const selectedIds = new Set(
      (activeVariant?.components || [])
        .map((c) => String(c.ingredientId || ""))
        .filter(Boolean),
    );
    const direct = ingredientOptionSearch(searchText).filter(
      (item) => !selectedIds.has(String(item.value)),
    );
    const byCategory = ingredients
      .filter((ing) => !selectedIds.has(String(ing.id)))
      .slice(0, 12)
      .map((ing) => ({
        value: ing.id,
        label: `${ing.name} (${ing.category || "khác"})`,
        item: ing,
      }));

    return [
      { title: "Kết quả tìm kiếm", items: direct },
      { title: "Gợi ý nhanh", items: uniqueByValue(byCategory) },
    ];
  };

  useEffect(() => {
    if (!isOpen || !activeVariant) return;
    let cancelled = false;
    setSuggestLoading(true);
    const timer = setTimeout(() => {
      if (cancelled) return;
      setIngredientSuggestions(buildSuggestGroups(""));
      setSuggestLoading(false);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, activeVariantIndex, ingredients]);

  const setOnlyDefault = (index) => {
    setFormData((prev) => ({
      ...prev,
      servingVariants: prev.servingVariants.map((v, i) => ({
        ...v,
        isDefault: i === index,
      })),
    }));
  };

  const handlePickDishRow = (row) => {
    const raw = row?._rawMenuItem || row || {};
    const menuItemPrice = Number(raw.price || raw.basePrice || row?.basePrice || 0);
    setFormData((prev) => ({
      ...prev,
      menuItemId: raw.id || row?.id || "",
      menuItemName: raw.name || row?.name || "",
      menuItemDescription: raw.description || row?.description || "",
      menuItemPrice,
      status: raw.status || row?.status || "ACTIVE",
      servingVariants: (prev.servingVariants || []).map((v) => ({
        ...v,
        price: Number(v.price || menuItemPrice || 0),
      })),
    }));
    setErrors((prev) => ({ ...prev, menuItem: null }));
    setIsDishInfoCollapsed(true);
  };

  const handleVariantChange = (index, patch) => {
    setFormData((prev) => ({
      ...prev,
      servingVariants: prev.servingVariants.map((v, i) => {
        if (i !== index) return v;
        if (patch.pickIngredient) {
          const ing = findIngredient(patch.pickIngredient);
          return {
            ...v,
            components: v.components.map((c, idx) =>
              idx === patch.componentIndex
                ? {
                    ...c,
                    ingredientId: ing?.id || patch.pickIngredient,
                    ingredientName: ing?.name || "",
                    ingSearch: ing?.name || "",
                    unit: ing?.baseUnit || c.unit || "g",
                    isEditingIngredient: false,
                    ingFocused: false,
                  }
                : c,
            ),
          };
        }
        return { ...v, ...patch };
      }),
    }));
  };

  const handleComponentChange = (variantIndex, componentIndex, key, value) => {
    if (key === "pickIngredient") {
      const ing = findIngredient(value);
      setFormData((prev) => ({
        ...prev,
        servingVariants: prev.servingVariants.map((v, i) =>
          i === variantIndex
            ? {
                ...v,
                components: v.components.map((c, idx) =>
                  idx === componentIndex
                    ? {
                        ...c,
                        ingredientId: ing?.id || value,
                        ingredientName: ing?.name || "",
                        ingSearch: ing?.name || "",
                        unit: ing?.baseUnit || c.unit || "g",
                        isEditingIngredient: false,
                        ingFocused: false,
                      }
                    : c,
                ),
              }
            : v,
        ),
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      servingVariants: prev.servingVariants.map((v, i) =>
        i === variantIndex
          ? {
              ...v,
              components: v.components.map((c, idx) =>
                idx === componentIndex ? { ...c, [key]: value } : c,
              ),
            }
          : v,
      ),
    }));
  };

  const handleComponentAdd = (variantIndex) => {
    setFormData((prev) => ({
      ...prev,
      servingVariants: prev.servingVariants.map((v, i) =>
        i === variantIndex
          ? {
              ...v,
              components: [
                ...(v.components || []),
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
            }
          : v,
      ),
    }));
  };

  const handleComponentRemove = (variantIndex, componentIndex) => {
    setFormData((prev) => ({
      ...prev,
      servingVariants: prev.servingVariants.map((v, i) =>
        i === variantIndex
          ? {
              ...v,
              components: v.components.filter((_, idx) => idx !== componentIndex),
            }
          : v,
      ),
    }));
  };

  const handleVariantAdd = () => {
    const nextIndex = formData.servingVariants.length + 1;
    const next = {
      name: `Size ${nextIndex}`,
      key: `size_${nextIndex}`,
      mode: "PORTION",
      sellQty: 1,
      sellQtyText: "1",
      sellUnit: "portion",
      price: formData.menuItemPrice || 0,
      isDefault: false,
      components: [],
    };
    setFormData((prev) => ({
      ...prev,
      servingVariants: [...prev.servingVariants, next],
    }));
    setActiveVariantIndex(formData.servingVariants.length);
  };

  const handleVariantDuplicate = (index) => {
    const source = formData.servingVariants[index];
    if (!source) return;
    const copy = {
      ...source,
      name: `${source.name || "Biến thể"} copy`,
      key: `${source.key || "variant"}_copy_${Date.now()}`,
      isDefault: false,
      components: (source.components || []).map((c) => ({ ...c })),
    };
    setFormData((prev) => ({
      ...prev,
      servingVariants: [...prev.servingVariants, copy],
    }));
    setActiveVariantIndex(formData.servingVariants.length);
  };

  const handleVariantRemove = (index) => {
    if (formData.servingVariants.length <= 1) return;
    const nextVariants = formData.servingVariants.filter((_, i) => i !== index);
    if (!nextVariants.some((v) => v.isDefault)) {
      nextVariants[0] = { ...nextVariants[0], isDefault: true };
    }
    setFormData((prev) => ({ ...prev, servingVariants: nextVariants }));
    setActiveVariantIndex(Math.max(0, Math.min(index - 1, nextVariants.length - 1)));
  };

  const calculateVariantCost = (variant) => {
    if (!variant) return null;
    let total = 0;
    for (const comp of variant.components || []) {
      if (!comp.ingredientId || isMissingIngredientId(comp.ingredientId)) return null;
      const ing = findIngredient(comp.ingredientId);
      const qty = toNumber(comp.qty);
      if (!ing || qty <= 0) return null;
      const unitCost = Number(ing.costPerBaseUnit || ing.cost || ing.avgCost || 0);
      const wastePct = Math.max(0, toNumber(comp.wastePct));
      const multiplier = 1 + wastePct / 100;
      total += qty * multiplier * unitCost;
    }
    return total;
  };

  const activeCost = useMemo(
    () => calculateVariantCost(activeVariant),
    [activeVariant, ingredients],
  );

  const recipeSummary = useMemo(() => {
    const variants = formData.servingVariants || [];
    const totalVariants = variants.length;
    const validComponents = variants.reduce(
      (sum, v) =>
        sum +
        (v.components || []).filter(
          (c) => c.ingredientId && !isMissingIngredientId(c.ingredientId) && toNumber(c.qty) > 0,
        ).length,
      0,
    );
    const defaultVariantName = variants.find((v) => v.isDefault)?.name || "Chưa chọn";
    return {
      totalVariants,
      validComponents,
      defaultVariantName,
      noReplacementCount: recipeMissingIngredientSummary.count,
      estimatedCostValid: recipeMissingIngredientSummary.count === 0,
    };
  }, [formData.servingVariants, recipeMissingIngredientSummary.count, ingredients]);

  const activeVariantSummary = useMemo(() => {
    const components = activeVariant?.components || [];
    const readyLines = components.filter(
      (c) => c.ingredientId && !isMissingIngredientId(c.ingredientId) && toNumber(c.qty) > 0,
    ).length;
    return {
      totalLines: components.length,
      readyLines,
      displayPrice: cfmt(activeVariant?.price || formData.menuItemPrice || 0),
    };
  }, [activeVariant, formData.menuItemPrice, ingredients]);

  const priceSuggestionValues = useMemo(() => {
    const base = Number(formData.menuItemPrice || 0);
    if (base <= 0) return [];
    return uniqueByValue([
      { value: base, label: cfmt(base) },
      { value: Math.round(base * 1.1), label: cfmt(base * 1.1) },
      { value: Math.round(base * 1.2), label: cfmt(base * 1.2) },
    ]).map((x) => x.value);
  }, [formData.menuItemPrice]);

  const getPriceLabel = (variant) =>
    variant?.mode === "BY_WEIGHT" ? `Giá / ${variant.sellUnit || "đơn vị"}` : "Giá / phần";

  const validate = () => {
    const nextErrors = {};
    if (!formData.menuItemId) nextErrors.menuItem = "Vui lòng chọn món ăn.";
    const variants = formData.servingVariants || [];
    if (!variants.length) nextErrors.variants = "Cần ít nhất một biến thể.";
    if (!variants.some((v) => v.isDefault)) nextErrors.default = "Cần chọn biến thể mặc định.";

    const keys = new Set();
    variants.forEach((variant, index) => {
      if (!variant.name?.trim()) nextErrors.variantNames = "Tên biến thể là bắt buộc.";
      const key = String(variant.key || "").trim();
      if (!key) nextErrors.keys = "Định danh biến thể là bắt buộc.";
      if (keys.has(key)) nextErrors.keys = "Định danh biến thể không được trùng.";
      keys.add(key);
      if (index === activeVariantIndex) {
        (variant.components || []).forEach((comp, cIdx) => {
          if (!comp.ingredientId) {
            nextErrors[`component_${cIdx}`] = "Chọn nguyên liệu cho dòng đang nhập.";
          }
          if (toNumber(comp.qty) <= 0) {
            nextErrors[`qty_${cIdx}`] = "Số lượng phải lớn hơn 0.";
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
    (activeVariant.components || []).forEach((comp, index) => {
      if (!comp.ingredientId) list.push(`Dòng ${index + 1}: chưa chọn nguyên liệu.`);
      if (comp.ingredientId && isMissingIngredientId(comp.ingredientId)) {
        list.push(`Dòng ${index + 1}: nguyên liệu không còn tồn tại trong kho.`);
      }
      if (toNumber(comp.qty) <= 0) list.push(`Dòng ${index + 1}: số lượng phải lớn hơn 0.`);
    });
    return list;
  }, [activeVariant, ingredients]);

  const serializePayload = () => ({
    id: recipe?.id,
    menuItemId: formData.menuItemId,
    variants: formData.servingVariants.map((v) => ({
      name: v.name,
      key: v.key,
      mode: v.mode,
      sellQty: v.mode === "BY_WEIGHT" ? toNumber(v.sellQtyText || v.sellQty) : 1,
      sellUnit: v.mode === "BY_WEIGHT" ? v.sellUnit : "portion",
      price: toNumber(v.price),
      isDefault: Boolean(v.isDefault),
      components: (v.components || []).map((c) => ({
        ingredientId: c.ingredientId,
        qty: toNumber(c.qty),
        unit: c.unit,
        wastePct: toNumber(c.wastePct),
      })),
    })),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
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

  const requestCloseWithDraft = (closeFn) => {
    setErrors({});
    closeFn?.();
  };

  const resetRecipeForm = () => {
    setFormData({
      menuItemId: "",
      menuItemName: "",
      menuItemDescription: "",
      menuItemPrice: 0,
      status: "ACTIVE",
      servingVariants: [{ ...DEFAULT_VARIANT }],
    });
    setActiveVariantIndex(0);
    setPreviewWeight(100);
    setIsDishInfoCollapsed(true);
  };

  if (!isOpen) return null;

  const modeOptions = [
    { value: "PORTION", label: "Bán theo phần" },
    { value: "BY_WEIGHT", label: "Bán theo khối lượng" },
  ];

  const sellUnitOptions = [
    { value: "kg", label: "kg" },
    { value: "g", label: "g" },
  ];

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={() => requestCloseWithDraft(onClose)}
        title={
          hasExistingRecipe ? "Cập nhật công thức món" : "Thêm công thức mới"
        }
        size="xl"
        autoWrapBody={false}
      >
        <form className="recipe-modal-form" onSubmit={handleSubmit}>
          <Modal.Body style={{ padding: "24px", background: "#f8fafc" }}>
            <div className="recipe-section">
              <div className="section-header">
                <h3 className="section-title">🍽️ Thông tin món ăn</h3>
                <div style={{ display: "flex", gap: "10px" }}>
                  {currentMenuItemId && (
                    <button
                      type="button"
                      className="method-tab"
                      style={{ padding: "6px 12px", fontSize: "12px" }}
                      onClick={() => setIsDishInfoCollapsed((v) => !v)}
                    >
                      {isDishInfoCollapsed ? "Mở rộng" : "Thu gọn"}
                    </button>
                  )}
                  {!recipe && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setIsDishPickerOpen(true)}
                    >
                      {currentMenuItemId ? "🔁 Đổi món khác" : "🔎 Chọn món"}
                    </Button>
                  )}
                </div>
              </div>

              {!currentMenuItemId ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    border: "2px dashed #cbd5e1",
                    borderRadius: "12px",
                    color: "#64748b",
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: "8px" }}>
                    Chưa có món ăn nào được chọn
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => setIsDishPickerOpen(true)}
                  >
                    Chọn món ngay
                  </Button>
                  {errors.menuItem && (
                    <div
                      style={{
                        color: "#ef4444",
                        marginTop: "8px",
                        fontSize: "13px",
                      }}
                    >
                      {errors.menuItem}
                    </div>
                  )}
                </div>
              ) : isDishInfoCollapsed ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: "16px",
                        color: "#0f172a",
                      }}
                    >
                      {formData.menuItemName}
                    </div>
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: "13px",
                        marginTop: "4px",
                      }}
                    >
                      {formData.menuItemDescription || "Không có mô tả"}
                    </div>
                    <div style={{ marginTop: "8px" }}>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          padding: "2px 10px",
                          borderRadius: "999px",
                          background: "#eef2ff",
                          color: "#3730a3",
                        }}
                      >
                        Trạng thái: {MENU_ITEM_STATUS_LABEL[formData.status] || "Không rõ"}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      Giá bán gốc
                    </div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: 900,
                        color: "#16a34a",
                      }}
                    >
                      {cfmt(formData.menuItemPrice)}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                  }}
                >
                  <FormGroup>
                    <FormLabel>Tên món</FormLabel>
                    <FormInput value={formData.menuItemName} disabled />
                  </FormGroup>
                  <FormGroup>
                    <FormLabel>Giá bán gốc</FormLabel>
                    <FormInput value={cfmt(formData.menuItemPrice)} disabled />
                  </FormGroup>
                </div>
              )}
            </div>

            <div className="recipe-section">
              <div className="section-header">
                <h4 className="section-title">
                  ⚖️ Cấu hình các biến thể định lượng
                </h4>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  marginBottom: "20px",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    flex: "1 1 250px",
                    background: "#f0f9ff",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid #bae6fd",
                  }}
                >
                  <strong style={{ color: "#0369a1", fontSize: "14px" }}>
                    Tổng quan cấu hình:
                  </strong>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#0c4a6e",
                      marginTop: "6px",
                      lineHeight: "1.6",
                    }}
                  >
                    <div>
                      Tổng số biến thể: <strong>{recipeSummary.totalVariants}</strong>
                    </div>
                    <div>
                      Số dòng NL hợp lệ: <strong>{recipeSummary.validComponents}</strong>
                    </div>
                    <div>
                      Biến thể mặc định: <strong>{recipeSummary.defaultVariantName}</strong>
                    </div>
                    {!recipeSummary.estimatedCostValid && (
                      <div style={{ color: "#b91c1c", fontWeight: 700 }}>
                        {`Có ${recipeSummary.noReplacementCount} dòng Chưa có nguyên liệu bù.`}
                      </div>
                    )}
                  </div>
                </div>

                {activeVariant && (
                  <div
                    style={{
                      flex: "1 1 250px",
                      background: "#fdf4ff",
                      padding: "14px",
                      borderRadius: "10px",
                      border: "1px solid #fbcfe8",
                    }}
                  >
                    <strong style={{ color: "#86198f", fontSize: "14px" }}>
                      Thống kê biến thể hiện tại:
                    </strong>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#701a75",
                        marginTop: "6px",
                        lineHeight: "1.6",
                      }}
                    >
                      <div>
                        Tổng số dòng: <strong>{activeVariantSummary.totalLines}</strong>
                      </div>
                      <div>
                        Dòng đã nhập đủ: <strong>{activeVariantSummary.readyLines}</strong>
                      </div>
                      <div>
                        Hiển thị bán: <strong>{activeVariantSummary.displayPrice}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {errors.variants && (
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: "13px",
                    marginBottom: "12px",
                    fontWeight: "bold",
                  }}
                >
                  {errors.variants}
                </div>
              )}
              {errors.default && (
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: "13px",
                    marginBottom: "12px",
                    fontWeight: "bold",
                  }}
                >
                  {errors.default}
                </div>
              )}
              {errors.keys && (
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: "13px",
                    marginBottom: "12px",
                    fontWeight: "bold",
                  }}
                >
                  {errors.keys}
                </div>
              )}
              {errors.variantNames && (
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: "13px",
                    marginBottom: "12px",
                    fontWeight: "bold",
                  }}
                >
                  {errors.variantNames}
                </div>
              )}

              {activeVariantErrors.length > 0 && (
                <div
                  style={{
                    background: "#fef2f2",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #fecaca",
                    marginBottom: "16px",
                  }}
                >
                  <strong style={{ color: "#dc2626", fontSize: "13px" }}>
                    Vui lòng sửa các lỗi sau:
                  </strong>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: "20px",
                      color: "#b91c1c",
                      fontSize: "13px",
                      marginTop: "4px",
                    }}
                  >
                    {activeVariantErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="method-tabs">
                {(formData.servingVariants || []).map((v, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`method-tab ${
                      activeVariantIndex === index ? "active" : ""
                    }`}
                    onClick={() => setActiveVariantIndex(index)}
                  >
                    {v.name || `Biến thể ${index + 1}`}
                    {v.isDefault && (
                      <span style={{ marginLeft: "6px", color: "#10b981" }}>
                        ★
                      </span>
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  className="method-tab"
                  onClick={handleVariantAdd}
                  style={{ color: "#3b82f6" }}
                >
                  + Thêm biến thể
                </button>
              </div>

              {activeVariant && (
                <div style={{ animation: "fadeIn 0.3s ease" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "16px",
                      marginBottom: "20px",
                    }}
                  >
                    <div>
                      <FormGroup>
                        <FormLabel>
                          Tên biến thể <span style={{ color: "red" }}>*</span>
                        </FormLabel>
                        <FormInput
                          type="text"
                          value={activeVariant.name || ""}
                          onChange={(e) =>
                            handleVariantChange(activeVariantIndex, {
                              name: e.target.value,
                            })
                          }
                          placeholder="VD: Mặc định, Cỡ Lớn..."
                        />
                      </FormGroup>
                    </div>

                    <div>
                      <FormGroup>
                        <FormLabel>
                          Định danh (Key) <span style={{ color: "red" }}>*</span>
                        </FormLabel>
                        <FormInput
                          type="text"
                          value={activeVariant.key || ""}
                          onChange={(e) =>
                            handleVariantChange(activeVariantIndex, {
                              key: e.target.value,
                            })
                          }
                          placeholder="VD: mac_dinh, co_lon..."
                        />
                      </FormGroup>
                    </div>

                    <div>
                      <FormGroup>
                        <FormLabel>
                          Chế độ bán <span style={{ color: "red" }}>*</span>
                        </FormLabel>
                        <FormSelect
                          options={modeOptions}
                          value={activeVariant.mode}
                          onChange={(e) =>
                            handleVariantChange(activeVariantIndex, {
                              mode: e.target.value,
                            })
                          }
                        />
                      </FormGroup>
                    </div>

                    {activeVariant.mode === "BY_WEIGHT" ? (
                      <div style={{ display: "flex", gap: "12px" }}>
                        <div style={{ flex: 1 }}>
                          <FormGroup>
                            <FormLabel>
                              Số lượng bán <span style={{ color: "red" }}>*</span>
                            </FormLabel>
                            <FormInput
                              type="text"
                              value={activeVariant.sellQtyText || ""}
                              onChange={(e) =>
                                handleVariantChange(activeVariantIndex, {
                                  sellQtyText: e.target.value,
                                })
                              }
                              style={{ textAlign: "right" }}
                            />
                          </FormGroup>
                        </div>
                        <div style={{ width: "100px" }}>
                          <FormGroup>
                            <FormLabel>ĐVT</FormLabel>
                            <FormSelect
                              options={sellUnitOptions}
                              value={activeVariant.sellUnit}
                              onChange={(e) =>
                                handleVariantChange(activeVariantIndex, {
                                  sellUnit: e.target.value,
                                })
                              }
                            />
                          </FormGroup>
                        </div>
                      </div>
                    ) : (
                      <FormGroup>
                        <FormLabel>Số lượng / ĐVT</FormLabel>
                        <FormInput type="text" value="1 phần" disabled />
                      </FormGroup>
                    )}

                    <div>
                      <FormGroup>
                        <FormLabel>{getPriceLabel(activeVariant)}</FormLabel>
                        <FormInput
                          type="number"
                          step={1000}
                          min={0}
                          value={
                            activeVariant.price === 0 ? "" : activeVariant.price
                          }
                          onChange={(e) =>
                            handleVariantChange(activeVariantIndex, {
                              price: e.target.value,
                            })
                          }
                          onWheel={(e) => {
                            e.preventDefault();
                            const delta = e.deltaY < 0 ? 1000 : -1000;
                            const next = Math.max(
                              0,
                              (Number(activeVariant.price) || 0) + delta,
                            );
                            handleVariantChange(activeVariantIndex, {
                              price: next,
                            });
                          }}
                          placeholder="0"
                          style={{ textAlign: "right" }}
                        />
                        {priceSuggestionValues.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap",
                              marginTop: "8px",
                            }}
                          >
                            {priceSuggestionValues.map((v, idx) => (
                              <button
                                key={`${v}_${idx}`}
                                type="button"
                                onClick={() =>
                                  handleVariantChange(activeVariantIndex, {
                                    price: v,
                                  })
                                }
                                style={{
                                  border: "1px solid #cbd5e1",
                                  background: "#f8fafc",
                                  color: "#0f172a",
                                  borderRadius: "999px",
                                  padding: "4px 10px",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                {cfmt(v)}
                              </button>
                            ))}
                          </div>
                        )}
                      </FormGroup>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        paddingBottom: "10px",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={activeVariant.isDefault || false}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setOnlyDefault(activeVariantIndex);
                            }
                          }}
                          style={{
                            width: "20px",
                            height: "20px",
                            accentColor: "#10b981",
                            marginRight: "10px",
                          }}
                        />
                        <span style={{ fontWeight: 800, color: "#0f172a" }}>
                          Dùng làm biến thể mặc định
                        </span>
                      </label>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      marginBottom: "20px",
                      justifyContent: "flex-end",
                      borderBottom: "1px dashed #cbd5e1",
                      paddingBottom: "16px",
                    }}
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleVariantDuplicate(activeVariantIndex)}
                    >
                      ⧉ Nhân bản
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleVariantRemove(activeVariantIndex)}
                    >
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

                    {recipeMissingIngredientSummary.count > 0 && (
                      <div className="recipe-missing-warning">
                        ⚠️ Có dòng <strong>Chưa có nguyên liệu bù</strong>. Hệ
                        thống sẽ không tính chi phí ước tính để tránh sai số.
                      </div>
                    )}

                    {(activeVariant.components || []).map((comp, cIdx) => (
                      <div
                        key={cIdx}
                        className={`recipeIngredientLine${
                          isMissingIngredientId(comp?.ingredientId)
                            ? " is-missing-ingredient"
                            : ""
                        }`}
                      >
                        <div style={{ position: "relative" }}>
                          {comp.ingredientId && !comp.isEditingIngredient ? (
                            <div
                              style={{
                                minHeight: "42px",
                                border: "1px solid #cbd5e1",
                                borderRadius: "10px",
                                padding: "8px 10px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                                background: "#f8fafc",
                              }}
                            >
                              <strong
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  color: isMissingIngredientId(comp.ingredientId)
                                    ? "#b91c1c"
                                    : undefined,
                                }}
                              >
                                {findIngredient(comp.ingredientId)?.name ||
                                  `Chưa có nguyên liệu bù (${comp.ingredientId})`}
                              </strong>
                              <button
                                type="button"
                                onClick={() =>
                                  handleComponentChange(
                                    activeVariantIndex,
                                    cIdx,
                                    "isEditingIngredient",
                                    true,
                                  )
                                }
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  cursor: "pointer",
                                  color: "#2563eb",
                                  fontWeight: 700,
                                }}
                                title="Thay đổi nguyên liệu"
                              >
                                ✏️
                              </button>
                            </div>
                          ) : (
                            <FormInput
                              type="text"
                              placeholder="🔍 Tìm nguyên liệu..."
                              value={
                                comp.ingSearch !== undefined
                                  ? comp.ingSearch
                                  : comp.ingredientName || ""
                              }
                              onChange={(e) =>
                                handleComponentChange(
                                  activeVariantIndex,
                                  cIdx,
                                  "ingSearch",
                                  e.target.value,
                                )
                              }
                              onFocus={() =>
                                handleComponentChange(
                                  activeVariantIndex,
                                  cIdx,
                                  "ingFocused",
                                  true,
                                )
                              }
                              onBlur={() =>
                                setTimeout(
                                  () =>
                                    handleComponentChange(
                                      activeVariantIndex,
                                      cIdx,
                                      "ingFocused",
                                      false,
                                    ),
                                  200,
                                )
                              }
                            />
                          )}

                          {comp.isEditingIngredient !== false &&
                            comp.ingFocused && (
                              <div className="ingredientSuggestDropdown">
                                {[...(ingredientSuggestions || []), ...buildSuggestGroups(comp.ingSearch || "")]
                                  .filter(
                                    (g) =>
                                      Array.isArray(g?.items) &&
                                      g.items.length > 0,
                                  )
                                  .map((group, gIdx) => (
                                    <div
                                      key={gIdx}
                                      className="ingredientSuggestGroup"
                                    >
                                      <div className="ingredientSuggestTitle">
                                        {group.title}
                                      </div>
                                      <div style={{ padding: "4px" }}>
                                        {group.items.map((item, iIdx) => (
                                          <button
                                            key={iIdx}
                                            type="button"
                                            className="ingredientSuggestItem"
                                            onMouseDown={() =>
                                              handleComponentChange(
                                                activeVariantIndex,
                                                cIdx,
                                                "pickIngredient",
                                                item.value,
                                              )
                                            }
                                          >
                                            {item.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ))}

                                {!ingredientSuggestions.length &&
                                  !buildSuggestGroups(comp.ingSearch || "").length && (
                                    <div className="ingredientSuggestEmpty">
                                      {suggestLoading
                                        ? "Đang tải gợi ý..."
                                        : "Không tìm thấy"}
                                    </div>
                                  )}
                              </div>
                            )}
                        </div>

                        <div>
                          <FormInput
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={comp.qty}
                            onChange={(e) =>
                              handleComponentChange(
                                activeVariantIndex,
                                cIdx,
                                "qty",
                                sanitizeDecimalText(e.target.value),
                              )
                            }
                            className="right-align"
                          />
                        </div>

                        <div>
                          <FormSelect
                            value={comp.unit || ""}
                            onChange={(e) =>
                              handleComponentChange(
                                activeVariantIndex,
                                cIdx,
                                "unit",
                                e.target.value,
                              )
                            }
                            options={
                              comp.ingredientId
                                ? getAllowedUnitsForIngredient(
                                    comp.ingredientId,
                                  ).map((u) => ({ value: u, label: u }))
                                : []
                            }
                            disabled={!comp.ingredientId}
                          />
                        </div>

                        <div>
                          <FormInput
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={comp.wastePct}
                            onChange={(e) =>
                              handleComponentChange(
                                activeVariantIndex,
                                cIdx,
                                "wastePct",
                                sanitizeDecimalText(e.target.value),
                              )
                            }
                            className="right-align"
                            style={{
                              color:
                                Number(comp.wastePct) > 0
                                  ? "#ef4444"
                                  : "inherit",
                              fontWeight:
                                Number(comp.wastePct) > 0 ? "bold" : "normal",
                            }}
                          />
                        </div>

                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              handleComponentRemove(activeVariantIndex, cIdx)
                            }
                            style={{
                              color: "#ef4444",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "16px",
                              padding: "8px",
                              margin: "0 auto",
                              display: "block",
                              transition: "transform 0.2s",
                            }}
                            onMouseEnter={(e) =>
                              (e.target.style.transform = "scale(1.2)")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.transform = "scale(1)")
                            }
                            title="Xoá dòng này"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}

                    {activeVariantMissingIngredientLines.length > 0 && (
                      <div className="recipe-missing-hint">
                        {`Có ${activeVariantMissingIngredientLines.length} dòng Chưa có nguyên liệu bù trong biến thể đang chọn.`}
                      </div>
                    )}

                    <div style={{ padding: "12px" }}>
                      <button
                        type="button"
                        onClick={() => handleComponentAdd(activeVariantIndex)}
                        style={{
                          width: "100%",
                          padding: "10px",
                          borderRadius: "8px",
                          background: "#eff6ff",
                          border: "1px dashed #93c5fd",
                          color: "#2563eb",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        + Thêm dòng nguyên liệu
                      </button>
                    </div>
                  </div>

                  <div className="variant-footer">
                    <span className="label">
                      Tổng chi phí dự kiến cho biến thể này:
                    </span>
                    <span className="value">
                      {activeCost === null ? "Không thể tính (N/A)" : cfmt(activeCost)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Modal.Body>

          <Modal.Footer
            style={{ borderTop: "1px solid #e2e8f0", background: "#ffffff" }}
          >
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
                width: "100%",
                padding: "8px 0",
              }}
            >
              <Button
                type="button"
                variant="secondary"
                onClick={() => requestCloseWithDraft(onClose)}
                disabled={saving || deleting}
              >
                Hủy bỏ
              </Button>

              {hasExistingRecipe && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleDeleteClick}
                  disabled={saving || deleting || !currentMenuItemId}
                >
                  {deleting ? "Đang xoá..." : "Xóa công thức này"}
                </Button>
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={saving || deleting || !currentMenuItemId}
              >
                {saving ? "Đang lưu..." : "💾 Lưu công thức"}
              </Button>
            </div>
          </Modal.Footer>
        </form>
      </Modal>

      <RecipeDishPickerModal
        isOpenPicker={isDishPickerOpen}
        onRequestClose={() => setIsDishPickerOpen(false)}
        dishRows={menuItemRecipeRows}
        onPickDishRow={handlePickDishRow}
      />
    </>
  );
};

export default RecipeModal;
