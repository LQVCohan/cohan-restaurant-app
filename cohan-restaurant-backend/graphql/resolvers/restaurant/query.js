// src/resolvers/restaurant.query.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Restaurant, User } from "../../../models/index.js";

/* ============================ Helpers ============================ */

function badInput(message) {
  return new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}
function notFound(message = "Resource not found") {
  return new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });
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

function safeRegexContains(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  return { $regex: s, $options: "i" };
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

/* ============================ Queries ============================ */

/** Danh sách nhà hàng với cursor pagination và bộ lọc
 *  - sort theo _id tăng dần
 *  - cursor là _id, dùng $gt (forward pagination)
 */
async function restaurants(_, { limit = 20, cursor, restaurantFilter }) {
  const lim = clampLimit(limit, 1, 100);

  const f = buildFilter(restaurantFilter);
  const cId = toObjectIdOrNull(cursor);
  if (cId) f._id = { ...(f._id || {}), $gt: cId };

  const docs = await Restaurant.find(f)
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
  };
}

/** Chi tiết nhà hàng */
async function restaurant(_, { id }) {
  if (!mongoose.isValidObjectId(id)) {
    throw badInput("Invalid ID");
  }
  const doc = await Restaurant.findById(id).lean();
  return doc || null; // SDL của bạn cho phép null
}

/** Top nhà hàng theo rating với bộ lọc */
async function restaurantsTop(_, { limit = 6, restaurantFilter }) {
  const lim = clampLimit(limit, 1, 100);
  const f = buildFilter(restaurantFilter);

  const docs = await Restaurant.find(f)
    .sort({ avgRating: -1, _id: 1 })
    .limit(lim)
    .lean();

  return docs;
}

/** Danh sách nhà hàng theo manager với cursor pagination và bộ lọc */
async function restaurantsByManager(
  _,
  { managerId, limit = 20, cursor, restaurantFilter }
) {
  if (!mongoose.isValidObjectId(managerId)) {
    throw badInput("Invalid managerId");
  }

  const lim = clampLimit(limit, 1, 100);
  const f = {
    managerId: new mongoose.Types.ObjectId(managerId),
    ...buildFilter(restaurantFilter),
  };

  const cId = toObjectIdOrNull(cursor);
  if (cId) f._id = { ...(f._id || {}), $gt: cId };

  const docs = await Restaurant.find(f)
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
  };
}

/** Các nhà hàng tham chiếu theo user.refRestaurant */
async function refRestaurants(_, { userId }) {
  if (!mongoose.isValidObjectId(userId)) {
    throw badInput("Invalid userId");
  }

  const user = await User.findById(userId).select("refRestaurant").lean();
  if (!user) throw notFound("User not found");

  const ref = Array.isArray(user.refRestaurant) ? user.refRestaurant : [];
  if (ref.length === 0) return [];

  // Chuẩn hoá về ObjectId, loại phần tử rỗng/trùng
  const ids = [
    ...new Set(
      ref
        .map((x) => (mongoose.isValidObjectId(x) ? String(x) : null))
        .filter(Boolean)
    ),
  ].map((s) => new mongoose.Types.ObjectId(s));

  if (ids.length === 0) return [];

  const restaurants = await Restaurant.find({ _id: { $in: ids } })
    .sort({ _id: 1 })
    .lean();

  return restaurants;
}

export const RestaurantQuery = {
  restaurants,
  restaurant,
  restaurantsTop,
  restaurantsByManager,
  refRestaurants,
};
