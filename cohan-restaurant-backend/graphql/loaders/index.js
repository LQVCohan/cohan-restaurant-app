// src/graphql/loaders/index.js
import { createIngredientLoader } from "./ingredientLoader.js";
export function createLoaders() {
  return {
    ingredientLoader: createIngredientLoader(), // NEW instance per request
  };
}
