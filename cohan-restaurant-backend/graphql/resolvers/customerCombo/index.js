import mongoose from "mongoose";
import { Combo, Promotion, MenuItem } from "../../../models/index.js";
import { GraphQLError } from "graphql";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

const toId = (value) => {
  if (!value) return null;
  if (typeof value === "object" && value._id) return String(value._id);
  if (typeof value === "object" && value.id) return String(value.id);
  return String(value);
};

const toNumber = (value, fallback = null) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const isRestaurantActive = (restaurant) => !restaurant || !restaurant.status || restaurant.status === "active";
const isItemAvailable = (item) => !item || !item.status || item.status === "available";

const getRestaurantName = (restaurant) => restaurant?.name || null;
const getItemName = (item, fallback = "Món trong combo") => item?.name || fallback;
const getItemImage = (item) => item?.thumbImage || null;
const getItemPrice = (item) => toNumber(item?.basePrice, null);

const normalizeItems = (items = [], getRef) => (items || [])
  .map((row) => {
    const item = getRef(row);
    const qty = Math.max(1, Math.floor(toNumber(row?.qty ?? row?.quantity, 1) || 1));
    const price = getItemPrice(item);
    return {
      menuItemId: toId(item?._id || item?.id || row?.menuItemId || row?.itemId),
      name: getItemName(item),
      qty,
      imageUrl: getItemImage(item),
      price,
      _available: isItemAvailable(item),
    };
  })
  .filter((item) => item.menuItemId || item.name);

const sumOriginalPrice = (items) => {
  const pricedItems = (items || []).filter((item) => Number.isFinite(Number(item.price)));
  if (!pricedItems.length) return null;
  return pricedItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0);
};

const discountPercent = (originalPrice, discountAmount) => {
  if (!originalPrice || !discountAmount || originalPrice <= 0) return null;
  return Math.round((discountAmount / originalPrice) * 100);
};

const moneyBadge = (discountAmount, fallback) => {
  if (discountAmount > 0) return `Tiết kiệm ${Math.round(discountAmount).toLocaleString("vi-VN")}đ`;
  return fallback;
};

export const normalizeCombo = (combo) => {
  try {
    const restaurant = combo.restaurantId && typeof combo.restaurantId === "object" ? combo.restaurantId : null;
    const items = normalizeItems(combo.items, (row) => row?.menuItemId);
    const originalPrice = sumOriginalPrice(items);
    const comboPrice = toNumber(combo.price, null);
    const discountAmount = originalPrice && comboPrice != null && originalPrice > comboPrice ? originalPrice - comboPrice : null;
    const isAvailable = isRestaurantActive(restaurant) && items.every((item) => item._available !== false);
    return {
      id: toId(combo._id || combo.id),
      sourceType: "COMBO",
      restaurantId: toId(restaurant?._id || combo.restaurantId),
      restaurantName: getRestaurantName(restaurant),
      name: combo.name || "Combo nhà hàng",
      description: combo.description || null,
      imageUrl: items.find((item) => item.imageUrl)?.imageUrl || null,
      items: items.map(({ _available, ...item }) => item),
      originalPrice,
      comboPrice,
      discountAmount,
      discountPercent: discountPercent(originalPrice, discountAmount),
      badge: moneyBadge(discountAmount, "Combo cố định"),
      isAvailable,
      startsAt: null,
      endsAt: null,
      minPeople: null,
      maxPeople: null,
    };
  } catch (error) {
    console.warn("[customerCombos] skipped combo", combo?._id?.toString?.(), error.message);
    return null;
  }
};

export const normalizePromotion = (promotion) => {
  try {
    const restaurant = promotion.restaurantId && typeof promotion.restaurantId === "object" ? promotion.restaurantId : null;
    const items = normalizeItems(promotion.comboItems, (row) => row?.itemId);
    const originalPrice = sumOriginalPrice(items);
    const rawDiscount = toNumber(promotion.discountValue, 0) || 0;
    let discountAmount = null;
    let comboPrice = null;
    if (String(promotion.discountType || "").toUpperCase() === "PERCENT" && originalPrice) {
      discountAmount = originalPrice * Math.min(100, Math.max(0, rawDiscount)) / 100;
      if (promotion.maxDiscount > 0) discountAmount = Math.min(discountAmount, Number(promotion.maxDiscount));
      comboPrice = Math.max(0, originalPrice - discountAmount);
    } else if (rawDiscount > 0) {
      discountAmount = rawDiscount;
      comboPrice = originalPrice ? Math.max(0, originalPrice - discountAmount) : null;
    }
    const isAvailable = isRestaurantActive(restaurant) && items.every((item) => item._available !== false);
    return {
      id: toId(promotion._id || promotion.id),
      sourceType: "PROMOTION",
      restaurantId: toId(restaurant?._id || promotion.restaurantId),
      restaurantName: getRestaurantName(restaurant),
      name: promotion.name || promotion.code || "Ưu đãi combo",
      description: promotion.description || null,
      imageUrl: items.find((item) => item.imageUrl)?.imageUrl || null,
      items: items.map(({ _available, ...item }) => item),
      originalPrice,
      comboPrice,
      discountAmount,
      discountPercent: discountPercent(originalPrice, discountAmount) || (promotion.discountType === "PERCENT" ? rawDiscount : null),
      badge: moneyBadge(discountAmount, "Ưu đãi combo"),
      isAvailable,
      startsAt: promotion.startAt || null,
      endsAt: promotion.endAt || null,
      minPeople: null,
      maxPeople: null,
    };
  } catch (error) {
    console.warn("[customerCombos] skipped promotion", promotion?._id?.toString?.(), error.message);
    return null;
  }
};

const budgetLimit = (budget) => ({ under_100k: 100000, "100k_200k": 200000, "200k_400k": 400000 }[budget] || null);
const peopleRange = (people) => ({ one: [1, 1], two: [2, 2], three_four: [3, 4], group: [5, Infinity] }[people] || null);
const estimatedPeople = (combo) => (combo.items || []).reduce((sum, item) => sum + Number(item.qty || 1), 0);

const applyFilter = (combos, filter = {}) => {
  const q = String(filter.search || "").trim().toLowerCase();
  const maxBudget = budgetLimit(filter.budget);
  const range = peopleRange(filter.people);
  return combos.filter((combo) => {
    if (filter.onlyAvailable !== false && !combo.isAvailable) return false;
    if (filter.sourceType && combo.sourceType !== filter.sourceType) return false;
    if (q && !`${combo.name} ${combo.restaurantName || ""} ${combo.description || ""}`.toLowerCase().includes(q)) return false;
    const price = combo.comboPrice ?? combo.originalPrice;
    if (maxBudget && Number(price || 0) > maxBudget) return false;
    if (range) {
      const count = estimatedPeople(combo);
      if (count < range[0] || count > range[1]) return false;
    }
    return true;
  });
};


const serializeManagerCombo = (combo) => normalizeCombo(combo) && {
  ...normalizeCombo(combo),
  price: Number(combo?.price || 0),
  isActive: combo?.isActive !== false,
  createdAt: combo?.createdAt || null,
  updatedAt: combo?.updatedAt || null,
};

async function validateComboInput(input, ctx) {
  if (!input?.restaurantId || !mongoose.isValidObjectId(input.restaurantId)) throw new GraphQLError("Invalid restaurantId");
  await requireRestaurantPermission(ctx, input.restaurantId, PERMISSIONS.MENU_WRITE);
  const name = String(input.name || "").trim();
  if (!name) throw new GraphQLError("Tên combo là bắt buộc.");
  const price = Number(input.price || 0);
  if (!(price > 0)) throw new GraphQLError("Giá combo phải lớn hơn 0.");
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.length) throw new GraphQLError("Combo cần ít nhất 1 món.");
  const normalizedItems = items.map((item) => ({ menuItemId: item.menuItemId, qty: Math.max(1, Math.floor(Number(item.qty || 1))) }));
  const ids = [...new Set(normalizedItems.map((item) => String(item.menuItemId || "")))];
  if (ids.some((id) => !mongoose.isValidObjectId(id))) throw new GraphQLError("Món trong combo không hợp lệ.");
  const menuItems = await MenuItem.find({ _id: { $in: ids }, restaurantId: input.restaurantId }).select("_id").lean();
  if (menuItems.length !== ids.length) throw new GraphQLError("Tất cả món trong combo phải thuộc cùng nhà hàng.");
  return {
    restaurantId: input.restaurantId,
    name,
    description: String(input.description || "").trim(),
    imageUrl: String(input.imageUrl || "").trim(),
    items: normalizedItems,
    price,
    isActive: input.isActive !== false,
  };
}

async function loadCustomerCombos(filter = {}) {
  const query = {};
  if (filter.restaurantId && mongoose.isValidObjectId(filter.restaurantId)) query.restaurantId = filter.restaurantId;

  const now = new Date();
  const [combos, promotions] = await Promise.all([
    filter.sourceType === "PROMOTION" ? [] : Combo.find({ ...query, isActive: { $ne: false } }).populate("restaurantId").populate("items.menuItemId").lean(),
    filter.sourceType === "COMBO" ? [] : Promotion.find({
      ...query,
      promotionType: "COMBO",
      isActive: true,
      $and: [
        { $or: [{ startAt: { $exists: false } }, { startAt: null }, { startAt: { $lte: now } }] },
        { $or: [{ endAt: { $exists: false } }, { endAt: null }, { endAt: { $gte: now } }] },
      ],
    }).populate("restaurantId").populate("comboItems.itemId").lean(),
  ]);

  const normalized = [
    ...(combos || []).map(normalizeCombo),
    ...(promotions || []).map(normalizePromotion),
  ].filter(Boolean);
  const filtered = applyFilter(normalized, filter);
  const limit = Math.min(60, Math.max(1, Number(filter.limit || 24)));
  return filtered.slice(0, limit);
}

export default {
  Query: {
    customerCombos: async (_, { filter = {} }) => loadCustomerCombos(filter || {}),
    customerCombo: async (_, { id }) => {
      if (!mongoose.isValidObjectId(id)) return null;
      const doc = await Combo.findOne({ _id: id, isActive: { $ne: false } }).populate("restaurantId").populate("items.menuItemId").lean();
      if (doc) return normalizeCombo(doc);
      const promo = await Promotion.findOne({ _id: id, promotionType: "COMBO", isActive: true }).populate("restaurantId").populate("comboItems.itemId").lean();
      return promo ? normalizePromotion(promo) : null;
    },
    managerCombos: async (_, { restaurantId, search, status }, ctx) => {
      if (!mongoose.isValidObjectId(restaurantId)) throw new GraphQLError("Invalid restaurantId");
      await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.MENU_READ);
      const query = { restaurantId };
      if (status === "active") query.isActive = { $ne: false };
      if (status === "inactive") query.isActive = false;
      if (search) query.name = { $regex: String(search).trim(), $options: "i" };
      const docs = await Combo.find(query).sort({ updatedAt: -1 }).populate("restaurantId").populate("items.menuItemId").lean();
      return docs.map(serializeManagerCombo).filter(Boolean);
    },
    combo: async (_, { id }, ctx) => {
      if (!mongoose.isValidObjectId(id)) return null;
      const doc = await Combo.findById(id).populate("restaurantId").populate("items.menuItemId").lean();
      if (!doc) return null;
      await requireRestaurantPermission(ctx, doc.restaurantId?._id || doc.restaurantId, PERMISSIONS.MENU_READ);
      return serializeManagerCombo(doc);
    },
  },
  Mutation: {
    createCombo: async (_, { input }, ctx) => {
      const payload = await validateComboInput(input, ctx);
      const combo = await Combo.create(payload);
      return serializeManagerCombo(await Combo.findById(combo._id).populate("restaurantId").populate("items.menuItemId").lean());
    },
    updateCombo: async (_, { id, input }, ctx) => {
      if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid combo id");
      const payload = await validateComboInput(input, ctx);
      const combo = await Combo.findOneAndUpdate({ _id: id }, payload, { new: true }).populate("restaurantId").populate("items.menuItemId").lean();
      if (!combo) throw new GraphQLError("Combo not found");
      return serializeManagerCombo(combo);
    },
    deleteCombo: async (_, { id }, ctx) => {
      if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid combo id");
      const combo = await Combo.findById(id).lean();
      if (!combo) return true;
      await requireRestaurantPermission(ctx, combo.restaurantId, PERMISSIONS.MENU_WRITE);
      await Combo.deleteOne({ _id: id });
      return true;
    },
    toggleComboStatus: async (_, { id, isActive }, ctx) => {
      if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid combo id");
      const combo = await Combo.findById(id).lean();
      if (!combo) throw new GraphQLError("Combo not found");
      await requireRestaurantPermission(ctx, combo.restaurantId, PERMISSIONS.MENU_WRITE);
      const updated = await Combo.findByIdAndUpdate(id, { isActive: Boolean(isActive) }, { new: true }).populate("restaurantId").populate("items.menuItemId").lean();
      return serializeManagerCombo(updated);
    },
  },
};
