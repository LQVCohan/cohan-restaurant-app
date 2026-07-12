import mongoose from "mongoose";
import { Menu, MenuItem } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import {
  hasPermission,
  requireRestaurantPermission,
} from "../../../src/services/auth/authorization.service.js";
import { MenuQuery } from "./query.js";

const PUBLIC_STATUSES = ["available", "out_of_stock"];
const SORTS = new Set(["default", "name_asc", "name_desc", "price_asc", "price_desc"]);
const normalizeSort = (sort) => (SORTS.has(sort) ? sort : "default");
const isOid = (value) => mongoose.isValidObjectId(value);

const getSortSpec = (sort) => {
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
    const value = field === "name" ? String(parsed.value || "") : Number(parsed.value);
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

export const MenuMultiSlotQuery = {
  menuItemsConnection: async (parent, args, ctx) => {
    const menuId = args?.filter?.menuId;
    if (!menuId) return MenuQuery.menuItemsConnection(parent, args, ctx);

    const { filter, limit = 20, cursor } = args;
    if (!isOid(filter?.restaurantId) || !isOid(menuId)) {
      return { edges: [], pageInfo: { endCursor: null, hasNextPage: false } };
    }

    const internal = ctx?.user
      ? await hasPermission(ctx.user, PERMISSIONS.MENU_READ)
      : false;
    if (internal) {
      await requireRestaurantPermission(ctx, filter.restaurantId, PERMISSIONS.MENU_READ);
    }

    const menu = await Menu.findOne({
      _id: menuId,
      restaurantId: filter.restaurantId,
      ...(!internal ? { isActive: true } : {}),
    })
      .select({ _id: 1 })
      .lean();
    if (!menu) {
      return { edges: [], pageInfo: { endCursor: null, hasNextPage: false } };
    }

    const query = {
      restaurantId: filter.restaurantId,
      menuId: menu._id,
      ...(!internal ? { status: { $in: PUBLIC_STATUSES } } : {}),
    };
    if (filter.categoryId && isOid(filter.categoryId)) query.categoryId = filter.categoryId;
    if (filter.status) query.status = filter.status;
    if (filter.search?.trim()) {
      const pattern = new RegExp(filter.search.trim(), "i");
      query.$or = [{ name: pattern }, { description: pattern }];
    }
    if (typeof filter.minPrice === "number" || typeof filter.maxPrice === "number") {
      query.basePrice = {};
      if (typeof filter.minPrice === "number") query.basePrice.$gte = filter.minPrice;
      if (typeof filter.maxPrice === "number") query.basePrice.$lte = filter.maxPrice;
    }

    const sort = normalizeSort(filter.sort);
    const cursorCondition = getCursorCondition(cursor, sort);
    if (cursorCondition) query.$and = [cursorCondition];

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 200);
    const documents = await MenuItem.find(query)
      .sort(getSortSpec(sort))
      .limit(safeLimit + 1)
      .lean({ virtuals: true });
    const hasNextPage = documents.length > safeLimit;
    const page = hasNextPage ? documents.slice(0, safeLimit) : documents;

    return {
      edges: page.map((node) => ({ node, cursor: encodeCursor(node, sort) })),
      pageInfo: {
        endCursor: page.length ? encodeCursor(page[page.length - 1], sort) : null,
        hasNextPage,
      },
    };
  },
};
