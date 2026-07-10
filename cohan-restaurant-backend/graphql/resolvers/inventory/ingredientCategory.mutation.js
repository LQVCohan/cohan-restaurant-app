import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Ingredient, IngredientCategory, EventLog } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

import {
  classifyCategoryFromName,
  INGREDIENT_CATEGORY_RULES,
  slugify,
  toEnglishCategoryName,
  toVietnameseIngredientCategoryName,
} from "./categoryAi.shared.js";

const toIngredientCategorySlug = (name) => slugify(toEnglishCategoryName(name));

const classifyCategoryFromIngredient = (ingredient, existingCategoryName) => {
  const currentName = String(existingCategoryName || ingredient?.category || "").trim();
  if (currentName) {
    return {
      categoryName: currentName,
      reason: "existing_category",
      confidence: 0.96,
      matchedKeyword: null,
    };
  }

  return classifyCategoryFromName({
    itemName: ingredient?.name,
    rules: INGREDIENT_CATEGORY_RULES,
    fallbackCategory: "Other",
  });
};

async function runIngredientCategorySync(restaurantId, ctx) {
  const session = await mongoose.startSession();

  const stats = {
    totalIngredients: 0,
    categoriesCreated: 0,
    categoriesUpdated: 0,
    ingredientsReassigned: 0,
    skipped: 0,
    errors: 0,
  };

  const classificationDetails = [];

  try {
    session.startTransaction();

    const [ingredients, existingCategories] = await Promise.all([
      Ingredient.find({
        restaurantId,
        isActive: true,
      })
        .select({ _id: 1, name: 1, category: 1, ingredientCategoryId: 1 })
        .lean()
        .session(session),
      IngredientCategory.find({ restaurantId })
        .select({ _id: 1, name: 1, slug: 1, usageCount: 1 })
        .lean()
        .session(session),
    ]);

    stats.totalIngredients = ingredients.length;

    const existingBySlug = new Map();
    const duplicateCategoryIds = [];
    for (const category of existingCategories) {
      const canonicalSlug = toIngredientCategorySlug(category.name || category.slug);
      if (!canonicalSlug) continue;

      const selected = existingBySlug.get(canonicalSlug);
      if (!selected) {
        existingBySlug.set(canonicalSlug, category);
        continue;
      }

      const categoryIsCanonical = category.slug === canonicalSlug;
      const selectedIsCanonical = selected.slug === canonicalSlug;
      if (categoryIsCanonical && !selectedIsCanonical) {
        duplicateCategoryIds.push(selected._id);
        existingBySlug.set(canonicalSlug, category);
      } else {
        duplicateCategoryIds.push(category._id);
      }
    }

    const existingById = new Map(
      existingCategories.map((c) => [String(c._id), c]).filter(([id]) => Boolean(id)),
    );

    const usageBySlug = new Map();
    const nameBySlug = new Map();
    const targetCategoryByIngredientId = new Map();

    for (const ingredient of ingredients) {
      try {
        const linked = existingById.get(String(ingredient.ingredientCategoryId || ""));
        const result = classifyCategoryFromIngredient(ingredient, linked?.name);
        const normalizedName = toVietnameseIngredientCategoryName(result.categoryName);
        const slug = toIngredientCategorySlug(normalizedName);
        if (!slug) {
          stats.skipped += 1;
          continue;
        }

        usageBySlug.set(slug, (usageBySlug.get(slug) || 0) + 1);
        nameBySlug.set(slug, normalizedName);
        targetCategoryByIngredientId.set(String(ingredient._id), normalizedName);

        classificationDetails.push({
          ingredientId: String(ingredient._id),
          ingredientName: ingredient.name,
          predictedCategory: normalizedName,
          reason: result.reason,
          confidence: result.confidence,
          matchedKeyword: result.matchedKeyword,
        });
      } catch {
        stats.errors += 1;
      }
    }

    const categoryOps = [];
    for (const [slug, usageCount] of usageBySlug.entries()) {
      const existing = existingBySlug.get(slug);
      const name = toVietnameseIngredientCategoryName(
        existing?.name || nameBySlug.get(slug) || slug.replace(/-/g, " "),
      );

      if (existing) {
        stats.categoriesUpdated += 1;
      } else {
        stats.categoriesCreated += 1;
      }

      categoryOps.push({
        updateOne: {
          filter: existing ? { _id: existing._id, restaurantId } : { restaurantId, slug },
          update: {
            $set: {
              name,
              slug,
              source: "sync",
              usageCount,
              isActive: true,
            },
            $setOnInsert: { restaurantId },
          },
          upsert: true,
        },
      });
    }

    if (categoryOps.length) {
      await IngredientCategory.bulkWrite(categoryOps, { session });
    }

    if (duplicateCategoryIds.length) {
      await IngredientCategory.updateMany(
        { _id: { $in: duplicateCategoryIds }, restaurantId },
        { $set: { isActive: false, usageCount: 0 } },
        { session },
      );
    }

    const syncedCategories = await IngredientCategory.find({
      restaurantId,
      slug: { $in: [...usageBySlug.keys()] },
    })
      .select({ _id: 1, slug: 1, name: 1 })
      .lean()
      .session(session);
    const syncedCategoryBySlug = new Map(
      syncedCategories.map((c) => [c.slug, c]).filter(([slug]) => Boolean(slug)),
    );

    const ingredientOps = [];
    for (const ingredient of ingredients) {
      const target = targetCategoryByIngredientId.get(String(ingredient._id));
      const current = toVietnameseIngredientCategoryName(ingredient.category);
      const targetSlug = toIngredientCategorySlug(target);
      const targetCategory = syncedCategoryBySlug.get(targetSlug);
      if (!target) {
        stats.skipped += 1;
        continue;
      }

      if (
        current === target &&
        String(ingredient.ingredientCategoryId || "") ===
          String(targetCategory?._id || "")
      ) {
        stats.skipped += 1;
        continue;
      }

      ingredientOps.push({
        updateOne: {
          filter: { _id: ingredient._id, restaurantId },
          update: {
            $set: {
              category: target,
              ingredientCategoryId: targetCategory?._id || null,
            },
          },
        },
      });
    }

    if (ingredientOps.length) {
      const writeResult = await Ingredient.bulkWrite(ingredientOps, { session });
      stats.ingredientsReassigned = Number(writeResult.modifiedCount || 0);
    }

    const summaryText = `Quét thành công ${stats.totalIngredients} nguyên liệu: ${stats.categoriesCreated} danh mục mới, ${stats.categoriesUpdated} danh mục được cập nhật, ${stats.ingredientsReassigned} nguyên liệu được gán lại${stats.errors ? `, ${stats.errors} lỗi cần kiểm tra` : ", không có lỗi"}.`;

    await EventLog.log(
      {
        restaurantId,
        actorUserId: mongoose.isValidObjectId(ctx?.user?.id)
          ? new mongoose.Types.ObjectId(String(ctx.user.id))
          : undefined,
        source: "sync",
        verb: "inventory.ingredient_category_sync",
        status: stats.errors > 0 ? "info" : "success",
        object: { kind: "IngredientCategory", code: "ingredient-category-sync" },
        meta: {
          ...stats,
          summaryText,
          sample: classificationDetails.slice(0, 20),
        },
      },
      { session },
    );

    await session.commitTransaction();

    const categories = await IngredientCategory.find({ restaurantId, isActive: true })
      .sort({ usageCount: -1, name: 1 })
      .lean({ virtuals: true });

    return {
      ...stats,
      summaryText,
      categories,
      sample: classificationDetails.slice(0, 20),
      syncedAt: new Date().toISOString(),
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export default {
  createIngredientCategory: async (_p, { input }, ctx) => {
    if (!mongoose.isValidObjectId(input?.restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }
    await requireRestaurantPermission(ctx, input.restaurantId, PERMISSIONS.INVENTORY_WRITE);
    const name = toVietnameseIngredientCategoryName(input?.name);
    if (!name) throw new GraphQLError("Category name is required");
    const slug = toIngredientCategorySlug(name);
    if (!slug) throw new GraphQLError("Category name is invalid");

    const doc = await IngredientCategory.findOneAndUpdate(
      { restaurantId: input.restaurantId, slug },
      {
        $set: { name, isActive: true },
        $setOnInsert: { source: "manual" },
      },
      { new: true, upsert: true },
    ).lean({ virtuals: true });

    return doc;
  },

  updateIngredientCategory: async (_p, { input }, ctx) => {
    const { id, name, isActive } = input || {};
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");

    const current = await IngredientCategory.findById(id);
    if (!current) throw new GraphQLError("Ingredient category not found");
    await requireRestaurantPermission(ctx, current.restaurantId, PERMISSIONS.INVENTORY_WRITE);

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      delete input?.restaurantId;
      let renamedName = null;
      if (typeof name === "string") {
        const nextName = toVietnameseIngredientCategoryName(name);
        const nextSlug = toIngredientCategorySlug(nextName);
        if (!nextName || !nextSlug) {
          throw new GraphQLError("Category name is invalid");
        }
        current.name = nextName;
        current.slug = nextSlug;
        renamedName = nextName;
      }
      if (typeof isActive === "boolean") current.isActive = isActive;

      await current.save({ session });

      if (renamedName) {
        await Ingredient.updateMany(
          { restaurantId: current.restaurantId, ingredientCategoryId: current._id },
          { $set: { category: renamedName } },
          { session },
        );
      }

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    return current.toObject({ virtuals: true });
  },

  deleteIngredientCategory: async (_p, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return false;
    const doc = await IngredientCategory.findById(id).lean();
    if (!doc) return false;
    await requireRestaurantPermission(ctx, doc.restaurantId, PERMISSIONS.INVENTORY_WRITE);
    await IngredientCategory.deleteOne({ _id: id });
    return true;
  },

  syncIngredientCategories: async (_p, { restaurantId }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }

    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.INVENTORY_WRITE);
    return runIngredientCategorySync(restaurantId, ctx);
  },

  syncIngredientCategoriesFromIngredients: async (_p, { restaurantId }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }

    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.INVENTORY_WRITE);
    const report = await runIngredientCategorySync(restaurantId, ctx);
    return report.categories;
  },
};
