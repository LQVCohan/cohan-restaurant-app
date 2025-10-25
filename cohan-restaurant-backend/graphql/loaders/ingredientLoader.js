// src/graphql/loaders/ingredientLoader.js
import DataLoader from "dataloader";
import mongoose from "mongoose";
import { Ingredient } from "../../models/index.js";

async function batchIngredients(ids) {
  const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
  if (!validIds.length) return ids.map(() => null);

  const docs = await Ingredient.find({ _id: { $in: validIds } })
    .select({ name: 1 }) // chỉ name cho nhẹ
    .lean({ virtuals: true });

  const map = new Map(docs.map((d) => [String(d._id), d]));
  return ids.map((id) => map.get(String(id)) || null);
}

export function createIngredientLoader() {
  return new DataLoader(batchIngredients, { cacheKeyFn: (k) => String(k) });
}
