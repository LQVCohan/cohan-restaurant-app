// src/graphql/resolvers/menu/query.js (CLEAN + aligned with Recipe-as-source-of-truth)
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Menu, MenuItem, Category } from "../../../models/index.js";
import { requireRoles } from "../../guards.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

const MENU_ITEM_SORTS = new Set([
  "default",
  "name_asc",
  "name_desc",
  "price_asc",
  "price_desc",
]);
const DEFAULT_MENU_ITEM_SORT = "default";

const toObjectIdOrNull = (id) => {
  try {
    return mongoose.isValidObjectId(id)
      ? new mongoose.Types.ObjectId(String(id))
      : null;
  } catch {
    return null;
  }
};

const normalizeMenuItemSort = (sort) =>
  MENU_ITEM_SORTS.has(sort) ? sort : DEFAULT_MENU_ITEM_SORT;

const getMenuItemsListSortSpec = (sort = DEFAULT_MENU_ITEM_SORT) => {
  switch (normalizeMenuItemSort(sort)) {
    case "name_desc":
      return { name: -1, _id: -1 };
    case "price_asc":
      return { basePrice: 1, _id: 1 };
    case "price_desc":
      return { basePrice: -1, _id: -1 };
    case "default":
    case "name_asc":
    default:
      return { name: 1, _id: 1 };
  }
};

const getMenuItemConnectionSortSpec = (sort = DEFAULT_MENU_ITEM_SORT) => {
  switch (normalizeMenuItemSort(sort)) {
    case "name_asc":
      return { name: 1, _id: 1 };
    case "name_desc":
      return { name: -1, _id: -1 };
    case "price_asc":
      return { basePrice: 1, _id: 1 };
    case "price_desc":
      return { basePrice: -1, _id: -1 };
    default:
      return { _id: 1 };
  }
};

const encodeMenuItemCursor = (doc, sort = DEFAULT_MENU_ITEM_SORT) => {
  const normalizedSort = normalizeMenuItemSort(sort);
  if (!doc?._id) return null;

  if (normalizedSort === DEFAULT_MENU_ITEM_SORT) {
    return String(doc._id);
  }

  const payload = {
    sort: normalizedSort,
    id: String(doc._id),
    value:
      normalizedSort === "name_asc" || normalizedSort === "name_desc"
        ? doc.name || ""
        : doc.basePrice ?? null,
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
};

const buildMenuItemCursorCondition = (cursor, sort = DEFAULT_MENU_ITEM_SORT) => {
  const normalizedSort = normalizeMenuItemSort(sort);
  if (!cursor) return null;

  if (normalizedSort === DEFAULT_MENU_ITEM_SORT) {
    const cursorId = toObjectIdOrNull(cursor);
    return cursorId ? { _id: { $gt: cursorId } } : null;
  }

  let parsed = null;
  try {
    parsed = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const cursorId = toObjectIdOrNull(parsed?.id);
  if (!cursorId) return null;

  if (
    parsed?.sort &&
    normalizeMenuItemSort(parsed.sort) !== normalizedSort
  ) {
    return null;
  }

  if (normalizedSort === "name_asc") {
    const cursorName = typeof parsed?.value === "string" ? parsed.value : "";
    return {
      $or: [
        { name: { $gt: cursorName } },
        { name: cursorName, _id: { $gt: cursorId } },
      ],
    };
  }

  if (normalizedSort === "name_desc") {
    const cursorName = typeof parsed?.value === "string" ? parsed.value : "";
    return {
      $or: [
        { name: { $lt: cursorName } },
        { name: cursorName, _id: { $lt: cursorId } },
      ],
    };
  }

  const rawPrice = parsed?.value;
  const cursorPrice =
    rawPrice === null || rawPrice === undefined ? null : Number(rawPrice);

  if (
    rawPrice !== null &&
    rawPrice !== undefined &&
    !Number.isFinite(cursorPrice)
  ) {
    return null;
  }

  if (normalizedSort === "price_asc") {
    return {
      $or: [
        { basePrice: { $gt: cursorPrice } },
        { basePrice: cursorPrice, _id: { $gt: cursorId } },
      ],
    };
  }

  return {
    $or: [
      { basePrice: { $lt: cursorPrice } },
      { basePrice: cursorPrice, _id: { $lt: cursorId } },
    ],
  };
};

const appendAndCondition = (query, condition) => {
  if (!condition) return query;
  query.$and = (query.$and || []).concat([condition]);
  return query;
};

function isInternalMenuQuery(args = {}) {
  const status = args?.status || args?.filter?.status;
  return Boolean(
    args?.includeInactive ||
      args?.adminOnly ||
      ["draft", "unavailable", "out_of_stock", "hidden"].includes(String(status || "").toLowerCase()),
  );
}

function applyPublicMenuItemFilter(query) {
  if (!query.status) query.status = "available";
  return query;
}

export const MenuQuery = {
  menus: async (_p, { restaurantId }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    return Menu.find({ restaurantId, isActive: true })
      .sort({ timeSlot: 1 })
      .lean({ virtuals: true });
  },

  menu: async (_p, { restaurantId, timeSlot }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return null;
    return Menu.findOne({ restaurantId, timeSlot, isActive: true }).lean({ virtuals: true });
  },

  // Note: menuItems here returns MenuItem only (no recipe populate).
  // Recipe/servingVariants should be fetched via inventory.menuItemsWithRecipes or type resolvers.
  menuItems: async (
    _p,
    {
      restaurantId,
      timeSlot,
      categoryId,
      search,
      sort = DEFAULT_MENU_ITEM_SORT,
      limit = 50,
    },
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    const q = applyPublicMenuItemFilter({ restaurantId });

    if (timeSlot) {
      const menu = await Menu.findOne({ restaurantId, timeSlot })
        .select({ _id: 1 })
        .lean();
      if (!menu) return [];
      q.menuId = menu._id;
    }

    if (categoryId && mongoose.isValidObjectId(categoryId)) {
      q.categoryId = categoryId;
    }

    if (search?.trim()) {
      q.name = new RegExp(search.trim(), "i");
    }

    const safeLimit = Math.min(Math.max(limit || 50, 1), 500);
    const normalizedSort = normalizeMenuItemSort(sort);

    return MenuItem.find(q)
      .sort(getMenuItemsListSortSpec(normalizedSort))
      .limit(safeLimit)
      .lean({ virtuals: true });
  },

  menuItemsConnection: async (_p, { limit = 20, cursor, filter }, ctx) => {
    if (!filter || !filter.restaurantId) {
      throw new GraphQLError("filter.restaurantId is required", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    if (!mongoose.isValidObjectId(filter.restaurantId)) {
      return {
        edges: [],
        pageInfo: { endCursor: null, hasNextPage: false },
      };
    }
    const internalQuery = isInternalMenuQuery({ filter });
    if (internalQuery) {
      await requireRestaurantPermission(ctx, filter.restaurantId, PERMISSIONS.MENU_READ);
    }

    const q = internalQuery
      ? { restaurantId: filter.restaurantId }
      : applyPublicMenuItemFilter({ restaurantId: filter.restaurantId });

    // timeSlot -> menuId
    if (filter.timeSlot) {
      const m = await Menu.findOne({
        restaurantId: filter.restaurantId,
        timeSlot: filter.timeSlot,
      })
        .select({ _id: 1 })
        .lean();

      if (!m) {
        return {
          edges: [],
          pageInfo: { endCursor: null, hasNextPage: false },
        };
      }
      q.menuId = m._id;
    }

    if (filter.categoryId && mongoose.isValidObjectId(filter.categoryId)) {
      q.categoryId = filter.categoryId;
    }

    if (filter.status) q.status = filter.status;

    if (filter.search && filter.search.trim()) {
      const s = filter.search.trim();
      q.$or = [
        { name: new RegExp(s, "i") },
        { description: new RegExp(s, "i") },
      ];
    }

    // Price range: filter by MenuItem.basePrice (cached min variant price)
    const hasMin = typeof filter.minPrice === "number";
    const hasMax = typeof filter.maxPrice === "number";
    if (hasMin || hasMax) {
      const cond = {};
      if (hasMin) cond.$gte = filter.minPrice;
      if (hasMax) cond.$lte = filter.maxPrice;
      appendAndCondition(q, { basePrice: cond });
    }

    const normalizedSort = normalizeMenuItemSort(filter.sort);
    appendAndCondition(q, buildMenuItemCursorCondition(cursor, normalizedSort));

    const safeLimit = Math.min(Math.max(limit || 20, 1), 200);

    const docs = await MenuItem.find(q)
      .sort(getMenuItemConnectionSortSpec(normalizedSort))
      .limit(safeLimit + 1)
      .lean({ virtuals: true });

    const hasNextPage = docs.length > safeLimit;
    const slice = hasNextPage ? docs.slice(0, safeLimit) : docs;

    return {
      edges: slice.map((d) => ({
        node: d,
        cursor: encodeMenuItemCursor(d, normalizedSort),
      })),
      pageInfo: {
        endCursor: slice.length
          ? encodeMenuItemCursor(slice[slice.length - 1], normalizedSort)
          : null,
        hasNextPage,
      },
    };
  },

  topMenuItems: async (
    _p,
    { limit = 8, restaurantId, categoryId, categoryName, timeSlot },
    ctx,
  ) => {
    const LIM = Math.min(Math.max(limit, 1), 200);

    const q = {};
    if (restaurantId) {
      if (!mongoose.isValidObjectId(restaurantId)) return [];
      q.restaurantId = restaurantId;
    } else {
      requireRoles(ctx, ["ADMIN"]);
    }

    if (timeSlot) {
      const menuFilter = { timeSlot };
      if (q.restaurantId) {
        menuFilter.restaurantId = q.restaurantId;
      }

      const menus = await Menu.find(menuFilter).select({ _id: 1 }).lean();
      if (!menus.length) return [];

      q.menuId = { $in: menus.map((menu) => menu._id) };
    }

    if (categoryId && mongoose.isValidObjectId(categoryId)) {
      q.categoryId = categoryId;
    } else if (categoryName?.trim()) {
      const categoryFilter = {
        name: new RegExp(`^${categoryName.trim()}$`, "i"),
      };
      const matchedCategories = await Category.find(categoryFilter)
        .select({ _id: 1 })
        .lean();

      const matchedIds = matchedCategories.map((c) => c._id);
      if (!matchedIds.length) return [];

      q.categoryId = { $in: matchedIds };
    }

    applyPublicMenuItemFilter(q);

    return MenuItem.find(q)
      .sort({ rate: -1, orderCounter: -1, createdAt: -1, _id: 1 })
      .limit(LIM)
      .lean({ virtuals: true });
  },
};
