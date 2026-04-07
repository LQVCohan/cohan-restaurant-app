import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Ingredient, IngredientCategory, EventLog } from "../../../models/index.js";

const slugify = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const titleCase = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

const EN_CATEGORY_BY_ALIAS = {
  meat: "Meat",
  thit: "Meat",
  seafood: "Seafood",
  hai_san: "Seafood",
  hai_san_: "Seafood",
  rau_cu: "Vegetable",
  rau_cu_: "Vegetable",
  vegetable: "Vegetable",
  gia_vi: "Spice",
  spice: "Spice",
  tinh_bot: "Starch",
  starch: "Starch",
  dairy_egg: "Dairy & Egg",
  sua_trung: "Dairy & Egg",
  beverage: "Beverage",
  do_uong: "Beverage",
  other: "Other",
  khac: "Other",
};

const normalizeText = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCategoryAlias = (s) =>
  normalizeText(s).replace(/\s+/g, "_");

const toEnglishCategoryName = (s) => {
  const alias = normalizeCategoryAlias(s);
  if (EN_CATEGORY_BY_ALIAS[alias]) return EN_CATEGORY_BY_ALIAS[alias];
  return titleCase(normalizeText(s));
};

const CATEGORY_RULES = [
  {
    name: "Meat",
    keywords: [
      "thit",
      "bo",
      "heo",
      "ga",
      "vit",
      "lon",
      "cuu",
      "beef",
      "pork",
      "chicken",
      "meat",
    ],
  },
  {
    name: "Seafood",
    keywords: [
      "hai san",
      "tom",
      "ca",
      "muc",
      "cua",
      "ghe",
      "so",
      "oc",
      "shrimp",
      "fish",
      "seafood",
      "salmon",
    ],
  },
  {
    name: "Vegetable",
    keywords: [
      "rau",
      "cu",
      "qua",
      "nam",
      "salad",
      "cai",
      "bap cai",
      "ca rot",
      "khoai",
      "hanh",
      "toi",
      "rau cu",
      "vegetable",
    ],
  },
  {
    name: "Spice",
    keywords: [
      "muoi",
      "duong",
      "nuoc mam",
      "tuong",
      "tieu",
      "ot",
      "gung",
      "sa",
      "bot",
      "gia vi",
      "seasoning",
      "spice",
      "sauce",
    ],
  },
  {
    name: "Starch",
    keywords: [
      "gao",
      "bun",
      "pho",
      "my",
      "mien",
      "mi",
      "bot mi",
      "flour",
      "rice",
      "noodle",
      "grain",
    ],
  },
  {
    name: "Dairy & Egg",
    keywords: [
      "sua",
      "pho mai",
      "bo",
      "trung",
      "yogurt",
      "milk",
      "cheese",
      "butter",
      "egg",
    ],
  },
  {
    name: "Beverage",
    keywords: [
      "nuoc",
      "tra",
      "cafe",
      "ca phe",
      "soda",
      "juice",
      "beer",
      "ruou",
      "drink",
    ],
  },
];

const classifyCategoryFromIngredient = (ingredient, existingCategoryName) => {
  const existingCategory = toEnglishCategoryName(
    existingCategoryName || ingredient?.category,
  );
  if (existingCategory) {
    return {
      categoryName: existingCategory,
      reason: "existing_category",
      confidence: 0.96,
      matchedKeyword: null,
    };
  }

  const normalizedName = normalizeText(ingredient?.name);
  if (!normalizedName) {
    return {
      categoryName: "Other",
      reason: "fallback",
      confidence: 0.2,
      matchedKeyword: null,
    };
  }

  for (const rule of CATEGORY_RULES) {
    const hit = rule.keywords.find((keyword) => {
      const token = normalizeText(keyword);
      return token && normalizedName.includes(token);
    });

    if (hit) {
      return {
        categoryName: rule.name,
        reason: "keyword_match",
        confidence: 0.85,
        matchedKeyword: hit,
      };
    }
  }

  return {
    categoryName: "Other",
    reason: "fallback",
    confidence: 0.4,
    matchedKeyword: null,
  };
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
