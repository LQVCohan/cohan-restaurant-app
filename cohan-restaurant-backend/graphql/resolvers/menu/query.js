import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import {
  Category,
  Menu,
  MenuItem,
  Restaurant,
} from "../../../models/index.js";
import { computeRestaurantAvailability } from "../../../src/services/restaurantAvailability.service.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import {
  hasPermission,
  requireRestaurantPermission,
} from "../../../src/services/auth/authorization.service.js";

const MENU_ITEM_SORTS = new Set([
  "default",
  "name_asc",
  "name_desc",
  "price_asc",
  "price_desc",
]);
const DEFAULT_MENU_ITEM_SORT = "default";
const PUBLIC_BROWSABLE_STATUSES = ["available", "out_of_stock"];

const RESTAURANT_ORDERABILITY_SELECT = {
  _id: 1,
  businessStatus: 1,
  publicationStatus: 1,
  status: 1,
  operationalStatus: 1,
  capabilities: 1,
  orderPolicy: 1,
  weeklyOpeningHours: 1,
  specialHours: 1,
  openingHours: 1,
  closingHours: 1,
  timezone: 1,
};

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

const encodeMenuItemCursor = (document, sort = DEFAULT_MENU_ITEM_SORT) => {
  const normalizedSort = normalizeMenuItemSort(sort);
  if (!document?._id) return null;

  if (normalizedSort === DEFAULT_MENU_ITEM_SORT) {
    return String(document._id);
  }

  const payload = {
    sort: normalizedSort,
    id: String(document._id),
    value:
      normalizedSort === "name_asc" || normalizedSort === "name_desc"
        ? document.name || ""
        : document.basePrice ?? null,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
};

const buildMenuItemCursorCondition = (
  cursor,
  sort = DEFAULT_MENU_ITEM_SORT,
) => {
  const normalizedSort = normalizeMenuItemSort(sort);
  if (!cursor) return null;

  if (normalizedSort === DEFAULT_MENU_ITEM_SORT) {
    const cursorId = toObjectIdOrNull(cursor);
    return cursorId ? { _id: { $gt: cursorId } } : null;
  }

  let parsed = null;
  try {
    parsed = JSON.parse(
      Buffer.from(String(cursor), "base64url").toString("utf8"),
    );
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
      ["draft", "unavailable", "out_of_stock", "hidden"].includes(
        String(status || "").toLowerCase(),
      ),
  );
}

function applyPublicBrowsableMenuItemFilter(query) {
  if (!query.status) query.status = { $in: PUBLIC_BROWSABLE_STATUSES };
  return query;
}

function applyPublicOrderableMenuItemFilter(query) {
  if (!query.status) query.status = "available";
  return query;
}

function canRestaurantAcceptHomeOrders(restaurant) {
  if (!restaurant) return false;
  return computeRestaurantAvailability(restaurant).canOrder === true;
}

async function getMenuManagementPermission(user) {
  if (!user) return null;
  if (await hasPermission(user, PERMISSIONS.MENU_UPDATE)) {
    return PERMISSIONS.MENU_UPDATE;
  }
  if (await hasPermission(user, PERMISSIONS.MENU_WRITE)) {
    return PERMISSIONS.MENU_WRITE;
  }
  return null;
}

export const MenuQuery = {
  menus: async (_parent, { restaurantId }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    const managementPermission = await getMenuManagementPermission(ctx?.user);
    if (managementPermission) {
      await requireRestaurantPermission(ctx, restaurantId, managementPermission);
    }

    return Menu.find({
      restaurantId,
      ...(!managementPermission ? { isActive: true } : {}),
    })
      .sort({ timeSlot: 1 })
      .lean({ virtuals: true });
  },

  menu: async (_parent, { restaurantId, timeSlot }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return null;
    return Menu.findOne({
      restaurantId,
      timeSlot,
      isActive: true,
    }).lean({ virtuals: true });
  },

  menuItems: async (
    _parent,
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
    const query = applyPublicBrowsableMenuItemFilter({ restaurantId });

    if (timeSlot) {
      const menu = await Menu.findOne({
        restaurantId,
        timeSlot,
        isActive: true,
      })
        .select({ _id: 1 })
        .lean();
      if (!menu) return [];
      query.menuId = menu._id;
    }

    if (categoryId && mongoose.isValidObjectId(categoryId)) {
      query.categoryId = categoryId;
    }

    if (search?.trim()) {
      const searchPattern = new RegExp(search.trim(), "i");
      query.$or = [
        { name: searchPattern },
        { description: searchPattern },
      ];
    }

    const safeLimit = Math.min(Math.max(limit || 50, 1), 500);
    const normalizedSort = normalizeMenuItemSort(sort);
    return MenuItem.find(query)
      .sort(getMenuItemsListSortSpec(normalizedSort))
      .limit(safeLimit)
      .lean({ virtuals: true });
  },

  menuItemsConnection: async (
    _parent,
    { limit = 20, cursor, filter },
    ctx,
  ) => {
    if (!filter?.restaurantId) {
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

    const internalQuery =
      isInternalMenuQuery({ filter }) ||
      (ctx?.user
        ? await hasPermission(ctx.user, PERMISSIONS.MENU_READ)
        : false);
    if (internalQuery) {
      await requireRestaurantPermission(
        ctx,
        filter.restaurantId,
        PERMISSIONS.MENU_READ,
      );
    }

    const query = internalQuery
      ? { restaurantId: filter.restaurantId }
      : applyPublicBrowsableMenuItemFilter({
          restaurantId: filter.restaurantId,
        });

    if (filter.timeSlot) {
      const menu = await Menu.findOne({
        restaurantId: filter.restaurantId,
        timeSlot: filter.timeSlot,
        ...(!internalQuery ? { isActive: true } : {}),
      })
        .select({ _id: 1 })
        .lean();

      if (!menu) {
        return {
          edges: [],
          pageInfo: { endCursor: null, hasNextPage: false },
        };
      }
      query.menuId = menu._id;
    }

    if (filter.categoryId && mongoose.isValidObjectId(filter.categoryId)) {
      query.categoryId = filter.categoryId;
    }
    if (filter.status) query.status = filter.status;

    if (filter.search?.trim()) {
      const searchPattern = new RegExp(filter.search.trim(), "i");
      query.$or = [
        { name: searchPattern },
        { description: searchPattern },
      ];
    }

    const hasMin = typeof filter.minPrice === "number";
    const hasMax = typeof filter.maxPrice === "number";
    if (hasMin || hasMax) {
      const condition = {};
      if (hasMin) condition.$gte = filter.minPrice;
      if (hasMax) condition.$lte = filter.maxPrice;
      appendAndCondition(query, { basePrice: condition });
    }

    const normalizedSort = normalizeMenuItemSort(filter.sort);
    appendAndCondition(
      query,
      buildMenuItemCursorCondition(cursor, normalizedSort),
    );

    const safeLimit = Math.min(Math.max(limit || 20, 1), 200);
    const documents = await MenuItem.find(query)
      .sort(getMenuItemConnectionSortSpec(normalizedSort))
      .limit(safeLimit + 1)
      .lean({ virtuals: true });

    const hasNextPage = documents.length > safeLimit;
    const pageDocuments = hasNextPage
      ? documents.slice(0, safeLimit)
      : documents;

    return {
      edges: pageDocuments.map((document) => ({
        node: document,
        cursor: encodeMenuItemCursor(document, normalizedSort),
      })),
      pageInfo: {
        endCursor: pageDocuments.length
          ? encodeMenuItemCursor(
              pageDocuments[pageDocuments.length - 1],
              normalizedSort,
            )
          : null,
        hasNextPage,
      },
    };
  },

  customerMenuItem: async (_parent, { id, restaurantId }) => {
    if (!mongoose.isValidObjectId(id)) return null;
    if (restaurantId && !mongoose.isValidObjectId(restaurantId)) return null;

    const item = await MenuItem.findOne({
      _id: id,
      ...(restaurantId ? { restaurantId } : {}),
      status: { $in: PUBLIC_BROWSABLE_STATUSES },
    }).lean({ virtuals: true });
    if (!item) return null;

    if (item.menuId && mongoose.isValidObjectId(item.menuId)) {
      const menu = await Menu.findOne({
        _id: item.menuId,
        restaurantId: item.restaurantId,
        isActive: true,
      })
        .select({ _id: 1 })
        .lean();
      if (!menu) return null;
    }

    const restaurant = await Restaurant.findById(item.restaurantId)
      .select(RESTAURANT_ORDERABILITY_SELECT)
      .lean();
    if (!restaurant) return null;

    const availability = computeRestaurantAvailability(restaurant);
    if (
      availability.businessStatus !== "active" ||
      availability.publicationStatus !== "published"
    ) {
      return null;
    }

    return item;
  },

  topMenuItems: async (
    _parent,
    { limit = 8, restaurantId, categoryId, categoryName, timeSlot },
  ) => {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const query = {};

    if (restaurantId) {
      if (!mongoose.isValidObjectId(restaurantId)) return [];
      const restaurant = await Restaurant.findById(restaurantId)
        .select(RESTAURANT_ORDERABILITY_SELECT)
        .lean();
      if (!canRestaurantAcceptHomeOrders(restaurant)) return [];
      query.restaurantId = restaurantId;
    } else {
      const restaurants = await Restaurant.find({})
        .select(RESTAURANT_ORDERABILITY_SELECT)
        .lean();
      const publicRestaurantIds = restaurants
        .filter(canRestaurantAcceptHomeOrders)
        .map((restaurant) => restaurant._id);
      if (!publicRestaurantIds.length) return [];
      query.restaurantId = { $in: publicRestaurantIds };
    }

    if (timeSlot) {
      const menuFilter = { timeSlot, isActive: true };
      if (query.restaurantId) {
        menuFilter.restaurantId = query.restaurantId;
      }
      const menus = await Menu.find(menuFilter).select({ _id: 1 }).lean();
      if (!menus.length) return [];
      query.menuId = { $in: menus.map((menu) => menu._id) };
    }

    if (categoryId && mongoose.isValidObjectId(categoryId)) {
      query.categoryId = categoryId;
    } else if (categoryName?.trim()) {
      const matchedCategories = await Category.find({
        name: new RegExp(`^${categoryName.trim()}$`, "i"),
      })
        .select({ _id: 1 })
        .lean();
      const matchedIds = matchedCategories.map((category) => category._id);
      if (!matchedIds.length) return [];
      query.categoryId = { $in: matchedIds };
    }

    applyPublicOrderableMenuItemFilter(query);
    return MenuItem.find(query)
      .sort({ rate: -1, orderCounter: -1, createdAt: -1, _id: 1 })
      .limit(safeLimit)
      .lean({ virtuals: true });
  },
};
