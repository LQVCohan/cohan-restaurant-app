import ingredientQ from "./ingredient.query.js";
import ingredientM from "./ingredient.mutation.js";
import warehouseQ from "./warehouse.query.js";
import warehouseM from "./warehouse.mutation.js";
import stockQ from "./stock.query.js";
import stockM from "./stock.mutation.js";
import recipeQ from "./recipe.query.js";
import recipeM from "./recipe.mutation.js";
import consumeM from "./consume.mutation.js";
import reservationM from "./reservation.mutation.js";
import movementQ from "./movement.query.js";
import typesResolvers from "./types.js";
export default {
  Query: {
    ...ingredientQ,
    ...warehouseQ,
    ...stockQ,
    ...recipeQ,
    ...movementQ,
  },
  Mutation: {
    ...ingredientM,
    ...warehouseM,
    ...stockM,
    ...recipeM,
    ...consumeM,
    ...reservationM,
  },
  ...typesResolvers,
};
