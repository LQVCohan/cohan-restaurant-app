import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import Table from "../../../models/table.model.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import * as authorizationService from "../../../src/services/auth/authorization.service.js";
import { computeRestaurantAvailability } from "../../../src/services/restaurantAvailability.service.js";

const TABLE_LIST_READ_PERMISSIONS = [
  PERMISSIONS.TABLE_READ,
  PERMISSIONS.ORDER_READ,
  PERMISSIONS.RESERVATION_READ,
];

const TABLE_SELECT = {
  viewLock: 1,
  status: 1,
  capacity: 1,
  code: 1,
  floorId: 1,
  floorLevel: 1,
  position: 1,
  restaurantId: 1,
  type: 1,
  deposit: 1,
  vrUrl: 1,
  photos: 1,
  notes: 1,
  tags: 1,
  visualConfig: 1,
  isJoinable: 1,
  joinGroupId: 1,
};

const getRestaurantModel = async () => {
  const module = await import("../../../models/restaurant.model.js");
  return module.default || module.Restaurant;
};

async function requireTableListAccess(ctx, restaurantId) {
  if (
    Object.prototype.hasOwnProperty.call(
      authorizationService,
      "requireAnyRestaurantPermission",
    ) &&
    typeof authorizationService.requireAnyRestaurantPermission === "function"
  ) {
    return authorizationService.requireAnyRestaurantPermission(ctx, restaurantId, TABLE_LIST_READ_PERMISSIONS);
  }
  return authorizationService.requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.TABLE_READ);
}

async function cleanupExpiredViewLocks(restaurantId) {
  const now = new Date();
  const q = { "viewLock.expiresAt": { $lte: now } };
  if (restaurantId && mongoose.isValidObjectId(restaurantId)) q.restaurantId = restaurantId;
  await Table.updateMany(q, { $unset: { viewLock: 1 } }).catch(() => {});
}

async function requirePublicRestaurant(restaurantId) {
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw new GraphQLError("Invalid restaurantId", { extensions: { code: "BAD_USER_INPUT" } });
  }
  const Restaurant = await getRestaurantModel();
  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    businessStatus: "active",
    publicationStatus: "published",
  }).lean();
  if (!restaurant) {
    throw new GraphQLError("Restaurant is not available", { extensions: { code: "NOT_FOUND" } });
  }
  const availability = computeRestaurantAvailability(restaurant || {});
  if (availability.canView === false) {
    throw new GraphQLError("Restaurant is not available for viewing", {
      extensions: { code: "RESTAURANT_NOT_VIEWABLE" },
    });
  }
  return restaurant;
}

function buildTableFilter({ restaurantId, floorId, status, type, search }) {
  // Bàn vật lý đang nằm trong một bàn ghép được giữ trong DB để có thể tách lại,
  // nhưng không hiển thị đồng thời với bàn ghép.
  const q = { restaurantId, mergedIntoTableId: null };
  if (floorId && mongoose.isValidObjectId(floorId)) q.floorId = floorId;
  if (status) q.status = status;
  if (type) q.type = type;
  if (search?.trim()) {
    const keyword = search.trim();
    q.$or = [
      { code: new RegExp(keyword, "i") },
      { notes: new RegExp(keyword, "i") },
      { tags: { $in: [new RegExp(keyword, "i")] } },
    ];
  }
  return q;
}

export default {
  tables: async (
    _p,
    { restaurantId, floorId, status, type, search, limit },
    ctx,
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireTableListAccess(ctx, restaurantId);
    await cleanupExpiredViewLocks(restaurantId);
    const q = buildTableFilter({ restaurantId, floorId, status, type, search });

    return Table.find(q)
      .select(TABLE_SELECT)
      .sort({ floorLevel: 1, code: 1 })
      .limit(Math.min(limit ?? 200, 500))
      .lean({ virtuals: true });
  },

  publicTables: async (
    _p,
    { restaurantId, floorId, status, type, limit },
  ) => {
    await requirePublicRestaurant(restaurantId);
    await cleanupExpiredViewLocks(restaurantId);
    const q = buildTableFilter({ restaurantId, floorId, status, type });
    if (!status) q.status = { $ne: "offline" };

    return Table.find(q)
      .select(TABLE_SELECT)
      .sort({ floorLevel: 1, code: 1 })
      .limit(Math.min(limit ?? 200, 500))
      .lean({ virtuals: true });
  },

  tableByCode: async (_p, { restaurantId, floorId, code }, ctx) => {
    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(floorId)
    ) return null;
    await requireTableListAccess(ctx, restaurantId);
    await cleanupExpiredViewLocks(restaurantId);
    return Table.findOne({
      restaurantId,
      floorId,
      code,
      mergedIntoTableId: null,
    }).lean({
      virtuals: true,
    });
  },
};
