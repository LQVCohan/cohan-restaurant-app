import mongoose from "mongoose";
import { Recipe, MenuItem, Menu, Ingredient } from "../../../models/index.js";

function toObjectIdOrNull(v) {
  if (!v) return null;

  if (v instanceof mongoose.Types.ObjectId) return v;

  const s = typeof v === "string" ? v : String(v);

  if (!mongoose.isValidObjectId(s)) return null;

  return mongoose.Types.ObjectId.createFromHexString(s);
}

function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default {
  recipe: async (_p, { restaurantId, menuItemId }) => {
    if (![restaurantId, menuItemId].every(mongoose.isValidObjectId))
      return null;

    return Recipe.findOne({ restaurantId, menuItemId })
      .select({ __v: 0 })
      .lean({ virtuals: true });
  },

  recipesByMenuItems: async (_p, { restaurantId, menuItemIds }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    const ids = (menuItemIds || []).filter(mongoose.isValidObjectId);
    if (!ids.length) return [];

    return Recipe.find({ restaurantId, menuItemId: { $in: ids } })
      .select({ __v: 0 })
      .lean({ virtuals: true });
  },

  /**
   * ✅ Search nâng cấp:
   * - Search món: name/description/code/labels
   * - Search công thức: notes, servingVariants.name, servingVariants.key
   * - Search theo nguyên liệu: Ingredient.name/sku/category -> recipe chứa ingredientId
   *
   * Output giữ nguyên shape:
   * { total, pageInfo, items: [{ menuItem, recipe }] }
   */
  menuItemsWithRecipes: async (
    _,
    {
      restaurantId,
      timeSlot,
      search = null,
      categoryId = null,
      first = 30,
      after = null,
    }
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) {
      return {
        total: 0,
        pageInfo: { endCursor: null, hasNextPage: false },
        items: [],
      };
    }

    // 1) Lấy menu theo timeSlot hoặc tất cả
    let menus = [];
    if (timeSlot) {
      const m = await Menu.findOne({ restaurantId, timeSlot })
        .select({ __v: 0 })
        .lean({ virtuals: true });

      if (!m) {
        return {
          total: 0,
          pageInfo: { endCursor: null, hasNextPage: false },
          items: [],
        };
      }
      menus = [m];
    } else {
      menus = await Menu.find({ restaurantId })
        .select({ __v: 0 })
        .lean({ virtuals: true });

      if (!menus.length) {
        return {
          total: 0,
          pageInfo: { endCursor: null, hasNextPage: false },
          items: [],
        };
      }
    }

    const menuIds = menus.map((m) => m._id);

    // 2) Base filter MenuItem theo menuIds + category
    const qBase = { restaurantId, menuId: { $in: menuIds } };

    if (categoryId && mongoose.isValidObjectId(categoryId)) {
      qBase.categoryId = new mongoose.Types.ObjectId(categoryId);
    }

    // Cursor-based pagination theo _id tăng dần
    const cursorId = toObjectIdOrNull(after);

    const safeLimit = Math.min(Math.max(first || 30, 1), 200);

    // === SEARCH: menu item + recipe + ingredient ===
    const s = search && String(search).trim() ? String(search).trim() : null;

    let filteredMenuItemIds = null; // null = không áp filter search

    if (s) {
      const pattern = escapeRegex(s);
      const rx = new RegExp(pattern, "i");

      // 2.1) menu item matches
      const miMatches = await MenuItem.find({
        ...qBase,
        $or: [{ name: rx }, { description: rx }, { code: rx }, { labels: rx }],
      })
        .select({ _id: 1 })
        .limit(5000)
        .lean();

      const idsFromMenuItem = miMatches.map((d) => d._id);

      // 2.2) ingredient matches -> lấy ingredientIds
      const ingMatches = await Ingredient.find({
        restaurantId,
        isActive: true,
        $or: [{ name: rx }, { sku: rx }, { category: rx }],
      })
        .select({ _id: 1 })
        .limit(200)
        .lean();

      const ingredientIds = ingMatches.map((d) => d._id);

      // 2.3) recipe matches
      const recipeOr = [
        { notes: rx },
        { "servingVariants.name": rx },
        { "servingVariants.key": rx },
      ];

      if (ingredientIds.length) {
        recipeOr.push({
          "servingVariants.ingredients.ingredientId": { $in: ingredientIds },
        });
      }

      const recipeMatches = await Recipe.find({
        restaurantId,
        $or: recipeOr,
      })
        .select({ menuItemId: 1 })
        .limit(10000)
        .lean();

      const idsFromRecipe = recipeMatches
        .map((r) => r.menuItemId)
        .filter(Boolean);

      // union ids
      const union = new Map();
      idsFromMenuItem.forEach((id) => union.set(String(id), id));
      idsFromRecipe.forEach((id) => union.set(String(id), id));

      filteredMenuItemIds = Array.from(union.values());

      // search mà không ra gì -> return empty
      if (!filteredMenuItemIds.length) {
        return {
          total: 0,
          pageInfo: { endCursor: null, hasNextPage: false },
          items: [],
        };
      }
    }

    // 3) Build query lấy page items
    const qPage = { ...qBase };

    // áp cursor
    if (cursorId) {
      qPage._id = { $gt: cursorId };
    }

    // áp search filter
    if (filteredMenuItemIds) {
      if (qPage._id && typeof qPage._id === "object") {
        qPage._id = { ...qPage._id, $in: filteredMenuItemIds };
      } else {
        qPage._id = { $in: filteredMenuItemIds };
      }
    }

    // 4) total (không tính cursor)
    let total = 0;
    if (filteredMenuItemIds) {
      total = await MenuItem.countDocuments({
        ...qBase,
        _id: { $in: filteredMenuItemIds },
      });
    } else {
      total = await MenuItem.countDocuments(qBase);
    }

    // 5) lấy items + 1 để tính hasNext
    const itemsPlusOne = await MenuItem.find(qPage)
      .select({ __v: 0 })
      .sort({ _id: 1 })
      .limit(safeLimit + 1)
      .lean({ virtuals: true });

    const hasNextPage = itemsPlusOne.length > safeLimit;
    const items = hasNextPage ? itemsPlusOne.slice(0, safeLimit) : itemsPlusOne;

    if (!items.length) {
      return {
        total,
        pageInfo: { endCursor: null, hasNextPage: false },
        items: [],
      };
    }

    // 6) Lấy recipes tương ứng cho page
    const menuItemIds = items.map((i) => i._id);

    const recipes = await Recipe.find({
      restaurantId,
      menuItemId: { $in: menuItemIds },
    })
      .select({ __v: 0 })
      .lean({ virtuals: true });

    const recipeByMenuItem = new Map(
      recipes.map((r) => [String(r.menuItemId), r])
    );

    // 7) Build rows { menuItem, recipe }
    const rows = items.map((mi) => ({
      menuItem: {
        ...mi,
        id: String(mi._id),
      },
      recipe: recipeByMenuItem.get(String(mi._id)) || null,
    }));

    const endCursor = String(items[items.length - 1]._id);

    return {
      total,
      pageInfo: { endCursor, hasNextPage },
      items: rows,
    };
  },
};
