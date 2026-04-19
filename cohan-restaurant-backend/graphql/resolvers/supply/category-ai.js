import mongoose from "mongoose";
import { SupplyCategory } from "../../../models/index.js";
import {
  classifyCategoryFromName,
  slugify,
  SUPPLY_CATEGORY_RULES,
  toEnglishCategoryName,
} from "../inventory/categoryAi.shared.js";

function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listSupplyCategories({
  restaurantId,
  search = "",
  includeInactive = false,
  limit = 200,
}) {
  const query = { restaurantId };
  if (!includeInactive) query.isActive = true;
  if (String(search || "").trim()) {
    query.name = new RegExp(escapeRegex(String(search).trim()), "i");
  }
  return SupplyCategory.find(query)
    .sort({ usageCount: -1, name: 1 })
    .limit(Math.min(Math.max(Number(limit) || 200, 1), 500))
    .lean({ virtuals: true });
}

export async function findOrCreateSupplyCategory({
  restaurantId,
  categoryName,
  source = "manual",
  session = null,
}) {
  const normalizedName = toEnglishCategoryName(categoryName);
  const slug = slugify(normalizedName);
  if (!slug) return null;

  const query = { restaurantId, slug };
  const update = {
    $set: { name: normalizedName, isActive: true },
    $setOnInsert: { source },
  };
  return SupplyCategory.findOneAndUpdate(query, update, {
    new: true,
    upsert: true,
    session,
  });
}

export async function suggestSupplyCategory({ restaurantId, supplyName, existingCategoryName }) {
  const base = classifyCategoryFromName({
    itemName: supplyName,
    existingCategoryName,
    rules: SUPPLY_CATEGORY_RULES,
    fallbackCategory: "Other",
  });

  const normalizedName = toEnglishCategoryName(base.categoryName);
  const slug = slugify(normalizedName);
  const category = slug
    ? await SupplyCategory.findOne({ restaurantId, slug, isActive: true })
        .select({ _id: 1, name: 1, slug: 1 })
        .lean()
    : null;

  return {
    ...base,
    categoryName: normalizedName,
    categorySlug: slug,
    categoryId: category?._id ? String(category._id) : null,
    existing: !!category,
    autoSelected: base.confidence >= 0.8,
  };
}

export function isValidObjectId(value) {
  return mongoose.isValidObjectId(value);
}
