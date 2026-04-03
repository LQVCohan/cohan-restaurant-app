// src/hooks/useIngredients.js
import { useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useApolloClient } from "@apollo/client";
import {
  INGREDIENTS_QUERY,
  CREATE_INGREDIENT,
  UPDATE_INGREDIENT,
  DELETE_INGREDIENT,
  WAREHOUSES_QUERY,
  STOCK_ITEMS_QUERY,
  ADJUST_STOCK,
  RECEIVE_STOCK,
  INGREDIENT_PRICE_SUGGESTIONS,
} from "@/components/Dashboard_Manager/Storage/graphql/inventory.gql";
import { toBaseQty } from "@/utils/unitConversion";

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

  // ===== 1) Ingredients =====
  const {
    data: ingData,
    loading: ingLoading,
    error: ingError,
    refetch: refetchIngredients,
  } = useQuery(INGREDIENTS_QUERY, {
    variables: {
      restaurantId,
      search: filters.search?.trim() ? filters.search.trim() : null,
      limit: 200,
    },
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
        category: it.category || "",

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
      const cat = filters.category.trim().toLowerCase();
      arr = arr.filter((i) => (i.category || "").toLowerCase() === cat);
    }

    if (filters.status) {
      arr = arr.filter((i) => getStockStatus(i).key === filters.status);
    }

    return arr;
  }, [ingredientsMapped, filters.category, filters.status, getStockStatus]);

  // ===== 9) Mutations =====
  const [createIngredientMu] = useMutation(CREATE_INGREDIENT);
  const [updateIngredientMu] = useMutation(UPDATE_INGREDIENT);
  const [deleteIngredientMu] = useMutation(DELETE_INGREDIENT);
  const [adjustStockMu] = useMutation(ADJUST_STOCK);
  const [receiveStockMu] = useMutation(RECEIVE_STOCK);

  const safeRefetchAll = useCallback(async () => {
    await Promise.allSettled([
      refetchIngredients?.(),
      withStock ? refetchStock?.() : Promise.resolve(),
    ]);
  }, [refetchIngredients, refetchStock, withStock]);

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

      // init stock (nhập tồn ban đầu phải có giá nhập)
      const qty0 = Number(initialStockQty) || 0;
      if (qty0 > 0 && withStock) {
        const wid = assertWarehouseForStock();
        const intQty = Math.round(qty0); // BE: integer
        const initCost = Number(payload.costPerBaseUnit);
        if (!Number.isFinite(initCost) || initCost <= 0) {
          throw new Error(
            "Nhập tồn ban đầu bắt buộc có giá nhập > 0 (cost per base unit)."
          );
        }
        if (intQty > 0 && createdId) {
          await receiveStockMu({
            variables: {
              restaurantId,
              warehouseId: wid,
              ingredientId: createdId,
              qty: intQty,
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
      await deleteIngredientMu({ variables: { id } });
      await safeRefetchAll();
    },
    [deleteIngredientMu, safeRefetchAll]
  );

  const addStock = useCallback(
    async (ingredientId, qty, reason = "Nhập bổ sung") => {
      if (!withStock)
        throw new Error("withStock=false: không hỗ trợ nhập kho.");

      const wid = assertWarehouseForStock();

      const q = Number(qty);
      if (!Number.isFinite(q) || q <= 0) return;

      const intQty = Math.round(q); // BE integer
      if (intQty === 0) return;

      await adjustStockMu({
        variables: {
          restaurantId,
          warehouseId: wid,
          ingredientId,
          qty: Math.abs(intQty),
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

      const qtyNum = Number(qty);
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        throw new Error("Số lượng nhập phải > 0.");
      }

      const unitPriceNum = Number(unitPrice);
      if (!Number.isFinite(unitPriceNum) || unitPriceNum <= 0) {
        throw new Error("Giá nhập là bắt buộc và phải > 0.");
      }

      const fromUnit = unit || ing.baseUnit;
      const qtyBaseRaw = toBaseQty(qtyNum, fromUnit, ing.baseUnit);
      const qtyBase = Math.round(qtyBaseRaw);
      if (!Number.isFinite(qtyBase) || qtyBase <= 0) {
        throw new Error("Số lượng quy đổi về đơn vị gốc không hợp lệ.");
      }

      const costPerBaseUnit = unitPriceNum / qtyBaseRaw;
      if (!Number.isFinite(costPerBaseUnit) || costPerBaseUnit <= 0) {
        throw new Error("Không thể tính giá theo đơn vị gốc.");
      }

      await receiveStockMu({
        variables: {
          restaurantId,
          warehouseId: wid,
          ingredientId,
          qty: qtyBase,
          costPerBaseUnit,
          reason: reason || "Nhập kho",
          lot: lot || null,
          expiry: expiry || null,
          supplierNote: supplierNote || null,
        },
      });

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
    filteredIngredients,
    stockItems,

    // ui filters
    filters,
    setFilters,

    // actions
    addIngredient,
    updateIngredient,
    deleteIngredient,
    addStock,
    receiveStock,
    getPriceSuggestions,
    updateCostPerBaseUnit,

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
