import { useState, useEffect } from "react";

const initialIngredients = [
  {
    id: 1,
    name: "Thịt bò Wagyu A5",
    category: "meat",
    unit: "kg",
    currentStock: 15.5,
    minStock: 5,
    costPrice: 2500000,
    supplier: "Wagyu Farm Japan",
    notes: "Thịt bò Wagyu cao cấp, bảo quản lạnh -2°C",
    icon: "🥩",
  },
  // ... other ingredients
];

export const useIngredients = () => {
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [filteredIngredients, setFilteredIngredients] = useState(ingredients);
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    status: "",
  });

  useEffect(() => {
    let filtered = ingredients;

    if (filters.search) {
      filtered = filtered.filter((ingredient) =>
        ingredient.name.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.category) {
      filtered = filtered.filter(
        (ingredient) => ingredient.category === filters.category
      );
    }

    if (filters.status) {
      filtered = filtered.filter((ingredient) => {
        const status = getStockStatus(ingredient);
        return status.value === filters.status;
      });
    }

    setFilteredIngredients(filtered);
  }, [ingredients, filters]);

  const getStockStatus = (item) => {
    if (item.currentStock === 0) {
      return {
        value: "out-of-stock",
        class: "status-out-of-stock",
        text: "Hết hàng",
      };
    } else if (item.currentStock <= item.minStock) {
      return { value: "low-stock", class: "status-low-stock", text: "Sắp hết" };
    } else {
      return { value: "in-stock", class: "status-in-stock", text: "Còn hàng" };
    }
  };

  const addIngredient = (ingredientData) => {
    const newId = Math.max(...ingredients.map((i) => i.id)) + 1;
    setIngredients([...ingredients, { id: newId, ...ingredientData }]);
  };

  const updateIngredient = (id, ingredientData) => {
    setIngredients(
      ingredients.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, ...ingredientData } : ingredient
      )
    );
  };

  const deleteIngredient = (id) => {
    setIngredients(ingredients.filter((ingredient) => ingredient.id !== id));
  };

  const addStock = (id, amount) => {
    setIngredients(
      ingredients.map((ingredient) =>
        ingredient.id === id
          ? { ...ingredient, currentStock: ingredient.currentStock + amount }
          : ingredient
      )
    );
  };

  return {
    ingredients,
    filteredIngredients,
    filters,
    setFilters,
    addIngredient,
    updateIngredient,
    deleteIngredient,
    addStock,
    getStockStatus,
  };
};
