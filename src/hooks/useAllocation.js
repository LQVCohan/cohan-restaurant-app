import { useState, useEffect } from "react";
import { useIngredients } from "./useIngredients.js";
import { useRecipes } from "./useRecipes";

export const useAllocation = () => {
  const { ingredients, updateIngredient } = useIngredients();
  const { recipes } = useRecipes();
  const [allocations, setAllocations] = useState([]);

  // Check if we can make a recipe with current stock
  const canMakeRecipe = (recipe, method, quantity = 1) => {
    const requiredIngredients = method.ingredients;

    for (let reqIng of requiredIngredients) {
      const ingredient = ingredients.find((i) => i.id === reqIng.ingredientId);
      if (!ingredient) return { canMake: false, missing: [reqIng] };

      const requiredAmount = reqIng.amount * quantity;
      if (ingredient.currentStock < requiredAmount) {
        return {
          canMake: false,
          missing: [
            {
              ...reqIng,
              needed: requiredAmount,
              available: ingredient.currentStock,
            },
          ],
        };
      }
    }

    return { canMake: true, missing: [] };
  };

  // Calculate maximum quantity we can make
  const getMaxQuantity = (recipe, method) => {
    let maxQuantity = Infinity;

    for (let reqIng of method.ingredients) {
      const ingredient = ingredients.find((i) => i.id === reqIng.ingredientId);
      if (!ingredient || ingredient.currentStock === 0) return 0;

      const possibleQuantity = Math.floor(
        ingredient.currentStock / reqIng.amount
      );
      maxQuantity = Math.min(maxQuantity, possibleQuantity);
    }

    return maxQuantity === Infinity ? 0 : maxQuantity;
  };

  // Allocate ingredients for a recipe
  const allocateIngredients = (recipeId, methodId, quantity, notes = "") => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return { success: false, error: "Không tìm thấy công thức" };

    const method = recipe.methods.find((m) => m.id === methodId);
    if (!method)
      return { success: false, error: "Không tìm thấy phương pháp chế biến" };

    const checkResult = canMakeRecipe(recipe, method, quantity);
    if (!checkResult.canMake) {
      return {
        success: false,
        error: "Không đủ nguyên liệu",
        missing: checkResult.missing,
      };
    }

    // Create allocation record
    const allocation = {
      id: Date.now(),
      recipeId,
      recipeName: recipe.name,
      methodId,
      methodName: method.name,
      quantity,
      ingredients: method.ingredients.map((ing) => {
        const ingredient = ingredients.find((i) => i.id === ing.ingredientId);
        return {
          ingredientId: ing.ingredientId,
          ingredientName: ingredient.name,
          allocatedAmount: ing.amount * quantity,
          unit: ing.unit,
          costPrice: ingredient.costPrice,
        };
      }),
      totalCost: method.ingredients.reduce((total, ing) => {
        const ingredient = ingredients.find((i) => i.id === ing.ingredientId);
        return total + ingredient.costPrice * ing.amount * quantity;
      }, 0),
      notes,
      createdAt: new Date().toISOString(),
      status: "allocated",
    };

    // Update ingredient stocks
    method.ingredients.forEach((ing) => {
      const ingredient = ingredients.find((i) => i.id === ing.ingredientId);
      const newStock = ingredient.currentStock - ing.amount * quantity;
      updateIngredient(ing.ingredientId, { currentStock: newStock });
    });

    setAllocations([...allocations, allocation]);
    return { success: true, allocation };
  };

  // Release allocation (return ingredients to stock)
  const releaseAllocation = (allocationId) => {
    const allocation = allocations.find((a) => a.id === allocationId);
    if (!allocation) return { success: false, error: "Không tìm thấy phân bổ" };

    // Return ingredients to stock
    allocation.ingredients.forEach((ing) => {
      const ingredient = ingredients.find((i) => i.id === ing.ingredientId);
      const newStock = ingredient.currentStock + ing.allocatedAmount;
      updateIngredient(ing.ingredientId, { currentStock: newStock });
    });

    // Update allocation status
    setAllocations(
      allocations.map((a) =>
        a.id === allocationId
          ? { ...a, status: "released", releasedAt: new Date().toISOString() }
          : a
      )
    );

    return { success: true };
  };

  // Complete allocation (mark as used)
  const completeAllocation = (allocationId) => {
    setAllocations(
      allocations.map((a) =>
        a.id === allocationId
          ? { ...a, status: "completed", completedAt: new Date().toISOString() }
          : a
      )
    );
    return { success: true };
  };

  // Get allocation statistics
  const getAllocationStats = () => {
    const today = new Date().toDateString();
    const todayAllocations = allocations.filter(
      (a) => new Date(a.createdAt).toDateString() === today
    );

    return {
      total: allocations.length,
      today: todayAllocations.length,
      allocated: allocations.filter((a) => a.status === "allocated").length,
      completed: allocations.filter((a) => a.status === "completed").length,
      released: allocations.filter((a) => a.status === "released").length,
      totalCost: allocations.reduce((sum, a) => sum + a.totalCost, 0),
      todayCost: todayAllocations.reduce((sum, a) => sum + a.totalCost, 0),
    };
  };

  return {
    allocations,
    canMakeRecipe,
    getMaxQuantity,
    allocateIngredients,
    releaseAllocation,
    completeAllocation,
    getAllocationStats,
  };
};
