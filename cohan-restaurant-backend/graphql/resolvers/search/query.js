// src/graphql/resolvers/search/query.js

import { BrandMembership, MenuItem, Restaurant, User } from "../../../models/index.js";
import { buildPublicRestaurantFilter } from "../restaurant/publicRestaurantAccess.js";

const MAX_QUERY_LENGTH = 120;
const clampLimit = (value, fallback = 20) => Math.max(1, Math.min(Number(value) || fallback, 50));
const clampOffset = (value) => Math.max(Number(value) || 0, 0);
const uniq = (arr = []) => [...new Set(arr.map(String).filter(Boolean))];

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toSafeRegex(value = "") {
  return new RegExp(escapeRegex(String(value).slice(0, MAX_QUERY_LENGTH)), "i");
}

function compactAddressParts(address = {}) {
  return [address?.line1, address?.line2, address?.ward, address?.district, address?.city, address?.country]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
}

function toShortAddress(address = {}) {
  return [address?.ward, address?.district, address?.city]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");
}

function normalizePhone(q) {
  if (!q) return "";
  return String(q).replace(/[^0-9]/g, "");
}

function isAdminUser(ctx) {
  const user = ctx?.user;
  const roleName = String(user?.roleName || user?.role?.slug || user?.role || user?.userType || "").toUpperCase();
  const roles = Array.isArray(user?.roles) ? user.roles.map((r) => String(r).toUpperCase()) : [];
  return roleName === "ADMIN" || roles.includes("ADMIN");
}

function normalizeTimeSlot(ts) {
  if (!ts) return null;
  return ts.toString().trim().toLowerCase();
}

function buildRestaurantOr(regex, query) {
  const phoneDigits = normalizePhone(query);
  const or = [
    { name: regex },
    { "address.line1": regex },
    { "address.line2": regex },
    { "address.ward": regex },
    { "address.district": regex },
    { "address.city": regex },
    { "address.country": regex },
    { "address.postalCode": regex },
    { cuisineType: regex },
  ];
  if (phoneDigits.length >= 6) or.push({ phone: { $regex: phoneDigits, $options: "i" } });
  return or;
}

function buildRestaurantFilter(query, filter = {}) {
  const regex = toSafeRegex(query);
  const base = { ...buildPublicRestaurantFilter(), $or: buildRestaurantOr(regex, query) };
  if (filter?.city) base["address.city"] = toSafeRegex(filter.city);
  if (filter?.district) base["address.district"] = toSafeRegex(filter.district);
  if (filter?.minRating != null) base.avgRating = { $gte: Number(filter.minRating) || 0 };
  return base;
}

async function managedRestaurantCountMap(users = []) {
  const userIds = uniq(users.map((user) => user?._id));
  if (!userIds.length) return new Map();

  const memberships = await BrandMembership.find({ userId: { $in: userIds }, status: "active" })
    .select("userId role brandId restaurantIds")
    .lean();
  const brandIds = uniq(
    memberships
      .filter((membership) => ["owner", "admin"].includes(String(membership.role)))
      .map((membership) => membership.brandId),
  );
  const brandRestaurants = brandIds.length
    ? await Restaurant.find({ brandId: { $in: brandIds } }).select("_id brandId").lean()
    : [];

  const byBrand = new Map();
  for (const restaurant of brandRestaurants) {
    const key = String(restaurant.brandId || "");
    if (!byBrand.has(key)) byBrand.set(key, []);
    byBrand.get(key).push(String(restaurant._id));
  }

  const counts = new Map(userIds.map((id) => [String(id), new Set()]));
  for (const membership of memberships) {
    const set = counts.get(String(membership.userId));
    if (!set) continue;
    if (["owner", "admin"].includes(String(membership.role))) {
      (byBrand.get(String(membership.brandId)) || []).forEach((id) => set.add(id));
    } else if (String(membership.role) === "manager") {
      (membership.restaurantIds || []).forEach((id) => set.add(String(id)));
    }
  }

  return new Map([...counts].map(([userId, ids]) => [userId, ids.size]));
}

async function findRestaurantSuggestions(query, limit) {
  const docs = await Restaurant.find(
    buildRestaurantFilter(query),
    { name: 1, address: 1, phone: 1, avgRating: 1, cuisineType: 1 },
  )
    .limit(clampLimit(limit, 5))
    .sort({ avgRating: -1 })
    .lean();

  return docs.map((restaurant) => ({
    id: restaurant._id.toString(),
    name: restaurant.name,
    shortAddress: toShortAddress(restaurant?.address),
    fullAddress: compactAddressParts(restaurant?.address).join(", "),
    phone: restaurant.phone || null,
    avgRating: restaurant.avgRating ?? 0,
    cuisineType: restaurant.cuisineType || null,
    lat:
      typeof restaurant?.address?.lat === "number"
        ? restaurant.address.lat
        : null,
    lng:
      typeof restaurant?.address?.lng === "number"
        ? restaurant.address.lng
        : null,
  }));
}

async function findMenuItemSuggestions(query, timeSlotDb, limit) {
  const regex = toSafeRegex(query);
  const finalLimit = Math.min(clampLimit(limit, 3), 3);
  const pipeline = [
    { $lookup: { from: "menus", localField: "menuId", foreignField: "_id", as: "menu" } },
    { $unwind: { path: "$menu", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "restaurants", localField: "restaurantId", foreignField: "_id", as: "restaurant" } },
    { $unwind: { path: "$restaurant", preserveNullAndEmptyArrays: true } },
    { $match: { status: "available", $or: [{ name: regex }, { description: regex }], ...(timeSlotDb ? { "menu.timeSlot": timeSlotDb } : {}) } },
    { $sort: { rate: -1, orderCounter: -1, _id: 1 } },
    { $project: { _id: 1, name: 1, thumbImage: 1, basePrice: 1, rate: 1, orderCounter: 1, "restaurant._id": 1, "restaurant.name": 1, "menu.timeSlot": 1 } },
    { $limit: finalLimit },
  ];
  const docs = await MenuItem.aggregate(pipeline);

  return docs.map((chef) => ({
    id: chef._id.toString(),
    fullName: chef.fullName || null,
    positionTitle: chef.positionTitle || chef.roleName || "Bếp trưởng",
    avatarUrl: chef.avatarUrl || null,
    restaurantId: chef.restaurant._id.toString(),
    restaurantName: chef.restaurant.name,
    contactPhone: chef.restaurant.phone || null,
    restaurant: chef.restaurant,
  }));
}

async function findOwnerSuggestions(query, limit) {
  const regex = toSafeRegex(query);
  const or = [{ fullName: regex }, { email: regex }];
  const phoneDigits = normalizePhone(query);
  if (phoneDigits.length >= 6) or.push({ phone: { $regex: phoneDigits, $options: "i" } });

  const users = await User.find(
    { userType: { $in: ["MANAGER", "ADMIN"] }, $or: or },
    { fullName: 1, phone: 1, email: 1 },
  )
    .limit(clampLimit(limit, 5))
    .lean();
  const counts = await managedRestaurantCountMap(users);

  return users.map((u) => ({
    id: u._id.toString(),
    fullName: u.fullName || null,
    phone: u.phone || null,
    email: u.email || null,
    managedRestaurantCount: counts.get(String(u._id)) || 0,
  }));
}

async function findChefSuggestions(query, limit, offset = 0) {
  const regex = toSafeRegex(query);
  return User.find(
    {
      status: "active",
      deletedAt: null,
      $or: [
        { fullName: regex },
        { email: regex },
        { userType: "STAFF", roleName: regex },
        { userType: "STAFF", jobTitle: regex },
      ],
    },
    { fullName: 1, email: 1, phone: 1, avatar: 1, roleName: 1, jobTitle: 1 },
  )
    .limit(clampLimit(limit))
    .skip(clampOffset(offset))
    .lean();
}

async function findLocationSuggestions(query, limit) {
  const trimmed = (query || "").trim().slice(0, MAX_QUERY_LENGTH);
  if (!trimmed || trimmed.length < 2) return [];
  const regex = toSafeRegex(trimmed);

  const docs = await Restaurant.aggregate([
    { $match: { ...buildPublicRestaurantFilter(), $or: [
      { "address.ward": { $regex: regex } },
      { "address.district": { $regex: regex } },
      { "address.city": { $regex: regex } },
      { "address.line1": { $regex: regex } },
      { "address.line2": { $regex: regex } },
      { "address.country": { $regex: regex } },
      { "address.postalCode": { $regex: regex } },
    ] } },
    { $group: { _id: { ward: "$address.ward", district: "$address.district", city: "$address.city", country: "$address.country", postalCode: "$address.postalCode" }, lat: { $first: "$address.lat" }, lng: { $first: "$address.lng" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: clampLimit(limit, 5) },
  ]);

  return docs.map((d) => ({
    label: [d._id.ward || "", d._id.district || "", d._id.city || ""].filter(Boolean).join(", "),
    ward: d._id.ward || null,
    district: d._id.district || null,
    city: d._id.city || null,
    country: d._id.country || null,
    postalCode: d._id.postalCode || null,
    lat: typeof d.lat === "number" ? d.lat : null,
    lng: typeof d.lng === "number" ? d.lng : null,
  }));
}

async function findRestaurants(query, filter, limit, offset) {
  return Restaurant.find(
    buildRestaurantFilter(query, filter),
    { name: 1, address: 1, cuisineType: 1, avgRating: 1, coverImage: 1, avatar: 1 },
  )
    .limit(clampLimit(limit))
    .skip(clampOffset(offset))
    .sort({ avgRating: -1 })
    .lean();
}

async function findMenuItems(query, filter, limit, offset) {
  const regex = toSafeRegex(query);
  const timeSlotDb = normalizeTimeSlot(filter?.timeSlot);
  return MenuItem.aggregate([
    { $lookup: { from: "menus", localField: "menuId", foreignField: "_id", as: "menu" } },
    { $unwind: { path: "$menu", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "restaurants", localField: "restaurantId", foreignField: "_id", as: "restaurant" } },
    { $unwind: { path: "$restaurant", preserveNullAndEmptyArrays: true } },
    { $match: { status: "available", $or: [{ name: regex }, { description: regex }, { "servingVariants.name": regex }, { cookingMethod: regex }, { category: regex }, { "recipe.notes": regex }], ...(timeSlotDb ? { "menu.timeSlot": timeSlotDb } : {}) } },
    { $project: { _id: 1, name: 1, thumbImage: 1, basePrice: 1, "menu.timeSlot": 1, "restaurant._id": 1, "restaurant.name": 1, "restaurant.address": 1 } },
    { $skip: clampOffset(offset) },
    { $limit: clampLimit(limit) },
  ]);
}

async function findOwners(query, limit, offset) {
  const regex = toSafeRegex(query);
  const or = [{ fullName: regex }, { email: regex }];
  const phoneDigits = normalizePhone(query);
  if (phoneDigits.length >= 6) or.push({ phone: { $regex: phoneDigits, $options: "i" } });

  const users = await User.find(
    { userType: { $in: ["MANAGER", "ADMIN"] }, $or: or },
    { fullName: 1, phone: 1, email: 1 },
  )
    .limit(clampLimit(limit))
    .skip(clampOffset(offset))
    .lean();
  const counts = await managedRestaurantCountMap(users);
  return users.map((user) => ({ ...user, managedRestaurantCount: counts.get(String(user._id)) || 0 }));
}

async function fullSearch(query, filter, limit, offset, ctx) {
  const trimmed = (query || "").trim().slice(0, MAX_QUERY_LENGTH);
  if (!trimmed) return { items: [], totalCount: 0 };

  return User.find(
    {
      userType: { $in: ["MANAGER", "ADMIN"] },
      $or: searchConditions,
    },
    { fullName: 1, phone: 1, email: 1, refRestaurants: 1 },
  )
    .limit(clampLimit(limit, 20, 50))
    .skip(clampOffset(offset))
    .lean();
}

async function fullSearch(query, filter = {}, limit, offset, ctx) {
  const trimmed = String(query || "").trim();
  if (!trimmed) return { items: [], totalCount: 0 };

  const adminUser = isAdminUser(ctx);
  const requestedTypes = filter?.types?.length ? filter.types : ["RESTAURANT", "MENU_ITEM", "LOCATION"];
  const types = new Set(requestedTypes.map((t) => t.toString().toUpperCase()).filter((t) => t !== "OWNER" || adminUser));

  const [restaurants, menuItems, chefs, owners, locations] = await Promise.all([
    types.has("RESTAURANT") ? findRestaurants(trimmed, filter, limit, offset) : [],
    types.has("MENU_ITEM") ? findMenuItems(trimmed, filter, limit, offset) : [],
    types.has("CHEF") ? findChefSuggestions(trimmed, limit, offset) : [],
    adminUser && types.has("OWNER") ? findOwners(trimmed, limit, offset) : [],
    types.has("LOCATION") ? findLocationSuggestions(trimmed, limit) : [],
  ]);

  const items = [];
  restaurants.forEach((r) => items.push({ type: "RESTAURANT", score: r.avgRating || 0, restaurant: { id: r._id.toString(), name: r.name, coverImage: r.coverImage || null, avatar: r.avatar || null, avgRating: r.avgRating ?? 0, cuisineType: r.cuisineType || null, address: r.address || null } }));
  menuItems.forEach((m) => items.push({ type: "MENU_ITEM", score: 1, timeSlot: m.menu?.timeSlot || null, menuItem: { id: m._id.toString(), name: m.name, basePrice: m.basePrice ?? 0, thumbImage: m.thumbImage || null, restaurant: m.restaurant ? { id: m.restaurant._id.toString(), name: m.restaurant.name, address: m.restaurant.address || null } : null } }));
  chefs.forEach((c) => items.push({ type: "CHEF", score: 1, chef: { id: c._id.toString(), fullName: c.fullName || null, phone: c.phone || null, email: c.email || null, avatar: c.avatar || null } }));
  owners.forEach((o) => items.push({ type: "OWNER", score: (o.managedRestaurantCount || 0) + 1, owner: { id: o._id.toString(), fullName: o.fullName || null, phone: o.phone || null, email: o.email || null } }));
  locations.forEach((l) => items.push({ type: "LOCATION", score: 1, locationLabel: l.label, locationCity: l.city, locationDistrict: l.district }));

  restaurants.forEach((restaurant) => {
    items.push({
      type: "RESTAURANT",
      score: restaurant.avgRating || 0,
      restaurant: toRestaurantPayload(restaurant),
      cookingMethods: [],
    });
  });

  menuItems.forEach((menuItem) => {
    items.push({
      type: "MENU_ITEM",
      score: menuItem.rate || 1,
      timeSlot: menuItem.menu?.timeSlot || null,
      restaurant: toRestaurantPayload(menuItem.restaurant),
      menuItem: {
        id: menuItem._id.toString(),
        name: menuItem.name,
        basePrice: menuItem.basePrice ?? 0,
        thumbImage: menuItem.thumbImage || null,
      },
      categoryName: menuItem.category?.name || null,
      servingLabel: buildServingLabel(menuItem),
      cookingMethods: extractCookingMethods(menuItem),
    });
  });

  chefs.forEach((chef) => {
    items.push({
      type: "CHEF",
      score: 1,
      restaurant: toRestaurantPayload(chef.restaurant),
      chef: {
        id: chef.id,
        fullName: chef.fullName,
        positionTitle: chef.positionTitle,
        avatarUrl: chef.avatarUrl,
        restaurantId: chef.restaurantId,
        restaurantName: chef.restaurantName,
        contactPhone: chef.contactPhone,
      },
      cookingMethods: [],
    });
  });

  owners.forEach((owner) => {
    items.push({
      type: "OWNER",
      score:
        (Array.isArray(owner.refRestaurants)
          ? owner.refRestaurants.length
          : 0) + 1,
      owner: {
        id: owner._id.toString(),
        fullName: owner.fullName || null,
        phone: owner.phone || null,
        email: owner.email || null,
      },
      cookingMethods: [],
    });
  });

  locations.forEach((location) => {
    items.push({
      type: "LOCATION",
      score: 1,
      locationLabel: location.label,
      locationCity: location.city,
      locationDistrict: location.district,
      cookingMethods: [],
    });
  });

  items.sort((left, right) => (right.score || 0) - (left.score || 0));
  return { items, totalCount: items.length };
}

const emptySuggestions = () => ({
  restaurants: [],
  menuItems: [],
  chefs: [],
  owners: [],
  locations: [],
});

const searchQueryResolvers = {
  async searchSuggestions(_, { query, timeSlot, limitPerType = 5 }, ctx) {
    const trimmed = (query || "").trim().slice(0, MAX_QUERY_LENGTH);
    if (!trimmed || trimmed.length < 2) return { restaurants: [], menuItems: [], owners: [], locations: [] };
    const timeSlotDb = normalizeTimeSlot(timeSlot);
    const adminUser = isAdminUser(ctx);

    try {
      const [restaurants, menuItems, owners, locations] = await Promise.all([
        findRestaurantSuggestions(trimmed, limitPerType),
        findMenuItemSuggestions(trimmed, timeSlotDb, limitPerType),
        adminUser ? findOwnerSuggestions(trimmed, limitPerType) : [],
        findLocationSuggestions(trimmed, limitPerType),
      ]);
      return { restaurants, menuItems, owners, locations };
    } catch (err) {
      console.error("searchSuggestions error:", err);
      return { restaurants: [], menuItems: [], owners: [], locations: [] };
    }
  },

  async search(_, { query, filter, limit = 20, offset = 0 }, ctx) {
    try {
      return await fullSearch(query, filter, limit, offset, ctx);
    } catch (error) {
      console.error("search error:", error);
      return { items: [], totalCount: 0 };
    }
  },
};

export default searchQueryResolvers;
