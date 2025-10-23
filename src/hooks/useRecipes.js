import { useCallback, useEffect, useMemo, useState } from "react";
import { useLazyQuery, useMutation } from "@apollo/client";
import {
  Q_MENU_ITEMS_FOR_RECIPE, // menuItems(restaurantId, timeSlot)
  Q_RECIPE, // recipe(restaurantId, menuItemId)
  M_UPSERT_RECIPE, // upsertRecipe(input)
  M_DELETE_RECIPE, // deleteRecipe(restaurantId, menuItemId)
} from "../components/Dashboard_Manager/Storage/graphql/recipe.gql";

// === Mock fallback để UI không trống khi chưa chọn nhà hàng ===
const initialRecipes = [
  {
    id: 1,
    name: "Bò Wagyu nướng",
    category: "main",
    description: "Thịt bò Wagyu A5 nướng tảng với gia vị đặc biệt",
    baseIngredients: [
      { ingredientId: 1, amount: 0.3, unit: "kg" },
      { ingredientId: 4, amount: 0.005, unit: "kg" },
    ],
    methods: [
      {
        id: 1,
        name: "Nướng than hoa",
        description:
          "Nướng trên than hoa với nhiệt độ cao 400°C trong 8-10 phút",
        ingredients: [
          { ingredientId: 1, amount: 0.3, unit: "kg" },
          { ingredientId: 4, amount: 0.005, unit: "kg" },
          { ingredientId: 5, amount: 0.02, unit: "kg" },
        ],
      },
      {
        id: 2,
        name: "Nướng chảo gang",
        description: "Áp chảo trên chảo gang nóng với bơ và thảo mộc",
        ingredients: [
          { ingredientId: 1, amount: 0.3, unit: "kg" },
          { ingredientId: 4, amount: 0.005, unit: "kg" },
          { ingredientId: 5, amount: 0.05, unit: "kg" },
        ],
      },
    ],
    icon: "🥩",
  },
  {
    id: 2,
    name: "Tôm hùm nướng bơ tỏi",
    category: "main",
    description: "Tôm hùm tươi nướng với bơ tỏi thơm lừng",
    baseIngredients: [
      { ingredientId: 2, amount: 0.5, unit: "kg" },
      { ingredientId: 5, amount: 0.05, unit: "kg" },
    ],
    methods: [
      {
        id: 1,
        name: "Nướng lò bơ tỏi",
        description: "Nướng trong lò 180°C với bơ tỏi và thảo mộc tươi",
        ingredients: [
          { ingredientId: 2, amount: 0.5, unit: "kg" },
          { ingredientId: 5, amount: 0.05, unit: "kg" },
        ],
      },
    ],
    icon: "🦞",
  },
];

/**
 * useRecipes(restaurantId?, timeSlot?)
 * - Nếu có restaurantId -> tải menuItems theo timeSlot và map sang "recipes" cho FE.
 * - Nếu không có restaurantId -> dùng mock initialRecipes.
 */
export const useRecipes = (restaurantId = null, timeSlot = null) => {
  const [recipes, setRecipes] = useState(initialRecipes);
  const [filters, setFilters] = useState({ search: "", category: "" });

  // Queries & Mutations
  const [fetchMenuItems, { data: menuData }] = useLazyQuery(
    Q_MENU_ITEMS_FOR_RECIPE,
    {
      fetchPolicy: "cache-and-network",
    }
  );
  const [fetchRecipe] = useLazyQuery(Q_RECIPE, { fetchPolicy: "cache-first" });
  const [upsertRecipe] = useMutation(M_UPSERT_RECIPE);
  const [deleteRecipeMut] = useMutation(M_DELETE_RECIPE);

  // Tải menuItems theo restaurantId + timeSlot
  useEffect(() => {
    if (!restaurantId) {
      setRecipes(initialRecipes);
      return;
    }
    fetchMenuItems({
      variables: { restaurantId, timeSlot: timeSlot || null, limit: 200 },
    });
  }, [restaurantId, timeSlot, fetchMenuItems]);

  // Map menuItems -> recipes hiển thị (đọc chi tiết recipe để lấy components)
  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!restaurantId) return; // đang dùng mock

      const items = menuData?.menuItems || [];
      if (!items.length) {
        if (active) setRecipes([]);
        return;
      }

      const next = [];
      for (const mi of items) {
        // lấy recipe cho từng menuItem
        const { data } = await fetchRecipe({
          variables: { restaurantId, menuItemId: mi.id },
        });

        const baseIngredients =
          data?.recipe?.baseComponents?.map((c) => ({
            ingredientId: c.ingredientId,
            amount: c.qty,
            unit: c.unit || "g",
          })) || [];

        const methods = data?.recipe?.servingVariants?.map((v, idx) => ({
          id: idx + 1,
          name: v.preparationMethodName || v.key || `Phương pháp ${idx + 1}`,
          description: "",
          ingredients:
            v.components?.map((c) => ({
              ingredientId: c.ingredientId,
              amount: c.qty,
              unit: c.unit || "g",
            })) || [],
        })) || [
          {
            id: 1,
            name: "Phương pháp cơ bản",
            description: "",
            ingredients: [],
          },
        ];

        next.push({
          id: mi.id, // dùng menuItemId làm id recipe ở FE
          name: mi.name,
          category: "main",
          description: mi.description || "",
          icon: "🍽️",
          baseIngredients,
          methods,
        });
      }

      if (active) setRecipes(next);
    };

    if (restaurantId) run();
    return () => {
      active = false;
    };
  }, [restaurantId, menuData, fetchRecipe]);

  // Lọc theo search + category (giữ behavior cũ)
  const filteredRecipes = useMemo(() => {
    let filtered = recipes;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q)
      );
    }
    if (filters.category) {
      filtered = filtered.filter((r) => r.category === filters.category);
    }
    return filtered;
  }, [recipes, filters]);

  // Helper convert form -> input upsert cho BE
  const toUpsertInput = (menuItemId, form) => {
    const baseComponents = (form.baseIngredients || []).map((b) => ({
      ingredientId: b.ingredientId,
      qty: Number(b.amount) || 0,
      unit: b.unit || undefined,
      wastePct: 0,
    }));

    const servingVariants = (form.methods || []).map((m, idx) => ({
      key: m.name?.trim() || `m${idx + 1}`,
      mode: "PORTION",
      yieldQty: 1,
      yieldUnit: "portion",
      preparationMethodName: m.name?.trim() || `Phương pháp ${idx + 1}`,
      components: (m.ingredients || []).map((c) => ({
        ingredientId: c.ingredientId,
        qty: Number(c.amount) || 0,
        unit: c.unit || undefined,
        wastePct: 0,
      })),
    }));

    return {
      restaurantId,
      menuItemId,
      // giữ legacy để không phá dữ liệu cũ
      yieldQty: 1,
      yieldUnit: "portion",
      baseComponents,
      servingVariants,
      notes: "",
      isActive: true,
    };
  };

  // === Actions giữ API cũ ===
  const addRecipe = useCallback(
    async (recipeForm) => {
      // Ở UI hiện tại recipe.id chính là menuItemId
      const menuItemId = recipeForm.id || recipeForm.menuItemId || null;

      if (!restaurantId || !menuItemId) {
        // fallback local nếu chưa có restaurantId
        const newId =
          recipes.length > 0
            ? Math.max(...recipes.map((r) => +r.id || 0)) + 1
            : 1;
        setRecipes((prev) => [...prev, { id: newId, ...recipeForm }]);
        return;
      }

      const input = toUpsertInput(menuItemId, recipeForm);
      await upsertRecipe({ variables: { input } });

      setRecipes((prev) => {
        // Nếu đã có trong list -> update, chưa có -> add
        const exists = prev.some((r) => r.id === menuItemId);
        if (exists) {
          return prev.map((r) =>
            r.id === menuItemId ? { ...r, ...recipeForm } : r
          );
        }
        return [{ ...recipeForm, id: menuItemId }, ...prev];
      });
    },
    [restaurantId, recipes, upsertRecipe]
  );

  const updateRecipe = useCallback(
    async (id, recipeForm) => {
      if (!restaurantId || !id) {
        // local fallback
        setRecipes((prev) =>
          prev.map((r) => (r.id === id ? { ...r, ...recipeForm } : r))
        );
        return;
      }
      const input = toUpsertInput(id, recipeForm);
      await upsertRecipe({ variables: { input } });
      setRecipes((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...recipeForm } : r))
      );
    },
    [restaurantId, upsertRecipe]
  );

  const deleteRecipe = useCallback(
    async (id) => {
      if (!restaurantId || !id) {
        // local fallback
        setRecipes((prev) => prev.filter((r) => r.id !== id));
        return;
      }
      await deleteRecipeMut({ variables: { restaurantId, menuItemId: id } });
      setRecipes((prev) => prev.filter((r) => r.id !== id));
    },
    [restaurantId, deleteRecipeMut]
  );

  const getRecipesByIngredient = useCallback(
    (ingredientId) => {
      return recipes.filter((recipe) => {
        const hasBase = recipe.baseIngredients?.some(
          (ing) => String(ing.ingredientId) === String(ingredientId)
        );
        const hasInMethod = recipe.methods?.some((m) =>
          m.ingredients?.some(
            (ing) => String(ing.ingredientId) === String(ingredientId)
          )
        );
        return hasBase || hasInMethod;
      });
    },
    [recipes]
  );

  return {
    recipes,
    filteredRecipes,
    filters,
    setFilters,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    getRecipesByIngredient,
  };
};

export default useRecipes;
