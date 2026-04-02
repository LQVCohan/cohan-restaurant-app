// src/components/Dashboard_Manager/Storage/components/recipes/RecipeModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";

import Modal from "../../../../common/Modal";
import Button from "../../../../common/Button";
import Card from "../../../../common/Card";

import FormGroup from "../Form/FormGroup";
import FormLabel from "../Form/FormLabel";
import FormInput from "../Form/FormInput";
import FormSelect from "../Form/FormSelect";
import FormTextarea from "../Form/FormTextarea";

import { formatPrice } from "../../../../../utils/formatters";
import { toBaseQty, fromBaseQty } from "../../../../../utils/unitConversion";

import RecipeDishPickerModal from "./RecipeDishPickerModal";
import {
  Q_INGREDIENT_SUGGESTIONS,
  M_RECORD_INGREDIENT_USED,
} from "../../graphql/ingredientSuggestions.gql";

import "./RecipeModal.scss";

/**
 * ✅ RecipeModal:
 * - Chỉ làm công thức (notes + servingVariants + ingredients)
 * - Chọn món qua RecipeDishPickerModal, sau khi chọn: info món chỉ đọc + có thể thu gọn
 * - Ingredient search: có suggestions list (không cần mở select)
 *   + hỗ trợ tìm không dấu: "ot" match "ớt"
 *   + khi focus mà chưa gõ: show Recent/Top/New (limit 8)
 * - Hao hụt: 2 mode (UNIT hoặc %) nhưng luôn chuẩn hoá lưu về wastePct (%), rule waste <= qty
 * - Nút nhân bản biến thể
 */

// ===== decimal helpers (1,2 or 1.2) =====
const sanitizeDecimalText = (v) => {
  let s = String(v ?? "").replace(/[^\d.,]/g, "");
  const i = s.search(/[.,]/);
  if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/[.,]/g, "");
  return s;
};

const parseDecimalLoose = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const normalizeText = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

const RecipeModal = ({
  isOpen,
  onClose,
  onSave,
  onDelete,

  // nếu mở modal từ card recipe có sẵn
  recipe = null,

  // ✅ truyền list dishRows (items của Q_MENU_ITEMS_WITH_RECIPES_PAGED)
  menuItemRecipeRows = [],

  restaurantId,
  ingredients = [],
}) => {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [previewWeight, setPreviewWeight] = useState(100);

  // dish picker state
  const [isDishPickerOpen, setIsDishPickerOpen] = useState(false);
  const [pickedDishRow, setPickedDishRow] = useState(null);

  // dish info collapse
  const [isDishInfoCollapsed, setIsDishInfoCollapsed] = useState(true);

  // ===== suggestions query (Recent/Top/New) =====
  const shouldLoadSuggest = Boolean(isOpen && restaurantId);
  const { data: suggestData, loading: suggestLoading } = useQuery(
    Q_INGREDIENT_SUGGESTIONS,
    {
      variables: { restaurantId, limit: 8 },
      skip: !shouldLoadSuggest,
      fetchPolicy: "cache-and-network",
    }
  );

  const [recordIngredientUsed] = useMutation(M_RECORD_INGREDIENT_USED);

  // ========= ingredient helpers =========
  const ingredientIdSet = useMemo(() => {
    const s = new Set();
    (ingredients || []).forEach((i) => s.add(String(i.id)));
    return s;
  }, [ingredients]);

  const findIngredient = (ingredientId) =>
    ingredients.find((x) => String(x.id) === String(ingredientId));

  const getIngredientBaseUnit = (ingredientId) =>
    findIngredient(ingredientId)?.baseUnit || "g";

  const getIngredientCost = (ingredientId) =>
    Number(findIngredient(ingredientId)?.costPerBaseUnit) || 0;

  const getAllowedUnitsForIngredient = (ingredientId) => {
    const ing = findIngredient(ingredientId);
    if (!ing) return [];
    const base = ing.baseUnit || "g";
    const set = new Set([base]);

    const conv = Array.isArray(ing.conversions) ? ing.conversions : [];
    conv.forEach((c) => {
      const from = String(c?.from || "").trim();
      const to = String(c?.to || "").trim();
      if (!from || !to) return;
      if (from === base) set.add(to);
      if (to === base) set.add(from);
    });

    return Array.from(set);
  };

  const isUnitAllowed = (ingredientId, unit) => {
    if (!ingredientId || !unit) return false;
    const allowed = getAllowedUnitsForIngredient(ingredientId);
    return allowed.includes(unit);
  };

  // ========= waste normalize =========
  const normalizeWasteForComp = (comp) => {
    if (!comp?.ingredientId) return comp;

    const baseUnit = getIngredientBaseUnit(comp.ingredientId);
    const unit = comp.unit || baseUnit;

    const qtyNum = parseDecimalLoose(comp.qty);
    const qty = qtyNum && qtyNum > 0 ? qtyNum : 0;
    const qtyBase = qty > 0 ? toBaseQty(qty, unit, baseUnit) : 0;

    const mode = comp.wasteMode === "UNIT" ? "UNIT" : "PERCENT";

    if (mode === "UNIT") {
      const wNum = parseDecimalLoose(comp.wasteQty);
      const w = wNum && wNum > 0 ? wNum : 0;
      const wBaseRaw = w > 0 ? toBaseQty(w, unit, baseUnit) : 0;

      const wBase = qtyBase > 0 ? clamp(wBaseRaw, 0, qtyBase) : 0;
      const wastePct = qtyBase > 0 ? (wBase / qtyBase) * 100 : 0;

      const wasteQtyClamped =
        qtyBase > 0 ? fromBaseQty(wBase, unit, baseUnit) : 0;

      return {
        ...comp,
        wasteMode: "UNIT",
        wasteQty: String(wasteQtyClamped),
        wastePct: clamp(wastePct, 0, 100),
      };
    }

    const pctNum = parseDecimalLoose(comp.wastePct);
    const pct = pctNum !== null ? clamp(pctNum, 0, 100) : 0;

    const wBase = qtyBase > 0 ? qtyBase * (pct / 100) : 0;
    const wasteQty = qtyBase > 0 ? fromBaseQty(wBase, unit, baseUnit) : 0;

    return {
      ...comp,
      wasteMode: "PERCENT",
      wastePct: pct,
      wasteQty: String(wasteQty),
    };
  };

  // ========= key helpers =========
  const slugifyKey = (str) =>
    String(str || "")
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]+/gu, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 80);

  const ensureUniqueKey = (rawKey, usedKeys) => {
    const base = slugifyKey(rawKey) || "variant";
    if (!usedKeys.has(base)) {
      usedKeys.add(base);
      return base;
    }
    let i = 2;
    while (usedKeys.has(`${base}_${i}`)) i += 1;
    const next = `${base}_${i}`;
    usedKeys.add(next);
    return next;
  };

  const makeEmptyVariant = (idx, usedKeys) => {
    const name = idx === 0 ? "Cơ bản" : `Biến thể ${idx + 1}`;
    const key = ensureUniqueKey(name, usedKeys);

    return {
      uiId: `${Date.now()}_${idx}`,
      key,
      name,
      mode: "PORTION",

      sellQty: 1,
      sellQtyText: "1",
      sellUnit: "portion",

      price: 0,
      isDefault: idx === 0,

      components: [],
    };
  };

  // ========= resolve active row =========
  const activeRow = useMemo(
    () => pickedDishRow || recipe || null,
    [pickedDishRow, recipe]
  );

  const menuItemNode = useMemo(() => {
    if (activeRow?.menuItem) return activeRow.menuItem;
    return activeRow;
  }, [activeRow]);

  const recipeNode = useMemo(() => {
    if (activeRow?.recipe) return activeRow.recipe;
    return activeRow;
  }, [activeRow]);

  const currentMenuItemId = useMemo(() => {
    return (
      menuItemNode?.id ||
      recipeNode?.menuItemId ||
      activeRow?.menuItemId ||
      activeRow?.id ||
      null
    );
  }, [menuItemNode, recipeNode, activeRow]);

  const dishInfo = useMemo(() => {
    return {
      name: menuItemNode?.name || "",
      description: menuItemNode?.description || "",
      status: menuItemNode?.status || "",
      basePrice:
        typeof menuItemNode?.basePrice === "number"
          ? menuItemNode.basePrice
          : 0,
    };
  }, [menuItemNode]);

  const hasExistingRecipe = useMemo(() => {
    if (activeRow?.recipe?.id) return true;
    if (recipeNode?.id && recipeNode?.menuItemId) return true;
    const variants = Array.isArray(recipeNode?.servingVariants)
      ? recipeNode.servingVariants
      : [];
    return variants.length > 0;
  }, [activeRow, recipeNode]);

  // ========= form state =========
  const [formData, setFormData] = useState({
    notes: "",
    servingVariants: [],
  });

  const activeVariant = formData.servingVariants?.[activeVariantIndex];

  // ========= open/init =========
  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setActiveVariantIndex(0);
    setPreviewWeight(100);

    // nếu mở modal để tạo mới recipe (chưa có recipe truyền vào) => bật picker
    if (!recipe && !pickedDishRow) {
      setIsDishPickerOpen(true);
      setIsDishInfoCollapsed(true);
    } else {
      setIsDishInfoCollapsed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Init form from recipeNode
  useEffect(() => {
    if (!isOpen) return;

    const usedKeys = new Set();
    const srcVariants = Array.isArray(recipeNode?.servingVariants)
      ? recipeNode.servingVariants
      : [];

    const normalizedVariants = (srcVariants || []).map((v, idx) => {
      const name = String(v?.name || `Biến thể ${idx + 1}`).trim();
      const existingKey = String(v?.key || "").trim();
      const key = existingKey
        ? ensureUniqueKey(existingKey, usedKeys)
        : ensureUniqueKey(name, usedKeys);

      const mode = v?.mode === "BY_WEIGHT" ? "BY_WEIGHT" : "PORTION";

      let sellUnit = String(
        v?.sellUnit || (mode === "BY_WEIGHT" ? "kg" : "portion")
      );
      let sellQty = Number(v?.sellQty);

      if (mode === "PORTION") {
        sellUnit = "portion";
        sellQty = 1;
      } else {
        if (!["kg", "g"].includes(sellUnit)) sellUnit = "kg";
        if (!Number.isFinite(sellQty) || sellQty <= 0) sellQty = 1;
      }

      const price = Number(v?.price);
      const isDefault = !!v?.isDefault;

      const rawLines = Array.isArray(v?.ingredients)
        ? v.ingredients
        : Array.isArray(v?.components)
        ? v.components
        : [];

      const components = rawLines
        .map((c) => {
          const ingredientId = c?.ingredientId;
          if (!ingredientId) return null;

          const baseUnit = getIngredientBaseUnit(ingredientId);
          const lineUnitCandidate = c?.unit || baseUnit;

          const unit = isUnitAllowed(ingredientId, lineUnitCandidate)
            ? lineUnitCandidate
            : baseUnit;

          const qtyBase = Number(c?.qty ?? 0) || 0;
          const qtyDisplay =
            unit === baseUnit ? qtyBase : fromBaseQty(qtyBase, unit, baseUnit);

          const wastePct = Number(c?.wastePct) || 0;
          const wasteQtyDisplay = qtyDisplay * (wastePct / 100);

          return normalizeWasteForComp({
            ingredientId: String(ingredientId),
            qty: String(qtyDisplay),
            unit,
            wasteMode: "PERCENT",
            wastePct: String(wastePct),
            wasteQty: String(wasteQtyDisplay),
            ingSearch: "",
            ingFocused: false,
          });
        })
        .filter(Boolean);

      return {
        uiId: `${Date.now()}_${idx}`,
        key,
        name,
        mode,

        sellQty,
        sellQtyText: String(sellQty),

        sellUnit,
        price: Number.isFinite(price) && price >= 0 ? price : 0,
        isDefault,
        components,
      };
    });

    const variantsFinal = normalizedVariants.length
      ? normalizedVariants
      : [makeEmptyVariant(0, usedKeys)];

    // enforce exactly one default
    if (variantsFinal.length) {
      const hasDefault = variantsFinal.some((x) => x.isDefault);
      if (!hasDefault) variantsFinal[0].isDefault = true;

      let seen = false;
      variantsFinal.forEach((vv) => {
        if (vv.isDefault && !seen) seen = true;
        else if (vv.isDefault && seen) vv.isDefault = false;
      });
    }

    setFormData({
      notes: String(recipeNode?.notes || ""),
      servingVariants: variantsFinal,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, recipeNode, ingredients]);

  // ========= costs =========
  const getComponentQtyInBase = (comp) => {
    const baseUnit = getIngredientBaseUnit(comp.ingredientId);
    const unit = comp.unit || baseUnit;
    const q = parseDecimalLoose(comp.qty);
    return toBaseQty(q || 0, unit, baseUnit);
  };

  const getComponentWasteFactor = (comp) => {
    const wastePct = clamp(Number(comp?.wastePct) || 0, 0, 200);
    return 1 + wastePct / 100;
  };

  const calcVariantCostPortion = (variant) => {
    const list = variant?.components || [];
    return list.reduce((sum, c) => {
      const unitCost = getIngredientCost(c.ingredientId);
      const qtyBase = getComponentQtyInBase(c) * getComponentWasteFactor(c);
      return sum + qtyBase * unitCost;
    }, 0);
  };

  const calcVariantCostByWeightPreview = (variant, weightGrams = 100) => {
    const ratio = (Number(weightGrams) || 0) / 100;
    const list = variant?.components || [];
    return list.reduce((sum, c) => {
      const unitCost = getIngredientCost(c.ingredientId);
      const qtyBasePer100g =
        getComponentQtyInBase(c) * getComponentWasteFactor(c);
      return sum + qtyBasePer100g * ratio * unitCost;
    }, 0);
  };

  const activeCost = useMemo(() => {
    if (!activeVariant) return 0;
    if (activeVariant.mode === "BY_WEIGHT") {
      return calcVariantCostByWeightPreview(activeVariant, previewWeight);
    }
    return calcVariantCostPortion(activeVariant);
  }, [activeVariant, previewWeight, ingredients]);

  // ========= label helpers =========
  const getPriceLabel = (variant) => {
    if (!variant) return "Giá";
    if (variant.mode === "PORTION") return "Giá / phần";
    const unit = variant.sellUnit || "kg";
    const qtyText = String(variant.sellQtyText ?? "").trim() || "…";
    return `Giá / ${qtyText} ${unit}`;
  };

  const getFinalDisplay = (variant) => {
    if (!variant) return "";
    const price = Math.max(0, Number(variant.price) || 0);

    if (variant.mode === "PORTION") return `${formatPrice(price)} / phần`;

    const unit = variant.sellUnit || "kg";
    const qtyNum = parseDecimalLoose(variant.sellQtyText) || 0;
    if (qtyNum > 0) {
      const perUnit = price / qtyNum;
      return `${formatPrice(perUnit)} / ${unit}`;
    }
    return `${formatPrice(price)} / ${unit}`;
  };

  // ========= Variant handlers =========
  const handleVariantAdd = () => {
    const used = new Set(
      (formData.servingVariants || []).map((v) => v.key).filter(Boolean)
    );
    const nextVariant = makeEmptyVariant(
      (formData.servingVariants || []).length,
      used
    );

    setFormData((p) => ({
      ...p,
      servingVariants: [...(p.servingVariants || []), nextVariant],
    }));
    setActiveVariantIndex((formData.servingVariants || []).length);
  };

  const handleVariantDuplicate = (index) => {
    const src = formData.servingVariants?.[index];
    if (!src) return;

    const used = new Set(
      (formData.servingVariants || [])
        .map((v) => String(v.key || "").trim())
        .filter(Boolean)
    );

    const copyName = `${src.name || "Biến thể"} (copy)`;
    const copyKey = ensureUniqueKey(copyName, used);

    const cloned = {
      ...src,
      uiId: `${Date.now()}_${Math.random()}`,
      name: copyName,
      key: copyKey,
      isDefault: false,
      components: (src.components || []).map((c) => ({
        ...c,
        ingSearch: "",
        ingFocused: false,
      })),
    };

    setFormData((p) => ({
      ...p,
      servingVariants: [...(p.servingVariants || []), cloned],
    }));
    setActiveVariantIndex((formData.servingVariants || []).length);
  };

  const handleVariantRemove = (index) => {
    if ((formData.servingVariants || []).length <= 1) {
      alert("Phải có ít nhất 1 biến thể.");
      return;
    }

    const removingDefault = !!formData.servingVariants[index]?.isDefault;
    const next = formData.servingVariants.filter((_, i) => i !== index);

    if (removingDefault && next.length) next[0].isDefault = true;

    setFormData((p) => ({ ...p, servingVariants: next }));
    setActiveVariantIndex((cur) => Math.max(0, Math.min(cur, next.length - 1)));
  };

  const setOnlyDefault = (index) => {
    const next = formData.servingVariants.map((v, i) => ({
      ...v,
      isDefault: i === index,
    }));
    setFormData((p) => ({ ...p, servingVariants: next }));
  };

  const handleVariantChange = (index, patch) => {
    const next = [...formData.servingVariants];
    const original = next[index];
    let updated = { ...original, ...patch };

    if (patch.sellQtyText !== undefined) {
      const t = sanitizeDecimalText(patch.sellQtyText);
      updated.sellQtyText = t;
      const n = parseDecimalLoose(t);
      if (n && n > 0) updated.sellQty = n;
    }

    if (patch.mode) {
      const mode = patch.mode === "BY_WEIGHT" ? "BY_WEIGHT" : "PORTION";
      updated.mode = mode;

      if (mode === "PORTION") {
        updated.sellUnit = "portion";
        updated.sellQty = 1;
        updated.sellQtyText = "1";
      } else {
        if (!["kg", "g"].includes(updated.sellUnit)) updated.sellUnit = "kg";
        if (!String(updated.sellQtyText || "").trim())
          updated.sellQtyText = "1";
        const n = parseDecimalLoose(updated.sellQtyText);
        updated.sellQty = n && n > 0 ? n : 1;
      }
    }

    if (updated.mode === "BY_WEIGHT") {
      if (!["kg", "g"].includes(updated.sellUnit)) updated.sellUnit = "kg";
      const n = parseDecimalLoose(updated.sellQtyText);
      updated.sellQty = n && n > 0 ? n : updated.sellQty || 1;
    } else {
      updated.sellUnit = "portion";
      updated.sellQty = 1;
      updated.sellQtyText = "1";
    }

    if (patch.price !== undefined) {
      const p = Number(patch.price);
      updated.price = Number.isFinite(p) && p >= 0 ? p : 0;
    }

    next[index] = updated;
    setFormData((p) => ({ ...p, servingVariants: next }));
  };

  // ========= ingredient line handlers =========
  const handleComponentAdd = (variantIndex) => {
    const next = [...formData.servingVariants];
    next[variantIndex].components = [
      ...(next[variantIndex].components || []),
      normalizeWasteForComp({
        ingredientId: "",
        qty: "",
        unit: "",
        wasteMode: "PERCENT",
        wastePct: "0",
        wasteQty: "0",
        ingSearch: "",
        ingFocused: false,
      }),
    ];
    setFormData((p) => ({ ...p, servingVariants: next }));
  };

  const handleComponentRemove = (variantIndex, compIndex) => {
    const next = [...formData.servingVariants];
    next[variantIndex].components = (
      next[variantIndex].components || []
    ).filter((_, i) => i !== compIndex);
    setFormData((p) => ({ ...p, servingVariants: next }));
  };

  const fireRecordUsed = (ingredientId) => {
    if (!restaurantId || !ingredientId) return;
    recordIngredientUsed({
      variables: { restaurantId, ingredientId },
    }).catch(() => {});
  };

  const handleComponentChange = (variantIndex, compIndex, field, value) => {
    const next = [...formData.servingVariants];
    const comp0 = next[variantIndex].components?.[compIndex] || {};
    let comp = { ...comp0 };

    if (field === "ingSearch") {
      comp.ingSearch = value;
      next[variantIndex].components[compIndex] = comp;
      setFormData((p) => ({ ...p, servingVariants: next }));
      return;
    }

    if (field === "ingFocused") {
      comp.ingFocused = !!value;
      next[variantIndex].components[compIndex] = comp;
      setFormData((p) => ({ ...p, servingVariants: next }));
      return;
    }

    if (field === "pickIngredient") {
      const ingredientId = value;

      const baseUnit = getIngredientBaseUnit(ingredientId);
      const unit = isUnitAllowed(ingredientId, comp.unit)
        ? comp.unit
        : baseUnit;

      comp.ingredientId = ingredientId;
      comp.unit = unit;
      comp.ingSearch = "";
      comp.ingFocused = false;

      comp.qty = comp.qty || "";
      comp.wasteMode = comp.wasteMode || "PERCENT";
      comp.wastePct = comp.wastePct ?? "0";
      comp.wasteQty = comp.wasteQty ?? "0";

      comp = normalizeWasteForComp(comp);

      next[variantIndex].components[compIndex] = comp;
      setFormData((p) => ({ ...p, servingVariants: next }));

      fireRecordUsed(String(ingredientId));
      return;
    }

    if (field === "ingredientId") {
      const ingredientId = value;
      const baseUnit = getIngredientBaseUnit(ingredientId);
      const unit = isUnitAllowed(ingredientId, comp.unit)
        ? comp.unit
        : baseUnit;

      comp.ingredientId = ingredientId;
      comp.unit = unit;

      comp.qty = comp.qty || "";
      comp.wasteMode = comp.wasteMode || "PERCENT";
      comp.wastePct = comp.wastePct ?? "0";
      comp.wasteQty = comp.wasteQty ?? "0";

      comp = normalizeWasteForComp(comp);
      fireRecordUsed(String(ingredientId));
    } else if (field === "unit") {
      const ingredientId = comp.ingredientId;
      if (!ingredientId) return;

      const baseUnit = getIngredientBaseUnit(ingredientId);
      const newUnit = value || baseUnit;

      if (!isUnitAllowed(ingredientId, newUnit)) {
        comp.unit = baseUnit;
        comp = normalizeWasteForComp(comp);
      } else {
        const oldUnit = comp.unit || baseUnit;

        const qtyBase = toBaseQty(
          parseDecimalLoose(comp.qty) || 0,
          oldUnit,
          baseUnit
        );
        const newQty = fromBaseQty(qtyBase, newUnit, baseUnit);

        const wasteBase = toBaseQty(
          parseDecimalLoose(comp.wasteQty) || 0,
          oldUnit,
          baseUnit
        );
        const newWasteQty = fromBaseQty(wasteBase, newUnit, baseUnit);

        comp.unit = newUnit;
        comp.qty = String(newQty);
        comp.wasteQty = String(newWasteQty);

        comp = normalizeWasteForComp(comp);
      }
    } else if (field === "qty") {
      comp.qty = value;
      comp = normalizeWasteForComp(comp);
    } else if (field === "wasteMode") {
      comp.wasteMode = value === "UNIT" ? "UNIT" : "PERCENT";
      comp = normalizeWasteForComp(comp);
    } else if (field === "wastePct") {
      comp.wastePct = value;
      comp.wasteMode = "PERCENT";
      comp = normalizeWasteForComp(comp);
    } else if (field === "wasteQty") {
      comp.wasteQty = value;
      comp.wasteMode = "UNIT";
      comp = normalizeWasteForComp(comp);
    } else {
      comp[field] = value;
      comp = normalizeWasteForComp(comp);
    }

    next[variantIndex].components[compIndex] = comp;
    setFormData((p) => ({ ...p, servingVariants: next }));
  };

  // ========= validate =========
  const validateForm = () => {
    const e = {};

    if (!currentMenuItemId) e.menuItem = "Vui lòng chọn món trước khi lưu.";

    const variants = formData.servingVariants || [];
    if (!variants.length) e.variants = "Phải có ít nhất 1 biến thể";

    const defaultCount = variants.filter((v) => v?.isDefault).length;
    if (defaultCount !== 1) e.default = "Phải chọn đúng 1 biến thể mặc định";

    const keys = variants
      .map((v) => String(v?.key || "").trim())
      .filter(Boolean);
    const set = new Set(keys);
    if (set.size !== keys.length)
      e.keys = "Key biến thể bị trùng (vui lòng sửa)";

    variants.forEach((v, vi) => {
      if (!String(v?.name || "").trim())
        e[`variant_${vi}_name`] = "Tên biến thể là bắt buộc";

      if (v.mode === "BY_WEIGHT") {
        const sq = parseDecimalLoose(v.sellQtyText);
        if (!sq || sq <= 0)
          e[`variant_${vi}_sellQty`] = "Số lượng bán phải > 0";
        if (!["kg", "g"].includes(v.sellUnit))
          e[`variant_${vi}_sellUnit`] = "sellUnit chỉ kg/g";
      }

      (v.components || []).forEach((c, ci) => {
        if (!c.ingredientId)
          e[`variant_${vi}_comp_${ci}_id`] = "Chọn nguyên liệu";

        const q = parseDecimalLoose(c.qty);
        if (!q || q <= 0)
          e[`variant_${vi}_comp_${ci}_qty`] = "Số lượng phải > 0";

        const wp = Number(c.wastePct) || 0;
        if (wp < 0 || wp > 100)
          e[`variant_${vi}_comp_${ci}_waste`] = "Hao hụt 0-100%";

        const baseUnit = getIngredientBaseUnit(c.ingredientId);
        const unit = c.unit || baseUnit;
        if (c.ingredientId && !isUnitAllowed(c.ingredientId, unit)) {
          e[
            `variant_${vi}_comp_${ci}_unit`
          ] = `Unit không hợp lệ (chỉ cho: ${getAllowedUnitsForIngredient(
            c.ingredientId
          ).join(", ")})`;
        }
      });
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ========= build payload =========
  const buildPayload = () => {
    const variants = (formData.servingVariants || []).map((v, idx) => {
      const mode = v.mode === "BY_WEIGHT" ? "BY_WEIGHT" : "PORTION";
      const sellUnit =
        mode === "PORTION" ? "portion" : v.sellUnit === "g" ? "g" : "kg";

      const sqNum = parseDecimalLoose(v.sellQtyText);
      const sellQty = mode === "PORTION" ? 1 : sqNum && sqNum > 0 ? sqNum : 1;

      const ingredientsPayload = (v.components || [])
        .map((c) => {
          if (!c?.ingredientId) return null;

          const baseUnit = getIngredientBaseUnit(c.ingredientId);
          const unit = c.unit || baseUnit;

          const qtyBase = toBaseQty(
            parseDecimalLoose(c.qty) || 0,
            unit,
            baseUnit
          );
          const q = Number(qtyBase);
          if (!Number.isFinite(q) || q <= 0) return null;

          const wastePct = clamp(Number(c.wastePct) || 0, 0, 100);

          return {
            ingredientId: c.ingredientId,
            qty: q,
            unit: baseUnit, // ✅ chuẩn hoá
            wastePct, // ✅ chuẩn hoá
          };
        })
        .filter(Boolean);

      return {
        key: String(v.key || "").trim() || `variant_${idx + 1}`,
        name: String(v.name || "").trim(),
        mode,
        sellQty,
        sellUnit,
        price: Math.max(0, Number(v.price) || 0),
        isDefault: !!v.isDefault,
        ingredients: ingredientsPayload,
      };
    });

    if (variants.length && !variants.some((x) => x.isDefault))
      variants[0].isDefault = true;
    let seen = false;
    variants.forEach((x) => {
      if (x.isDefault && !seen) seen = true;
      else if (x.isDefault && seen) x.isDefault = false;
    });

    return {
      restaurantId,
      menuItemId: currentMenuItemId,
      notes: formData.notes || "",
      isActive: true,
      servingVariants: variants,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      const payload = buildPayload();
      await onSave?.(payload);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!onDelete || !currentMenuItemId) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa công thức này?")) return;

    try {
      setDeleting(true);
      await onDelete(currentMenuItemId);
      onClose?.();
    } finally {
      setDeleting(false);
    }
  };

  // ========= options =========
  const ingredientOptions = useMemo(() => {
    return (ingredients || []).map((ing) => ({
      value: String(ing.id),
      label: ing.name,
    }));
  }, [ingredients]);

  const modeOptions = useMemo(
    () => [
      { value: "PORTION", label: "PORTION (Theo phần)" },
      { value: "BY_WEIGHT", label: "BY_WEIGHT (Theo trọng lượng)" },
    ],
    []
  );

  const sellUnitOptions = useMemo(
    () => [
      { value: "kg", label: "kg" },
      { value: "g", label: "g" },
    ],
    []
  );

  // ========= suggestion payload -> option groups =========
  const suggestPayload = suggestData?.ingredientSuggestions;

  const suggestGroups = useMemo(() => {
    const toOpts = (arr) =>
      (arr || [])
        .map((x) => ({ value: String(x.id), label: x.name }))
        .filter((o) => ingredientIdSet.has(o.value));

    const recentUsed = toOpts(suggestPayload?.recentUsed);
    const topUsed = toOpts(suggestPayload?.topUsed);
    const recentCreated = toOpts(suggestPayload?.recentCreated);

    // de-dup across groups while keeping priority
    const seen = new Set();
    const uniq = (list) =>
      list.filter((o) => {
        if (!o.value || seen.has(o.value)) return false;
        seen.add(o.value);
        return true;
      });

    const gRecent = uniq(recentUsed);
    const gTop = uniq(topUsed);
    const gNew = uniq(recentCreated);

    // limit total 8
    const take = (list, n) => list.slice(0, Math.max(n, 0));
    let remain = 8;

    const out = [];
    if (gRecent.length && remain > 0) {
      const part = take(gRecent, remain);
      out.push({ title: "Gần đây", items: part });
      remain -= part.length;
    }
    if (gTop.length && remain > 0) {
      const part = take(gTop, remain);
      out.push({ title: "Dùng nhiều", items: part });
      remain -= part.length;
    }
    if (gNew.length && remain > 0) {
      const part = take(gNew, remain);
      out.push({ title: "Mới tạo", items: part });
      remain -= part.length;
    }

    // fallback nếu BE chưa có data
    if (!out.length && ingredientOptions.length) {
      out.push({ title: "Gợi ý", items: ingredientOptions.slice(0, 8) });
    }

    return out;
  }, [suggestPayload, ingredientIdSet, ingredientOptions]);

  // ========= dish picker =========
  const handlePickDishRow = (row) => {
    setPickedDishRow(row);
    setIsDishPickerOpen(false);
    setErrors({});
    setActiveVariantIndex(0);
    setPreviewWeight(100);
    setIsDishInfoCollapsed(true);
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={hasExistingRecipe ? "Cập nhật công thức" : "Thêm công thức"}
        size="xl"
      >
        <form className="recipe-modal-form" onSubmit={handleSubmit}>
          <Modal.Body>
          {/* ===== Dish (read-only) ===== */}
          <div className="recipe-section">
            <div className="section-header" style={{ marginBottom: 8 }}>
              <h3 className="section-title">🍽️ Món đang chọn</h3>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {currentMenuItemId ? (
                  <button
                    type="button"
                    className="recipeToggleBtn"
                    onClick={() => setIsDishInfoCollapsed((v) => !v)}
                  >
                    {isDishInfoCollapsed ? "Mở thông tin" : "Thu gọn"}
                  </button>
                ) : null}

                {!recipe ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsDishPickerOpen(true)}
                    disabled={saving || deleting}
                  >
                    {currentMenuItemId ? "🔁 Đổi món" : "🔎 Chọn món"}
                  </Button>
                ) : null}
              </div>
            </div>

            {!currentMenuItemId ? (
              <Card style={{ padding: 12, border: "1px dashed #e5e7eb" }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  Bạn chưa chọn món
                </div>
                {errors.menuItem ? (
                  <div className="error-message">{errors.menuItem}</div>
                ) : null}
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setIsDishPickerOpen(true)}
                >
                  Chọn món ngay
                </Button>
              </Card>
            ) : isDishInfoCollapsed ? (
              <div className="dishInfoCompact">
                <div className="dishInfoName">{dishInfo.name}</div>
                <div className="dishInfoDesc">
                  {dishInfo.description || "Không có mô tả"}
                </div>
                <div className="dishInfoHint">
                  Thông tin món được khóa trong modal công thức.
                </div>
              </div>
            ) : (
              <Card style={{ padding: 12 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>
                  {dishInfo.name}
                </div>
                <div style={{ opacity: 0.75, marginTop: 6 }}>
                  {dishInfo.description || "Không có mô tả"}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span className="badgeSoft">
                    {hasExistingRecipe
                      ? "Đã có công thức"
                      : "Chưa có công thức"}
                  </span>
                  {dishInfo.status ? (
                    <span className="badgeSoft">{dishInfo.status}</span>
                  ) : null}
                  <span className="badgeSoft">
                    Giá cache: {formatPrice(dishInfo.basePrice)}
                  </span>
                </div>
              </Card>
            )}
          </div>

          {/* ===== Notes ===== */}
          <div className="recipe-section">
            <h3 className="section-title">🗒️ Ghi chú công thức</h3>
            <FormGroup>
              <FormTextarea
                placeholder="Ghi chú nội bộ cho công thức..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, notes: e.target.value }))
                }
                rows={2}
                disabled={saving || deleting || !currentMenuItemId}
              />
            </FormGroup>
          </div>

          {/* ===== Variants ===== */}
          <div className="recipe-section">
            <div className="section-header">
              <h3 className="section-title">👨‍🍳 Biến thể</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleVariantDuplicate(activeVariantIndex)}
                  disabled={
                    saving || deleting || !currentMenuItemId || !activeVariant
                  }
                  title="Nhân bản biến thể đang chọn"
                >
                  📄 Nhân bản biến thể
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleVariantAdd}
                  disabled={saving || deleting || !currentMenuItemId}
                >
                  ➕ Thêm biến thể
                </Button>
              </div>
            </div>

            {(errors.variants || errors.default || errors.keys) && (
              <div
                style={{ margin: "8px 0", color: "#b91c1c", fontWeight: 600 }}
              >
                {errors.variants || errors.default || errors.keys}
              </div>
            )}

            <div className="method-tabs">
              {(formData.servingVariants || []).map((v, idx) => (
                <button
                  key={v.uiId || v.key || idx}
                  type="button"
                  className={`method-tab ${
                    activeVariantIndex === idx ? "active" : ""
                  }`}
                  onClick={() => setActiveVariantIndex(idx)}
                  disabled={saving || deleting || !currentMenuItemId}
                  title={v.key}
                >
                  {v.name || `Biến thể ${idx + 1}`}
                  {v.isDefault ? " ⭐" : ""}
                  {(formData.servingVariants || []).length > 1 && (
                    <span
                      className="method-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVariantRemove(idx);
                      }}
                      title="Xoá"
                    >
                      ×
                    </span>
                  )}
                </button>
              ))}
            </div>

            {activeVariant && (
              <Card className="method-content">
                <div className="form-row">
                  <FormGroup>
                    <FormLabel required>Tên biến thể</FormLabel>
                    <FormInput
                      value={activeVariant.name}
                      onChange={(e) =>
                        handleVariantChange(activeVariantIndex, {
                          name: e.target.value,
                        })
                      }
                      disabled={saving || deleting || !currentMenuItemId}
                    />
                    {errors[`variant_${activeVariantIndex}_name`] && (
                      <div className="error-message">
                        {errors[`variant_${activeVariantIndex}_name`]}
                      </div>
                    )}
                    <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
                      Key ổn định: <strong>{activeVariant.key}</strong>
                    </div>
                  </FormGroup>

                  <FormGroup>
                    <FormLabel>Chế độ</FormLabel>
                    <FormSelect
                      options={modeOptions}
                      value={activeVariant.mode}
                      onChange={(e) =>
                        handleVariantChange(activeVariantIndex, {
                          mode: e.target.value,
                        })
                      }
                      disabled={saving || deleting || !currentMenuItemId}
                    />
                  </FormGroup>

                  <FormGroup>
                    <FormLabel>Mặc định</FormLabel>
                    <div
                      style={{ display: "flex", gap: 10, alignItems: "center" }}
                    >
                      <input
                        type="radio"
                        checked={!!activeVariant.isDefault}
                        onChange={() => setOnlyDefault(activeVariantIndex)}
                        disabled={saving || deleting || !currentMenuItemId}
                      />
                      <span style={{ opacity: 0.85 }}>Chọn làm mặc định</span>
                    </div>
                  </FormGroup>
                </div>

                <div className="sell-config-title">
                  Đơn vị bán • Số lượng bán • {getPriceLabel(activeVariant)}
                </div>

                <div className="form-row">
                  {activeVariant.mode === "BY_WEIGHT" ? (
                    <>
                      <FormGroup>
                        <FormLabel required>Đơn vị bán</FormLabel>
                        <FormSelect
                          options={sellUnitOptions}
                          value={activeVariant.sellUnit}
                          onChange={(e) =>
                            handleVariantChange(activeVariantIndex, {
                              sellUnit: e.target.value,
                            })
                          }
                          disabled={saving || deleting || !currentMenuItemId}
                        />
                        {errors[`variant_${activeVariantIndex}_sellUnit`] && (
                          <div className="error-message">
                            {errors[`variant_${activeVariantIndex}_sellUnit`]}
                          </div>
                        )}
                      </FormGroup>

                      <FormGroup>
                        <FormLabel required>Số lượng bán</FormLabel>
                        <input
                          className="decimalInput"
                          type="text"
                          inputMode="decimal"
                          placeholder="vd: 1,2 hoặc 1.2"
                          value={activeVariant.sellQtyText ?? ""}
                          onChange={(e) =>
                            handleVariantChange(activeVariantIndex, {
                              sellQtyText: e.target.value,
                            })
                          }
                          disabled={saving || deleting || !currentMenuItemId}
                        />
                        {errors[`variant_${activeVariantIndex}_sellQty`] && (
                          <div className="error-message">
                            {errors[`variant_${activeVariantIndex}_sellQty`]}
                          </div>
                        )}
                      </FormGroup>
                    </>
                  ) : (
                    <>
                      <FormGroup>
                        <FormLabel>Đơn vị bán</FormLabel>
                        <FormInput value="portion" disabled />
                      </FormGroup>
                      <FormGroup>
                        <FormLabel>Số lượng bán</FormLabel>
                        <FormInput value="1" disabled />
                      </FormGroup>
                    </>
                  )}

                  <FormGroup>
                    <FormLabel>{getPriceLabel(activeVariant)}</FormLabel>
                    <FormInput
                      type="number"
                      min="0"
                      step="1000"
                      value={activeVariant.price}
                      onChange={(e) =>
                        handleVariantChange(activeVariantIndex, {
                          price: e.target.value,
                        })
                      }
                      disabled={saving || deleting || !currentMenuItemId}
                    />
                    <div className="finalDisplay">
                      Hiển thị:{" "}
                      <strong>{getFinalDisplay(activeVariant)}</strong>
                    </div>
                  </FormGroup>
                </div>

                {activeVariant.mode === "BY_WEIGHT" && (
                  <Card className="ingredient-row" style={{ marginBottom: 12 }}>
                    <div style={{ marginBottom: 8 }}>
                      <strong>Preview</strong> chi phí theo gram:
                    </div>
                    <div className="form-row">
                      <FormGroup>
                        <FormLabel>Trọng lượng (gram)</FormLabel>
                        <FormInput
                          type="number"
                          min="1"
                          step="1"
                          value={previewWeight}
                          onChange={(e) => setPreviewWeight(e.target.value)}
                          disabled={saving || deleting || !currentMenuItemId}
                        />
                        <div style={{ marginTop: 6 }}>
                          Ước tính chi phí:{" "}
                          <strong>{formatPrice(activeCost)}</strong>
                        </div>
                      </FormGroup>
                    </div>
                  </Card>
                )}

                {/* Ingredients */}
                <div className="method-ingredients">
                  <div className="subsection-header">
                    <h4>Nguyên liệu</h4>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleComponentAdd(activeVariantIndex)}
                      disabled={saving || deleting || !currentMenuItemId}
                    >
                      ➕ Thêm nguyên liệu
                    </Button>
                  </div>

                  {(activeVariant.components || []).map((c, ci) => {
                    const ing = c.ingredientId
                      ? findIngredient(c.ingredientId)
                      : null;
                    const baseUnit = c.ingredientId
                      ? getIngredientBaseUnit(c.ingredientId)
                      : "";
                    const allowedUnits = c.ingredientId
                      ? getAllowedUnitsForIngredient(c.ingredientId)
                      : [];

                    const unitValue =
                      c.ingredientId && isUnitAllowed(c.ingredientId, c.unit)
                        ? c.unit
                        : baseUnit || "";

                    // ===== search filter + suggestions =====
                    const searchTextRaw = String(c.ingSearch || "").trim();
                    const searchKey = normalizeText(searchTextRaw);

                    let filteredIngredientOptions = ingredientOptions;
                    if (searchKey) {
                      filteredIngredientOptions = ingredientOptions.filter(
                        (o) => normalizeText(o.label).includes(searchKey)
                      );
                    }

                    // ensure selected visible in filtered list
                    if (c.ingredientId) {
                      const selected = ingredientOptions.find(
                        (o) => o.value === String(c.ingredientId)
                      );
                      if (
                        selected &&
                        !filteredIngredientOptions.some(
                          (o) => o.value === selected.value
                        )
                      ) {
                        filteredIngredientOptions = [
                          selected,
                          ...filteredIngredientOptions,
                        ];
                      }
                    }

                    const showFallback = !!c.ingFocused && !searchKey;
                    const showSuggest = !!c.ingFocused;

                    const wasteMode =
                      c.wasteMode === "UNIT" ? "UNIT" : "PERCENT";

                    return (
                      <div key={ci} className="method-ingredient-row">
                        <div className="form-row-3">
                          <FormGroup>
                            <FormLabel>Nguyên liệu</FormLabel>
                            <div className="ingredientSelectField">

                            <input
                              className="ingredientSearchInput"
                              type="text"
                              placeholder={
                                suggestLoading
                                  ? "Đang tải gợi ý..."
                                  : "Tìm nguyên liệu..."
                              }
                              value={c.ingSearch || ""}
                              onFocus={() =>
                                handleComponentChange(
                                  activeVariantIndex,
                                  ci,
                                  "ingFocused",
                                  true
                                )
                              }
                              onBlur={() =>
                                setTimeout(() => {
                                  handleComponentChange(
                                    activeVariantIndex,
                                    ci,
                                    "ingFocused",
                                    false
                                  );
                                }, 120)
                              }
                              onChange={(e) =>
                                handleComponentChange(
                                  activeVariantIndex,
                                  ci,
                                  "ingSearch",
                                  e.target.value
                                )
                              }
                              disabled={
                                saving || deleting || !currentMenuItemId
                              }
                            />

                            {/* ✅ suggestions list */}
                            {showSuggest ? (
                              <div className="ingredientSuggest">
                                {showFallback ? (
                                  <>
                                    {suggestGroups.map((g) => (
                                      <div
                                        key={g.title}
                                        className="ingredientSuggestGroup"
                                      >
                                        <div className="ingredientSuggestTitle">
                                          {g.title}
                                        </div>
                                        {g.items.map((opt) => (
                                          <button
                                            key={opt.value}
                                            type="button"
                                            className="ingredientSuggestItem"
                                            onMouseDown={(e) =>
                                              e.preventDefault()
                                            } // tránh blur trước click
                                            onClick={() =>
                                              handleComponentChange(
                                                activeVariantIndex,
                                                ci,
                                                "pickIngredient",
                                                opt.value
                                              )
                                            }
                                            disabled={
                                              saving ||
                                              deleting ||
                                              !currentMenuItemId
                                            }
                                          >
                                            {opt.label}
                                          </button>
                                        ))}
                                      </div>
                                    ))}
                                  </>
                                ) : (
                                  <>
                                    {filteredIngredientOptions.length ? (
                                      filteredIngredientOptions
                                        .slice(0, 10)
                                        .map((opt) => (
                                          <button
                                            key={opt.value}
                                            type="button"
                                            className="ingredientSuggestItem"
                                            onMouseDown={(e) =>
                                              e.preventDefault()
                                            }
                                            onClick={() =>
                                              handleComponentChange(
                                                activeVariantIndex,
                                                ci,
                                                "pickIngredient",
                                                opt.value
                                              )
                                            }
                                            disabled={
                                              saving ||
                                              deleting ||
                                              !currentMenuItemId
                                            }
                                          >
                                            {opt.label}
                                          </button>
                                        ))
                                    ) : (
                                      <div className="ingredientSuggestEmpty">
                                        Không tìm thấy nguyên liệu phù hợp
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ) : null}

                            {/* dropdown vẫn giữ để user thích chọn kiểu select */}
                            <FormSelect
                              options={ingredientOptions}
                              value={
                                c.ingredientId ? String(c.ingredientId) : ""
                              }
                              onChange={(e) =>
                                handleComponentChange(
                                  activeVariantIndex,
                                  ci,
                                  "ingredientId",
                                  e.target.value
                                )
                              }
                              placeholder="Chọn nguyên liệu"
                              disabled={
                                saving || deleting || !currentMenuItemId
                              }
                            />

                            {errors[
                              `variant_${activeVariantIndex}_comp_${ci}_id`
                            ] && (
                              <div className="error-message">
                                {
                                  errors[
                                    `variant_${activeVariantIndex}_comp_${ci}_id`
                                  ]
                                }
                              </div>
                            )}

                            {ing?.baseUnit ? (
                              <div
                                style={{
                                  marginTop: 6,
                                  opacity: 0.75,
                                  fontSize: 12,
                                }}
                              >
                                BaseUnit (BE): <strong>{ing.baseUnit}</strong>
                              </div>
                            ) : null}
                            </div>
                          </FormGroup>

                          <FormGroup>
                            <FormLabel>Số lượng</FormLabel>
                            <FormInput
                              type="text"
                              inputMode="decimal"
                              placeholder="0"
                              value={c.qty}
                              onChange={(e) =>
                                handleComponentChange(
                                  activeVariantIndex,
                                  ci,
                                  "qty",
                                  e.target.value
                                )
                              }
                              disabled={
                                saving || deleting || !currentMenuItemId
                              }
                            />
                            {errors[
                              `variant_${activeVariantIndex}_comp_${ci}_qty`
                            ] && (
                              <div className="error-message">
                                {
                                  errors[
                                    `variant_${activeVariantIndex}_comp_${ci}_qty`
                                  ]
                                }
                              </div>
                            )}
                          </FormGroup>

                          <FormGroup>
                            <FormLabel>Đơn vị</FormLabel>
                            <div className="input-with-action">
                              <select
                                className="select"
                                value={unitValue || ""}
                                disabled={
                                  !c.ingredientId ||
                                  saving ||
                                  deleting ||
                                  !currentMenuItemId
                                }
                                onChange={(e) =>
                                  handleComponentChange(
                                    activeVariantIndex,
                                    ci,
                                    "unit",
                                    e.target.value
                                  )
                                }
                              >
                                {!c.ingredientId ? (
                                  <option value="">
                                    Chọn nguyên liệu trước
                                  </option>
                                ) : null}

                                {c.ingredientId
                                  ? allowedUnits.map((u) => (
                                      <option key={u} value={u}>
                                        {u}
                                      </option>
                                    ))
                                  : null}
                              </select>

                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                onClick={() =>
                                  handleComponentRemove(activeVariantIndex, ci)
                                }
                                disabled={
                                  saving || deleting || !currentMenuItemId
                                }
                                title="Xoá dòng"
                              >
                                🗑️
                              </Button>
                            </div>

                            {errors[
                              `variant_${activeVariantIndex}_comp_${ci}_unit`
                            ] && (
                              <div className="error-message">
                                {
                                  errors[
                                    `variant_${activeVariantIndex}_comp_${ci}_unit`
                                  ]
                                }
                              </div>
                            )}

                            <div
                              style={{
                                marginTop: 6,
                                opacity: 0.7,
                                fontSize: 12,
                              }}
                            >
                              Khi lưu: qty chuẩn hoá về{" "}
                              <strong>{baseUnit || "baseUnit"}</strong>.
                            </div>
                          </FormGroup>
                        </div>

                        {/* waste */}
                        <div className="wasteBlock">
                          <div className="wasteModeGroup">
                            <button
                              type="button"
                              className={`wasteModeBtn ${
                                wasteMode === "UNIT" ? "active" : ""
                              }`}
                              disabled={
                                !c.ingredientId ||
                                saving ||
                                deleting ||
                                !currentMenuItemId
                              }
                              onClick={() =>
                                handleComponentChange(
                                  activeVariantIndex,
                                  ci,
                                  "wasteMode",
                                  "UNIT"
                                )
                              }
                              title="Nhập hao hụt theo số lượng (đơn vị đang chọn)"
                            >
                              1/ {unitValue || "unit"}
                            </button>

                            <button
                              type="button"
                              className={`wasteModeBtn ${
                                wasteMode === "PERCENT" ? "active" : ""
                              }`}
                              disabled={
                                !c.ingredientId ||
                                saving ||
                                deleting ||
                                !currentMenuItemId
                              }
                              onClick={() =>
                                handleComponentChange(
                                  activeVariantIndex,
                                  ci,
                                  "wasteMode",
                                  "PERCENT"
                                )
                              }
                              title="Nhập hao hụt theo %"
                            >
                              2/ %
                            </button>
                          </div>

                          <div className="form-row" style={{ marginTop: 8 }}>
                            <FormGroup>
                              <FormLabel>
                                Hao hụt{" "}
                                {wasteMode === "UNIT"
                                  ? `(${unitValue || ""})`
                                  : "(%)"}
                              </FormLabel>

                              {wasteMode === "UNIT" ? (
                                <input
                                  className="decimalInput"
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="vd: 0.1"
                                  value={c.wasteQty ?? ""}
                                  onChange={(e) =>
                                    handleComponentChange(
                                      activeVariantIndex,
                                      ci,
                                      "wasteQty",
                                      e.target.value
                                    )
                                  }
                                  disabled={
                                    !c.ingredientId ||
                                    saving ||
                                    deleting ||
                                    !currentMenuItemId
                                  }
                                />
                              ) : (
                                <input
                                  className="decimalInput"
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="vd: 5"
                                  value={String(c.wastePct ?? "")}
                                  onChange={(e) =>
                                    handleComponentChange(
                                      activeVariantIndex,
                                      ci,
                                      "wastePct",
                                      e.target.value
                                    )
                                  }
                                  disabled={
                                    !c.ingredientId ||
                                    saving ||
                                    deleting ||
                                    !currentMenuItemId
                                  }
                                />
                              )}

                              {errors[
                                `variant_${activeVariantIndex}_comp_${ci}_waste`
                              ] ? (
                                <div className="error-message">
                                  {
                                    errors[
                                      `variant_${activeVariantIndex}_comp_${ci}_waste`
                                    ]
                                  }
                                </div>
                              ) : null}

                              <div className="wasteHint">
                                Chuẩn hoá:{" "}
                                <strong>
                                  {(Number(c.wastePct) || 0).toFixed(2)}%
                                </strong>
                                {wasteMode === "PERCENT" && c.ingredientId ? (
                                  <>
                                    {" "}
                                    • Tương đương:{" "}
                                    <strong>
                                      {(
                                        parseDecimalLoose(c.wasteQty) || 0
                                      ).toFixed(4)}{" "}
                                      {unitValue}
                                    </strong>
                                  </>
                                ) : null}
                              </div>
                            </FormGroup>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="method-cost">
                    <strong>
                      Chi phí ước tính:{" "}
                      {activeVariant.mode === "BY_WEIGHT"
                        ? formatPrice(activeCost)
                        : formatPrice(calcVariantCostPortion(activeVariant))}
                    </strong>
                  </div>
                </div>
              </Card>
            )}
          </div>
          </Modal.Body>
          <Modal.Footer>
            <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving || deleting}
            >
              Đóng
            </Button>

            {hasExistingRecipe && (
              <Button
                type="button"
                variant="danger"
                onClick={handleDeleteClick}
                disabled={saving || deleting || !currentMenuItemId}
              >
                {deleting ? "Đang xoá..." : "Xóa"}
              </Button>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={saving || deleting || !currentMenuItemId}
              title={!currentMenuItemId ? "Vui lòng chọn món trước" : ""}
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
            </div>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Dish picker */}
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
