import mongoose from "mongoose";
import { Recipe, MenuItem, Menu } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

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

function normalizeSearchText(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function buildUnaccentRegexFromNormalized(normalized) {
  if (!normalized) return null;

  const unaccentProbe = [...normalized]
    .map((ch) => {
      if (ch === "a") return "[aàáạảãâầấậẩẫăằắặẳẵ]";
      if (ch === "e") return "[eèéẹẻẽêềếệểễ]";
      if (ch === "i") return "[iìíịỉĩ]";
      if (ch === "o") return "[oòóọỏõôồốộổỗơờớợởỡ]";
      if (ch === "u") return "[uùúụủũưừứựửữ]";
      if (ch === "y") return "[yỳýỵỷỹ]";
      if (ch === "d") return "[dđ]";
      if (ch === " ") return "\\s+";
      return escapeRegex(ch);
    })
    .join("");

  return new RegExp(unaccentProbe, "i");
}

function buildRecipeSearchSortKey({ menuItem, recipe }, normalizedQuery) {
  const name = normalizeSearchText(menuItem?.name);
  const description = normalizeSearchText(menuItem?.description);
  const notes = normalizeSearchText(recipe?.notes);
  const variantNames = Array.isArray(recipe?.servingVariants)
    ? recipe.servingVariants.map((v) => normalizeSearchText(v?.name)).filter(Boolean)
    : [];

  if (name === normalizedQuery) return { group: 0, text: name };
  if (name.startsWith(normalizedQuery)) return { group: 1, text: name };
  if (name.includes(normalizedQuery)) return { group: 2, text: name };
  if (variantNames.some((v) => v === normalizedQuery)) {
    return { group: 3, text: variantNames.find((v) => v === normalizedQuery) };
  }
  if (variantNames.some((v) => v.startsWith(normalizedQuery))) {
    return {
      group: 4,
      text: variantNames.find((v) => v.startsWith(normalizedQuery)),
    };
  }
  if (variantNames.some((v) => v.includes(normalizedQuery))) {
    return {
      group: 5,
      text: variantNames.find((v) => v.includes(normalizedQuery)),
    };
  }
  if (description && description.includes(normalizedQuery)) {
    return { group: 6, text: description };
  }
  if (notes && notes.includes(normalizedQuery)) {
    return { group: 7, text: notes };
  }
  return null;
}

export default {
  recipe: async (_p, { restaurantId, menuItemId }, ctx) => {
    if (![restaurantId, menuItemId].every(mongoose.isValidObjectId))
      return null;

    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.INVENTORY_READ);

    return Recipe.findOne({ restaurantId, menuItemId })
      .select({ __v: 0 })
      .lean({ virtuals: true });
  },

  recipesByMenuItems: async (_p, { restaurantId, menuItemIds }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.INVENTORY_READ);

    const ids = (menuItemIds || []).filter(mongoose.isValidObjectId);
    if (!ids.length) return [];

    return Recipe.find({ restaurantId, menuItemId: { $in: ids } })
      .select({ __v: 0 })
      .lean({ virtuals: true });
  },

  /**
   * ✅ Search cho tab Công thức:
   * - Ưu tiên theo tên món/menu item
   * - Hỗ trợ không dấu + không phân biệt hoa thường
   * - Search phụ theo recipe notes + servingVariants.name
   * - Tránh match quá rộng (code/labels/ingredient/category...)
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
  ,
    ctx
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) {
      return {
        total: 0,
        pageInfo: { endCursor: null, hasNextPage: false },
        items: [],
      };
    }

    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.INVENTORY_READ);

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

    // === SEARCH: menu item + recipe ===
    const normalizedSearch = normalizeSearchText(search);

    let filteredMenuItemIds = null; // null = không áp filter search

    if (normalizedSearch) {
      const rx = buildUnaccentRegexFromNormalized(normalizedSearch);

      // 2.1) menu item matches
      const miMatches = await MenuItem.find({
        ...qBase,
        $or: [{ name: rx }, { description: rx }],
      })
        .select({ _id: 1 })
        .limit(5000)
        .lean();

      const idsFromMenuItem = miMatches.map((d) => d._id);

      // 2.2) recipe matches
      const recipeMatches = await Recipe.find({
        restaurantId,
        $or: [{ notes: rx }, { "servingVariants.name": rx }],
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
    let rows = items.map((mi) => ({
      menuItem: {
        ...mi,
        id: String(mi._id),
      },
      recipe: recipeByMenuItem.get(String(mi._id)) || null,
    }));

    if (normalizedSearch) {
      rows = rows
        .map((row) => ({
          row,
          rank: buildRecipeSearchSortKey(row, normalizedSearch),
        }))
        .filter((entry) => entry.rank !== null)
        .sort((a, b) => {
          if (a.rank.group !== b.rank.group) return a.rank.group - b.rank.group;
          return String(a.rank.text || "").localeCompare(String(b.rank.text || ""), "vi");
        })
        .map((entry) => entry.row);
    }

    const endCursor = String(items[items.length - 1]._id);

    return {
      total,
      pageInfo: { endCursor, hasNextPage },
      items: rows,
    };
  },
};
