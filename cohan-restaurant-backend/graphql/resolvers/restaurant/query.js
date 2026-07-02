// src/resolvers/restaurant.query.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Restaurant, User, RestaurantCategoryIndex, Menu, MenuItem, Order, Reservation, TableCustomer } from "../../../models/index.js";
import { computeRestaurantAvailability } from "../../../src/services/restaurantAvailability.service.js";
import { resolveRoadDistances } from "../../../src/services/distance/roadDistance.service.js";
import { canAccessRestaurant, getScopedRestaurantFilter, isSystemAdmin } from "../../../src/services/auth/restaurantScope.service.js";

/* ============================ Helpers ============================ */

function badInput(message) {
  return new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}
function notFound(message = "Resource not found") {
  return new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });
}
function unauthenticated(message = "Unauthorized") {
  return new GraphQLError(message, { extensions: { code: "UNAUTHENTICATED" } });
}

function toObjectIdOrNull(id) {
  if (!id) return null;
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
}

function clampLimit(n, min = 1, max = 100) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.floor(x)));
}

function isValidRoadDistanceKm(roadDistanceKm, straightLineDistanceKm) {
  if (!Number.isFinite(roadDistanceKm)) return false;
  if (roadDistanceKm < 0) return false;

  const straight = Number(straightLineDistanceKm);

  // A zero road distance is only credible when both points are virtually identical.
  if (roadDistanceKm === 0) {
    return Number.isFinite(straight) && straight < 0.05;
  }

  // Road distance should not be dramatically shorter than straight-line distance.
  // Keep tolerance for route snapping/map data, but reject obviously bad provider output.
  if (Number.isFinite(straight) && straight >= 0.05) {
    return roadDistanceKm >= straight * 0.5;
  }

  return true;
}

function escapeRegex(str) { return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function safeRegexContains(value) {
  const s = String(value || "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0,80);
  if (!s) return null;
  return { $regex: escapeRegex(s), $options: "i" };
}

function buildFilter(restaurantFilter) {
  const f = {};
  if (!restaurantFilter) return f;

  const {
    city,
    district,
    cuisineTypes,
    minRating,
    priceRange,
    search,
    restaurantIds,
  } = restaurantFilter;

  const cityRx = safeRegexContains(city);
  const districtRx = safeRegexContains(district);
  if (cityRx) f["address.city"] = cityRx;
  if (districtRx) f["address.district"] = districtRx;

  if (Array.isArray(cuisineTypes) && cuisineTypes.length > 0) {
    f.cuisineType = { $in: cuisineTypes.filter(Boolean) };
  }

  if (typeof minRating === "number") {
    f.avgRating = { $gte: minRating };
  }

  if (Array.isArray(priceRange) && priceRange.length > 0) {
    f.priceRange = { $in: priceRange.filter(Boolean) };
  }


  if (Array.isArray(restaurantIds) && restaurantIds.length > 0) {
    const ids = restaurantIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (ids.length > 0) {
      f._id = { $in: ids };
    }
  }

  const sRx = safeRegexContains(search);
  if (sRx) {
    f.$or = [
      { name: sRx },
      { description: sRx },
      { cuisineType: sRx },
      { "address.line1": sRx },
      { "address.line2": sRx },
      { "address.ward": sRx },
      { "address.city": sRx },
      { "address.district": sRx },
      { "address.country": sRx },
      { "address.postalCode": sRx },
    ];
  }

  return f;
}




function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}


function combineFilters(...filters) {
  const parts = filters.filter((filter) => filter && Object.keys(filter).length > 0);
  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { $and: parts };
}

function buildPublicRestaurantFilter() {
  return {
    $or: [
      { businessStatus: "active", publicationStatus: "published" },
      {
        businessStatus: { $exists: false },
        publicationStatus: { $exists: false },
        status: "active",
      },
    ],
  };
}

function applyPublicAvailabilityFilters(docs, filter) {
  const f = filter || {};
  return docs.filter((doc) => {
    const availability = computeRestaurantAvailability(doc);
    if (f.openNow === true && availability.openingStatus !== "open") return false;
    if (f.openingStatus && availability.openingStatus !== f.openingStatus) return false;
    if (typeof f.acceptsReservations === "boolean" && availability.canReserve !== f.acceptsReservations) return false;
    if (typeof f.acceptsOrders === "boolean" && availability.canOrder !== f.acceptsOrders) return false;
    return true;
  });
}

/* ============================ Queries ============================ */

/** Danh sách nhà hàng với cursor pagination và bộ lọc
 *  - sort theo _id tăng dần
 *  - cursor là _id, dùng $gt (forward pagination)
 */
async function restaurants(_, { limit = 20, cursor, restaurantFilter }, ctx) {
  const lim = clampLimit(limit, 1, 100);

  const scopeFilter = ctx?.user ? await getScopedRestaurantFilter(ctx.user) : { _id: { $in: [] } };
  const cId = toObjectIdOrNull(cursor);
  const cursorFilter = cId ? { _id: { $gt: cId } } : {};
  const baseFilter = combineFilters(buildFilter(restaurantFilter), scopeFilter);
  const queryFilter = combineFilters(baseFilter, cursorFilter);

  const docs = await Restaurant.find(queryFilter)
    .sort({ _id: 1 })
    .limit(lim + 1)
    .lean();

  const hasNextPage = docs.length > lim;
  const slice = hasNextPage ? docs.slice(0, lim) : docs;

  return {
    edges: slice.map((d) => ({ node: d, cursor: String(d._id) })),
    pageInfo: {
      endCursor: slice.length ? String(slice[slice.length - 1]._id) : null,
      hasNextPage,
    },
    totalCount: await Restaurant.countDocuments(baseFilter),
  };
}

/** Chi tiết nhà hàng */
async function restaurant(_, { id }, ctx) {
  if (!mongoose.isValidObjectId(id)) {
    throw badInput("Invalid ID");
  }
  const doc = await Restaurant.findById(id).lean();
  if (!doc || !ctx?.user) return null;
  if (isSystemAdmin(ctx.user)) return doc;
  return await canAccessRestaurant(ctx.user, id) ? doc : null;
}

/** Top nhà hàng theo rating với bộ lọc */
async function restaurantsTop(_, { limit = 6, restaurantFilter }) {
  const lim = clampLimit(limit, 1, 100);
  const f = combineFilters(buildFilter(restaurantFilter), buildPublicRestaurantFilter());

  const docs = await Restaurant.find(f)
    .sort({ avgRating: -1, _id: 1 })
    .limit(lim)
    .lean();

  return docs;
}


async function restaurantsNearby(_, { lat, lng, radiusKm = 20, limit = 6, restaurantFilter }) {
  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
    throw badInput("lat must be a number in range [-90, 90]");
  }
  if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
    throw badInput("lng must be a number in range [-180, 180]");
  }

  const normalizedRadiusKm = Number(radiusKm) > 0 ? Number(radiusKm) : 20;
  const lim = clampLimit(limit, 1, 100);

  const baseFilter = buildFilter(restaurantFilter);
  const publicFilter = buildPublicRestaurantFilter();
  const filterWithoutLocationType = {
    ...baseFilter,
    $and: [
      ...(Array.isArray(baseFilter.$and) ? baseFilter.$and : []),
      publicFilter,
    ],
  };

  try {
    const candidateLimit = Math.min(Math.max(lim * 4, 20), 50);
    const geoDocs = await Restaurant.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lngNum, latNum] },
          distanceField: "distanceMeters",
          maxDistance: normalizedRadiusKm * 1000,
          spherical: true,
          query: filterWithoutLocationType,
        },
      },
      { $limit: candidateLimit },
      { $addFields: { straightLineDistanceKm: { $divide: ["$distanceMeters", 1000] } } },
      { $project: { distanceMeters: 0 } },
    ]);

    if (Array.isArray(geoDocs) && geoDocs.length > 0) {
      const roadResults = await resolveRoadDistances({
        origin: { lat: latNum, lng: lngNum },
        destinations: geoDocs
          .map((doc) => {
            const coordinates = doc?.location?.coordinates;
            const geoLng = Number(Array.isArray(coordinates) ? coordinates[0] : NaN);
            const geoLat = Number(Array.isArray(coordinates) ? coordinates[1] : NaN);
            const fallbackLat = Number(doc?.address?.lat);
            const fallbackLng = Number(doc?.address?.lng);
            const resolvedLat = Number.isFinite(geoLat) ? geoLat : fallbackLat;
            const resolvedLng = Number.isFinite(geoLng) ? geoLng : fallbackLng;
            if (!Number.isFinite(resolvedLat) || !Number.isFinite(resolvedLng)) return null;
            return { id: String(doc._id), lat: resolvedLat, lng: resolvedLng };
          })
          .filter(Boolean),
      });

      const roadMap = new Map(roadResults.map((item) => [String(item.id), item]));
      return geoDocs
        .map((doc) => {
          const straightLineDistanceKm = Number(doc?.straightLineDistanceKm);
          const road = roadMap.get(String(doc._id));
          const roadDistanceKm = Number(road?.roadDistanceKm);
          const hasRoadDistance = isValidRoadDistanceKm(roadDistanceKm, straightLineDistanceKm);
          const estimatedTravelMinutes = Number(road?.estimatedTravelMinutes);
          const distanceKm = hasRoadDistance ? roadDistanceKm : straightLineDistanceKm;

          return {
            ...doc,
            straightLineDistanceKm: Number.isFinite(straightLineDistanceKm) ? straightLineDistanceKm : null,
            roadDistanceKm: hasRoadDistance ? roadDistanceKm : null,
            estimatedTravelMinutes: hasRoadDistance && Number.isFinite(estimatedTravelMinutes) ? estimatedTravelMinutes : null,
            distanceKm: Number.isFinite(distanceKm) ? distanceKm : null,
            distanceSource: hasRoadDistance ? "road" : "straight_line_fallback",
          };
        })
        .sort((a, b) => {
          const aHasRoad = Number.isFinite(a?.roadDistanceKm) ? 1 : 0;
          const bHasRoad = Number.isFinite(b?.roadDistanceKm) ? 1 : 0;
          if (aHasRoad !== bHasRoad) return bHasRoad - aHasRoad;
          return (a?.distanceKm ?? Number.POSITIVE_INFINITY) - (b?.distanceKm ?? Number.POSITIVE_INFINITY);
        })
        .slice(0, lim);
    }
  } catch (_error) {
    // Fallback to legacy address.lat/lng Haversine path when geospatial index/data is not ready.
  }

  const fallbackFilter = {
    ...filterWithoutLocationType,
    $and: [
      ...(Array.isArray(filterWithoutLocationType.$and) ? filterWithoutLocationType.$and : []),
      { "address.lat": { $type: "number" } },
      { "address.lng": { $type: "number" } },
    ],
  };

  const docs = await Restaurant.find(fallbackFilter).lean();
  return docs
    .map((doc) => {
      const rLat = Number(doc?.address?.lat);
      const rLng = Number(doc?.address?.lng);
      if (!Number.isFinite(rLat) || !Number.isFinite(rLng)) return null;
      const straightLineDistanceKm = haversineDistanceKm(latNum, lngNum, rLat, rLng);
      if (!Number.isFinite(straightLineDistanceKm) || straightLineDistanceKm > normalizedRadiusKm) return null;
      return {
        ...doc,
        straightLineDistanceKm,
        roadDistanceKm: null,
        estimatedTravelMinutes: null,
        distanceKm: straightLineDistanceKm,
        distanceSource: "straight_line_fallback",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, lim);
}

async function buildRestaurantConnection(baseFilter, { limit = 20, cursor } = {}) {
  const lim = clampLimit(limit, 1, 100);
  const cId = toObjectIdOrNull(cursor);
  const queryFilter = combineFilters(baseFilter, cId ? { _id: { $gt: cId } } : {});

  const docs = await Restaurant.find(queryFilter).sort({ _id: 1 }).limit(lim + 1).lean();
  const hasNextPage = docs.length > lim;
  const slice = hasNextPage ? docs.slice(0, lim) : docs;

  return {
    edges: slice.map((d) => ({ node: d, cursor: String(d._id) })),
    pageInfo: { endCursor: slice.length ? String(slice[slice.length - 1]._id) : null, hasNextPage },
    totalCount: await Restaurant.countDocuments(baseFilter),
  };
}

/** Danh sách nhà hàng theo quyền hiện tại với cursor pagination và bộ lọc */
async function scopedRestaurants(_, { brandId, limit = 20, cursor, restaurantFilter } = {}, ctx) {
  if (!ctx?.user) throw unauthenticated("Unauthorized");
  if (brandId && !mongoose.isValidObjectId(brandId)) throw badInput("Invalid brandId");

  const scopedAccessFilter = await getScopedRestaurantFilter(ctx.user);
  const requestedBrandFilter = brandId ? { brandId: new mongoose.Types.ObjectId(brandId) } : {};
  const baseFilter = combineFilters(buildFilter(restaurantFilter), scopedAccessFilter, requestedBrandFilter);
  return buildRestaurantConnection(baseFilter, { limit, cursor });
}

/** Deprecated legacy alias. New clients must use scopedRestaurants. System admin legacy lookups may still use Restaurant.managerId until migration completes. */
async function restaurantsByManager(_, { managerId, brandId, limit = 20, cursor, restaurantFilter } = {}, ctx) {
  if (!ctx?.user) throw unauthenticated("Unauthorized");
  if (!mongoose.isValidObjectId(managerId)) throw badInput("Invalid managerId");
  if (brandId && !mongoose.isValidObjectId(brandId)) throw badInput("Invalid brandId");

  const requestedBrandFilter = brandId ? { brandId: new mongoose.Types.ObjectId(brandId) } : {};
  if (isSystemAdmin(ctx.user)) {
    const legacyManagerFilter = { managerId: new mongoose.Types.ObjectId(managerId) };
    return buildRestaurantConnection(combineFilters(buildFilter(restaurantFilter), legacyManagerFilter, requestedBrandFilter), { limit, cursor });
  }

  const uid = String(ctx.user.id || ctx.user._id || "");
  if (uid !== String(managerId)) return buildRestaurantConnection({ _id: { $in: [] } }, { limit, cursor });
  return scopedRestaurants(_, { brandId, limit, cursor, restaurantFilter }, ctx);
}

/** Các nhà hàng tham chiếu theo user.refRestaurants */
async function refRestaurants(_, { userId }) {
  if (!mongoose.isValidObjectId(userId)) {
    throw badInput("Invalid userId");
  }

  const user = await User.findById(userId).select("refRestaurants").lean();
  if (!user) throw notFound("User not found");

  const ref = Array.isArray(user.refRestaurants) ? user.refRestaurants : [];
  if (ref.length === 0) return [];

  const ids = [...new Set(ref.map((x) => (mongoose.isValidObjectId(x) ? String(x) : null)).filter(Boolean))]
    .map((item) => new mongoose.Types.ObjectId(item));

  if (ids.length === 0) return [];

  return Restaurant.find({ _id: { $in: ids } }).sort({ _id: 1 }).lean();
}

async function refreshRestaurantCategoryIndexes(_, { timeSlot }) {
  if (!timeSlot) return 0;

  const menus = await Menu.find({ timeSlot }).select({ _id: 1, restaurantId: 1 }).lean();
  if (!menus.length) return 0;

  const menuIds = menus.map((m) => m._id);
  const grouped = await MenuItem.aggregate([
    { $match: { menuId: { $in: menuIds } } },
    {
      $group: {
        _id: { restaurantId: "$restaurantId", categoryId: "$categoryId" },
        menuItemCount: { $sum: 1 },
      },
    },
  ]);

  const byRestaurant = new Map();
  for (const row of grouped) {
    const rid = String(row._id.restaurantId);
    if (!byRestaurant.has(rid)) byRestaurant.set(rid, []);
    byRestaurant.get(rid).push({ categoryId: row._id.categoryId, menuItemCount: row.menuItemCount });
  }

  const restaurantIds = [...byRestaurant.keys()].map((id) => new mongoose.Types.ObjectId(id));
  const [orders, reservations, tables] = await Promise.all([
    Order.aggregate([{ $match: { restaurantId: { $in: restaurantIds } } }, { $group: { _id: "$restaurantId", count: { $sum: 1 } } }]),
    Reservation.aggregate([{ $match: { restaurantId: { $in: restaurantIds } } }, { $group: { _id: "$restaurantId", count: { $sum: 1 } } }]),
    TableCustomer.aggregate([{ $match: { restaurantId: { $in: restaurantIds } } }, { $group: { _id: "$restaurantId", count: { $sum: 1 } } }]),
  ]);

  const orderMap = new Map(orders.map((x) => [String(x._id), x.count]));
  const reservationMap = new Map(reservations.map((x) => [String(x._id), x.count]));
  const tableMap = new Map(tables.map((x) => [String(x._id), x.count]));

  const ops = [];
  for (const [rid, categories] of byRestaurant.entries()) {
    const categoryIds = [...new Set(categories.map((c) => String(c.categoryId)))].map((id) => new mongoose.Types.ObjectId(id));
    ops.push({
      updateOne: {
        filter: { restaurantId: new mongoose.Types.ObjectId(rid), timeSlot },
        update: {
          $set: {
            categoryIds,
            categories,
            distinctCategoryCount: categoryIds.length,
            orderCount: orderMap.get(rid) || 0,
            reservationCount: reservationMap.get(rid) || 0,
            tableParticipationCount: tableMap.get(rid) || 0,
          },
        },
        upsert: true,
      },
    });
  }

  if (ops.length) await RestaurantCategoryIndex.bulkWrite(ops, { ordered: false });
  return ops.length;
}

async function restaurantsByCategoryTimeSlot(_, { categoryId, timeSlot, limit = 12 }) {
  if (!mongoose.isValidObjectId(categoryId)) return [];
  const lim = clampLimit(limit, 1, 100);

  await refreshRestaurantCategoryIndexes(_, { timeSlot });

  const rows = await RestaurantCategoryIndex.find({
    timeSlot,
    categoryIds: new mongoose.Types.ObjectId(categoryId),
  })
    .sort({ reservationCount: -1, orderCount: -1, tableParticipationCount: -1, updatedAt: -1 })
    .limit(300)
    .lean();

  if (!rows.length) return [];

  const ids = rows.map((r) => r.restaurantId);
  const restaurants = await Restaurant.find({ _id: { $in: ids }, status: "active" }).lean();
  const restMap = new Map(restaurants.map((r) => [String(r._id), r]));

  const enriched = rows
    .map((row) => {
      const rest = restMap.get(String(row.restaurantId));
      if (!rest) return null;
      return {
        ...rest,
        orderCount: row.orderCount || 0,
        reservationCount: row.reservationCount || 0,
        tableParticipationCount: row.tableParticipationCount || 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const ra = Number(a.avgRating || 0);
      const rb = Number(b.avgRating || 0);
      if (rb !== ra) return rb - ra;
      if ((b.reservationCount || 0) !== (a.reservationCount || 0)) {
        return (b.reservationCount || 0) - (a.reservationCount || 0);
      }
      if ((b.orderCount || 0) !== (a.orderCount || 0)) {
        return (b.orderCount || 0) - (a.orderCount || 0);
      }
      return (b.tableParticipationCount || 0) - (a.tableParticipationCount || 0);
    });

  return enriched.slice(0, lim);
}


async function restaurantCategoryIndexes(_, { restaurantId, timeSlot }) {
  const q = {};
  if (restaurantId && mongoose.isValidObjectId(restaurantId)) {
    q.restaurantId = new mongoose.Types.ObjectId(restaurantId);
  }
  if (timeSlot) q.timeSlot = timeSlot;
  return RestaurantCategoryIndex.find(q).sort({ updatedAt: -1 }).lean();
}
export const RestaurantQuery = {
  restaurants,
  restaurant,
  restaurantsTop,
  restaurantsNearby,
  scopedRestaurants,
  restaurantsByManager,
  refRestaurants,
  restaurantsByCategoryTimeSlot,
  restaurantCategoryIndexes,
  refreshRestaurantCategoryIndexes,
  publicRestaurants,
  publicRestaurant,
  similarRestaurants,
};


async function publicRestaurants(_, { limit = 20, cursor, filter }) {
  const lim = clampLimit(limit, 1, 100);
  const baseFilter = { ...buildFilter(filter), businessStatus: "active", publicationStatus: "published" };
  const runtimeFilterEnabled = filter && (
    filter.openNow === true
    || !!filter.openingStatus
    || typeof filter.acceptsReservations === "boolean"
    || typeof filter.acceptsOrders === "boolean"
  );

  if (!runtimeFilterEnabled) {
    const queryFilter = { ...baseFilter };
    const cId = toObjectIdOrNull(cursor);
    if (cId) queryFilter._id = { ...(queryFilter._id || {}), $gt: cId };

    const docs = await Restaurant.find(queryFilter).sort({ _id: 1 }).limit(lim + 1).lean();
    const hasNextPage = docs.length > lim;
    const slice = hasNextPage ? docs.slice(0, lim) : docs;

    return {
      edges: slice.map((d) => ({ node: d, cursor: String(d._id) })),
      pageInfo: {
        endCursor: slice.length ? String(slice[slice.length - 1]._id) : null,
        hasNextPage,
      },
      totalCount: await Restaurant.countDocuments(baseFilter),
    };
  }

  const batchSize = 100;
  const accepted = [];
  let nextCursorId = toObjectIdOrNull(cursor);
  let exhausted = false;

  while (accepted.length < lim + 1 && !exhausted) {
    const queryFilter = { ...baseFilter };
    if (nextCursorId) queryFilter._id = { ...(queryFilter._id || {}), $gt: nextCursorId };

    const batch = await Restaurant.find(queryFilter).sort({ _id: 1 }).limit(batchSize).lean();
    if (!batch.length) { exhausted = true; break; }

    const passBatch = applyPublicAvailabilityFilters(batch, filter);
    accepted.push(...passBatch);
    nextCursorId = batch[batch.length - 1]._id;

    if (batch.length < batchSize) exhausted = true;
  }

  const slice = accepted.slice(0, lim);
  let hasNextPage = accepted.length > lim;

  if (!hasNextPage && slice.length) {
    const afterReturnedId = toObjectIdOrNull(String(slice[slice.length - 1]._id));
    let probeCursor = afterReturnedId;
    while (!hasNextPage && probeCursor) {
      const probeFilter = { ...baseFilter, _id: { ...(baseFilter._id || {}), $gt: probeCursor } };
      const probeBatch = await Restaurant.find(probeFilter).sort({ _id: 1 }).limit(batchSize).lean();
      if (!probeBatch.length) break;
      if (applyPublicAvailabilityFilters(probeBatch, filter).length > 0) {
        hasNextPage = true;
        break;
      }
      probeCursor = probeBatch.length < batchSize ? null : probeBatch[probeBatch.length - 1]._id;
    }
  }

  // TODO: optimize totalCount with pre-computed availability index to avoid full scan for runtime filters.
  let totalCount = 0;
  let countCursor = null;
  while (true) {
    const countFilter = { ...baseFilter };
    if (countCursor) countFilter._id = { ...(countFilter._id || {}), $gt: countCursor };
    const countBatch = await Restaurant.find(countFilter).sort({ _id: 1 }).limit(batchSize).lean();
    if (!countBatch.length) break;
    totalCount += applyPublicAvailabilityFilters(countBatch, filter).length;
    if (countBatch.length < batchSize) break;
    countCursor = countBatch[countBatch.length - 1]._id;
  }

  return {
    edges: slice.map((d) => ({ node: d, cursor: String(d._id) })),
    pageInfo: {
      endCursor: slice.length ? String(slice[slice.length - 1]._id) : null,
      hasNextPage,
    },
    totalCount,
  };
}


async function publicRestaurant(_, { id }) {
  if (!mongoose.isValidObjectId(id)) throw badInput("Invalid ID");
  return Restaurant.findOne({ _id: id, businessStatus: "active", publicationStatus: "published" }).lean();
}
async function similarRestaurants(_, { restaurantId, limit = 6 }) {
  const root = await Restaurant.findOne({ _id: restaurantId, businessStatus: "active", publicationStatus: "published" }).lean();
  if (!root) return [];
  const lim = clampLimit(limit, 1, 20);

  const sameCuisine = await Restaurant.find({
    _id: { $ne: root._id },
    businessStatus: "active",
    publicationStatus: "published",
    cuisineType: root.cuisineType,
  }).sort({ avgRating: -1, reviewCount: -1, _id: -1 }).limit(lim).lean();

  if (sameCuisine.length >= lim) return sameCuisine;

  const fallbackOrConditions = [];
  if (root.address?.district) {
    fallbackOrConditions.push({ "address.district": root.address.district });
  }
  if (root.address?.city) {
    fallbackOrConditions.push({ "address.city": root.address.city });
  }

  const fallbackFilter = {
    _id: { $ne: root._id, $nin: sameCuisine.map((r) => r._id) },
    businessStatus: "active",
    publicationStatus: "published",
  };
  if (fallbackOrConditions.length > 0) {
    fallbackFilter.$or = fallbackOrConditions;
  }

  const fallback = await Restaurant.find(fallbackFilter)
    .sort({ avgRating: -1, reviewCount: -1, _id: -1 })
    .limit(lim - sameCuisine.length)
    .lean();

  return [...sameCuisine, ...fallback];
}
