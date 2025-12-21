import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Ingredient } from "../../../models/index.js";

function normalizeDupKeyError(err) {
  // Mongo duplicate key
  if (err?.code === 11000) {
    const fields = Object.keys(err.keyPattern || {});
    const fieldText = fields.length ? fields.join(", ") : "unique field";
    return new GraphQLError(`Duplicate ${fieldText}`);
  }
  return err;
}

export default {
  createIngredient: async (_p, { input }) => {
    if (!mongoose.isValidObjectId(input?.restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }

    try {
      const created = await Ingredient.create(input);
      return created.toObject({ virtuals: true });
    } catch (err) {
      const e = normalizeDupKeyError(err);
      if (e instanceof GraphQLError) throw e;
      throw new GraphQLError(e?.message || "Create ingredient failed");
    }
  },

  updateIngredient: async (_p, { input }) => {
    const { id, ...patch } = input || {};
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");

    try {
      const doc = await Ingredient.findByIdAndUpdate(
        id,
        { $set: patch },
        { new: true, runValidators: true }
      ).lean({ virtuals: true });

      if (!doc) throw new GraphQLError("Ingredient not found");
      return doc;
    } catch (err) {
      const e = normalizeDupKeyError(err);
      if (e instanceof GraphQLError) throw e;
      throw new GraphQLError(e?.message || "Update ingredient failed");
    }
  },

  deleteIngredient: async (_p, { id }) => {
    if (!mongoose.isValidObjectId(id)) return false;
    const res = await Ingredient.deleteOne({ _id: id });
    return res.deletedCount > 0;
  },
};
