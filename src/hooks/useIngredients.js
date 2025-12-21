// src/hooks/useIngredients.js
import { useMemo, useState, useCallback } from "react";
import { useQuery, useMutation } from "@apollo/client";
import {
  INGREDIENTS_QUERY,
  CREATE_INGREDIENT,
  UPDATE_INGREDIENT,
  DELETE_INGREDIENT,
  WAREHOUSES_QUERY,
  STOCK_ITEMS_QUERY,
  ADJUST_STOCK,
} from "../components/Dashboard_Manager/Storage/graphql/inventory.gql";

/**
 * Dùng cho màn Nguyên liệu.
 * - restaurantId: bắt buộc
 * - selectedWarehouseId:
 *   - nếu truyền → tồn theo kho này
 *   - nếu null → gộp tất cả kho
 * NOTE: tồn khả dụng = onHand - reserved
 */
export function useIngredients(restaurantId, selectedWarehouseId = null) {
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    status: "", // "", "in-stock", "low-stock", "out-of-stock"
  });

  // 1) Ingredients
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

  // 2) Warehouses (để lấy kho mặc định khi nhập tồn ban đầu / addStock)
  const { data: whData, loading: whLoading } = useQuery(WAREHOUSES_QUERY, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  // 3) StockItems để tính tồn hiện tại theo nguyên liệu
  const {
    data: stockData,
    loading: stockLoading,
    refetch: refetchStock,
  } = useQuery(STOCK_ITEMS_QUERY, {
    variables: {
      restaurantId,
      warehouseId: selectedWarehouseId || null,
      limit: 500,
    },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const ingredientsRaw = ingData?.ingredients || [];
  const warehouses = whData?.warehouses || [];
  const stockItems = stockData?.stockItems || [];

  // Kho mặc định: kho đầu tiên (đúng flow bạn chốt)
  const defaultWarehouseId = useMemo(() => {
    if (selectedWarehouseId) return selectedWarehouseId;
    return warehouses?.[0]?.id || null;
  }, [selectedWarehouseId, warehouses]);

  // index tồn theo ingredientId (tính AVAILABLE = onHand - reserved)
  const stockAggByIngredient = useMemo(() => {
    const map = new Map();
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
  }, [stockItems]);

  // Map → shape UI (vẫn giữ alias unit/costPrice để UI cũ không vỡ)
  const ingredientsMapped = useMemo(() => {
    return ingredientsRaw.map((it) => {
      const agg = stockAggByIngredient.get(it.id) || {
        onHand: 0,
        reserved: 0,
        available: 0,
      };

      return {
        id: it.id,
        name: it.name,
        sku: it.sku || "",
        category: it.category || "",
        baseUnit: it.baseUnit, // chuẩn
        unit: it.baseUnit, // alias UI cũ
        costPerBaseUnit: Number(it.costPerBaseUnit) || 0, // chuẩn
        costPrice: Number(it.costPerBaseUnit) || 0, // alias UI cũ

        minStock: Number(it.minStock) || 0,
        notes: it.notes || "",
        isActive: it.isActive ?? true,

        // tồn kho
        onHand: agg.onHand,
        reserved: agg.reserved,
        availableStock: agg.available,
        currentStock: agg.available, // alias UI cũ

        icon: categoryIcon(it.category),
        _raw: it,
      };
    });
  }, [ingredientsRaw, stockAggByIngredient]);

  // Lọc UI-level (category, status)
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
  }, [ingredientsMapped, filters.category, filters.status]);

  // ==== Mutations ====
  const [createIngredientMu] = useMutation(CREATE_INGREDIENT);
  const [updateIngredientMu] = useMutation(UPDATE_INGREDIENT);
  const [deleteIngredientMu] = useMutation(DELETE_INGREDIENT);
  const [adjustStockMu] = useMutation(ADJUST_STOCK);

  const safeRefetchAll = useCallback(async () => {
    await Promise.allSettled([refetchIngredients(), refetchStock()]);
  }, [refetchIngredients, refetchStock]);

  const addIngredient = useCallback(
    async ({ payload, initialStockQty }) => {
      if (!restaurantId) throw new Error("restaurantId is required");

      // 1) tạo ingredient
      const res = await createIngredientMu({
        variables: {
          input: {
            restaurantId,
            name: payload.name,
            sku: payload.sku || null,
            category: payload.category || "",
            baseUnit: payload.baseUnit,
            costPerBaseUnit: Number(payload.costPerBaseUnit) || 0,
            minStock: Number(payload.minStock) || 0,
            notes: payload.notes || "",
            isActive: payload.isActive ?? true,
            conversions: payload.conversions || [],
            photos: payload.photos || [],
          },
        },
      });

      const created = res?.data?.createIngredient;
      const createdId = created?.id;

      // 2) nhập tồn ban đầu (nếu có kho)
      const qty0 = Number(initialStockQty) || 0;
      if (qty0 > 0) {
        if (!defaultWarehouseId) {
          // Không có kho → không thể lưu tồn ban đầu
          // (không throw để vẫn tạo được ingredient)
          console.warn("No warehouse available to save initial stock");
        } else if (createdId) {
          await adjustStockMu({
            variables: {
              restaurantId,
              warehouseId: defaultWarehouseId,
              ingredientId: createdId,
              qty: Math.abs(qty0),
              reason: "Nhập tồn ban đầu",
            },
          });
        }
      }

      // 3) refetch để UI không bị “đơ”
      await safeRefetchAll();

      return { createdId, created };
    },
    [
      restaurantId,
      createIngredientMu,
      adjustStockMu,
      defaultWarehouseId,
      safeRefetchAll,
    ]
  );

  const updateIngredient = useCallback(
    async (id, { payload }) => {
      await updateIngredientMu({
        variables: {
          input: {
            id,
            name: payload.name,
            sku: payload.sku || null,
            category: payload.category || "",
            baseUnit: payload.baseUnit,
            costPerBaseUnit: Number(payload.costPerBaseUnit) || 0,
            minStock: Number(payload.minStock) || 0,
            notes: payload.notes || "",
            isActive: !!payload.isActive,
            conversions: payload.conversions || [],
            photos: payload.photos || [],
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

  /**
   * addStock: +qty vào kho
   * - Nếu có selectedWarehouseId → dùng luôn
   * - Nếu không → mặc định kho đầu tiên
   */
  const addStock = useCallback(
    async (ingredientId, qty, reason = "Nhập bổ sung") => {
      const warehouseId = defaultWarehouseId;
      if (!warehouseId) {
        alert("Chưa có kho. Hãy tạo kho trước khi nhập hàng.");
        return;
      }

      const q = Number(qty);
      if (!Number.isFinite(q) || q <= 0) return;

      await adjustStockMu({
        variables: {
          restaurantId,
          warehouseId,
          ingredientId,
          qty: Math.abs(q),
          reason,
        },
      });

      await refetchStock();
    },
    [restaurantId, defaultWarehouseId, adjustStockMu, refetchStock]
  );

  // Status dựa vào tồn khả dụng
  const getStockStatus = (ingredient) => {
    const avail =
      Number(ingredient.availableStock ?? ingredient.currentStock) || 0;
    const min = Number(ingredient.minStock) || 0;

    if (avail <= 0)
      return { key: "out-of-stock", class: "danger", text: "Hết hàng" };
    if (avail <= min)
      return { key: "low-stock", class: "warning", text: "Sắp hết" };
    return { key: "in-stock", class: "success", text: "Còn hàng" };
  };

  return {
    loading: ingLoading || whLoading || stockLoading,
    error: ingError,
    ingredients: ingredientsMapped,
    filteredIngredients,
    filters,
    setFilters,

    warehouses,
    defaultWarehouseId,

    addIngredient,
    updateIngredient,
    deleteIngredient,
    addStock,
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
  };
  return icons[(category || "").toLowerCase()] || "📦";
}
