import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Ingredient, IngredientCategory } from "../../../models/index.js";

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

export default {
  createIngredientCategory: async (_p, { input }) => {
    if (!mongoose.isValidObjectId(input?.restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }
    const name = titleCase(input?.name);
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

    if (typeof name === "string") {
      const nextName = titleCase(name);
      const nextSlug = slugify(nextName);
      if (!nextName || !nextSlug) {
        throw new GraphQLError("Category name is invalid");
      }
      current.name = nextName;
      current.slug = nextSlug;
    }
    if (typeof isActive === "boolean") current.isActive = isActive;

    await current.save();
    return current.toObject({ virtuals: true });
  },

  deleteIngredientCategory: async (_p, { id }) => {
    if (!mongoose.isValidObjectId(id)) return false;
    const doc = await IngredientCategory.findById(id).lean();
    if (!doc) return false;
    await IngredientCategory.deleteOne({ _id: id });
    return true;
  },

  syncIngredientCategoriesFromIngredients: async (_p, { restaurantId }) => {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }

    const ingredients = await Ingredient.find({
      restaurantId,
      isActive: true,
      category: { $exists: true, $ne: "" },
    })
      .select({ _id: 1, category: 1 })
      .lean();

    const grouped = new Map();
    for (const ing of ingredients) {
      const raw = String(ing.category || "").trim();
      if (!raw) continue;
      const normalizedName = titleCase(raw);
      const slug = slugify(normalizedName);
      if (!slug) continue;
      const entry = grouped.get(slug) || { name: normalizedName, count: 0, raws: new Set() };
      entry.count += 1;
      entry.raws.add(raw);
      grouped.set(slug, entry);
    }

    for (const [slug, item] of grouped.entries()) {
      await IngredientCategory.findOneAndUpdate(
        { restaurantId, slug },
        {
          $set: {
            name: item.name,
            source: "sync",
            usageCount: item.count,
            isActive: true,
          },
        },
        { upsert: true, new: true },
      );

      for (const raw of item.raws) {
        await Ingredient.updateMany(
          {
            restaurantId,
            category: new RegExp(`^\\s*${raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"),
          },
          { $set: { category: item.name } },
        );
      }
    }

    return IngredientCategory.find({ restaurantId, isActive: true })
      .sort({ usageCount: -1, name: 1 })
      .lean({ virtuals: true });
  },
};
