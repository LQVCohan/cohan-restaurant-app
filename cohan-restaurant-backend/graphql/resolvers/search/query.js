// src/graphql/resolvers/search/query.js

import { User, Staff, MenuItem, Restaurant } from "../../../models/index.js";

const MAX_SEARCH_LENGTH = 80;
const CHEF_TITLE_REGEX = /(?:bếp trưởng|bep truong|head chef|executive chef|chef)/i;
const COOKING_METHODS = [
  { label: "Nướng", tokens: ["nướng", "nuong"] },
  { label: "Hấp", tokens: ["hấp", "hap"] },
  { label: "Chiên", tokens: ["chiên", "chien"] },
  { label: "Xào", tokens: ["xào", "xao"] },
  { label: "Kho", tokens: ["kho"] },
  { label: "Rang", tokens: ["rang"] },
  { label: "Luộc", tokens: ["luộc", "luoc"] },
  { label: "Hầm", tokens: ["hầm", "ham"] },
  { label: "Áp chảo", tokens: ["áp chảo", "ap chao"] },
  { label: "Trộn", tokens: ["trộn", "tron"] },
  { label: "Không qua nhiệt", tokens: ["không qua nhiệt", "khong qua nhiet"] },
];

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

function normalizePhone(value) {
  return String(value || "")
    .replace(/[^0-9]/g, "")
    .slice(0, MAX_SEARCH_LENGTH);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toSafeRegex(value) {
  const normalized = String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);

  return normalized ? new RegExp(escapeRegex(normalized), "i") : null;
}

function phoneRegexCondition(phoneDigits) {
  return { $regex: escapeRegex(phoneDigits), $options: "i" };
}

function clampLimit(value, fallback = 5, max = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), max);
}

function clampOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(Math.floor(parsed), 0);
}

function isAdminUser(ctx) {
  const user = ctx?.user;
  const roleName = String(
    user?.roleName || user?.role || user?.userType || "",
  ).toUpperCase();
  const roles = Array.isArray(user?.roles)
    ? user.roles.map((role) => String(role).toUpperCase())
    : [];

  return roleName === "ADMIN" || roles.includes("ADMIN");
}

function normalizeTimeSlot(value) {
  if (!value) return null;
  return value.toString().trim().toLowerCase();
}

function publicRestaurantFilter(prefix = "") {
  const field = (name) => (prefix ? `${prefix}.${name}` : name);

  return {
    $or: [
      {
        [field("businessStatus")]: "active",
        [field("publicationStatus")]: "published",
      },
      {
        [field("businessStatus")]: { $exists: false },
        [field("publicationStatus")]: { $exists: false },
        [field("status")]: "active",
      },
    ],
  };
}

function formatServingNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return String(parsed);
}

function formatServingUnit(value) {
  const unit = String(value || "").trim();
  if (!unit) return "";
  if (unit === "portion") return "phần";
  return unit;
}

function buildServingLabel(doc = {}) {
  const variants = Array.isArray(doc?.recipe?.servingVariants)
    ? doc.recipe.servingVariants
    : [];
  const preferred =
    variants.find((variant) => variant?.isDefault) || variants[0] || null;

  if (preferred?.name?.trim()) return preferred.name.trim();

  const variantQty = formatServingNumber(preferred?.sellQty);
  const variantUnit = formatServingUnit(preferred?.sellUnit);
  if (variantQty && variantUnit) return `${variantQty} ${variantUnit}`;

  const portion = formatServingNumber(doc?.servingPortion);
  const unit = formatServingUnit(doc?.servingUnit);
  return portion && unit ? `${portion} ${unit}` : null;
}

function extractCookingMethods(doc = {}) {
  const text = [doc?.name, doc?.description, doc?.recipe?.notes]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("vi");

  return COOKING_METHODS
    .filter(({ tokens }) => tokens.some((token) => text.includes(token)))
    .map(({ label }) => label)
    .slice(0, 3);
}

function toRestaurantPayload(restaurant) {
  if (!restaurant?._id && !restaurant?.id) return null;

  return {
    id: String(restaurant._id || restaurant.id),
    name: restaurant.name,
    coverImage: restaurant.coverImage || null,
    avatar: restaurant.avatar || null,
    avgRating: restaurant.avgRating ?? 0,
    cuisineType: restaurant.cuisineType || null,
    phone: restaurant.phone || null,
    address: restaurant.address || null,
  };
}

function buildMenuSearchPipeline({
  regex,
  timeSlotDb = null,
  limit = 5,
  offset = 0,
  filter = {},
}) {
  const searchConditions = [
    { name: regex },
    { description: regex },
    { code: regex },
    { labels: regex },
    { "category.name": regex },
    { servingUnit: regex },
    { servingSearchText: regex },
    { "recipe.servingVariants.name": regex },
    { "recipe.servingVariants.key": regex },
    { "recipe.servingVariants.sellUnit": regex },
    { variantSearchText: regex },
    { "recipe.notes": regex },
  ];

  const matchConditions = [
    { "menu.isActive": true },
    publicRestaurantFilter("restaurant"),
    {
      $or: [
        { "category._id": { $exists: false } },
        { "category.isActive": true },
      ],
    },
    {
      $or: [
        { "recipe._id": { $exists: false } },
        { "recipe.isActive": true, "recipe.deletedAt": null },
      ],
    },
    { $or: searchConditions },
  ];

  if (timeSlotDb) {
    matchConditions.push({ "menu.timeSlot": timeSlotDb });
  }

  const cityRegex = toSafeRegex(filter?.city);
  if (cityRegex) matchConditions.push({ "restaurant.address.city": cityRegex });

  const districtRegex = toSafeRegex(filter?.district);
  if (districtRegex) {
    matchConditions.push({ "restaurant.address.district": districtRegex });
  }

  if (filter?.minRating != null) {
    const minRating = Number(filter.minRating);
    if (Number.isFinite(minRating)) {
      matchConditions.push({ "restaurant.avgRating": { $gte: minRating } });
    }
  }

  return [
    { $match: { status: "available" } },
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
      $lookup: {
        from: "categories",
        localField: "categoryId",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "recipes",
        localField: "_id",
        foreignField: "menuItemId",
        as: "recipe",
      },
    },
    { $unwind: { path: "$recipe", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        servingSearchText: {
          $trim: {
            input: {
              $concat: [
                {
                  $convert: {
                    input: "$servingPortion",
                    to: "string",
                    onError: "",
                    onNull: "",
                  },
                },
                " ",
                { $ifNull: ["$servingUnit", ""] },
              ],
            },
          },
        },
        variantSearchText: {
          $reduce: {
            input: { $ifNull: ["$recipe.servingVariants", []] },
            initialValue: "",
            in: {
              $concat: [
                "$$value",
                " ",
                { $ifNull: ["$$this.name", ""] },
                " ",
                { $ifNull: ["$$this.key", ""] },
                " ",
                {
                  $convert: {
                    input: "$$this.sellQty",
                    to: "string",
                    onError: "",
                    onNull: "",
                  },
                },
                " ",
                { $ifNull: ["$$this.sellUnit", ""] },
              ],
            },
          },
        },
      },
    },
    { $match: { $and: matchConditions } },
    { $sort: { rate: -1, orderCounter: -1, _id: 1 } },
    { $skip: clampOffset(offset) },
    { $limit: clampLimit(limit, 5, 50) },
    {
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        thumbImage: 1,
        basePrice: 1,
        rate: 1,
        orderCounter: 1,
        servingPortion: 1,
        servingUnit: 1,
        "restaurant._id": 1,
        "restaurant.name": 1,
        "restaurant.coverImage": 1,
        "restaurant.avatar": 1,
        "restaurant.avgRating": 1,
        "restaurant.cuisineType": 1,
        "restaurant.phone": 1,
        "restaurant.address": 1,
        "menu.timeSlot": 1,
        "category.name": 1,
        "recipe.notes": 1,
        "recipe.servingVariants": 1,
      },
    },
  ];
}

function mapMenuSuggestion(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    restaurantId: doc.restaurant?._id?.toString() || null,
    restaurantName: doc.restaurant?.name || null,
    timeSlot: doc.menu?.timeSlot || null,
    thumbImage: doc.thumbImage || null,
    basePrice: doc.basePrice ?? 0,
    categoryName: doc.category?.name || null,
    servingLabel: buildServingLabel(doc),
    cookingMethods: extractCookingMethods(doc),
  };
}

async function findRestaurantSuggestions(query, limit) {
  const regex = toSafeRegex(query);
  if (!regex) return [];

  const phoneDigits = normalizePhone(query);
  const searchConditions = [
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
    searchConditions.push({ phone: phoneRegexCondition(phoneDigits) });
  }

  const docs = await Restaurant.find(
    {
      $and: [publicRestaurantFilter(), { $or: searchConditions }],
    },
    {
      name: 1,
      address: 1,
      phone: 1,
      avgRating: 1,
      cuisineType: 1,
    },
  )
    .limit(clampLimit(limit, 5, 20))
    .sort({ avgRating: -1, _id: 1 })
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
  if (!regex) return [];

  const docs = await MenuItem.aggregate(
    buildMenuSearchPipeline({
      regex,
      timeSlotDb,
      limit: Math.min(clampLimit(limit, 5, 10), 5),
    }),
  );

  return docs.map(mapMenuSuggestion);
}

async function findChefSuggestions(query, limit, offset = 0) {
  const regex = toSafeRegex(query);
  if (!regex) return [];

  const phoneDigits = normalizePhone(query);
  const searchConditions = [
    { fullName: regex },
    { positionTitle: regex },
    { "role.name": regex },
    { "role.slug": regex },
    { "restaurant.name": regex },
  ];

  if (phoneDigits.length >= 6) {
    searchConditions.push({
      "restaurant.phone": phoneRegexCondition(phoneDigits),
    });
  }

  const docs = await Staff.aggregate([
    {
      $match: {
        userType: "STAFF",
        status: "active",
        employmentStatus: "working",
        restaurantForStaff: { $ne: null },
      },
    },
    {
      $lookup: {
        from: "roles",
        localField: "role",
        foreignField: "_id",
        as: "role",
      },
    },
    { $unwind: { path: "$role", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "restaurants",
        localField: "restaurantForStaff",
        foreignField: "_id",
        as: "restaurant",
      },
    },
    { $unwind: { path: "$restaurant", preserveNullAndEmptyArrays: false } },
    {
      $match: {
        $and: [
          {
            $or: [
              { "role.slug": "chef" },
              { "role.name": CHEF_TITLE_REGEX },
              { positionTitle: CHEF_TITLE_REGEX },
            ],
          },
          publicRestaurantFilter("restaurant"),
          { $or: searchConditions },
        ],
      },
    },
    { $sort: { fullName: 1, _id: 1 } },
    { $skip: clampOffset(offset) },
    { $limit: clampLimit(limit, 5, 20) },
    {
      $project: {
        _id: 1,
        fullName: 1,
        positionTitle: 1,
        avatarUrl: 1,
        roleName: "$role.name",
        "restaurant._id": 1,
        "restaurant.name": 1,
        "restaurant.phone": 1,
        "restaurant.coverImage": 1,
        "restaurant.avatar": 1,
        "restaurant.avgRating": 1,
        "restaurant.cuisineType": 1,
        "restaurant.address": 1,
      },
    },
  ]);

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
  if (!regex) return [];

  const phoneDigits = normalizePhone(query);
  const searchConditions = [{ fullName: regex }, { email: regex }];

  if (phoneDigits.length >= 6) {
    searchConditions.push({ phone: phoneRegexCondition(phoneDigits) });
  }

  const users = await User.find(
    {
      userType: { $in: ["MANAGER", "ADMIN"] },
      $or: searchConditions,
    },
    { fullName: 1, phone: 1, email: 1, refRestaurants: 1 },
  )
    .limit(clampLimit(limit, 5, 20))
    .lean();

  return users.map((user) => ({
    id: user._id.toString(),
    fullName: user.fullName || null,
    phone: user.phone || null,
    email: user.email || null,
    managedRestaurantCount: Array.isArray(user.refRestaurants)
      ? user.refRestaurants.length
      : 0,
  }));
}

async function findLocationSuggestions(query, limit) {
  const regex = toSafeRegex(query);
  if (!regex) return [];

  const docs = await Restaurant.aggregate([
    {
      $match: {
        $and: [
          publicRestaurantFilter(),
          {
            $or: [
              { "address.ward": regex },
              { "address.district": regex },
              { "address.city": regex },
              { "address.line1": regex },
              { "address.line2": regex },
              { "address.country": regex },
              { "address.postalCode": regex },
            ],
          },
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
    { $limit: clampLimit(limit, 5, 20) },
  ]);

  return docs.map((doc) => {
    const ward = doc._id.ward || "";
    const district = doc._id.district || "";
    const city = doc._id.city || "";
    const country = doc._id.country || "";
    const postalCode = doc._id.postalCode || "";

    return {
      label: [ward, district, city].filter(Boolean).join(", "),
      ward: ward || null,
      district: district || null,
      city: city || null,
      country: country || null,
      postalCode: postalCode || null,
      lat: typeof doc.lat === "number" ? doc.lat : null,
      lng: typeof doc.lng === "number" ? doc.lng : null,
    };
  });
}

async function findRestaurants(query, filter, limit, offset) {
  const regex = toSafeRegex(query);
  if (!regex) return [];

  const phoneDigits = normalizePhone(query);
  const searchConditions = [
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
    searchConditions.push({ phone: phoneRegexCondition(phoneDigits) });
  }

  const conditions = [publicRestaurantFilter(), { $or: searchConditions }];

  const cityRegex = toSafeRegex(filter?.city);
  if (cityRegex) conditions.push({ "address.city": cityRegex });

  const districtRegex = toSafeRegex(filter?.district);
  if (districtRegex) conditions.push({ "address.district": districtRegex });

  if (filter?.minRating != null) {
    const minRating = Number(filter.minRating);
    if (Number.isFinite(minRating)) {
      conditions.push({ avgRating: { $gte: minRating } });
    }
  }

  return Restaurant.find(
    { $and: conditions },
    {
      name: 1,
      address: 1,
      phone: 1,
      cuisineType: 1,
      avgRating: 1,
      coverImage: 1,
      avatar: 1,
    },
  )
    .limit(clampLimit(limit, 20, 50))
    .skip(clampOffset(offset))
    .sort({ avgRating: -1, _id: 1 })
    .lean();
}

async function findMenuItems(query, filter, limit, offset) {
  const regex = toSafeRegex(query);
  if (!regex) return [];

  return MenuItem.aggregate(
    buildMenuSearchPipeline({
      regex,
      timeSlotDb: normalizeTimeSlot(filter?.timeSlot),
      limit,
      offset,
      filter,
    }),
  );
}

async function findOwners(query, limit, offset) {
  const regex = toSafeRegex(query);
  if (!regex) return [];

  const phoneDigits = normalizePhone(query);
  const searchConditions = [{ fullName: regex }, { email: regex }];

  if (phoneDigits.length >= 6) {
    searchConditions.push({ phone: phoneRegexCondition(phoneDigits) });
  }

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
  const requestedTypes =
    filter?.types?.length > 0
      ? filter.types
      : ["RESTAURANT", "MENU_ITEM", "CHEF", "LOCATION"];
  const types = new Set(
    requestedTypes
      .map((type) => type.toString().toUpperCase())
      .filter((type) => type !== "OWNER" || adminUser),
  );

  const [restaurants, menuItems, chefs, owners, locations] = await Promise.all([
    types.has("RESTAURANT")
      ? findRestaurants(trimmed, filter, limit, offset)
      : [],
    types.has("MENU_ITEM")
      ? findMenuItems(trimmed, filter, limit, offset)
      : [],
    types.has("CHEF") ? findChefSuggestions(trimmed, limit, offset) : [],
    adminUser && types.has("OWNER")
      ? findOwners(trimmed, limit, offset)
      : [],
    types.has("LOCATION") ? findLocationSuggestions(trimmed, limit) : [],
  ]);

  const items = [];

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
    const trimmed = String(query || "").trim();
    if (trimmed.length < 2) return emptySuggestions();

    const adminUser = isAdminUser(ctx);

    try {
      const [restaurants, menuItems, chefs, owners, locations] =
        await Promise.all([
          findRestaurantSuggestions(trimmed, limitPerType),
          findMenuItemSuggestions(
            trimmed,
            normalizeTimeSlot(timeSlot),
            limitPerType,
          ),
          findChefSuggestions(trimmed, limitPerType),
          adminUser ? findOwnerSuggestions(trimmed, limitPerType) : [],
          findLocationSuggestions(trimmed, limitPerType),
        ]);

      return { restaurants, menuItems, chefs, owners, locations };
    } catch (error) {
      console.error("searchSuggestions error:", error);
      return emptySuggestions();
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
