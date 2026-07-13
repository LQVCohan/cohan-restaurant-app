import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import Table from "../../../models/table.model.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import * as authorizationService from "../../../src/services/auth/authorization.service.js";
import { computeRestaurantAvailability } from "../../../src/services/restaurantAvailability.service.js";
import { getTableReservationSnapshot } from "../../../src/services/reservationTableTiming.service.js";

const TABLE_LIST_READ_PERMISSIONS = [
  PERMISSIONS.TABLE_READ,
  PERMISSIONS.ORDER_READ,
  PERMISSIONS.RESERVATION_READ,
];

export const TABLE_SELECT = {
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
  zone: 1,
  promotionIds: 1,
  bookingPerks: 1,
  reservationHoldMinutes: 1,
  minSpend: 1,
  cancelPolicy: 1,
  visualConfig: 1,
  isJoinable: 1,
  joinGroupId: 1,
  mergedFromTableIds: 1,
  mergeAnchorTableId: 1,
  mergedAt: 1,
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
    return authorizationService.requireAnyRestaurantPermission(
      ctx,
      restaurantId,
      TABLE_LIST_READ_PERMISSIONS,
    );
  }
  return authorizationService.requireRestaurantPermission(
    ctx,
    restaurantId,
    PERMISSIONS.TABLE_READ,
  );
}

async function cleanupTableLegacyState(restaurantId) {
  const scoped =
    restaurantId && mongoose.isValidObjectId(restaurantId)
      ? { restaurantId }
      : {};
  await Promise.all([
    Table.updateMany(
      { ...scoped, "viewLock.expiresAt": { $lte: new Date() } },
      { $unset: { viewLock: 1 } },
    ).catch(() => {}),
    Table.updateMany(
      { ...scoped, deposit: 1 },
      { $set: { deposit: 0 } },
    ).catch(() => {}),
  ]);
}

async function requirePublicRestaurant(restaurantId) {
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw new GraphQLError("Invalid restaurantId", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  const Restaurant = await getRestaurantModel();
  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    businessStatus: "active",
    publicationStatus: "published",
  }).lean();
  if (!restaurant) {
    throw new GraphQLError("Restaurant is not available", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  const availability = computeRestaurantAvailability(restaurant || {});
  if (availability.canView === false) {
    throw new GraphQLError("Restaurant is not available for viewing", {
      extensions: { code: "RESTAURANT_NOT_VIEWABLE" },
    });
  }
  return restaurant;
}

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const normalizeTableLimit = (limit, fallback = 200) => {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), 500);
};

export function buildTableFilter({ restaurantId, floorId, status, type, search }) {
  const q = { restaurantId, mergedIntoTableId: null };
  if (floorId && mongoose.isValidObjectId(floorId)) q.floorId = floorId;
  if (status) q.status = status;
  if (type) q.type = type;
  if (search?.trim()) {
    const literalSearch = new RegExp(escapeRegex(search.trim()), "i");
    q.$or = [
      { code: literalSearch },
      { notes: literalSearch },
      { tags: { $in: [literalSearch] } },
    ];
  }
  return q;
}

async function enrichManagerTables(rows, ctx) {
  return Promise.all(
    rows.map(async (table) => {
      const snapshot = await getTableReservationSnapshot(table, ctx);
      if (!snapshot) return table;
      const storedStatus = String(table.status || "available");
      const canUseReservationStatus = ![
        "occupied",
        "cleaning",
        "offline",
        "payment_pending",
      ].includes(storedStatus);
      const effectiveStatus =
        canUseReservationStatus && snapshot.reservationPhase === "waiting"
          ? "reserved"
          : canUseReservationStatus &&
              ["upcoming", "expired"].includes(snapshot.reservationPhase) &&
              storedStatus === "reserved"
            ? "available"
            : storedStatus;
      return {
        ...table,
        ...snapshot,
        status: effectiveStatus,
      };
    }),
  );
}

export default {
  tables: async (
    _p,
    { restaurantId, floorId, status, type, search, limit },
    ctx,
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireTableListAccess(ctx, restaurantId);
    await cleanupTableLegacyState(restaurantId);
    const q = buildTableFilter({ restaurantId, floorId, status, type, search });

    const rows = await Table.find(q)
      .select(TABLE_SELECT)
      .sort({ floorLevel: 1, code: 1 })
      .limit(normalizeTableLimit(limit))
      .lean({ virtuals: true });
    return enrichManagerTables(rows, ctx);
  },

  publicTables: async (
    _p,
    { restaurantId, floorId, status, type, limit },
  ) => {
    await requirePublicRestaurant(restaurantId);
    await cleanupTableLegacyState(restaurantId);
    const q = buildTableFilter({ restaurantId, floorId, status, type });
    if (!status) q.status = { $ne: "offline" };

    return Table.find(q)
      .select(TABLE_SELECT)
      .sort({ floorLevel: 1, code: 1 })
      .limit(normalizeTableLimit(limit))
      .lean({ virtuals: true });
  },

  tableByCode: async (_p, { restaurantId, floorId, code }, ctx) => {
    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(floorId)
    ) {
      return null;
    }
    await requireTableListAccess(ctx, restaurantId);
    await cleanupTableLegacyState(restaurantId);
    const table = await Table.findOne({
      restaurantId,
      floorId,
      code,
      mergedIntoTableId: null,
    }).lean({ virtuals: true });
    if (!table) return null;
    const [enriched] = await enrichManagerTables([table], ctx);
    return enriched;
  },
};
