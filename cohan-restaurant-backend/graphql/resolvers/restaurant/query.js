// src/resolvers/restaurant.query.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Restaurant, User, RestaurantCategoryIndex, Menu, MenuItem, Order, Reservation, TableCustomer } from "../../../models/index.js";

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

/** Các nhà hàng tham chiếu theo user.refRestaurants */
async function refRestaurants(_, { userId }) {
  if (!mongoose.isValidObjectId(userId)) {
    throw badInput("Invalid userId");
  }

  const user = await User.findById(userId).select("refRestaurants").lean();
  if (!user) throw notFound("User not found");

  const ref = Array.isArray(user.refRestaurants) ? user.refRestaurants : [];
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
  restaurantsByManager,
  refRestaurants,
  restaurantsByCategoryTimeSlot,
  restaurantCategoryIndexes,
  refreshRestaurantCategoryIndexes,
};
