import { useState, useEffect } from "react";

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

export const useRecipes = () => {
  const [recipes, setRecipes] = useState(initialRecipes);
  const [filteredRecipes, setFilteredRecipes] = useState(recipes);
  const [filters, setFilters] = useState({
    search: "",
    category: "",
  });

  useEffect(() => {
    let filtered = recipes;

    if (filters.search) {
      filtered = filtered.filter(
        (recipe) =>
          recipe.name.toLowerCase().includes(filters.search.toLowerCase()) ||
          recipe.description
            .toLowerCase()
            .includes(filters.search.toLowerCase())
      );
    }

    if (filters.category) {
      filtered = filtered.filter(
        (recipe) => recipe.category === filters.category
      );
    }

    setFilteredRecipes(filtered);
  }, [recipes, filters]);

  const addRecipe = (recipeData) => {
    const newId = Math.max(...recipes.map((r) => r.id)) + 1;
    setRecipes([...recipes, { id: newId, ...recipeData }]);
  };

  const updateRecipe = (id, recipeData) => {
    setRecipes(
      recipes.map((recipe) =>
        recipe.id === id ? { ...recipe, ...recipeData } : recipe
      )
    );
  };

  const deleteRecipe = (id) => {
    setRecipes(recipes.filter((recipe) => recipe.id !== id));
  };

  const getRecipesByIngredient = (ingredientId) => {
    return recipes.filter((recipe) => {
      // Check base ingredients
      const hasBaseIngredient = recipe.baseIngredients.some(
        (ing) => ing.ingredientId === ingredientId
      );

      // Check method ingredients
      const hasMethodIngredient = recipe.methods.some((method) =>
        method.ingredients.some((ing) => ing.ingredientId === ingredientId)
      );

      return hasBaseIngredient || hasMethodIngredient;
    });
  };

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
