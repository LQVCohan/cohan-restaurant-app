// src/hooks/useIngredients.js
import { useMemo, useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useApolloClient } from "@apollo/client";
import {
  INGREDIENTS_QUERY,
  INGREDIENT_TRASH_QUERY,
  INGREDIENT_CATEGORIES_QUERY,
  INGREDIENT_CATEGORY_SYNC_LOGS_QUERY,
  CREATE_INGREDIENT_CATEGORY,
  UPDATE_INGREDIENT_CATEGORY,
  DELETE_INGREDIENT_CATEGORY,
  SYNC_INGREDIENT_CATEGORIES,
  CREATE_INGREDIENT,
  UPDATE_INGREDIENT,
  DELETE_INGREDIENT,
  RESTORE_INGREDIENT,
  DELETE_INGREDIENT_PERMANENTLY,
  WAREHOUSES_QUERY,
  STOCK_ITEMS_QUERY,
  ADJUST_STOCK,
  RECEIVE_STOCK,
  INGREDIENT_PRICE_SUGGESTIONS,
} from "@/components/Dashboard_Manager/Storage/graphql/inventory.gql";
import {
  calculateStockReceipt,
  roundUnitQuantity,
} from "@/utils/unitConversion";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseLocalDateOnly = (value) => {
  if (!DATE_ONLY_RE.test(value || "")) return null;
  const [y, m, d] = value.split("-").map((v) => Number(v));
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
};

const normalizeExpiryForMutation = (expiry) => {
  if (expiry == null || expiry === "") return null;
  const raw = String(expiry).trim();
  if (!raw) return null;

  if (DATE_ONLY_RE.test(raw)) {
    const localDate = parseLocalDateOnly(raw);
    if (!localDate) {
      throw new Error("Hạn dùng không hợp lệ. Vui lòng chọn đúng ngày.");
    }
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (localDate.getTime() < todayStart.getTime()) {
      throw new Error("Hạn dùng không được ở trong quá khứ.");
    }
    return localDate.toISOString();
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Hạn dùng không hợp lệ. Vui lòng chọn đúng ngày.");
  }
  return parsed.toISOString();
};

/**
 * useIngredients (SINGLE SOURCE OF TRUTH)
 *
 * restaurantId: bắt buộc
 * selectedWarehouseId:
 *   - undefined: chưa init -> auto pick kho đầu tiên (nếu có)
 *   - null: tất cả kho (KHÔNG auto pick) -> chỉ xem, không nhập kho / nhập tồn ban đầu
 *   - string: 1 kho cụ thể
 *
 * options:
 *  - withStock: default true  (tab recipes có thể dùng false)
 *  - withWarehouses: default true
 */
export function useIngredients(
  restaurantId,
  selectedWarehouseId = undefined,
  options = {}
) {
  const { withStock = true, withWarehouses = true } = options;
  const apolloClient = useApolloClient();

  const [filters, setFilters] = useState({
    search: "",
    category: "",
    status: "", // "", "in-stock", "low-stock", "out-of-stock"
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(filters.search || "");
    }, 250);

    return () => clearTimeout(handle);
  }, [filters.search]);

  // ===== 1) Ingredients =====
  const {
    data: ingData,
    loading: ingLoading,
    error: ingError,
    refetch: refetchIngredients,
  } = useQuery(INGREDIENTS_QUERY, {
    variables: {
      restaurantId,
      search: debouncedSearch?.trim() ? debouncedSearch.trim() : null,
      limit: 200,
      includeDeleted: false,
    },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const {
    data: categoryData,
    refetch: refetchCategories,
  } = useQuery(INGREDIENT_CATEGORIES_QUERY, {
    variables: { restaurantId, includeInactive: false, limit: 200 },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const {
    data: syncLogsData,
    refetch: refetchSyncLogs,
  } = useQuery(INGREDIENT_CATEGORY_SYNC_LOGS_QUERY, {
    variables: { restaurantId, limit: 10 },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  // ===== 2) Warehouses (optional) =====
  const {
    data: whData,
    loading: whLoading,
    error: whError,
  } = useQuery(WAREHOUSES_QUERY, {
    variables: { restaurantId },
    skip: !restaurantId || !withWarehouses,
    fetchPolicy: "cache-and-network",
  });

  const warehouses = useMemo(() => whData?.warehouses || [], [whData]);

  // ===== 3) Resolve warehouse mode =====
  // - undefined: auto pick kho đầu (nếu có)
  // - null: tất cả kho
  // - string: kho cụ thể
  const effectiveWarehouseId = useMemo(() => {
    if (selectedWarehouseId === null) return null; // all warehouses
    if (typeof selectedWarehouseId === "string") return selectedWarehouseId;

    // selectedWarehouseId === undefined -> auto pick kho đầu
    if (warehouses.length) return warehouses[0].id;
    return undefined; // chưa có kho
  }, [selectedWarehouseId, warehouses]);

  // ===== 4) StockItems (optional) =====
  const {
    data: stockData,
    loading: stockLoading,
    error: stockError,
    refetch: refetchStock,
  } = useQuery(STOCK_ITEMS_QUERY, {
    variables: {
      restaurantId,
      warehouseId:
        // null = all, string = specific, undefined = chưa có kho (skip)
        effectiveWarehouseId === undefined ? null : effectiveWarehouseId,
      limit: 500,
    },
    skip: !restaurantId || !withStock || effectiveWarehouseId === undefined,
    fetchPolicy: "cache-and-network",
  });

  const ingredientsRaw = useMemo(() => ingData?.ingredients || [], [ingData]);
  const {
    data: trashData,
    refetch: refetchIngredientTrash,
  } = useQuery(INGREDIENT_TRASH_QUERY, {
    variables: { restaurantId, limit: 500 },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const ingredientTrashRaw = useMemo(
    () => trashData?.ingredientTrash || [],
    [trashData]
  );
  const ingredientCategories = useMemo(
    () => categoryData?.ingredientCategories || [],
    [categoryData],
  );
  const ingredientCategorySyncLogs = useMemo(
    () => syncLogsData?.ingredientCategorySyncLogs || [],
    [syncLogsData],
  );
  const stockItems = useMemo(() => stockData?.stockItems || [], [stockData]);

  // ===== 5) Aggregate stock per ingredientId =====
  // AVAILABLE = onHand - reserved
  const stockAggByIngredient = useMemo(() => {
    const map = new Map();
    if (!withStock) return map;

    for (const s of stockItems) {
      const key = s.ingredientId;
      const onHand = Number(s.onHand) || 0;
      const reserved = Number(s.reserved) || 0;

      const prev = map.get(key) || { onHand: 0, reserved: 0, available: 0 };
      const next = {
        onHand: prev.onHand + onHand,
        reserved: prev.reserved + reserved,
        available: prev.available + (onHand - reserved),
      };
      map.set(key, next);
    }

    return map;
  }, [stockItems, withStock]);

  // ===== 6) UI Mapping (chuẩn hoá field) =====
  const ingredientsMapped = useMemo(() => {
    return ingredientsRaw.map((it) => {
      const agg = stockAggByIngredient.get(it.id) || {
        onHand: 0,
        reserved: 0,
        available: 0,
      };

      return {
        id: it.id,
        restaurantId: it.restaurantId,
        name: it.name,
        sku: it.sku || "",
        category:
          it.ingredientCategory?.name || it.category || "",
        ingredientCategoryId:
          it.ingredientCategoryId || it.ingredientCategory?.id || null,

        baseUnit: it.baseUnit,
        conversions: it.conversions || [],

        costPerBaseUnit: Number(it.costPerBaseUnit) || 0,
        photos: it.photos || [],
        minStock: Number(it.minStock) || 0,
        notes: it.notes || "",
        isActive: it.isActive ?? true,

        // stock
        onHand: agg.onHand,
        reserved: agg.reserved,
        availableStock: agg.available, // canonical
        // icons
        icon: categoryIcon(it.category),
        _raw: it,
      };
    });
  }, [ingredientsRaw, stockAggByIngredient]);

  // ===== 7) Status helper =====
  const getStockStatus = useCallback((ingredient) => {
    const avail = Number(ingredient.availableStock) || 0;
    const min = Number(ingredient.minStock) || 0;

    if (avail <= 0)
      return { key: "out-of-stock", class: "danger", text: "Hết hàng" };
    if (avail <= min)
      return { key: "low-stock", class: "warning", text: "Sắp hết" };
    return { key: "in-stock", class: "success", text: "Còn hàng" };
  }, []);

  // ===== 8) UI filters (category/status) =====
  const filteredIngredients = useMemo(() => {
    let arr = ingredientsMapped;

    if (filters.category?.trim()) {
      const categoryId = filters.category.trim();
      arr = arr.filter((i) => String(i.ingredientCategoryId || "") === categoryId);
    }

    if (filters.status) {
      arr = arr.filter((i) => getStockStatus(i).key === filters.status);
    }

    return arr;
  }, [ingredientsMapped, filters.category, filters.status, getStockStatus]);

  // ===== 9) Mutations =====
  const [createIngredientMu] = useMutation(CREATE_INGREDIENT);
  const [createIngredientCategoryMu] = useMutation(CREATE_INGREDIENT_CATEGORY);
  const [updateIngredientCategoryMu] = useMutation(UPDATE_INGREDIENT_CATEGORY);
  const [deleteIngredientCategoryMu] = useMutation(DELETE_INGREDIENT_CATEGORY);
  const [syncIngredientCategoriesMu] = useMutation(SYNC_INGREDIENT_CATEGORIES);
  const [updateIngredientMu] = useMutation(UPDATE_INGREDIENT);
  const [deleteIngredientMu] = useMutation(DELETE_INGREDIENT);
  const [restoreIngredientMu] = useMutation(RESTORE_INGREDIENT);
  const [deleteIngredientPermanentlyMu] = useMutation(
    DELETE_INGREDIENT_PERMANENTLY
  );
  const [adjustStockMu] = useMutation(ADJUST_STOCK);
  const [receiveStockMu] = useMutation(RECEIVE_STOCK);

  const safeRefetchAll = useCallback(async () => {
    await Promise.allSettled([
      refetchIngredients?.(),
      refetchIngredientTrash?.(),
      refetchCategories?.(),
      withStock ? refetchStock?.() : Promise.resolve(),
    ]);
  }, [
    refetchIngredients,
    refetchIngredientTrash,
    refetchCategories,
    refetchStock,
    withStock,
  ]);

  const createIngredientCategory = useCallback(
    async (name) => {
      if (!restaurantId) throw new Error("restaurantId is required");
      const res = await createIngredientCategoryMu({
        variables: { input: { restaurantId, name } },
      });
      await refetchCategories?.();
      return res?.data?.createIngredientCategory || null;
    },
    [createIngredientCategoryMu, restaurantId, refetchCategories],
  );

  const updateIngredientCategory = useCallback(
    async (id, patch) => {
      await updateIngredientCategoryMu({
        variables: { input: { id, ...patch } },
      });
      await refetchCategories?.();
    },
    [updateIngredientCategoryMu, refetchCategories],
  );

  const deleteIngredientCategory = useCallback(
    async (id) => {
      await deleteIngredientCategoryMu({ variables: { id } });
      await refetchCategories?.();
    },
    [deleteIngredientCategoryMu, refetchCategories],
  );

  const syncIngredientCategories = useCallback(async () => {
    if (!restaurantId) throw new Error("restaurantId is required");
    const res = await syncIngredientCategoriesMu({ variables: { restaurantId } });
    await Promise.all([
      refetchCategories?.(),
      refetchIngredients?.(),
      refetchSyncLogs?.(),
    ]);
    return res?.data?.syncIngredientCategories || null;
  }, [
    restaurantId,
    syncIngredientCategoriesMu,
    refetchCategories,
    refetchIngredients,
    refetchSyncLogs,
  ]);

  const assertWarehouseForStock = useCallback(() => {
    // null => all warehouses (không được nhập kho)
    if (effectiveWarehouseId === null) {
      throw new Error(
        "Bạn đang ở chế độ 'Tất cả kho'. Hãy chọn 1 kho cụ thể để nhập kho / nhập tồn."
      );
    }
    // undefined => chưa có kho
    if (effectiveWarehouseId === undefined) {
      throw new Error("Chưa có kho. Hãy tạo kho trước khi nhập hàng.");
    }
    return effectiveWarehouseId; // string
  }, [effectiveWarehouseId]);

  const addIngredient = useCallback(
    async ({ payload, initialStockQty }) => {
      if (!restaurantId) throw new Error("restaurantId is required");

      const res = await createIngredientMu({
        variables: {
          input: {
            restaurantId,
            name: payload.name,
            sku: payload.sku || null,
            category: payload.category || "",
            ingredientCategoryId: payload.ingredientCategoryId || null,
            baseUnit: payload.baseUnit,
            conversions: payload.conversions || [],
            costPerBaseUnit: Number(payload.costPerBaseUnit) || 0,
            photos: payload.photos || [],
            minStock: Number(payload.minStock) || 0,
            notes: payload.notes || "",
            isActive: payload.isActive ?? true,
          },
        },
      });

      const created = res?.data?.createIngredient;
      const createdId = created?.id;

      // init stock is already entered in the ingredient base unit.
      const qty0 = roundUnitQuantity(initialStockQty);
      if (qty0 > 0 && withStock) {
        const wid = assertWarehouseForStock();
        const initCost = Number(payload.costPerBaseUnit);
        if (!Number.isFinite(initCost) || initCost <= 0) {
          throw new Error(
            "Nhập tồn ban đầu bắt buộc có giá nhập > 0 (cost per base unit)."
          );
        }
        if (createdId) {
          await receiveStockMu({
            variables: {
              restaurantId,
              warehouseId: wid,
              ingredientId: createdId,
              qty: qty0,
              costPerBaseUnit: initCost,
              reason: "Nhập tồn ban đầu",
              lot: "INIT",
            },
          });
        }
      }

      await safeRefetchAll();
      return { createdId, created };
    },
    [
      restaurantId,
      withStock,
      createIngredientMu,
      receiveStockMu,
      assertWarehouseForStock,
      safeRefetchAll,
    ]
  );

  const updateIngredient = useCallback(
    async (id, { payload }) => {
      // ⚠️ BE chặn update nếu ingredient đang trong active orders
      // -> FE chỉ cần show đúng message BE trả
      await updateIngredientMu({
        variables: {
          input: {
            id,
            name: payload.name,
            sku: payload.sku || null,
            category: payload.category || "",
            ingredientCategoryId: payload.ingredientCategoryId || null,
            baseUnit: payload.baseUnit,
            conversions: payload.conversions || [],
            costPerBaseUnit: Number(payload.costPerBaseUnit) || 0,
            photos: payload.photos || [],
            minStock: Number(payload.minStock) || 0,
            notes: payload.notes || "",
            isActive: !!payload.isActive,
          },
        },
      });

      await safeRefetchAll();
    },
    [updateIngredientMu, safeRefetchAll]
  );

  const deleteIngredient = useCallback(
    async (id) => {
      const res = await deleteIngredientMu({ variables: { id } });
      await safeRefetchAll();
      return res?.data?.deleteIngredient ?? false;
    },
    [deleteIngredientMu, safeRefetchAll]
  );

  const restoreIngredient = useCallback(
    async (id) => {
      const res = await restoreIngredientMu({ variables: { id } });
      await safeRefetchAll();
      return res?.data?.restoreIngredient || null;
    },
    [restoreIngredientMu, safeRefetchAll]
  );

  const deleteIngredientPermanently = useCallback(
    async (id) => {
      const res = await deleteIngredientPermanentlyMu({ variables: { id } });
      await safeRefetchAll();
      return res?.data?.deleteIngredientPermanently ?? false;
    },
    [deleteIngredientPermanentlyMu, safeRefetchAll]
  );

  const addStock = useCallback(
    async (ingredientId, qty, reason = "Nhập bổ sung") => {
      if (!withStock)
        throw new Error("withStock=false: không hỗ trợ nhập kho.");

      const wid = assertWarehouseForStock();
      const normalizedQty = roundUnitQuantity(Math.abs(Number(qty)));
      if (!Number.isFinite(normalizedQty) || normalizedQty <= 0) return;

      await adjustStockMu({
        variables: {
          restaurantId,
          warehouseId: wid,
          ingredientId,
          qty: normalizedQty,
          reason,
        },
      });

      await refetchStock?.();
    },
    [
      restaurantId,
      withStock,
      assertWarehouseForStock,
      adjustStockMu,
      refetchStock,
    ]
  );

  const receiveStock = useCallback(
    async (
      ingredientId,
      { qty, unit, unitPrice, reason, lot, expiry, supplierNote } = {}
    ) => {
      if (!withStock)
        throw new Error("withStock=false: không hỗ trợ nhập kho.");

      const wid = assertWarehouseForStock();
      const ing = ingredientsMapped.find((x) => String(x.id) === String(ingredientId));
      if (!ing) throw new Error("Không tìm thấy nguyên liệu.");

      const { qtyBase, costPerBaseUnit } = calculateStockReceipt({
        qty,
        unit: unit || ing.baseUnit,
        unitPrice,
        baseUnit: ing.baseUnit,
        conversions: ing.conversions || [],
      });
      const normalizedExpiry = normalizeExpiryForMutation(expiry);

      try {
        await receiveStockMu({
          variables: {
            restaurantId,
            warehouseId: wid,
            ingredientId,
            qty: qtyBase,
            costPerBaseUnit,
            reason: reason || "Nhập kho",
            lot: lot || null,
            expiry: normalizedExpiry,
            supplierNote: supplierNote || null,
          },
        });
      } catch (err) {
        const message = err?.message || "";
        if (message.includes("DateTime cannot represent")) {
          throw new Error(
            "Hạn dùng không hợp lệ. Vui lòng chọn ngày hết hạn theo định dạng YYYY-MM-DD."
          );
        }
        throw err;
      }

      await safeRefetchAll();
      return {
        qtyBase,
        costPerBaseUnit,
      };
    },
    [
      withStock,
      assertWarehouseForStock,
      ingredientsMapped,
      receiveStockMu,
      restaurantId,
      safeRefetchAll,
    ]
  );

  const getPriceSuggestions = useCallback(
    async (ingredientId, limit = 5) => {
      if (!restaurantId || !ingredientId) return null;
      const res = await apolloClient.query({
        query: INGREDIENT_PRICE_SUGGESTIONS,
        variables: { restaurantId, ingredientId, limit },
        fetchPolicy: "network-only",
      });
      return res?.data?.ingredientPriceSuggestions || null;
    },
    [apolloClient, restaurantId]
  );

  // Update giá nhập nhanh (costPerBaseUnit) – vẫn đi qua updateIngredient (BE sẽ chặn nếu active order)
  const updateCostPerBaseUnit = useCallback(
    async (ingredientId, nextCost) => {
      const ing = ingredientsMapped.find((x) => x.id === ingredientId);
      if (!ing) throw new Error("Ingredient not found in cache");

      await updateIngredient(ingredientId, {
        payload: {
          name: ing.name,
          sku: ing.sku || null,
          category: ing.category || "",
          ingredientCategoryId: ing.ingredientCategoryId || null,
          baseUnit: ing.baseUnit,
          conversions: ing.conversions || [],
          photos: ing.photos || [],
          minStock: Number(ing.minStock) || 0,
          notes: ing.notes || "",
          isActive: ing.isActive ?? true,
          costPerBaseUnit: Number(nextCost) || 0,
        },
      });
    },
    [ingredientsMapped, updateIngredient]
  );

  return {
    // status
    loading:
      ingLoading ||
      (withWarehouses ? whLoading : false) ||
      (withStock ? stockLoading : false),
    error: ingError || whError || stockError,

    // data
    warehouses,
    effectiveWarehouseId, // string | null | undefined
    ingredients: ingredientsMapped,
    ingredientCategories,
    ingredientCategorySyncLogs,
    filteredIngredients,
    ingredientTrash: ingredientTrashRaw,
    stockItems,

    // ui filters
    filters,
    setFilters,

    // actions
    addIngredient,
    updateIngredient,
    deleteIngredient,
    restoreIngredient,
    deleteIngredientPermanently,
    addStock,
    receiveStock,
    getPriceSuggestions,
    updateCostPerBaseUnit,
    createIngredientCategory,
    updateIngredientCategory,
    deleteIngredientCategory,
    syncIngredientCategories,

    // helpers
    getStockStatus,
    refetch: safeRefetchAll,
  };
}

function categoryIcon(category) {
  const icons = {
    meat: "🥩",
    vegetable: "🥬",
    spice: "🧂",
    dairy: "🥛",
    grain: "🌾",
    others: "📦",
  };
  return icons[(category || "").toLowerCase()] || "📦";
}
