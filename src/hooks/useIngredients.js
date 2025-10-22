// src/hooks/useIngredients.js
import { useMemo, useState } from "react";
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
 * - selectedWarehouseId: nếu truyền → currentStock sẽ tính riêng theo kho này; nếu không → gộp tất cả kho
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
      search: filters.search || null,
      limit: 200,
    },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  // 2) Warehouses (để có thể lấy kho mặc định khi addStock)
  const { data: whData } = useQuery(WAREHOUSES_QUERY, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  // 3) StockItems để tính tồn hiện tại theo nguyên liệu
  const { data: stockData, refetch: refetchStock } = useQuery(
    STOCK_ITEMS_QUERY,
    {
      variables: {
        restaurantId,
        warehouseId: selectedWarehouseId || null,
        limit: 500,
      },
      skip: !restaurantId,
      fetchPolicy: "cache-and-network",
    }
  );

  const ingredientsRaw = ingData?.ingredients || [];
  const warehouses = whData?.warehouses || [];
  const stockItems = stockData?.stockItems || [];

  // index tồn theo ingredientId
  const stockByIngredient = useMemo(() => {
    const map = new Map();
    for (const s of stockItems) {
      const key = s.ingredientId;
      const prev = map.get(key) || 0;
      map.set(key, prev + (Number(s.onHand) || 0));
    }
    return map;
  }, [stockItems]);

  // Map → shape UI
  const ingredientsMapped = useMemo(() => {
    return ingredientsRaw.map((it) => {
      const currentStock = stockByIngredient.get(it.id) ?? 0;
      return {
        id: it.id,
        name: it.name,
        category: it.category || "", // UI đang dùng text
        unit: it.baseUnit, // map baseUnit → unit
        currentStock, // tính từ stockItems
        minStock: it.minStock ?? 0,
        costPrice: it.costPerBaseUnit ?? 0, // map costPerBaseUnit → costPrice
        supplier: "", // schema chưa có, để trống nếu UI cần
        notes: it.notes || "",
        icon: categoryIcon(it.category),
        isActive: it.isActive ?? true,
        _raw: it,
      };
    });
  }, [ingredientsRaw, stockByIngredient]);

  // Lọc UI-level (category, status)
  const filteredIngredients = useMemo(() => {
    let arr = ingredientsMapped;

    if (filters.category) {
      arr = arr.filter(
        (i) =>
          (i.category || "").toLowerCase() === filters.category.toLowerCase()
      );
    }

    if (filters.status) {
      arr = arr.filter((i) => getStockStatus(i).key === filters.status);
    }

    return arr;
  }, [ingredientsMapped, filters.category, filters.status]);

  // ==== Mutations ====
  const [createIngredient] = useMutation(CREATE_INGREDIENT);
  const [updateIngredientMu] = useMutation(UPDATE_INGREDIENT);
  const [deleteIngredientMu] = useMutation(DELETE_INGREDIENT);
  const [adjustStock] = useMutation(ADJUST_STOCK);

  const addIngredient = async (payload) => {
    const res = await createIngredient({
      variables: {
        input: {
          restaurantId,
          name: payload.name,
          category: payload.category || "",
          baseUnit: payload.unit,
          costPerBaseUnit: Number(payload.costPrice) || 0,
          minStock: Number(payload.minStock) || 0,
          notes: payload.notes || "",
          isActive: true,
          conversions: [],
          photos: [],
        },
      },
    });

    await refetchIngredients();

    // LẤY ID mới tạo từ response
    const created = res?.data?.createIngredient;
    return { createdId: created?.id, created };
  };

  const updateIngredient = async (id, payload) => {
    await updateIngredientMu({
      variables: {
        input: {
          id,
          name: payload.name,
          category: payload.category,
          baseUnit: payload.unit,
          costPerBaseUnit: Number(payload.costPrice),
          minStock: Number(payload.minStock),
          notes: payload.notes,
          isActive: payload.isActive,
          // conversions, photos nếu form có
        },
      },
    });
    await refetchIngredients();
  };

  const deleteIngredient = async (id) => {
    await deleteIngredientMu({ variables: { id } });
    await Promise.all([refetchIngredients(), refetchStock()]);
  };

  /**
   * addStock: +qty vào kho
   * - Nếu có selectedWarehouseId → dùng luôn
   * - Nếu không → mặc định kho đầu tiên
   */
  const addStock = async (ingredientId, qty, reason = "Nhập bổ sung") => {
    const warehouseId = selectedWarehouseId || warehouses[0]?.id || null;
    if (!warehouseId) {
      alert("Chưa có kho. Hãy tạo kho trước khi nhập hàng.");
      return;
    }
    await adjustStock({
      variables: {
        restaurantId,
        warehouseId,
        ingredientId,
        qty: Math.abs(Number(qty) || 0), // + thêm
        reason,
      },
    });
    await refetchStock();
  };

  // Đánh giá trạng thái tồn
  const getStockStatus = (ingredient) => {
    const cur = Number(ingredient.currentStock) || 0;
    const min = Number(ingredient.minStock) || 0;
    if (cur <= 0)
      return { key: "out-of-stock", class: "danger", text: "Hết hàng" };
    if (cur <= min)
      return { key: "low-stock", class: "warning", text: "Sắp hết" };
    return { key: "in-stock", class: "success", text: "Còn hàng" };
  };

  return {
    loading: ingLoading,
    error: ingError,
    ingredients: ingredientsMapped,
    filteredIngredients,
    filters,
    setFilters,
    addIngredient,
    updateIngredient,
    deleteIngredient,
    addStock,
    getStockStatus,
    refetch: () => {
      refetchIngredients();
      refetchStock();
    },
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
