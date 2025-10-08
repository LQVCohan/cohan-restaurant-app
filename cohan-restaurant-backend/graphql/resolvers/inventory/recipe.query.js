import mongoose from "mongoose";
import { Recipe } from "../../../models/index.js";

export default {
  recipe: async (_p, { restaurantId, menuItemId }) => {
    if (![restaurantId, menuItemId].every(mongoose.isValidObjectId))
      return null;
    return Recipe.findOne({ restaurantId, menuItemId }).lean({
      virtuals: true,
    });
  },
};
