// src/graphql/resolvers/menu/query.js (CLEAN + aligned with Recipe-as-source-of-truth)
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Menu, MenuItem, Category } from "../../../models/index.js";
import { requireRestaurantAccess, requireRoles } from "../../guards.js";

const MENU_ITEM_SORTS = {
  default: { sort: { _id: 1 }, field: "_id", direction: 1 },
  name_asc: { sort: { name: 1, _id: 1 }, field: "name", direction: 1 },
  name_desc: { sort: { name: -1, _id: -1 }, field: "name", direction: -1 },
  price_asc: { sort: { basePrice: 1, _id: 1 }, field: "basePrice", direction: 1 },
  price_desc: { sort: { basePrice: -1, _id: -1 }, field: "basePrice", direction: -1 },
};

const NAME_SORT_OPTIONS = new Set(["name_asc", "name_desc"]);

const toObjectIdOrNull = (id) => {
  try {
    return mongoose.isValidObjectId(id)
      ? new mongoose.Types.ObjectId(String(id))
      : null;
  } catch {
    return null;
  }
};

const encodeCursor = ({ sort, value, id }) => {
  return Buffer.from(
    JSON.stringify({ sort, value: value ?? null, id: String(id) }),
    "utf8"
  ).toString("base64url");
};

const decodeCursor = (cursor, expectedSort) => {
  if (!cursor) return null;

  if (mongoose.isValidObjectId(cursor)) {
    if (expectedSort !== "default") {
      throw new GraphQLError("Cursor does not match current sort", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    return {
      sort: "default",
      value: null,
      id: String(cursor),
    };
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(String(cursor), "base64url").toString("utf8")
    );

    if (!decoded?.id || !mongoose.isValidObjectId(decoded.id)) {
      throw new Error("Invalid cursor id");
    }
    if (decoded.sort !== expectedSort) {
      throw new Error("Cursor sort mismatch");
    }

    return {
      sort: decoded.sort,
      value: decoded.value ?? null,
      id: String(decoded.id),
    };
  } catch {
    throw new GraphQLError("Invalid pagination cursor", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
};

const buildCursorQuery = ({ sortOption, cursor }) => {
  if (!cursor) return null;

  const cursorId = toObjectIdOrNull(cursor.id);
  if (!cursorId) {
    throw new GraphQLError("Invalid pagination cursor", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  if (sortOption === "default") {
    return { _id: { $gt: cursorId } };
  }

  if (sortOption === "name_asc") {
    return {
      $or: [
        { name: { $gt: cursor.value ?? "" } },
        { name: cursor.value ?? "", _id: { $gt: cursorId } },
      ],
    };
  }

  if (sortOption === "name_desc") {
    return {
      $or: [
        { name: { $lt: cursor.value ?? "" } },
        { name: cursor.value ?? "", _id: { $lt: cursorId } },
      ],
    };
  }

  if (sortOption === "price_asc") {
    return {
      $or: [
        { basePrice: { $gt: Number(cursor.value ?? 0) } },
        { basePrice: Number(cursor.value ?? 0), _id: { $gt: cursorId } },
      ],
    };
  }

  return {
    $or: [
      { basePrice: { $lt: Number(cursor.value ?? 0) } },
      { basePrice: Number(cursor.value ?? 0), _id: { $lt: cursorId } },
    ],
  };
};

const getCursorValue = (doc, sortOption) => {
  if (sortOption === "name_asc" || sortOption === "name_desc") {
    return doc?.name || "";
  }

  if (sortOption === "price_asc" || sortOption === "price_desc") {
    return typeof doc?.basePrice === "number" ? doc.basePrice : 0;
  }

  return null;
};

export const MenuQuery = {
  menus: async (_p, { restaurantId }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireRestaurantAccess(ctx, restaurantId);
    return Menu.find({ restaurantId })
      .sort({ timeSlot: 1 })
      .lean({ virtuals: true });
  },

  menu: async (_p, { restaurantId, timeSlot }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return null;
    await requireRestaurantAccess(ctx, restaurantId);
    return Menu.findOne({ restaurantId, timeSlot }).lean({ virtuals: true });
  },

  // Note: menuItems here returns MenuItem only (no recipe populate).
  // Recipe/servingVariants should be fetched via inventory.menuItemsWithRecipes or type resolvers.
  menuItems: async (
    _p,
    { restaurantId, timeSlot, categoryId, search, limit = 50 },
    ctx
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireRestaurantAccess(ctx, restaurantId);

    const q = { restaurantId };

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

    return MenuItem.find(q)
      .sort({ name: 1 })
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
    await requireRestaurantAccess(ctx, filter.restaurantId);

    const sortOption = MENU_ITEM_SORTS[filter.sort] ? filter.sort : "default";
    const sortConfig = MENU_ITEM_SORTS[sortOption];
    const q = { restaurantId: filter.restaurantId };

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

    const hasMin = typeof filter.minPrice === "number";
    const hasMax = typeof filter.maxPrice === "number";
    if (hasMin || hasMax) {
      const cond = {};
      if (hasMin) cond.$gte = filter.minPrice;
      if (hasMax) cond.$lte = filter.maxPrice;
      q.$and = (q.$and || []).concat([{ basePrice: cond }]);
    }

    const decodedCursor = decodeCursor(cursor, sortOption);
    const cursorQuery = buildCursorQuery({ sortOption, cursor: decodedCursor });
    if (cursorQuery) {
      q.$and = (q.$and || []).concat([cursorQuery]);
    }

    const safeLimit = Math.min(Math.max(limit || 20, 1), 200);

    let query = MenuItem.find(q)
      .sort(sortConfig.sort)
      .limit(safeLimit + 1)
      .lean({ virtuals: true });

    if (NAME_SORT_OPTIONS.has(sortOption)) {
      query = query.collation({ locale: "vi", strength: 1 });
    }

    const docs = await query;

    const hasNextPage = docs.length > safeLimit;
    const slice = hasNextPage ? docs.slice(0, safeLimit) : docs;

    return {
      edges: slice.map((d) => ({
        node: d,
        cursor: encodeCursor({
          sort: sortOption,
          value: getCursorValue(d, sortOption),
          id: d._id,
        }),
      })),
      pageInfo: {
        endCursor: slice.length
          ? encodeCursor({
              sort: sortOption,
              value: getCursorValue(slice[slice.length - 1], sortOption),
              id: slice[slice.length - 1]._id,
            })
          : null,
        hasNextPage,
      },
    };
  },

  topMenuItems: async (
    _p,
    { limit = 8, restaurantId, categoryId, categoryName, timeSlot },
    ctx
  ) => {
    const LIM = Math.min(Math.max(limit, 1), 200);

    const q = {};
    if (restaurantId) {
      if (!mongoose.isValidObjectId(restaurantId)) return [];
      await requireRestaurantAccess(ctx, restaurantId);
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

    return MenuItem.find(q)
      .sort({ rate: -1, orderCounter: -1, createdAt: -1, _id: 1 })
      .limit(LIM)
      .lean({ virtuals: true });
  },
};
