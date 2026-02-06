// src/graphql/resolvers/search/query.js

import { User, MenuItem, Restaurant } from "../../../models/index.js";

function compactAddressParts(address = {}) {
  return [
    address?.line1,
    address?.line2,
    address?.ward,
    address?.district,
    address?.city,
    address?.country,
  ]
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
  return q.replace(/[^0-9]/g, "");
}

// FE có thể truyền BREAKFAST, breakfast, BreakFast...
function normalizeTimeSlot(ts) {
  if (!ts) return null;
  return ts.toString().trim().toLowerCase(); // "BREAKFAST" -> "breakfast"
}

/* ============================
 * Suggestions helpers
 * ============================ */

async function findRestaurantSuggestions(query, limit) {
  const phoneDigits = normalizePhone(query);
  const regex = new RegExp(query, "i");

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

  if (phoneDigits.length >= 6) {
    or.push({ phone: { $regex: phoneDigits, $options: "i" } });
  }

  const docs = await Restaurant.find(
    {
      status: "active",
      $or: or,
    },
    {
      name: 1,
      address: 1,
      phone: 1,
      avgRating: 1,
      cuisineType: 1,
    }
  )
    .limit(limit)
    .sort({ avgRating: -1 })
    .lean();

  return docs.map((r) => ({
    id: r._id.toString(),
    name: r.name,
    shortAddress: toShortAddress(r?.address),
    fullAddress: compactAddressParts(r?.address).join(", "),
    phone: r.phone || null,
    avgRating: r.avgRating ?? 0,
    cuisineType: r.cuisineType || null,
    lat: typeof r?.address?.lat === "number" ? r.address.lat : null,
    lng: typeof r?.address?.lng === "number" ? r.address.lng : null,
  }));
}

async function findMenuItemSuggestions(query, timeSlotDb, limit) {
  const regex = new RegExp(query, "i");
  const finalLimit = Math.min(limit || 3, 3); // tối đa 3

  const matchStage = {
    status: "available",
    $or: [{ name: regex }, { description: regex }],
  };

  const pipeline = [
    {
      $lookup: {
        from: "menus",
        localField: "menuId",
        foreignField: "_id",
        as: "menu",
      },
    },
    { $unwind: { path: "$menu", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "restaurants",
        localField: "restaurantId",
        foreignField: "_id",
        as: "restaurant",
      },
    },
    { $unwind: { path: "$restaurant", preserveNullAndEmptyArrays: true } },
    {
      $match: {
        ...matchStage,
        ...(timeSlotDb ? { "menu.timeSlot": timeSlotDb } : {}),
      },
    },
    {
      $sort: {
        point: -1,
        _id: 1,
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        thumbImage: 1,
        basePrice: 1,
        point: 1,
        "restaurant._id": 1,
        "restaurant.name": 1,
        "menu.timeSlot": 1,
      },
    },
    { $limit: finalLimit },
  ];

  const docs = await MenuItem.aggregate(pipeline);

  return docs.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    restaurantId: d.restaurant?._id?.toString() || null,
    restaurantName: d.restaurant?.name || null,
    timeSlot: d.menu?.timeSlot || null,
    thumbImage: d.thumbImage || null,
    basePrice: d.basePrice ?? 0,
  }));
}

async function findOwnerSuggestions(query, limit) {
  const phoneDigits = normalizePhone(query);
  const regex = new RegExp(query, "i");

  const or = [{ fullName: regex }, { email: regex }];

  if (phoneDigits.length >= 6) {
    or.push({ phone: { $regex: phoneDigits, $options: "i" } });
  }

  const users = await User.find(
    {
      userType: { $in: ["MANAGER", "ADMIN"] },
      $or: or,
    },
    { fullName: 1, phone: 1, email: 1, refRestaurants: 1 }
  )
    .limit(limit)
    .lean();

  return users.map((u) => ({
    id: u._id.toString(),
    fullName: u.fullName || null,
    phone: u.phone || null,
    email: u.email || null,
    managedRestaurantCount: Array.isArray(u.refRestaurants)
      ? u.refRestaurants.length
      : 0,
  }));
}

async function findLocationSuggestions(query, limit) {
  const trimmed = (query || "").trim();
  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  const regex = new RegExp(trimmed, "i");

  const docs = await Restaurant.aggregate([
    {
      $match: {
        status: "active",
        $or: [
          { "address.ward": { $regex: regex } },
          { "address.district": { $regex: regex } },
          { "address.city": { $regex: regex } },
          { "address.line1": { $regex: regex } },
          { "address.line2": { $regex: regex } },
          { "address.country": { $regex: regex } },
          { "address.postalCode": { $regex: regex } },
        ],
      },
    },
    {
      $group: {
        _id: {
          ward: "$address.ward",
          district: "$address.district",
          city: "$address.city",
          country: "$address.country",
          postalCode: "$address.postalCode",
        },
        lat: { $first: "$address.lat" },
        lng: { $first: "$address.lng" },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);

  return docs.map((d) => {
    const ward = d._id.ward || "";
    const district = d._id.district || "";
    const city = d._id.city || "";
    const country = d._id.country || "";
    const postalCode = d._id.postalCode || "";
    return {
      label: [ward, district, city].filter(Boolean).join(", "),
      ward: ward || null,
      district: district || null,
      city: city || null,
      country: country || null,
      postalCode: postalCode || null,
      lat: typeof d.lat === "number" ? d.lat : null,
      lng: typeof d.lng === "number" ? d.lng : null,
    };
  });
}

/* ============================
 * FULL SEARCH
 * ============================ */

async function fullSearch(query, filter, limit, offset) {
  const trimmed = (query || "").trim();
  if (!trimmed) {
    return { items: [], totalCount: 0 };
  }

  const types = new Set(
    (filter?.types && filter.types.length
      ? filter.types
      : ["RESTAURANT", "MENU_ITEM", "OWNER", "LOCATION"]
    ).map((t) => t.toString().toUpperCase())
  );

  const timeSlotDb = filter?.timeSlot
    ? normalizeTimeSlot(filter.timeSlot)
    : null;

  const regex = new RegExp(trimmed, "i");

  const [restaurants, menuItems, owners, locations] = await Promise.all([
    types.has("RESTAURANT")
      ? (async () => {
          const baseFilter = { status: "active" };

          const phoneDigits = normalizePhone(trimmed);
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
          if (phoneDigits.length >= 6) {
            or.push({ phone: { $regex: phoneDigits, $options: "i" } });
          }

          if (filter?.city) {
            baseFilter["address.city"] = new RegExp(filter.city, "i");
          }
          if (filter?.district) {
            baseFilter["address.district"] = new RegExp(filter.district, "i");
          }
          if (filter?.minRating != null) {
            baseFilter.avgRating = { $gte: filter.minRating };
          }

          return Restaurant.find(
            {
              ...baseFilter,
              $or: or,
            },
            {
              name: 1,
              address: 1,
              cuisineType: 1,
              avgRating: 1,
              coverImage: 1,
              avatar: 1,
            }
          )
            .limit(limit)
            .skip(offset)
            .sort({ avgRating: -1 })
            .lean();
        })()
      : [],

    types.has("MENU_ITEM")
      ? (async () => {
          const miMatch = {
            status: "available",
            $or: [{ name: regex }, { description: regex }],
          };

          const pipeline = [
            {
              $lookup: {
                from: "menus",
                localField: "menuId",
                foreignField: "_id",
                as: "menu",
              },
            },
            { $unwind: { path: "$menu", preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: "restaurants",
                localField: "restaurantId",
                foreignField: "_id",
                as: "restaurant",
              },
            },
            {
              $unwind: {
                path: "$restaurant",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $match: {
                ...miMatch,
                ...(timeSlotDb ? { "menu.timeSlot": timeSlotDb } : {}),
              },
            },
            {
              $project: {
                _id: 1,
                name: 1,
                thumbImage: 1,
                basePrice: 1,
                "menu.timeSlot": 1,
                "restaurant._id": 1,
                "restaurant.name": 1,
                "restaurant.address": 1,
              },
            },
            { $skip: offset },
            { $limit: limit },
          ];

          return MenuItem.aggregate(pipeline);
        })()
      : [],

    types.has("OWNER")
      ? (async () => {
          const phoneDigits = normalizePhone(trimmed);
          const or = [{ fullName: regex }, { email: regex }];

          if (phoneDigits.length >= 6) {
            or.push({ phone: { $regex: phoneDigits, $options: "i" } });
          }

          return User.find(
            {
              userType: { $in: ["MANAGER", "ADMIN"] },
              $or: or,
            },
            { fullName: 1, phone: 1, email: 1, refRestaurants: 1 }
          )
            .limit(limit)
            .skip(offset)
            .lean();
        })()
      : [],

    types.has("LOCATION") ? await findLocationSuggestions(trimmed, limit) : [],
  ]);

  const items = [];

  for (const r of restaurants) {
    items.push({
      type: "RESTAURANT",
      score: r.avgRating || 0,
      restaurant: {
        id: r._id.toString(),
        name: r.name,
        coverImage: r.coverImage || null,
        avatar: r.avatar || null,
        avgRating: r.avgRating ?? 0,
        cuisineType: r.cuisineType || null,
        address: r.address || null,
      },
    });
  }

  for (const m of menuItems) {
    items.push({
      type: "MENU_ITEM",
      score: 1,
      timeSlot: m.menu?.timeSlot || null,
      menuItem: {
        id: m._id.toString(),
        name: m.name,
        basePrice: m.basePrice ?? 0,
        thumbImage: m.thumbImage || null,
        restaurant: m.restaurant
          ? {
              id: m.restaurant._id.toString(),
              name: m.restaurant.name,
              address: m.restaurant.address || null,
            }
          : null,
      },
    });
  }

  for (const o of owners) {
    items.push({
      type: "OWNER",
      score:
        (Array.isArray(o.refRestaurants) ? o.refRestaurants.length : 0) + 1,
      owner: {
        id: o._id.toString(),
        fullName: o.fullName || null,
        phone: o.phone || null,
        email: o.email || null,
      },
    });
  }

  for (const l of locations) {
    items.push({
      type: "LOCATION",
      score: 1,
      locationLabel: l.label,
      locationCity: l.city,
      locationDistrict: l.district,
    });
  }

  items.sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    items,
    totalCount: items.length,
  };
}

/* ============================
 * ROOT RESOLVERS
 * ============================ */

const searchQueryResolvers = {
  async searchSuggestions(_, { query, timeSlot, limitPerType = 5 }) {
    const trimmed = (query || "").trim();
    if (!trimmed || trimmed.length < 2) {
      return {
        restaurants: [],
        menuItems: [],
        owners: [],
        locations: [],
      };
    }

    const timeSlotDb = normalizeTimeSlot(timeSlot);

    try {
      const [restaurants, menuItems, owners, locations] = await Promise.all([
        findRestaurantSuggestions(trimmed, limitPerType),
        findMenuItemSuggestions(trimmed, timeSlotDb, limitPerType),
        findOwnerSuggestions(trimmed, limitPerType),
        findLocationSuggestions(trimmed, limitPerType),
      ]);

      return {
        restaurants,
        menuItems,
        owners,
        locations,
      };
    } catch (err) {
      console.error("searchSuggestions error:", err);
      return {
        restaurants: [],
        menuItems: [],
        owners: [],
        locations: [],
      };
    }
  },

  async search(_, { query, filter, limit = 20, offset = 0 }) {
    try {
      return await fullSearch(query, filter, limit, offset);
    } catch (err) {
      console.error("search error:", err);
      return {
        items: [],
        totalCount: 0,
      };
    }
  },
};

export default searchQueryResolvers;
