import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Ingredient } from "../../../models/index.js";

export default {
  createIngredient: async (_p, { input }) => {
    if (!mongoose.isValidObjectId(input.restaurantId))
      throw new GraphQLError("Invalid restaurantId");
    const created = await Ingredient.create(input);
    return created.toObject({ virtuals: true });
  },
  updateIngredient: async (_p, { input }) => {
    const { id, ...patch } = input;
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");
    const doc = await Ingredient.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean({ virtuals: true });
    if (!doc) throw new GraphQLError("Ingredient not found");
    return doc;
  },
  deleteIngredient: async (_p, { id }) => {
    if (!mongoose.isValidObjectId(id)) return false;
    const res = await Ingredient.deleteOne({ _id: id });
    return res.deletedCount > 0;
  },
};
