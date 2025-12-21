import mongoose from "mongoose";
import { Recipe, MenuItem, Menu } from "../../../models/index.js";

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

  menuItemsWithRecipes: async (
    _,
    {
      restaurantId,
      timeSlot, // 'breakfast'|'lunch'|'dinner'|'late-night' | null
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

    // 2) Filter MenuItem
    const q = { restaurantId, menuId: { $in: menuIds } };

    if (categoryId && mongoose.isValidObjectId(categoryId)) {
      q.categoryId = new mongoose.Types.ObjectId(categoryId);
    }

    if (search && String(search).trim()) {
      const pattern = escapeRegex(String(search).trim());
      q.name = new RegExp(pattern, "i");
    }

    // Cursor-based pagination theo _id tăng dần
    const cursorId = toObjectIdOrNull(after);
    if (cursorId) {
      q._id = { $gt: cursorId };
    }

    const safeLimit = Math.min(Math.max(first || 30, 1), 200);

    // 3) total (optional)
    const total = await MenuItem.countDocuments({
      restaurantId,
      menuId: { $in: menuIds },
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.name ? { name: q.name } : {}),
    });

    // 4) lấy items + 1 để tính hasNext
    const itemsPlusOne = await MenuItem.find(q)
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

    // 5) Lấy recipes tương ứng
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

    // 6) Build rows { menuItem, recipe }
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
