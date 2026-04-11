import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";

import Modal from "../../../../common/Modal";
import Button from "../../../../common/Button";

import FormGroup from "../Form/FormGroup";
import FormLabel from "../Form/FormLabel";
import FormInput from "../Form/FormInput";
import FormSelect from "../Form/FormSelect";
import FormTextarea from "../Form/FormTextarea";

import { formatPrice } from "../../../../../utils/formatters";
import {
  convertCurrencyAmount,
  normalizeCurrency,
} from "../../../../../utils/currency";
import { toBaseQty, fromBaseQty } from "../../../../../utils/unitConversion";

import RecipeDishPickerModal from "./RecipeDishPickerModal";
import useModalDraft from "../../../../../hooks/useModalDraft";
import { useNotification } from "../../../../../hooks/useNotification";
import {
  Q_INGREDIENT_SUGGESTIONS,
  M_RECORD_INGREDIENT_USED,
} from "../../graphql/ingredientSuggestions.gql";

import "./RecipeModal.scss";

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

const roundUpToThousand = (n) => {
  const x = Number(n) || 0;
  if (x <= 0) return 0;
  return Math.ceil(x / 1000) * 1000;
};

const normalizeText = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

const slugifyKey = (str) =>
  String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
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

const RecipeModal = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  recipe = null,
  menuItemRecipeRows = [],
  restaurantId,
  ingredients = [],
  currency = "VND",
  usdToVndRate = 26000,
}) => {
  const { showNotification } = useNotification();

  const activeCurrency = normalizeCurrency(currency, "VND");
  const cfmt = (amount) =>
    formatPrice(
      convertCurrencyAmount(amount, "VND", activeCurrency, usdToVndRate),
      { currency: activeCurrency },
    );

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [previewWeight, setPreviewWeight] = useState(100);
  const [isDishPickerOpen, setIsDishPickerOpen] = useState(false);
  const [pickedDishRow, setPickedDishRow] = useState(null);
  const [isDishInfoCollapsed, setIsDishInfoCollapsed] = useState(true);
  const initializedKeyRef = useRef(null);

  const [formData, setFormData] = useState({
    notes: "",
    servingVariants: [],
  });

  const shouldLoadSuggest = Boolean(isOpen && restaurantId);
  const { data: suggestData, loading: suggestLoading } = useQuery(
    Q_INGREDIENT_SUGGESTIONS,
    {
      variables: { restaurantId, limit: 8 },
      skip: !shouldLoadSuggest,
      fetchPolicy: "cache-and-network",
    },
  );

  const [recordIngredientUsed] = useMutation(M_RECORD_INGREDIENT_USED);

  const ingredientIdSet = useMemo(() => {
    const s = new Set();
    (ingredients || []).forEach((i) => s.add(String(i.id)));
    return s;
  }, [ingredients]);

  const ingredientOptions = useMemo(() => {
    return (ingredients || []).map((ing) => ({
      value: String(ing.id),
      label: ing.name,
    }));
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
    return getAllowedUnitsForIngredient(ingredientId).includes(unit);
  };

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

  const activeRow = useMemo(
    () => pickedDishRow || recipe || null,
    [pickedDishRow, recipe],
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

  const sourceHasRecipeLines = useMemo(() => {
    const variants = Array.isArray(recipeNode?.servingVariants)
      ? recipeNode.servingVariants
      : [];

    return variants.some((v) => {
      const lines = Array.isArray(v?.ingredients)
        ? v.ingredients
        : Array.isArray(v?.components)
          ? v.components
          : [];
      return lines.length > 0;
    });
  }, [recipeNode]);

  const formSourceKey = useMemo(() => {
    const dishKey =
      currentMenuItemId || pickedDishRow?.id || recipe?.id || "new";
    const recipeKey = recipeNode?.id || "no_recipe";
    const variantCount = Array.isArray(recipeNode?.servingVariants)
      ? recipeNode.servingVariants.length
      : 0;

    return `${dishKey}::${recipeKey}::${variantCount}`;
  }, [
    currentMenuItemId,
    pickedDishRow?.id,
    recipe?.id,
    recipeNode?.id,
    recipeNode?.servingVariants,
  ]);

  const activeVariant = formData.servingVariants?.[activeVariantIndex];

  const isDirty = useMemo(() => {
    if (!isOpen) return false;
    if ((formData.notes || "").trim()) return true;

    return (formData.servingVariants || []).some((v) => {
      const hasMeta =
        Boolean((v?.name || "").trim()) ||
        Boolean((v?.key || "").trim()) ||
        Number(v?.price || 0) > 0;

      const hasLines = (v?.components || []).some((c) => {
        const hasIngredient = Boolean(c?.ingredientId);
        const hasQty = String(c?.qty ?? "").trim() !== "";
        const hasWaste = Number(c?.wastePct || 0) > 0;
        return hasIngredient || hasQty || hasWaste;
      });

      return hasMeta || hasLines;
    });
  }, [formData.notes, formData.servingVariants, isOpen]);

  const { requestCloseWithDraft, clearDraft } = useModalDraft({
    enabled: isOpen,
    draftIdentity: {
      module: "storage",
      modal: "recipe-modal",
      route:
        typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: hasExistingRecipe ? "edit" : "create",
      entityType: "recipe",
      recordId: currentMenuItemId || activeRow?.id || null,
      context: "recipe-list",
      schemaVersion: "1",
    },
    formValue: formData,
    isDirty,
    sanitize: (v) => ({
      notes: v?.notes || "",
      servingVariants: Array.isArray(v?.servingVariants)
        ? v.servingVariants.map((variant) => ({
            key: variant?.key || "",
            name: variant?.name || "",
            mode: variant?.mode || "PORTION",
            sellQty: variant?.sellQty || 1,
            sellQtyText: variant?.sellQtyText || "1",
            sellUnit: variant?.sellUnit || "portion",
            price: variant?.price || 0,
            isDefault: !!variant?.isDefault,
            components: Array.isArray(variant?.components)
              ? variant.components.map((comp) => ({
                  ingredientId: comp?.ingredientId || "",
                  qty: comp?.qty || "",
                  unit: comp?.unit || "",
                  wasteMode: comp?.wasteMode || "PERCENT",
                  wastePct: comp?.wastePct || "0",
                  wasteQty: comp?.wasteQty || "0",
                }))
              : [],
          }))
        : [],
    }),
    onRestore: (draft) => {
      const restoredVariants = Array.isArray(draft?.servingVariants)
        ? draft.servingVariants.map((variant, idx) => ({
            uiId: `${Date.now()}_${idx}`,
            key: variant?.key || "",
            name: variant?.name || "",
            mode: variant?.mode === "BY_WEIGHT" ? "BY_WEIGHT" : "PORTION",
            sellQty: Number(variant?.sellQty) || 1,
            sellQtyText: String(
              variant?.sellQtyText ?? variant?.sellQty ?? "1",
            ),
            sellUnit: variant?.sellUnit || "portion",
            price: Number(variant?.price) || 0,
            isDefault: !!variant?.isDefault,
            components: Array.isArray(variant?.components)
              ? variant.components.map((comp) =>
                  normalizeWasteForComp({
                    ingredientId: comp?.ingredientId || "",
                    qty: comp?.qty || "",
                    unit: comp?.unit || "",
                    wasteMode: comp?.wasteMode || "PERCENT",
                    wastePct: comp?.wastePct || "0",
                    wasteQty: comp?.wasteQty || "0",
                    ingSearch: "",
                    ingFocused: false,
                    isEditingIngredient: false,
                  }),
                )
              : [],
          }))
        : [];

      setFormData({
        notes: draft?.notes || "",
        servingVariants: restoredVariants,
      });
    },
    notify: showNotification,
  });

  useEffect(() => {
    if (!isOpen) {
      initializedKeyRef.current = null;
      return;
    }

    setErrors({});
    setActiveVariantIndex(0);
    setPreviewWeight(100);

    if (!recipe && !pickedDishRow) {
      setIsDishPickerOpen(true);
      setIsDishInfoCollapsed(true);
    } else {
      setIsDishInfoCollapsed(true);
    }
  }, [isOpen, recipe, pickedDishRow]);

  useEffect(() => {
    if (!isOpen) return;
    if (sourceHasRecipeLines && !ingredients.length) return;
    if (initializedKeyRef.current === formSourceKey) return;

    initializedKeyRef.current = formSourceKey;

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
        v?.sellUnit || (mode === "BY_WEIGHT" ? "kg" : "portion"),
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
            isEditingIngredient: false,
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
  }, [
    isOpen,
    formSourceKey,
    recipeNode,
    ingredients.length,
    sourceHasRecipeLines,
  ]);

  const getComponentQtyInBase = (comp) => {
    const baseUnit = getIngredientBaseUnit(comp.ingredientId);
    const unit = comp.unit || baseUnit;
    const q = parseDecimalLoose(comp.qty);
    return toBaseQty(q || 0, unit, baseUnit);
  };

  const getComponentWasteFactor = (comp) => {
    const wastePct = clamp(Number(comp?.wastePct) || 0, 0, 100);
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

    if (variant.mode === "PORTION") return `${cfmt(price)} / phần`;

    const unit = variant.sellUnit || "kg";
    const qtyNum = parseDecimalLoose(variant.sellQtyText) || 0;
    if (qtyNum > 0) {
      const perUnit = price / qtyNum;
      return `${cfmt(perUnit)} / ${unit}`;
    }
    return `${cfmt(price)} / ${unit}`;
  };

  const recipeSummary = useMemo(() => {
    const variants = formData.servingVariants || [];
    const allComponents = variants.flatMap((v) => v.components || []);
    const validComponents = allComponents.filter((c) => c.ingredientId);
    const totalEstimated = variants.reduce((sum, variant) => {
      if (variant.mode === "BY_WEIGHT") {
        return sum + calcVariantCostByWeightPreview(variant, previewWeight);
      }
      return sum + calcVariantCostPortion(variant);
    }, 0);

    return {
      totalVariants: variants.length,
      totalComponents: allComponents.length,
      validComponents: validComponents.length,
      totalEstimated,
      defaultVariantName:
        variants.find((v) => v.isDefault)?.name || variants[0]?.name || "—",
    };
  }, [formData.servingVariants, previewWeight]);

  const activeVariantSummary = useMemo(() => {
    if (!activeVariant) {
      return {
        totalLines: 0,
        readyLines: 0,
        wasteLines: 0,
        displayPrice: "—",
      };
    }

    const components = activeVariant.components || [];
    const readyLines = components.filter((c) => {
      const q = parseDecimalLoose(c.qty);
      return c.ingredientId && q && q > 0;
    }).length;

    const wasteLines = components.filter((c) => Number(c?.wastePct) > 0).length;

    return {
      totalLines: components.length,
      readyLines,
      wasteLines,
      displayPrice: getFinalDisplay(activeVariant) || "—",
    };
  }, [activeVariant]);

  const priceSuggestionValues = useMemo(() => {
    if (!activeVariant) return [];

    const mode = activeVariant.mode === "BY_WEIGHT" ? "BY_WEIGHT" : "PORTION";
    const costBase =
      mode === "PORTION"
        ? calcVariantCostPortion(activeVariant)
        : calcVariantCostByWeightPreview(
            activeVariant,
            (activeVariant.sellUnit === "kg"
              ? (Number(activeVariant.sellQty) || 1) * 1000
              : Number(activeVariant.sellQty) || 1) || 1000,
          );

    const values = [
      dishInfo?.basePrice,
      costBase > 0 ? costBase * 1.3 : 0,
      costBase > 0 ? costBase * 1.6 : 0,
      costBase > 0 ? costBase * 2 : 0,
    ]
      .map((x) => roundUpToThousand(x))
      .filter((x) => x > 0);

    return Array.from(new Set(values)).slice(0, 4);
  }, [activeVariant, dishInfo?.basePrice, ingredients]);

  const activeVariantErrors = useMemo(() => {
    if (!activeVariant) return [];
    const prefix = `variant_${activeVariantIndex}`;
    return Object.entries(errors)
      .filter(([key]) => key.startsWith(prefix))
      .map(([, value]) => value);
  }, [errors, activeVariant, activeVariantIndex]);

  const suggestPayload = suggestData?.ingredientSuggestions;

  const suggestGroups = useMemo(() => {
    const toOpts = (arr) =>
      (arr || [])
        .map((x) => ({ value: String(x.id), label: x.name, source: "recent" }))
        .filter((o) => ingredientIdSet.has(o.value));

    const recentUsed = toOpts(suggestPayload?.recentUsed).map((x) => ({
      ...x,
      source: "recent",
    }));
    const topUsed = toOpts(suggestPayload?.topUsed).map((x) => ({
      ...x,
      source: "top",
    }));
    const recentCreated = toOpts(suggestPayload?.recentCreated).map((x) => ({
      ...x,
      source: "new",
    }));

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

    const take = (list, n) => list.slice(0, Math.max(n, 0));
    let remain = 8;
    const out = [];

    if (gRecent.length && remain > 0) {
      const part = take(gRecent, remain);
      out.push({ title: "Gần đây", items: part, kind: "recent" });
      remain -= part.length;
    }

    if (gTop.length && remain > 0) {
      const part = take(gTop, remain);
      out.push({ title: "Dùng nhiều", items: part, kind: "top" });
      remain -= part.length;
    }

    if (gNew.length && remain > 0) {
      const part = take(gNew, remain);
      out.push({ title: "Mới tạo", items: part, kind: "new" });
      remain -= part.length;
    }

    if (!out.length && ingredientOptions.length) {
      out.push({
        title: "Gợi ý",
        items: ingredientOptions.slice(0, 8),
        kind: "fallback",
      });
    }

    return out;
  }, [suggestPayload, ingredientIdSet, ingredientOptions]);

  const aiLikeGroups = useMemo(() => {
    const allRows = Array.isArray(menuItemRecipeRows) ? menuItemRecipeRows : [];
    if (!allRows.length || !ingredientOptions.length) return [];

    const selectedIds = new Set(
      (activeVariant?.components || [])
        .map((c) => String(c?.ingredientId || "").trim())
        .filter(Boolean),
    );

    const activeDishName = normalizeText(dishInfo?.name);
    const activeCategory = String(menuItemNode?.categoryId || "").trim();
    const nameTokens = activeDishName
      .split(/\s+/)
      .map((x) => x.trim())
      .filter((x) => x.length >= 2);

    const pairScore = new Map();
    const fallbackScore = new Map();

    const addScore = (id, score) => {
      if (!id || selectedIds.has(id) || !ingredientIdSet.has(id)) return;
      pairScore.set(id, (pairScore.get(id) || 0) + score);
    };

    const addFallback = (id, score) => {
      if (!id || selectedIds.has(id) || !ingredientIdSet.has(id)) return;
      fallbackScore.set(id, (fallbackScore.get(id) || 0) + score);
    };

    allRows.forEach((row) => {
      const rowMenu = row?.menuItem || row;
      const rowRecipe = row?.recipe || row;
      const variants = Array.isArray(rowRecipe?.servingVariants)
        ? rowRecipe.servingVariants
        : [];
      if (!variants.length) return;

      const rowName = normalizeText(rowMenu?.name || "");
      const rowCategory = String(rowMenu?.categoryId || "").trim();

      let recipeWeight = 0;
      if (rowCategory && activeCategory && rowCategory === activeCategory) {
        recipeWeight += 3;
      }
      if (activeDishName && rowName && rowName === activeDishName)
        recipeWeight += 3;
      if (nameTokens.length) {
        const tokenHits = nameTokens.filter((t) => rowName.includes(t)).length;
        recipeWeight += Math.min(tokenHits, 3);
      }
      recipeWeight = Math.max(1, recipeWeight);

      const ingredientSet = new Set();
      variants.forEach((v) => {
        const lines = Array.isArray(v?.ingredients) ? v.ingredients : [];
        lines.forEach((line) => {
          const iid = String(line?.ingredientId || "").trim();
          if (iid) ingredientSet.add(iid);
        });
      });

      if (!ingredientSet.size) return;

      ingredientSet.forEach((iid) => addFallback(iid, recipeWeight));
      if (!selectedIds.size) return;

      const sharedCount = Array.from(selectedIds).filter((iid) =>
        ingredientSet.has(iid),
      ).length;
      if (!sharedCount) return;

      const extraBoost = sharedCount >= 2 ? 2 : 1;
      ingredientSet.forEach((iid) => addScore(iid, recipeWeight * extraBoost));
    });

    const toItems = (mapObj, limit) =>
      Array.from(mapObj.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id, score]) => {
          const ing = ingredients.find((x) => String(x.id) === id);
          return {
            value: id,
            label: ing?.name || `Ingredient ${id}`,
            score,
          };
        });

    const pairingItems = toItems(pairScore, 5);
    const managerHintItems = toItems(fallbackScore, 5).filter(
      (x) => !pairingItems.some((p) => p.value === x.value),
    );

    const groups = [];
    if (pairingItems.length) {
      groups.push({
        title: "Gợi ý thêm (AI-like)",
        items: pairingItems,
        kind: "ai_pair",
      });
    }
    if (managerHintItems.length) {
      groups.push({
        title: "Manager hint",
        items: managerHintItems,
        kind: "ai_hint",
      });
    }
    return groups;
  }, [
    menuItemRecipeRows,
    ingredientOptions,
    activeVariant,
    dishInfo?.name,
    menuItemNode?.categoryId,
    ingredientIdSet,
    ingredients,
  ]);

  const getSuggestGroupsForComp = (comp) => {
    const keyword = normalizeText(comp?.ingSearch || "");

    const merged = [...suggestGroups, ...aiLikeGroups]
      .map((group) => {
        const items = Array.isArray(group?.items) ? group.items : [];
        const filteredItems = keyword
          ? items.filter((item) =>
              normalizeText(item?.label || "").includes(keyword),
            )
          : items;

        return {
          ...group,
          items: filteredItems,
        };
      })
      .filter((group) => group.items.length > 0);

    if (merged.length) return merged;

    if (keyword) {
      const searchItems = ingredientOptions
        .filter((item) => normalizeText(item.label).includes(keyword))
        .slice(0, 8);

      if (searchItems.length) {
        return [
          {
            title: "Kết quả tìm kiếm",
            items: searchItems,
            kind: "search",
          },
        ];
      }
    }

    return [];
  };

  const handleVariantAdd = () => {
    const used = new Set(
      (formData.servingVariants || []).map((v) => v.key).filter(Boolean),
    );

    const nextVariant = makeEmptyVariant(
      (formData.servingVariants || []).length,
      used,
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
        .filter(Boolean),
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
      window.alert("Phải có ít nhất 1 biến thể.");
      return;
    }

    const removingDefault = !!formData.servingVariants[index]?.isDefault;
    const next = formData.servingVariants.filter((_, i) => i !== index);

    if (removingDefault && next.length) {
      next[0] = { ...next[0], isDefault: true };
    }

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
    if (!original) return;

    let updated = { ...original, ...patch };

    if (patch.name !== undefined && !String(updated.key || "").trim()) {
      updated.key = slugifyKey(patch.name);
    }

    if (patch.key !== undefined) {
      updated.key = slugifyKey(patch.key);
    }

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
        if (!String(updated.sellQtyText || "").trim()) {
          updated.sellQtyText = "1";
        }
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
        isEditingIngredient: true,
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
    const comp0 = next[variantIndex]?.components?.[compIndex] || {};
    let comp = { ...comp0 };

    if (field === "ingSearch") {
      comp.ingSearch = value;
      comp.ingFocused = true;
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
      comp.isEditingIngredient = false;
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
      comp.isEditingIngredient = false;
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
          baseUnit,
        );
        const newQty = fromBaseQty(qtyBase, newUnit, baseUnit);

        const wasteBase = toBaseQty(
          parseDecimalLoose(comp.wasteQty) || 0,
          oldUnit,
          baseUnit,
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

  const validateForm = () => {
    const e = {};

    if (!currentMenuItemId) e.menuItem = "Vui lòng chọn món trước khi lưu.";

    const variants = formData.servingVariants || [];
    if (!variants.length) e.variants = "Phải có ít nhất 1 biến thể.";

    const defaultCount = variants.filter((v) => v?.isDefault).length;
    if (defaultCount !== 1) e.default = "Phải chọn đúng 1 biến thể mặc định.";

    const keys = variants
      .map((v) => String(v?.key || "").trim())
      .filter(Boolean);
    const set = new Set(keys);
    if (set.size !== keys.length) {
      e.keys = "Key biến thể bị trùng (vui lòng sửa).";
    }

    variants.forEach((v, vi) => {
      if (!String(v?.name || "").trim()) {
        e[`variant_${vi}_name`] = "Tên biến thể là bắt buộc.";
      }

      if (!String(v?.key || "").trim()) {
        e[`variant_${vi}_key`] = "Key biến thể là bắt buộc.";
      }

      if (v.mode === "BY_WEIGHT") {
        const sq = parseDecimalLoose(v.sellQtyText);
        if (!sq || sq <= 0) {
          e[`variant_${vi}_sellQty`] = "Số lượng bán phải > 0.";
        }
        if (!["kg", "g"].includes(v.sellUnit)) {
          e[`variant_${vi}_sellUnit`] = "Đơn vị bán chỉ nhận kg hoặc g.";
        }
      }

      if (Number(v?.price) < 0) {
        e[`variant_${vi}_price`] = "Giá bán không được âm.";
      }

      (v.components || []).forEach((c, ci) => {
        if (!c.ingredientId) {
          e[`variant_${vi}_comp_${ci}_id`] = "Chọn nguyên liệu.";
        }

        const q = parseDecimalLoose(c.qty);
        if (!q || q <= 0) {
          e[`variant_${vi}_comp_${ci}_qty`] = "Số lượng phải > 0.";
        }

        const wp = Number(c.wastePct) || 0;
        if (wp < 0 || wp > 100) {
          e[`variant_${vi}_comp_${ci}_waste`] = "Hao hụt phải trong 0-100%.";
        }

        const baseUnit = getIngredientBaseUnit(c.ingredientId);
        const unit = c.unit || baseUnit;
        if (c.ingredientId && !isUnitAllowed(c.ingredientId, unit)) {
          e[`variant_${vi}_comp_${ci}_unit`] =
            `Đơn vị không hợp lệ (chỉ cho: ${getAllowedUnitsForIngredient(
              c.ingredientId,
            ).join(", ")})`;
        }
      });
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  };

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
            baseUnit,
          );
          const q = Number(qtyBase);
          if (!Number.isFinite(q) || q <= 0) return null;

          const wastePct = clamp(Number(c.wastePct) || 0, 0, 100);

          return {
            ingredientId: c.ingredientId,
            qty: q,
            unit: baseUnit,
            wastePct,
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

    if (variants.length && !variants.some((x) => x.isDefault)) {
      variants[0].isDefault = true;
    }

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
      clearDraft();
      showNotification("Đã lưu công thức.", "success", 2200);
      onClose?.();
    } catch (err) {
      showNotification(
        err?.message || "Lưu công thức thất bại.",
        "error",
        2600,
      );
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
      clearDraft();
      showNotification("Đã xóa công thức.", "success", 2200);
      onClose?.();
    } catch (err) {
      showNotification(
        err?.message || "Xóa công thức thất bại.",
        "error",
        2600,
      );
    } finally {
      setDeleting(false);
    }
  };

  const handlePickDishRow = (row) => {
    initializedKeyRef.current = null;
    setPickedDishRow(row);
    setIsDishPickerOpen(false);
    setErrors({});
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
      >
        <form className="recipe-modal-form" onSubmit={handleSubmit}>
          <Modal.Body className="recipe-modal-body">
            <div className="recipe-section">
              <div className="section-header">
                <h3 className="section-title">🍽️ Thông tin món ăn</h3>

                <div className="recipe-header-actions">
                  {currentMenuItemId && (
                    <button
                      type="button"
                      className="method-tab method-tab--compact"
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
                <div className="recipe-empty-state">
                  <div className="recipe-empty-state__title">
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
                    <div className="recipe-empty-state__error">
                      {errors.menuItem}
                    </div>
                  )}
                </div>
              ) : isDishInfoCollapsed ? (
                <div className="recipe-overview">
                  <div className="recipe-overview-card recipe-overview-card--info">
                    <div className="recipe-overview-card__title">
                      {dishInfo.name}
                    </div>
                    <div className="recipe-overview-card__body">
                      {dishInfo.description || "Không có mô tả"}
                    </div>
                  </div>

                  <div className="recipe-overview-card recipe-overview-card--stats">
                    <div className="recipe-overview-card__title">
                      Giá bán gốc
                    </div>
                    <div className="recipe-overview-card__body">
                      <strong>{cfmt(dishInfo.basePrice)}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="recipe-variant-form">
                  <FormGroup>
                    <FormLabel>Tên món</FormLabel>
                    <FormInput value={dishInfo.name} disabled />
                  </FormGroup>

                  <FormGroup>
                    <FormLabel>Trạng thái món</FormLabel>
                    <FormInput value={dishInfo.status || "—"} disabled />
                  </FormGroup>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <FormGroup>
                      <FormLabel>
                        Ghi chú công thức chung (Không bắt buộc)
                      </FormLabel>
                      <FormTextarea
                        placeholder="Nhập lưu ý sơ chế, cách chế biến chung..."
                        value={formData.notes || ""}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, notes: e.target.value }))
                        }
                      />
                    </FormGroup>
                  </div>
                </div>
              )}
            </div>

            <div className="recipe-section">
              <div className="section-header">
                <h4 className="section-title">
                  ⚖️ Cấu hình các biến thể định lượng
                </h4>
              </div>

              <div className="recipe-overview">
                <div className="recipe-overview-card recipe-overview-card--info">
                  <div className="recipe-overview-card__title">
                    Tổng quan cấu hình
                  </div>
                  <div className="recipe-overview-card__body">
                    <div>
                      Tổng số biến thể:{" "}
                      <strong>{recipeSummary.totalVariants}</strong>
                    </div>
                    <div>
                      Số dòng NL hợp lệ:{" "}
                      <strong>{recipeSummary.validComponents}</strong>
                    </div>
                    <div>
                      Biến thể mặc định:{" "}
                      <strong>{recipeSummary.defaultVariantName}</strong>
                    </div>
                  </div>
                </div>

                {activeVariant && (
                  <div className="recipe-overview-card recipe-overview-card--stats">
                    <div className="recipe-overview-card__title">
                      Thống kê biến thể hiện tại
                    </div>
                    <div className="recipe-overview-card__body">
                      <div>
                        Tổng số dòng:{" "}
                        <strong>{activeVariantSummary.totalLines}</strong>
                      </div>
                      <div>
                        Dòng đã nhập đủ:{" "}
                        <strong>{activeVariantSummary.readyLines}</strong>
                      </div>
                      <div>
                        Hiển thị bán:{" "}
                        <strong>{activeVariantSummary.displayPrice}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {errors.variants && (
                <div className="recipe-error-box">
                  <div className="recipe-error-box__title">
                    {errors.variants}
                  </div>
                </div>
              )}

              {errors.default && (
                <div className="recipe-error-box">
                  <div className="recipe-error-box__title">
                    {errors.default}
                  </div>
                </div>
              )}

              {errors.keys && (
                <div className="recipe-error-box">
                  <div className="recipe-error-box__title">{errors.keys}</div>
                </div>
              )}

              {activeVariantErrors.length > 0 && (
                <div className="recipe-error-box">
                  <div className="recipe-error-box__title">
                    Vui lòng sửa các lỗi sau:
                  </div>
                  <ul>
                    {activeVariantErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="method-tabs">
                {(formData.servingVariants || []).map((v, index) => (
                  <button
                    key={v.uiId || index}
                    type="button"
                    className={`method-tab ${
                      activeVariantIndex === index ? "active" : ""
                    }`}
                    onClick={() => setActiveVariantIndex(index)}
                  >
                    {v.name || `Biến thể ${index + 1}`}
                    {v.isDefault && (
                      <span style={{ marginLeft: 6, color: "#10b981" }}>★</span>
                    )}
                  </button>
                ))}

                <button
                  type="button"
                  className="method-tab method-tab--add"
                  onClick={handleVariantAdd}
                >
                  + Thêm biến thể
                </button>
              </div>

              {activeVariant && (
                <div style={{ animation: "fadeIn 0.3s ease" }}>
                  <div className="recipe-variant-form">
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
                          placeholder="VD: Mặc định, Cỡ lớn..."
                        />
                      </FormGroup>
                    </div>

                    <div>
                      <FormGroup>
                        <FormLabel>
                          Định danh (Key){" "}
                          <span style={{ color: "red" }}>*</span>
                        </FormLabel>
                        <FormInput
                          type="text"
                          value={activeVariant.key || ""}
                          onChange={(e) =>
                            handleVariantChange(activeVariantIndex, {
                              key: e.target.value,
                            })
                          }
                          onBlur={(e) =>
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
                      <div className="recipe-field-inline">
                        <div>
                          <FormGroup>
                            <FormLabel>
                              Số lượng bán{" "}
                              <span style={{ color: "red" }}>*</span>
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

                        <div>
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
                          <div className="recipe-price-suggestions">
                            {priceSuggestionValues.map((v, idx) => (
                              <button
                                key={`${v}_${idx}`}
                                type="button"
                                className="recipe-price-chip"
                                onClick={() =>
                                  handleVariantChange(activeVariantIndex, {
                                    price: v,
                                  })
                                }
                              >
                                {cfmt(v)}
                              </button>
                            ))}
                          </div>
                        )}
                      </FormGroup>
                    </div>

                    <div className="recipe-checkbox">
                      <label>
                        <input
                          type="checkbox"
                          checked={activeVariant.isDefault || false}
                          onChange={(e) => {
                            if (e.target.checked)
                              setOnlyDefault(activeVariantIndex);
                          }}
                        />
                        <span>Dùng làm biến thể mặc định</span>
                      </label>
                    </div>
                  </div>

                  <div className="recipe-variant-actions">
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
                      <div style={{ textAlign: "center" }}>Xóa</div>
                    </div>

                    {(activeVariant.components || []).map((comp, cIdx) => {
                      const displayGroups = getSuggestGroupsForComp(comp);

                      return (
                        <div
                          key={`${comp.ingredientId || "row"}_${cIdx}`}
                          className="recipeIngredientLine"
                        >
                          <div className="ingredient-name-cell">
                            {comp.ingredientId && !comp.isEditingIngredient ? (
                              <div className="ingredient-selected">
                                <strong className="ingredient-selected__name">
                                  {findIngredient(comp.ingredientId)?.name ||
                                    "Nguyên liệu"}
                                </strong>

                                <button
                                  type="button"
                                  className="ingredient-edit-trigger"
                                  onClick={() =>
                                    handleComponentChange(
                                      activeVariantIndex,
                                      cIdx,
                                      "isEditingIngredient",
                                      true,
                                    )
                                  }
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
                                    180,
                                  )
                                }
                              />
                            )}

                            {comp.isEditingIngredient !== false &&
                              comp.ingFocused && (
                                <div className="ingredientSuggestDropdown">
                                  {displayGroups.map((group, gIdx) => (
                                    <div
                                      key={`${group.kind}_${gIdx}`}
                                      className="ingredientSuggestGroup"
                                    >
                                      <div className="ingredientSuggestTitle">
                                        {group.title}
                                      </div>

                                      <div style={{ padding: 4 }}>
                                        {group.items.map((item, iIdx) => (
                                          <button
                                            key={`${item.value}_${iIdx}`}
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

                                  {!displayGroups.length && (
                                    <div className="ingredientSuggestEmpty">
                                      {suggestLoading
                                        ? "Đang tải gợi ý..."
                                        : "Không tìm thấy nguyên liệu phù hợp"}
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
                                    ).map((u) => ({
                                      value: u,
                                      label: u,
                                    }))
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
                                    : undefined,
                                fontWeight:
                                  Number(comp.wastePct) > 0 ? 700 : undefined,
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
                                fontSize: 16,
                                padding: 8,
                                margin: "0 auto",
                                display: "block",
                                transition: "transform 0.2s",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.transform =
                                  "scale(1.15)")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.transform = "scale(1)")
                              }
                              title="Xóa dòng này"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <div className="ingredient-add-row">
                      <button
                        type="button"
                        className="ingredient-add-row__button"
                        onClick={() => handleComponentAdd(activeVariantIndex)}
                      >
                        + Thêm dòng nguyên liệu
                      </button>
                    </div>
                  </div>

                  <div className="variant-footer">
                    <span className="label">
                      Tổng chi phí dự kiến cho biến thể này:
                    </span>
                    <span className="value">{cfmt(activeCost)}</span>
                  </div>
                </div>
              )}
            </div>
          </Modal.Body>

          <Modal.Footer className="recipe-modal-footer">
            <div className="recipe-modal-footer__actions">
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
                  {deleting ? "Đang xóa..." : "Xóa công thức này"}
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
