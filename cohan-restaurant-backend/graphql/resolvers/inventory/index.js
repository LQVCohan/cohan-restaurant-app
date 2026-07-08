import ingredientQ from "./ingredient.query.js";
import ingredientM from "./ingredient.mutation.js";
import ingredientCategoryQ from "./ingredientCategory.query.js";
import ingredientCategoryM from "./ingredientCategory.mutation.js";
import warehouseQ from "./warehouse.query.js";
import warehouseM from "./warehouse.mutation.js";
import stockQ from "./stock.query.js";
import stockM from "./stock.mutation.js";
import recipeQ from "./recipe.query.js";
import recipeM from "./recipe.mutation.js";
import consumeM from "./consume.mutation.js";
import reservationM from "./reservation.mutation.js";
import movementQ from "./movement.query.js";
import inventoryCount from "./inventoryCount.js";
import typesResolvers from "./types.js";
export default {
  Query: {
    ...ingredientQ,
    ...ingredientCategoryQ,
    ...warehouseQ,
    ...stockQ,
    ...recipeQ,
    ...movementQ,
    ...inventoryCount.Query,
  },
  Mutation: {
    ...ingredientM,
    ...ingredientCategoryM,
    ...warehouseM,
    ...stockM,
    ...recipeM,
    ...consumeM,
    ...reservationM,
    ...inventoryCount.Mutation,
  },
  ...typesResolvers,
};
