import mongoose from "mongoose";
import { Recipe, MenuItem, Menu } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

const ACTIVE_RECIPE_FILTER = { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] };

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
  if (variantNames.some((v) => v === normalizedQuery)) return { group: 3, text: variantNames.find((v) => v === normalizedQuery) };
  if (variantNames.some((v) => v.startsWith(normalizedQuery))) return { group: 4, text: variantNames.find((v) => v.startsWith(normalizedQuery)) };
  if (variantNames.some((v) => v.includes(normalizedQuery))) return { group: 5, text: variantNames.find((v) => v.includes(normalizedQuery)) };
  if (description && description.includes(normalizedQuery)) return { group: 6, text: description };
  if (notes && notes.includes(normalizedQuery)) return { group: 7, text: notes };
  return null;
}

export default {
  recipe: async (_p, { restaurantId, menuItemId }, ctx) => {
    if (![restaurantId, menuItemId].every(mongoose.isValidObjectId)) return null;
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.INVENTORY_READ);
    return Recipe.findOne({ restaurantId, menuItemId, ...ACTIVE_RECIPE_FILTER })
      .select({ __v: 0 })
      .lean({ virtuals: true });
  },

  recipeTrash: async (_p, { restaurantId, limit = 200 }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.INVENTORY_READ);

    const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
    const recipes = await Recipe.find({ restaurantId, deletedAt: { $ne: null } })
      .select({ __v: 0 })
      .sort({ deletedAt: -1, updatedAt: -1 })
      .limit(safeLimit)
      .lean({ virtuals: true });

    if (!recipes.length) return [];
    const menuItemIds = recipes.map((r) => r.menuItemId).filter(Boolean);
    const menuItems = await MenuItem.find({ restaurantId, _id: { $in: menuItemIds } })
      .select({ __v: 0 })
      .lean({ virtuals: true });
    const menuMap = new Map(menuItems.map((item) => [String(item._id), { ...item, id: String(item._id) }]));

    return recipes.map((recipe) => ({
      recipe,
      menuItem: menuMap.get(String(recipe.menuItemId)) || null,
    }));
  },

  recipesByMenuItems: async (_p, { restaurantId, menuItemIds }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.INVENTORY_READ);
    const ids = (menuItemIds || []).filter(mongoose.isValidObjectId);
    if (!ids.length) return [];
    return Recipe.find({ restaurantId, menuItemId: { $in: ids }, ...ACTIVE_RECIPE_FILTER })
      .select({ __v: 0 })
      .lean({ virtuals: true });
  },

  menuItemsWithRecipes: async (_, { restaurantId, timeSlot, search = null, categoryId = null, first = 30, after = null }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) {
      return { total: 0, pageInfo: { endCursor: null, hasNextPage: false }, items: [] };
    }

    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.INVENTORY_READ);

    const menuFilter = { restaurantId, ...(timeSlot ? { timeSlot } : {}) };
    const menus = await Menu.find(menuFilter)
      .select({ __v: 0 })
      .lean({ virtuals: true });
    if (!menus.length) {
      return { total: 0, pageInfo: { endCursor: null, hasNextPage: false }, items: [] };
    }

    const menuIds = menus.map((m) => m._id);
    const qBase = { restaurantId, menuId: { $in: menuIds } };
    if (categoryId && mongoose.isValidObjectId(categoryId)) qBase.categoryId = new mongoose.Types.ObjectId(categoryId);

    const cursorId = toObjectIdOrNull(after);
    const safeLimit = Math.min(Math.max(first || 30, 1), 200);
    const normalizedSearch = normalizeSearchText(search);
    let filteredMenuItemIds = null;

    if (normalizedSearch) {
      const rx = buildUnaccentRegexFromNormalized(normalizedSearch);
      const miMatches = await MenuItem.find({ ...qBase, $or: [{ name: rx }, { description: rx }] })
        .select({ _id: 1 })
        .limit(5000)
        .lean();
      const idsFromMenuItem = miMatches.map((d) => d._id);

      const recipeMatches = await Recipe.find({
        restaurantId,
        ...ACTIVE_RECIPE_FILTER,
        $or: [{ notes: rx }, { "servingVariants.name": rx }],
      })
        .select({ menuItemId: 1 })
        .limit(10000)
        .lean();

      const idsFromRecipe = recipeMatches.map((r) => r.menuItemId).filter(Boolean);
      const union = new Map();
      idsFromMenuItem.forEach((id) => union.set(String(id), id));
      idsFromRecipe.forEach((id) => union.set(String(id), id));
      filteredMenuItemIds = Array.from(union.values());
      if (!filteredMenuItemIds.length) return { total: 0, pageInfo: { endCursor: null, hasNextPage: false }, items: [] };
    }

    const qPage = { ...qBase };
    if (cursorId) qPage._id = { $gt: cursorId };
    if (filteredMenuItemIds) {
      qPage._id = qPage._id && typeof qPage._id === "object"
        ? { ...qPage._id, $in: filteredMenuItemIds }
        : { $in: filteredMenuItemIds };
    }

    const total = filteredMenuItemIds
      ? await MenuItem.countDocuments({ ...qBase, _id: { $in: filteredMenuItemIds } })
      : await MenuItem.countDocuments(qBase);

    const itemsPlusOne = await MenuItem.find(qPage)
      .select({ __v: 0 })
      .sort({ _id: 1 })
      .limit(safeLimit + 1)
      .lean({ virtuals: true });

    const hasNextPage = itemsPlusOne.length > safeLimit;
    const items = hasNextPage ? itemsPlusOne.slice(0, safeLimit) : itemsPlusOne;
    if (!items.length) return { total, pageInfo: { endCursor: null, hasNextPage: false }, items: [] };

    const menuItemIds = items.map((i) => i._id);
    const recipes = await Recipe.find({ restaurantId, menuItemId: { $in: menuItemIds }, ...ACTIVE_RECIPE_FILTER })
      .select({ __v: 0 })
      .lean({ virtuals: true });

    const recipeByMenuItem = new Map(recipes.map((r) => [String(r.menuItemId), r]));
    let rows = items.map((mi) => ({
      menuItem: { ...mi, id: String(mi._id) },
      recipe: recipeByMenuItem.get(String(mi._id)) || null,
    }));

    if (normalizedSearch) {
      rows = rows
        .map((row) => ({ row, rank: buildRecipeSearchSortKey(row, normalizedSearch) }))
        .filter((entry) => entry.rank !== null)
        .sort((a, b) => {
          if (a.rank.group !== b.rank.group) return a.rank.group - b.rank.group;
          return String(a.rank.text || "").localeCompare(String(b.rank.text || ""), "vi");
        })
        .map((entry) => entry.row);
    }

    const endCursor = String(items[items.length - 1]._id);
    return { total, pageInfo: { endCursor, hasNextPage }, items: rows };
  },
};
