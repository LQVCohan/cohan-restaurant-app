import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Restaurant, User } from "../../../models/index.js";

function toObjectIdOrNull(id) {
  if (!id) return null;
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
}

function buildFilter(restaurantFilter) {
  const f = {};
  if (!restaurantFilter) return f;

  const { city, district, cuisineTypes, minRating, priceRange, search } =
    restaurantFilter;

  if (city) f["address.city"] = { $regex: city, $options: "i" };
  if (district) f["address.district"] = { $regex: district, $options: "i" };

  if (Array.isArray(cuisineTypes) && cuisineTypes.length > 0) {
    f.cuisineType = { $in: cuisineTypes };
  }

  if (typeof minRating === "number") {
    f.avgRating = { $gte: minRating };
  }

  if (Array.isArray(priceRange) && priceRange.length > 0) {
    f.priceRange = { $in: priceRange };
  }

  if (search && search.trim()) {
    const s = search.trim();
    f.$or = [
      { name: { $regex: s, $options: "i" } },
      { description: { $regex: s, $options: "i" } },
      { cuisineType: { $regex: s, $options: "i" } },
      { "address.city": { $regex: s, $options: "i" } },
      { "address.district": { $regex: s, $options: "i" } },
    ];
  }

  return f;
}

/** Danh sách nhà hàng với cursor pagination và bộ lọc */
async function restaurants(_, { limit = 20, cursor, restaurantFilter }) {
  const f = buildFilter(restaurantFilter);
  const cId = toObjectIdOrNull(cursor);
  if (cId) f._id = { ...(f._id || {}), $gt: cId };

  const docs = await Restaurant.find(f)
    .sort({ _id: 1 })
    .limit(limit + 1);
  const hasNextPage = docs.length > limit;
  const slice = hasNextPage ? docs.slice(0, -1) : docs;

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
    throw new GraphQLError("Invalid ID", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  const doc = await Restaurant.findById(id);
  return doc || null;
}

/** Top nhà hàng theo rating với bộ lọc */
async function restaurantsTop(_, { limit = 6, restaurantFilter }) {
  const f = buildFilter(restaurantFilter);
  const docs = await Restaurant.find(f)
    .sort({ avgRating: -1, _id: 1 })
    .limit(limit);
  return docs;
}

/** Danh sách nhà hàng theo manager với cursor pagination và bộ lọc */
async function restaurantsByManager(
  _,
  { managerId, limit = 20, cursor, restaurantFilter }
) {
  if (!mongoose.isValidObjectId(managerId)) {
    throw new GraphQLError("Invalid managerId", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const f = {
    managerId: new mongoose.Types.ObjectId(managerId),
    ...buildFilter(restaurantFilter),
  };
  const cId = toObjectIdOrNull(cursor);
  if (cId) f._id = { ...(f._id || {}), $gt: cId };

  const docs = await Restaurant.find(f)
    .sort({ _id: 1 })
    .limit(limit + 1);

  const hasNextPage = docs.length > limit;
  const slice = hasNextPage ? docs.slice(0, -1) : docs;

  return {
    edges: slice.map((d) => ({ node: d, cursor: String(d._id) })),
    pageInfo: {
      endCursor: slice.length ? String(slice[slice.length - 1]._id) : null,
      hasNextPage,
    },
  };
}
async function refRestaurants(_, { userId }) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new GraphQLError("Invalid userId", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  // Tìm user và lấy danh sách nhà hàng mà họ có quyền truy cập
  const user = await User.findById(userId).select("refRestaurant");

  if (!user) {
    throw new GraphQLError("User not found", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  const restaurantIds = user.refRestaurant;

  if (!restaurantIds || restaurantIds.length === 0) {
    return [];
  }

  // Lấy nhà hàng từ danh sách refRestaurant của người dùng
  const restaurants = await Restaurant.find({
    _id: { $in: restaurantIds },
  });

  return restaurants;
}
export const RestaurantQuery = {
  restaurants,
  restaurant,
  restaurantsTop,
  restaurantsByManager,
  refRestaurants,
};
