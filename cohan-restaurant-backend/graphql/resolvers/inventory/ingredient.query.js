import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import {
  Ingredient,
  Recipe,
  IngredientRecent,
  MenuItem,
} from "../../../models/index.js";

function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const reorderByIdList = (docs, idList) => {
  const map = new Map(docs.map((d) => [String(d._id || d.id), d]));
  return idList.map((id) => map.get(String(id))).filter(Boolean);
};

export default {
  ingredients: async (_p, { restaurantId, search, limit }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    const q = { restaurantId, isActive: true };

    if (search?.trim()) {
      const pattern = escapeRegex(search.trim());
      const rx = new RegExp(pattern, "i");
      q.$or = [{ name: rx }, { sku: rx }, { category: rx }];
    }

    return Ingredient.find(q)
      .sort({ name: 1 })
      .limit(Math.min(limit ?? 100, 500))
      .select({ __v: 0 })
      .lean({ virtuals: true });
  },

  ingredient: async (_p, { id }) => {
    if (!mongoose.isValidObjectId(id)) return null;
    return Ingredient.findById(id).select({ __v: 0 }).lean({ virtuals: true });
  },

  /**
   * ✅ Suggestion payload cho FE
   * - topUsed: top N nguyên liệu xuất hiện nhiều nhất trong Recipe
   * - recentUsed: theo user (IngredientRecent) nếu có auth, fallback theo Recipe updatedAt
   * - recentCreated: mới tạo gần đây
   */
  ingredientSuggestions: async (_p, { restaurantId, limit = 8 }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }

    const rid = new mongoose.Types.ObjectId(String(restaurantId));
    const LIM = Math.min(Math.max(limit || 8, 1), 20);

    // 1) recentCreated: mới tạo gần đây
    const recentCreated = await Ingredient.find({
      restaurantId: rid,
      isActive: true,
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(LIM)
      .select({ __v: 0 })
      .lean({ virtuals: true });

    // 2) topUsed: aggregate trên Recipe
    const topAgg = await Recipe.aggregate([
      { $match: { restaurantId: rid } },
      { $unwind: "$servingVariants" },
      { $unwind: "$servingVariants.ingredients" },
      {
        $group: {
          _id: "$servingVariants.ingredients.ingredientId",
          useCount: { $sum: 1 },
          lastSeen: { $max: "$updatedAt" },
        },
      },
      { $sort: { useCount: -1, lastSeen: -1 } },
      { $limit: LIM },
    ]);

    const topIds = topAgg.map((x) => x._id).filter(Boolean);

    const topDocs = topIds.length
      ? await Ingredient.find({
          _id: { $in: topIds },
          isActive: true,
        })
          .select({ __v: 0 })
          .lean({ virtuals: true })
      : [];

    const topUsed = reorderByIdList(topDocs, topIds);

    // 3) recentUsed: theo user recent table, fallback theo recipe lastSeen
    const uidRaw = ctx?.user?.id;
    let recentUsed = [];

    if (uidRaw && mongoose.isValidObjectId(uidRaw)) {
      const uid = new mongoose.Types.ObjectId(String(uidRaw));

      const recentRows = await IngredientRecent.find({
        restaurantId: rid,
        userId: uid,
      })
        .sort({ lastUsedAt: -1 })
        .limit(LIM)
        .lean();

      const recentIds = recentRows.map((r) => r.ingredientId).filter(Boolean);

      const recentDocs = recentIds.length
        ? await Ingredient.find({
            _id: { $in: recentIds },
            isActive: true,
          })
            .select({ __v: 0 })
            .lean({ virtuals: true })
        : [];

      recentUsed = reorderByIdList(recentDocs, recentIds);
    } else {
      const recentAgg = await Recipe.aggregate([
        { $match: { restaurantId: rid } },
        { $unwind: "$servingVariants" },
        { $unwind: "$servingVariants.ingredients" },
        {
          $group: {
            _id: "$servingVariants.ingredients.ingredientId",
            lastSeen: { $max: "$updatedAt" },
          },
        },
        { $sort: { lastSeen: -1 } },
        { $limit: LIM },
      ]);

      const recentIds = recentAgg.map((x) => x._id).filter(Boolean);

      const recentDocs = recentIds.length
        ? await Ingredient.find({
            _id: { $in: recentIds },
            isActive: true,
          })
            .select({ __v: 0 })
            .lean({ virtuals: true })
        : [];

      recentUsed = reorderByIdList(recentDocs, recentIds);
    }

    return {
      topUsed,
      recentUsed,
      recentCreated,
    };
  },

  /**
   * Danh sách món đang sử dụng một nguyên liệu cụ thể (theo recipe.servingVariants)
   */
  menuItemsUsingIngredient: async (
    _p,
    { restaurantId, ingredientId, limit = 100 }
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    if (!mongoose.isValidObjectId(ingredientId)) return [];

    // Tìm các recipe có chứa ingredientId
    const recipes = await Recipe.find({
      restaurantId,
      "servingVariants.ingredients.ingredientId": ingredientId,
    })
      .select({ menuItemId: 1 })
      .limit(Math.min(limit ?? 100, 500))
      .lean();

    const menuItemIds = [
      ...new Set(
        recipes
          .map((r) => r.menuItemId)
          .filter((id) => mongoose.isValidObjectId(id))
          .map((id) => String(id))
      ),
    ];

    if (!menuItemIds.length) return [];

    const menuItems = await MenuItem.find({
      _id: { $in: menuItemIds.map((id) => new mongoose.Types.ObjectId(id)) },
      restaurantId,
    })
      .select({ __v: 0 })
      .lean({ virtuals: true });

    return reorderByIdList(menuItems, menuItemIds);
  },
};
