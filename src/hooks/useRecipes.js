// src/hooks/useRecipes.js
import { useEffect, useMemo, useState, useCallback } from "react";
import { useLazyQuery, useMutation } from "@apollo/client";
import {
  Q_MENU_ITEMS_WITH_RECIPES_PAGED,
  M_UPSERT_RECIPE,
  M_DELETE_RECIPE,
  M_UPDATE_MENU_ITEM_BASIC,
} from "@/components/Dashboard_Manager/Storage/graphql/recipe.gql";

// Mock nhỏ để UI không trống khi chưa chọn nhà hàng
const initialRecipes = [
  {
    id: "demo-1",
    name: "Bò Wagyu nướng",
    category: "main",
    description: "Demo – thay bằng dữ liệu thật khi chọn nhà hàng",
    icon: "🍽️",
    servingVariants: [],
  },
];

/**
 * Map BE -> FE (card/list/detail)
 * items: [{ menuItem, recipe }]
 */
const mapToFeRecipes = (items = []) =>
  items.map(({ menuItem: mi, recipe: r }) => {
    const servingVariants = Array.isArray(r?.servingVariants)
      ? r.servingVariants.map((sv) => {
          // BE field: sv.Ingredients = [
          //   { ingredientId, quantify, wastePct, name, baseUnit, costPerBaseUnit }
          // ]
          const rawIngredients = Array.isArray(sv.Ingredients)
            ? sv.Ingredients
            : [];

          // components: chuẩn hóa cho RecipeModal (UI edit)
          const components = rawIngredients.map((ic) => ({
            ingredientId: ic.ingredientId,
            // coi quantify đang là quantity theo baseUnit
            qty:
              typeof ic.quantify === "number"
                ? ic.quantify
                : typeof ic.qty === "number"
                ? ic.qty
                : 0,
            unit: ic.baseUnit || "g", // hiển thị mặc định theo baseUnit
            baseUnit: ic.baseUnit || "g",
            name: ic.name || "",
            wastePct: typeof ic.wastePct === "number" ? ic.wastePct : 0,
            costPerBaseUnit:
              typeof ic.costPerBaseUnit === "number"
                ? ic.costPerBaseUnit
                : null,
          }));

          return {
            key: sv.key,
            mode: sv.mode, // "PORTION" | "BY_WEIGHT"
            yieldQty: sv.yieldQty,
            yieldUnit: sv.yieldUnit,
            // FE form đang dùng preparationMethodName; BE type dùng name
            preparationMethodName: sv.preparationMethodName || sv.name || "",
            // Để RecipeModal edit: dùng components
            components,
            // Để RecipeCard / Detail đọc nhanh:
            Ingredients: rawIngredients,
          };
        })
      : [];

    return {
      // ⚠️ id FE = menuItem.id (để CRUD theo menuItemId)
      id: mi.id,
      name: mi.name,
      description: mi.description || "",
      // tạm dùng category fake, nếu sau này có categoryId thì map thêm
      category: "main",
      icon: "🍽️",
      servingVariants,
      // nếu cần giữ lại info thô:
      _rawRecipeId: r?.id,
      _rawRecipe: r || null,
    };
  });

/**
 * Chuẩn hóa dữ liệu để gửi đúng định dạng UpsertRecipeInput
 * (không gửi name, category, description, methods, icon...)
 *
 * form nhận từ RecipeModal.buildPayload()
 * -> form.servingVariants[*].ingredients (đã được convert về baseUnit)
 */
function buildUpsertInput({
  restaurantId,
  menuItemId,
  form,
  defaultActive = true,
}) {
  if (!restaurantId || !menuItemId) {
    throw new Error("Missing restaurantId or menuItemId for upsertRecipe");
  }

  const servingVariants = (form?.servingVariants || []).map((v) => {
    const isByWeight = v.mode === "BY_WEIGHT";

    // Ưu tiên dùng v.ingredients (do RecipeModal build payload)
    // Nếu chưa có, fallback từ v.components (trường hợp cũ)
    const srcList = Array.isArray(v.ingredients)
      ? v.ingredients
      : Array.isArray(v.components)
      ? v.components
      : [];

    const ingredients = srcList.map((c) => ({
      ingredientId: c.ingredientId,
      qty: Number(c.qty) || 0, // qty đã là "theo baseUnit" nếu build từ RecipeModal mới
      name: c.name || undefined,
      wastePct: Number(c.wastePct || 0) || 0,
    }));

    return {
      key: v.key || (isByWeight ? "by-weight" : "portion"),
      mode: v.mode || "PORTION",
      yieldQty: Number(v.yieldQty || 1),
      yieldUnit: v.yieldUnit || (isByWeight ? "100g" : "portion"),
      preparationMethodName: v.preparationMethodName || "",
      // 🔥 ĐÚNG field theo schema: ServingVariantInput.ingredients
      ingredients,
    };
  });

  return {
    restaurantId,
    menuItemId,
    notes: form?.description || "",
    isActive: form?.isActive ?? defaultActive,
    servingVariants,
  };
}

/**
 * Xây input cho updateMenuItemBasic (chỉ có field thay đổi)
 */
function buildMenuItemPatch(restaurantId, menuItemId, form) {
  if (!restaurantId || !menuItemId) return null;
  const patch = {};
  if (typeof form?.name === "string") patch.name = form.name.trim();
  if (typeof form?.description === "string")
    patch.description = form.description.trim();
  if (form?.categoryId) patch.categoryId = form.categoryId;

  return Object.keys(patch).length
    ? { restaurantId, menuItemId, ...patch }
    : null;
}

/**
 * Hook useRecipes — quản lý danh sách công thức + CRUD
 */
export const useRecipes = (
  restaurantId = null,
  timeSlot = null,
  filters = { search: null, categoryId: null }
) => {
  const [recipes, setRecipes] = useState(initialRecipes);

  const [fetchList, { data, loading, error, fetchMore, refetch }] =
    useLazyQuery(Q_MENU_ITEMS_WITH_RECIPES_PAGED, {
      fetchPolicy: "cache-and-network",
    });

  const [upsertRecipeMutation, { loading: upserting }] =
    useMutation(M_UPSERT_RECIPE);
  const [deleteRecipeMutation, { loading: deleting }] =
    useMutation(M_DELETE_RECIPE);
  const [updateMenuItemBasicMutation] = useMutation(M_UPDATE_MENU_ITEM_BASIC);

  // ==== Query recipes list ====
  useEffect(() => {
    if (!restaurantId) {
      setRecipes(initialRecipes);
      return;
    }
    setRecipes([]);
    fetchList({
      variables: {
        restaurantId,
        timeSlot: timeSlot ?? null,
        search: filters?.search || null,
        categoryId: filters?.categoryId || null,
        first: 30,
        after: null,
      },
    });
  }, [restaurantId, timeSlot, filters?.search, filters?.categoryId, fetchList]);

  // Map BE -> FE
  useEffect(() => {
    if (!restaurantId) return;
    const items = data?.menuItemsWithRecipes?.items || [];
    setRecipes(mapToFeRecipes(items));
  }, [restaurantId, data]);

  const pageInfo = data?.menuItemsWithRecipes?.pageInfo || {
    endCursor: null,
    hasNextPage: false,
  };
  const total = data?.menuItemsWithRecipes?.total ?? undefined;

  // ==== Load more ====
  const loadMore = useCallback(async () => {
    if (!restaurantId) return;
    if (!pageInfo?.hasNextPage || !pageInfo?.endCursor) return;

    const res = await fetchMore({
      variables: {
        restaurantId,
        timeSlot: timeSlot ?? null,
        search: filters?.search || null,
        categoryId: filters?.categoryId || null,
        first: 30,
        after: pageInfo.endCursor,
      },
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

    const mergedItems = res?.data?.menuItemsWithRecipes?.items || [];
    setRecipes(mapToFeRecipes(mergedItems));
  }, [
    restaurantId,
    timeSlot,
    filters?.search,
    filters?.categoryId,
    fetchMore,
    pageInfo?.endCursor,
    pageInfo?.hasNextPage,
  ]);

  // ==== Refresh ====
  const refresh = useCallback(() => {
    if (!restaurantId) return Promise.resolve();
    return refetch?.({
      restaurantId,
      timeSlot: timeSlot ?? null,
      search: filters?.search || null,
      categoryId: filters?.categoryId || null,
      first: 30,
      after: null,
    });
  }, [refetch, restaurantId, timeSlot, filters?.search, filters?.categoryId]);

  // ==== CRUD: ADD ====
  const addRecipe = useCallback(
    async (form) => {
      if (!restaurantId) throw new Error("restaurantId is required");
      const menuItemId =
        form?.menuItemId || form?.id || form?.menuItem?.id || null;
      if (!menuItemId) throw new Error("menuItemId is required to create");

      const miInput = buildMenuItemPatch(restaurantId, menuItemId, form);
      if (miInput) {
        await updateMenuItemBasicMutation({ variables: { input: miInput } });
      }

      const input = buildUpsertInput({
        restaurantId,
        menuItemId,
        form,
        defaultActive: true,
      });
      await upsertRecipeMutation({ variables: { input } });
      await refresh?.();
    },
    [restaurantId, upsertRecipeMutation, updateMenuItemBasicMutation, refresh]
  );

  // ==== CRUD: UPDATE ====
  const updateRecipe = useCallback(
    async (menuItemId, form) => {
      if (!restaurantId) throw new Error("restaurantId is required");
      if (!menuItemId) throw new Error("menuItemId is required to update");

      const miInput = buildMenuItemPatch(restaurantId, menuItemId, form);
      if (miInput) {
        await updateMenuItemBasicMutation({ variables: { input: miInput } });
      }

      const input = buildUpsertInput({ restaurantId, menuItemId, form });
      await upsertRecipeMutation({ variables: { input } });
      await refresh?.();
    },
    [restaurantId, upsertRecipeMutation, updateMenuItemBasicMutation, refresh]
  );

  // ==== CRUD: DELETE ====
  const deleteRecipe = useCallback(
    async (menuItemId) => {
      if (!restaurantId) throw new Error("restaurantId is required");
      if (!menuItemId) throw new Error("menuItemId is required to delete");

      await deleteRecipeMutation({ variables: { restaurantId, menuItemId } });
      await refresh?.();
    },
    [restaurantId, deleteRecipeMutation, refresh]
  );

  const filteredRecipes = useMemo(() => recipes, [recipes]);

  return {
    recipes: filteredRecipes,
    loading: loading || upserting || deleting,
    error,
    total,
    pageInfo,
    loadMore,
    refresh,
    addRecipe,
    updateRecipe,
    deleteRecipe,
  };
};

export default useRecipes;
