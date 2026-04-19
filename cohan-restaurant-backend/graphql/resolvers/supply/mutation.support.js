import mongoose from "mongoose";
import { SupplyCategory } from "../../../models/index.js";
import { slugify, toEnglishCategoryName } from "../inventory/categoryAi.shared.js";

export { toEnglishCategoryName };

export function isValidObjectId(value) {
  return mongoose.isValidObjectId(value);
}

export async function findOrCreateSupplyCategory({
  restaurantId,
  categoryName,
  source = "manual",
  session,
}) {
  const normalizedName = toEnglishCategoryName(categoryName);
  const slug = slugify(normalizedName);
  if (!slug) return null;

  return SupplyCategory.findOneAndUpdate(
    { restaurantId, slug },
    {
      $set: { name: normalizedName, isActive: true },
      $setOnInsert: { source },
    },
    { new: true, upsert: true, session },
  );
}
