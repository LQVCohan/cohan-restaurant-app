import mongoose from "mongoose";
import { Menu, MenuItem } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import {
  hasPermission,
  requireRestaurantPermission,
} from "../../../src/services/auth/authorization.service.js";
import { MenuQuery } from "./query.js";

const PUBLIC_STATUSES = ["available", "out_of_stock"];
const SORTS = new Set([
  "default",
  "name_asc",
  "name_desc",
  "price_asc",
  "price_desc",
]);
const normalizeSort = (sort) => (SORTS.has(sort) ? sort : "default");
const isOid = (value) => mongoose.isValidObjectId(value);
const emptyConnection = () => ({
  edges: [],
  pageInfo: { endCursor: null, hasNextPage: false },
});

const getListSortSpec = (sort) => {
  switch (normalizeSort(sort)) {
    case "name_desc":
      return { name: -1, _id: -1 };
    case "price_asc":
      return { basePrice: 1, _id: 1 };
    case "price_desc":
      return { basePrice: -1, _id: -1 };
    default:
      return { name: 1, _id: 1 };
  }
};

const getConnectionSortSpec = (sort) => {
  switch (normalizeSort(sort)) {
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

const encodeCursor = (document, sort) => {
  if (!document?._id) return null;
  const normalized = normalizeSort(sort);
  if (normalized === "default") return String(document._id);
  return Buffer.from(
    JSON.stringify({
      sort: normalized,
      id: String(document._id),
      value: normalized.startsWith("name_")
        ? document.name || ""
        : document.basePrice ?? null,
    }),
    "utf8",
  ).toString("base64url");
};

const getCursorCondition = (cursor, sort) => {
  if (!cursor) return null;
  const normalized = normalizeSort(sort);
  if (normalized === "default") {
    return isOid(cursor) ? { _id: { $gt: cursor } } : null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(String(cursor), "base64url").toString("utf8"),
    );
    if (!isOid(parsed?.id) || parsed?.sort !== normalized) return null;
    const operator = normalized.endsWith("_desc") ? "$lt" : "$gt";
    const field = normalized.startsWith("name_") ? "name" : "basePrice";
    const value =
      field === "name" ? String(parsed.value || "") : Number(parsed.value);
    if (field === "basePrice" && !Number.isFinite(value)) return null;
    return {
      $or: [
        { [field]: { [operator]: value } },
        { [field]: value, _id: { [operator]: parsed.id } },
      ],
    };
  } catch {
    return null;
  }
};

const addSearchAndCategory = (query, args) => {
  if (args.categoryId && isOid(args.categoryId)) {
    query.categoryId = args.categoryId;
  }
  if (args.search?.trim()) {
    const pattern = new RegExp(args.search.trim(), "i");
    query.$or = [{ name: pattern }, { description: pattern }];
  }
};

export const MenuMultiSlotQuery = {
  customerMenus: async (_parent, { restaurantId }) => {
    if (!isOid(restaurantId)) return [];
    return Menu.find({ restaurantId, isActive: true })
      .sort({ timeSlot: 1, name: 1, _id: 1 })
      .lean({ virtuals: true });
  },

  menuItems: async (parent, args) => {
    if (!args?.timeSlot) return MenuQuery.menuItems(parent, args);
    if (!isOid(args.restaurantId)) return [];

    const menus = await Menu.find({
      restaurantId: args.restaurantId,
      timeSlot: args.timeSlot,
      isActive: true,
    })
      .select({ _id: 1 })
      .lean();
    if (!menus.length) return [];

    const query = {
      restaurantId: args.restaurantId,
      menuId: { $in: menus.map((menu) => menu._id) },
      status: { $in: PUBLIC_STATUSES },
    };
    addSearchAndCategory(query, args);

    const safeLimit = Math.min(Math.max(Number(args.limit) || 50, 1), 500);
    return MenuItem.find(query)
      .sort(getListSortSpec(args.sort))
      .limit(safeLimit)
      .lean({ virtuals: true });
  },

  menuItemsConnection: async (parent, args, ctx) => {
    const { filter, limit = 20, cursor } = args || {};
    const menuId = filter?.menuId;
    if (!menuId && !filter?.timeSlot) {
      return MenuQuery.menuItemsConnection(parent, args, ctx);
    }
    if (!isOid(filter?.restaurantId) || (menuId && !isOid(menuId))) {
      return emptyConnection();
    }

    const internal = ctx?.user
      ? await hasPermission(ctx.user, PERMISSIONS.MENU_READ)
      : false;
    if (internal) {
      await requireRestaurantPermission(
        ctx,
        filter.restaurantId,
        PERMISSIONS.MENU_READ,
      );
    }

    const menuFilter = {
      restaurantId: filter.restaurantId,
      ...(!internal ? { isActive: true } : {}),
      ...(menuId ? { _id: menuId } : { timeSlot: filter.timeSlot }),
    };
    const menus = await Menu.find(menuFilter).select({ _id: 1 }).lean();
    if (!menus.length) return emptyConnection();

    const menuIds = menus.map((menu) => menu._id);
    const query = {
      restaurantId: filter.restaurantId,
      menuId: menuIds.length === 1 ? menuIds[0] : { $in: menuIds },
      ...(!internal ? { status: { $in: PUBLIC_STATUSES } } : {}),
    };
    addSearchAndCategory(query, filter);
    if (filter.status && (internal || PUBLIC_STATUSES.includes(filter.status))) {
      query.status = filter.status;
    }
    if (
      typeof filter.minPrice === "number" ||
      typeof filter.maxPrice === "number"
    ) {
      query.basePrice = {};
      if (typeof filter.minPrice === "number") {
        query.basePrice.$gte = filter.minPrice;
      }
      if (typeof filter.maxPrice === "number") {
        query.basePrice.$lte = filter.maxPrice;
      }
    }

    const sort = normalizeSort(filter.sort);
    const cursorCondition = getCursorCondition(cursor, sort);
    if (cursorCondition) query.$and = [cursorCondition];

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 200);
    const documents = await MenuItem.find(query)
      .sort(getConnectionSortSpec(sort))
      .limit(safeLimit + 1)
      .lean({ virtuals: true });
    const hasNextPage = documents.length > safeLimit;
    const page = hasNextPage ? documents.slice(0, safeLimit) : documents;

    return {
      edges: page.map((node) => ({ node, cursor: encodeCursor(node, sort) })),
      pageInfo: {
        endCursor: page.length
          ? encodeCursor(page[page.length - 1], sort)
          : null,
        hasNextPage,
      },
    };
  },
};
