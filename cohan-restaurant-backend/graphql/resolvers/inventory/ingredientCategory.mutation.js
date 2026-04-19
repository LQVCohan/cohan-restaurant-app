import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Ingredient, IngredientCategory, EventLog } from "../../../models/index.js";

import {
  classifyCategoryFromName,
  INGREDIENT_CATEGORY_RULES,
  slugify,
  titleCase,
  toEnglishCategoryName,
} from "./categoryAi.shared.js";

const classifyCategoryFromIngredient = (ingredient, existingCategoryName) =>
  classifyCategoryFromName({
    itemName: ingredient?.name,
    existingCategoryName: existingCategoryName || ingredient?.category,
    rules: INGREDIENT_CATEGORY_RULES,
    fallbackCategory: "Other",
  });

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

    const existingBySlug = new Map(
      existingCategories
        .map((c) => [c.slug, c])
        .filter(([slug]) => Boolean(slug)),
    );
    const existingById = new Map(
      existingCategories.map((c) => [String(c._id), c]).filter(([id]) => Boolean(id)),
    );

    const usageBySlug = new Map();
    const targetCategoryByIngredientId = new Map();

    for (const ingredient of ingredients) {
      try {
        const linked = existingById.get(String(ingredient.ingredientCategoryId || ""));
        const result = classifyCategoryFromIngredient(ingredient, linked?.name);
        const normalizedName = toEnglishCategoryName(result.categoryName);
        const slug = slugify(normalizedName);
        if (!slug) {
          stats.skipped += 1;
          continue;
        }

        usageBySlug.set(slug, (usageBySlug.get(slug) || 0) + 1);
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
      const name = titleCase(existing?.name || slug.replace(/-/g, " "));

      if (existing) {
        stats.categoriesUpdated += 1;
      } else {
        stats.categoriesCreated += 1;
      }

      categoryOps.push({
        updateOne: {
          filter: { restaurantId, slug },
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
      const current = titleCase(ingredient.category);
      const targetSlug = slugify(target);
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

    const summaryText = `processed=${stats.totalIngredients}, created=${stats.categoriesCreated}, updated=${stats.categoriesUpdated}, reassigned=${stats.ingredientsReassigned}, skipped=${stats.skipped}, errors=${stats.errors}`;

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
  createIngredientCategory: async (_p, { input }) => {
    if (!mongoose.isValidObjectId(input?.restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }
    const name = toEnglishCategoryName(input?.name);
    if (!name) throw new GraphQLError("Category name is required");
    const slug = slugify(name);
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

  updateIngredientCategory: async (_p, { input }) => {
    const { id, name, isActive } = input || {};
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");

    const current = await IngredientCategory.findById(id);
    if (!current) throw new GraphQLError("Ingredient category not found");

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      let renamedName = null;
      if (typeof name === "string") {
        const nextName = toEnglishCategoryName(name);
        const nextSlug = slugify(nextName);
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

  deleteIngredientCategory: async (_p, { id }) => {
    if (!mongoose.isValidObjectId(id)) return false;
    const doc = await IngredientCategory.findById(id).lean();
    if (!doc) return false;
    await IngredientCategory.deleteOne({ _id: id });
    return true;
  },

  syncIngredientCategories: async (_p, { restaurantId }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }

    return runIngredientCategorySync(restaurantId, ctx);
  },

  syncIngredientCategoriesFromIngredients: async (_p, { restaurantId }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }

    const report = await runIngredientCategorySync(restaurantId, ctx);
    return report.categories;
  },
};
