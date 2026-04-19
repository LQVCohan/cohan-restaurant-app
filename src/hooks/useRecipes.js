import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLazyQuery, useMutation } from "@apollo/client";
import {
  Q_MENU_ITEMS_WITH_RECIPES_PAGED,
  M_UPSERT_RECIPE,
  M_DELETE_RECIPE,
  M_UPDATE_MENU_ITEM_BASIC,
} from "@/components/Dashboard_Manager/Storage/graphql/recipe.gql";

/**
 * useRecipes(restaurantId)
 * - Hook là nơi xử lý tất cả:
 *   + filters (search/categoryId/timeSlot/pagination)
 *   + fetch list (menuItemsWithRecipes)
 *   + CRUD recipe (upsert/delete)
 *   + sync MenuItem basic (optional)
 *   + normalize payload đúng schema BE mới
 *   + safeRefetchAll + optimistic updates
 *
 * Schema BE: servingVariants { key, name, mode, sellQty, sellUnit, ingredients[{ingredientId, qty, unit, wastePct}], price, isDefault }
 */

// =========================
// Helpers (match BE behavior)
// =========================
const MODES = new Set(["PORTION", "BY_WEIGHT"]);
const SELL_UNITS = new Set(["portion", "g", "kg"]);

function slugifyKey(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

function genStableKey() {
  return `sv_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toNum(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function normalizeMode(mode) {
  const m = String(mode || "PORTION");
  return MODES.has(m) ? m : "PORTION";
}

function normalizeSellUnit(mode, sellUnit) {
  const m = normalizeMode(mode);
  if (m === "PORTION") return "portion";
  const u = String(sellUnit || "").trim();
  if (u === "kg" || u === "g") return u;
  return "kg";
}

function normalizeSellQty(mode, sellQty) {
  const m = normalizeMode(mode);
  if (m === "PORTION") return 1;
  const q = toNum(sellQty, 1);
  return q > 0 ? q : 1;
}

function normalizeVariantName(v) {
  return String(v?.name ?? v?.preparationMethodName ?? "").trim();
}

function normalizeVariantKey(v, fallbackName = "") {
  // ✅ không ép key theo mode
  let key = String(v?.key || "").trim();
  if (!key && fallbackName) key = slugifyKey(fallbackName);
  key = slugifyKey(key);
  if (!key) key = genStableKey();
  return key;
}

function normalizeIngredientLine(line) {
  if (!line?.ingredientId) return null;

  const ingredientId = line.ingredientId;
  const qty = toNum(line.qty ?? line.quantify ?? line.quantity, 0);
  const unit = String(line.unit ?? line.baseUnit ?? "").trim();
  const wastePct = Math.min(100, Math.max(0, toNum(line.wastePct, 0)));

  if (!(qty > 0)) return null;
  if (!unit) {
    // BE throw Missing unit -> FE throw sớm
    throw new Error("Thiếu unit cho một dòng nguyên liệu.");
  }

  return { ingredientId, qty, unit, wastePct };
}

function ensureUniqueVariantKeys(variants) {
  const keys = variants.map((v) => v.key);
  const set = new Set(keys);
  if (set.size !== keys.length) {
    throw new Error("servingVariants.key bị trùng.");
  }
}

function ensureSingleDefault(variants) {
  const defaults = variants.filter((v) => !!v.isDefault);
  if (defaults.length > 1) {
    throw new Error("Chỉ được có 1 biến thể isDefault=true.");
  }
  if (defaults.length === 0 && variants.length) {
    variants[0].isDefault = true;
  }
}

function normalizeServingVariants(inputVariants = []) {
  const arr = Array.isArray(inputVariants) ? inputVariants : [];

  const normalized = arr
    .map((raw) => {
      if (!raw) return null;

      const name = normalizeVariantName(raw);
      const mode = normalizeMode(raw.mode);
      const key = normalizeVariantKey(raw, name);

      const sellUnit = normalizeSellUnit(mode, raw.sellUnit);
      const sellQty = normalizeSellQty(mode, raw.sellQty);

      // price optional
      let price = raw.price;
      if (price === "" || price === null || price === undefined) price = 0;
      price = Math.max(0, toNum(price, 0));

      const isDefault = !!raw.isDefault;

      const rawLines = Array.isArray(raw.ingredients)
        ? raw.ingredients
        : Array.isArray(raw.components)
        ? raw.components
        : Array.isArray(raw.Ingredients)
        ? raw.Ingredients
        : [];

      const ingredients = rawLines.map(normalizeIngredientLine).filter(Boolean);

      // match BE checks
      if (mode === "PORTION" && sellUnit !== "portion") {
        throw new Error(
          `Variant "${key}": PORTION phải có sellUnit="portion".`
        );
      }
      if (mode === "BY_WEIGHT" && !["kg", "g"].includes(sellUnit)) {
        throw new Error(`Variant "${key}": BY_WEIGHT phải có sellUnit kg/g.`);
      }
      if (!SELL_UNITS.has(sellUnit)) {
        throw new Error(`Variant "${key}": sellUnit không hợp lệ.`);
      }

      return {
        key,
        name: name || undefined,
        mode,
        sellQty,
        sellUnit,
        ingredients,
        price,
        isDefault,
      };
    })
    .filter(Boolean);

  if (!normalized.length) {
    throw new Error("servingVariants phải có ít nhất 1 biến thể.");
  }

  ensureUniqueVariantKeys(normalized);
  ensureSingleDefault(normalized);
  return normalized;
}

function mapRowToFe(row) {
  const mi = row?.menuItem || {};
  const r = row?.recipe || null;

  const servingVariants = Array.isArray(r?.servingVariants)
    ? r.servingVariants.map((sv) => {
        const ingredients = Array.isArray(sv?.ingredients)
          ? sv.ingredients
          : [];

        // alias cho UI editor cũ
        const components = ingredients.map((ic) => ({
          ingredientId: ic.ingredientId,
          qty: toNum(ic.qty, 0),
          unit: ic.unit || ic.baseUnit || "g",
          wastePct: toNum(ic.wastePct, 0),
          // join fields optional
          name: ic.name || "",
          baseUnit: ic.baseUnit || "",
          costPerBaseUnit:
            typeof ic.costPerBaseUnit === "number" ? ic.costPerBaseUnit : null,
        }));

        return {
          key: sv.key,
          name: sv.name || "",
          preparationMethodName: sv.name || "",
          mode: sv.mode,
          sellQty: typeof sv.sellQty === "number" ? sv.sellQty : 1,
          sellUnit: sv.sellUnit || (sv.mode === "BY_WEIGHT" ? "kg" : "portion"),
          price: typeof sv.price === "number" ? sv.price : 0,
          isDefault: !!sv.isDefault,

          ingredients, // chuẩn
          components, // alias editor
        };
      })
    : [];

  return {
    id: mi.id, // menuItemId (flatten)
    menuItemId: mi.id,
    restaurantId: mi.restaurantId,

    name: mi.name || "",
    description: mi.description || "",
    categoryId: mi.categoryId || null,

    basePrice: typeof mi.basePrice === "number" ? mi.basePrice : 0,
    thumbImage: mi.thumbImage || null,
    status: mi.status || null,

    // recipe
    servingVariants,
    notes: r?.notes || "",
    isActive: r?.isActive ?? true,

    _rawRecipeId: r?.id || null,
    _rawRecipe: r,

    icon: "🍽️",
  };
}

function buildUpsertInput(restaurantId, menuItemId, form) {
  return {
    restaurantId,
    menuItemId,
    notes: typeof form?.notes === "string" ? form.notes : form?.notes ?? "",
    isActive: form?.isActive ?? true,
    servingVariants: normalizeServingVariants(form?.servingVariants || []),
  };
}

function buildMenuItemPatch(restaurantId, menuItemId, form) {
  // optional — nếu modal cho sửa menuItem basic
  const patch = {};
  if (typeof form?.name === "string") patch.name = form.name.trim();
  if (typeof form?.description === "string")
    patch.description = form.description.trim();
  if (form?.categoryId) patch.categoryId = form.categoryId;

  const validStatuses = new Set([
    "available",
    "unavailable",
    "out_of_stock",
    "hidden",
  ]);
  if (typeof form?.status === "string") {
    const nextStatus = form.status.trim();
    if (validStatuses.has(nextStatus)) patch.status = nextStatus;
  }

  return Object.keys(patch).length
    ? { restaurantId, menuItemId, ...patch }
    : null;
}

// =========================
// Hook
// =========================
export function useRecipes(
  restaurantId,
  initialTimeSlot = null,
  initialFilters = {}
) {
  const normalizeSearchInput = useCallback((value) => {
    return String(value || "").replace(/\s+/g, " ").trim();
  }, []);

  // --- like useIngredients: filters state inside hook
  const [filters, setFilters] = useState({
    search: initialFilters?.search || "",
    categoryId: initialFilters?.categoryId || "",
    timeSlot: initialTimeSlot || "",
    first: initialFilters?.first || 30,
  });
  const [debouncedSearch, setDebouncedSearch] = useState(
    normalizeSearchInput(initialFilters?.search)
  );

  useEffect(() => {
    const nextTimeSlot = initialTimeSlot || "";
    setFilters((prev) =>
      prev.timeSlot === nextTimeSlot ? prev : { ...prev, timeSlot: nextTimeSlot }
    );
  }, [initialTimeSlot]);

  useEffect(() => {
    const nextCategoryId = initialFilters?.categoryId || "";
    const nextSearch = initialFilters?.search || "";
    const nextFirst = initialFilters?.first || 30;

    setFilters((prev) => {
      if (
        prev.categoryId === nextCategoryId &&
        prev.search === nextSearch &&
        prev.first === nextFirst
      ) {
        return prev;
      }
      return {
        ...prev,
        categoryId: nextCategoryId,
        search: nextSearch,
        first: nextFirst,
      };
    });
  }, [initialFilters?.categoryId, initialFilters?.search, initialFilters?.first]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(normalizeSearchInput(filters.search));
    }, 250);

    return () => clearTimeout(handle);
  }, [filters.search, normalizeSearchInput]);

  // --- data state
  const [recipes, setRecipes] = useState([]);
  const [pageInfo, setPageInfo] = useState({
    endCursor: null,
    hasNextPage: false,
  });
  const [total, setTotal] = useState(0);

  // --- local ui state
  const [localError, setLocalError] = useState(null);

  // for loadMore vars
  const lastVarsRef = useRef(null);

  const [fetchList, listState] = useLazyQuery(Q_MENU_ITEMS_WITH_RECIPES_PAGED, {
    fetchPolicy: "cache-and-network",
  });

  const [upsertMu, upsertState] = useMutation(M_UPSERT_RECIPE);
  const [deleteMu, deleteState] = useMutation(M_DELETE_RECIPE);
  const [updateMenuItemMu, menuItemState] = useMutation(
    M_UPDATE_MENU_ITEM_BASIC
  );

  const loading =
    listState.loading ||
    upsertState.loading ||
    deleteState.loading ||
    menuItemState.loading;

  const error = listState.error || localError;

  const runFetch = useCallback(
    async (override = {}) => {
      if (!restaurantId) return;

      const vars = {
        restaurantId,
        timeSlot: (override.timeSlot ?? filters.timeSlot) || null,
        search: normalizeSearchInput(override.search ?? debouncedSearch)
          ? normalizeSearchInput(override.search ?? debouncedSearch)
          : null,
        categoryId: (override.categoryId ?? filters.categoryId) || null,
        first: override.first ?? filters.first ?? 30,
        after: override.after ?? null,
      };

      lastVarsRef.current = vars;
      setLocalError(null);
      return fetchList({ variables: vars });
    },
    [restaurantId, filters, fetchList, debouncedSearch, normalizeSearchInput]
  );

  // auto fetch when restaurantId/filters change (like ingredient)
  useEffect(() => {
    if (!restaurantId) {
      setRecipes([]);
      setPageInfo({ endCursor: null, hasNextPage: false });
      setTotal(0);
      return;
    }

    // reset list on filter change
    setRecipes([]);
    setPageInfo({ endCursor: null, hasNextPage: false });
    setTotal(0);
    runFetch({ after: null });
  }, [
    restaurantId,
    debouncedSearch,
    filters.categoryId,
    filters.timeSlot,
    filters.first,
    runFetch,
  ]);

  // map result -> state
  useEffect(() => {
    const items = listState.data?.menuItemsWithRecipes?.items || [];
    const pi = listState.data?.menuItemsWithRecipes?.pageInfo || {
      endCursor: null,
      hasNextPage: false,
    };
    const t = listState.data?.menuItemsWithRecipes?.total ?? 0;

    setRecipes(items.map(mapRowToFe));
    setPageInfo(pi);
    setTotal(t);
  }, [listState.data]);

  // like useIngredients safeRefetchAll
  const safeRefetchAll = useCallback(async () => {
    try {
      setLocalError(null);
      await Promise.allSettled([runFetch({ after: null })]);
    } catch (e) {
      setLocalError(e);
    }
  }, [runFetch]);

  const loadMore = useCallback(async () => {
    if (!restaurantId) return;
    if (!pageInfo?.hasNextPage || !pageInfo?.endCursor) return;

    const base = lastVarsRef.current || {
      restaurantId,
      timeSlot: filters.timeSlot || null,
      search: normalizeSearchInput(debouncedSearch) || null,
      categoryId: filters.categoryId || null,
      first: filters.first || 30,
      after: null,
    };

    const nextVars = { ...base, after: pageInfo.endCursor };
    lastVarsRef.current = nextVars;

    const res = await listState.fetchMore?.({
      variables: nextVars,
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult) return prev;
        const prevItems = prev?.menuItemsWithRecipes?.items || [];
        const nextItems = fetchMoreResult?.menuItemsWithRecipes?.items || [];
        return {
          menuItemsWithRecipes: {
            __typename: prev.menuItemsWithRecipes.__typename,
            total: fetchMoreResult.menuItemsWithRecipes.total,
            pageInfo: fetchMoreResult.menuItemsWithRecipes.pageInfo,
            items: [...prevItems, ...nextItems],
          },
        };
      },
    });

    const merged = res?.data?.menuItemsWithRecipes?.items || [];
    setRecipes(merged.map(mapRowToFe));
    setPageInfo(res?.data?.menuItemsWithRecipes?.pageInfo || pageInfo);
    setTotal(res?.data?.menuItemsWithRecipes?.total ?? total);
  }, [
    restaurantId,
    pageInfo,
    filters,
    listState.fetchMore,
    total,
    debouncedSearch,
    normalizeSearchInput,
  ]);

  // ===== optimistic helpers =====
  const applyOptimisticUpsert = useCallback((menuItemId, form) => {
    setRecipes((prev) =>
      prev.map((r) => {
        if (String(r.id) !== String(menuItemId)) return r;

        // optimistic: update menu item basic if provided
        const next = { ...r };
        if (typeof form?.name === "string") next.name = form.name.trim();
        if (typeof form?.description === "string")
          next.description = form.description.trim();
        if (form?.categoryId) next.categoryId = form.categoryId;

        const validStatuses = new Set([
          "available",
          "unavailable",
          "out_of_stock",
          "hidden",
        ]);
        if (typeof form?.status === "string" && validStatuses.has(form.status)) {
          next.status = form.status;
        }

        // optimistic: update recipe variants
        try {
          const normalizedVariants = normalizeServingVariants(
            form?.servingVariants || next.servingVariants
          );
          next.servingVariants = normalizedVariants.map((sv) => ({
            key: sv.key,
            name: sv.name || "",
            preparationMethodName: sv.name || "",
            mode: sv.mode,
            sellQty: sv.sellQty,
            sellUnit: sv.sellUnit,
            price: sv.price ?? 0,
            isDefault: !!sv.isDefault,
            ingredients: sv.ingredients,
            components: sv.ingredients.map((ic) => ({
              ingredientId: ic.ingredientId,
              qty: ic.qty,
              unit: ic.unit,
              wastePct: ic.wastePct,
            })),
          }));
        } catch {
          // ignore optimistic normalize error — BE sẽ trả lỗi, UI vẫn giữ data cũ
        }

        next.notes = typeof form?.notes === "string" ? form.notes : next.notes;
        next.isActive = form?.isActive ?? next.isActive;

        return next;
      })
    );
  }, []);

  // ===== CRUD =====
  const addRecipe = useCallback(
    async (form) => {
      if (!restaurantId) throw new Error("restaurantId is required");
      const menuItemId = form?.menuItemId || form?.id || form?.menuItem?.id;
      if (!menuItemId) throw new Error("menuItemId is required");

      setLocalError(null);

      // optimistic
      applyOptimisticUpsert(menuItemId, form);

      // update menu item (optional)
      const miPatch = buildMenuItemPatch(restaurantId, menuItemId, form);
      if (miPatch) {
        await updateMenuItemMu({ variables: { input: miPatch } });
      }

      // upsert recipe
      const input = buildUpsertInput(restaurantId, menuItemId, form);
      await upsertMu({ variables: { input } });

      await safeRefetchAll();
    },
    [
      restaurantId,
      applyOptimisticUpsert,
      updateMenuItemMu,
      upsertMu,
      safeRefetchAll,
    ]
  );

  const updateRecipe = useCallback(
    async (menuItemId, form) => {
      if (!restaurantId) throw new Error("restaurantId is required");
      if (!menuItemId) throw new Error("menuItemId is required");

      setLocalError(null);

      // optimistic
      applyOptimisticUpsert(menuItemId, form);

      const miPatch = buildMenuItemPatch(restaurantId, menuItemId, form);
      if (miPatch) {
        await updateMenuItemMu({ variables: { input: miPatch } });
      }

      const input = buildUpsertInput(restaurantId, menuItemId, form);
      await upsertMu({ variables: { input } });

      await safeRefetchAll();
    },
    [
      restaurantId,
      applyOptimisticUpsert,
      updateMenuItemMu,
      upsertMu,
      safeRefetchAll,
    ]
  );

  const deleteRecipe = useCallback(
    async (menuItemId) => {
      if (!restaurantId) throw new Error("restaurantId is required");
      if (!menuItemId) throw new Error("menuItemId is required");

      setLocalError(null);

      // optimistic remove recipe only (không xoá menuItem)
      setRecipes((prev) =>
        prev.map((r) =>
          String(r.id) === String(menuItemId)
            ? {
                ...r,
                servingVariants: [],
                notes: "",
                _rawRecipeId: null,
                _rawRecipe: null,
              }
            : r
        )
      );

      await deleteMu({ variables: { restaurantId, menuItemId } });
      await safeRefetchAll();
    },
    [restaurantId, deleteMu, safeRefetchAll]
  );

  // ===== Optional: client-side filters (nếu bạn muốn) =====
  const filteredRecipes = useMemo(() => {
    // server đã filter search/category/timeSlot rồi.
    // giữ đây để tương tự useIngredients, và sau này nếu muốn filter local thêm.
    return recipes;
  }, [recipes]);

  // ===== Extra helpers =====
  const getDefaultVariant = useCallback((recipe) => {
    const arr = Array.isArray(recipe?.servingVariants)
      ? recipe.servingVariants
      : [];
    return arr.find((v) => v?.isDefault) || arr[0] || null;
  }, []);

  return {
    // like useIngredients
    loading,
    error,

    recipes,
    filteredRecipes,

    filters,
    setFilters,

    total,
    pageInfo,

    loadMore,
    refresh: safeRefetchAll,
    refetch: safeRefetchAll, // alias

    addRecipe,
    updateRecipe,
    deleteRecipe,

    // helpers exposed (optional)
    genStableKey,
    getDefaultVariant,
  };
}
