import mongoose from "mongoose";
import { IngredientCategory, EventLog } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";

function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default {
  ingredientCategories: async (
    _p,
    { restaurantId, search, includeInactive = false, limit = 200 },
    ctx
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireRestaurantAccess(ctx, restaurantId);

    const q = { restaurantId };
    if (!includeInactive) q.isActive = true;
    if (search?.trim()) {
      q.name = new RegExp(escapeRegex(search.trim()), "i");
    }

    return IngredientCategory.find(q)
      .sort({ usageCount: -1, name: 1 })
      .limit(Math.min(limit ?? 200, 500))
      .lean({ virtuals: true });
  },

  ingredientCategorySyncLogs: async (_p, { restaurantId, limit = 10 }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireRestaurantAccess(ctx, restaurantId);

    const docs = await EventLog.find({
      restaurantId,
      verb: "inventory.ingredient_category_sync",
    })
      .sort({ at: -1, createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 50))
      .select({ actorUserId: 1, status: 1, at: 1, meta: 1 })
      .lean();

    return docs.map((doc) => ({
      id: String(doc._id),
      at: doc.at || doc.createdAt,
      actorUserId: doc.actorUserId ? String(doc.actorUserId) : null,
      status: doc.status || "info",
      totalIngredients: Number(doc?.meta?.totalIngredients) || 0,
      categoriesCreated: Number(doc?.meta?.categoriesCreated) || 0,
      categoriesUpdated: Number(doc?.meta?.categoriesUpdated) || 0,
      ingredientsReassigned: Number(doc?.meta?.ingredientsReassigned) || 0,
      skipped: Number(doc?.meta?.skipped) || 0,
      errors: Number(doc?.meta?.errors) || 0,
      summaryText: doc?.meta?.summaryText || "",
    }));
  },
};
