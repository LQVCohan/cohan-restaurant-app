import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Category, MenuItem, Promotion } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

const PROMOTION_TYPES = new Set([
  "PERCENTAGE",
  "FIXED",
  "BOGO",
  "COMBO",
  "FREESHIP",
]);
const PROMOTION_SCOPES = new Set(["ORDER", "CATEGORY", "ITEM"]);
const DISCOUNT_TYPES = new Set(["PERCENT", "AMOUNT"]);
const TARGET_AUDIENCES = new Set(["all", "new", "vip", "birthday"]);

const toObjId = (id) =>
  id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;

const toObjectIdString = (value) => {
  if (!value) return "";
  if (typeof value === "object" && value._id) return String(value._id);
  if (typeof value === "object" && value.id) return String(value.id);
  return String(value);
};

const serializePromotion = (promotion) => {
  if (!promotion) return null;
  const row =
    typeof promotion.toObject === "function"
      ? promotion.toObject({ virtuals: true })
      : promotion;
  const id = toObjectIdString(row._id || row.id);
  if (!id) return null;

  return {
    ...row,
    id,
    restaurantId: row.restaurantId ? toObjectIdString(row.restaurantId) : null,
    categoryId: row.categoryId ? toObjectIdString(row.categoryId) : null,
    itemId: row.itemId ? toObjectIdString(row.itemId) : null,
    giftItemId: row.giftItemId ? toObjectIdString(row.giftItemId) : null,
    comboItems: Array.isArray(row.comboItems)
      ? row.comboItems
          .map((item) => ({
            itemId: toObjectIdString(item?.itemId),
            quantity: Number(item?.quantity || 1),
          }))
          .filter((item) => item.itemId)
      : [],
  };
};

const toOptionalDate = (value, fieldName) => {
  if (!value) return null;
  const next = new Date(value);
  if (Number.isNaN(next.getTime())) {
    throw new GraphQLError(`${fieldName} không hợp lệ`);
  }
  return next;
};

const normalizePromotionType = (value) => {
  const normalized = String(value || "PERCENTAGE").trim().toUpperCase();
  const aliases = {
    PERCENT: "PERCENTAGE",
    AMOUNT: "FIXED",
    BUY_X_GET_Y: "BOGO",
    BUY_GET: "BOGO",
  };
  const resolved = aliases[normalized] || normalized;
  if (!PROMOTION_TYPES.has(resolved)) {
    throw new GraphQLError("promotionType không hợp lệ");
  }
  return resolved;
};

const normalizeScope = (value) => {
  const normalized = String(value || "ORDER").trim().toUpperCase();
  if (!PROMOTION_SCOPES.has(normalized)) {
    throw new GraphQLError("scope không hợp lệ");
  }
  return normalized;
};

const normalizeDiscountType = (value, promotionType) => {
  if (promotionType === "PERCENTAGE" || promotionType === "BOGO") {
    return "PERCENT";
  }
  if (promotionType === "FIXED" || promotionType === "FREESHIP") {
    return "AMOUNT";
  }

  const normalized = String(value || "PERCENT").trim().toUpperCase();
  if (!DISCOUNT_TYPES.has(normalized)) {
    throw new GraphQLError("discountType không hợp lệ");
  }
  return normalized;
};

const normalizeTargetAudience = (value) => {
  const normalized = String(value || "all").trim().toLowerCase();
  if (!TARGET_AUDIENCES.has(normalized)) {
    throw new GraphQLError("targetAudience không hợp lệ");
  }
  return normalized;
};

const sanitizeComboItems = (items = []) => {
  if (!Array.isArray(items)) return [];

  return items.map((item) => ({
    itemId: toObjId(item?.itemId),
    quantity: Number(item?.quantity ?? 0),
  }));
};

const sanitizeInput = (input = {}) => {
  const promotionType = normalizePromotionType(input.promotionType);
  const scope = normalizeScope(input.scope);
  const payload = {
    name: String(input.name || "").trim(),
    code: input.code ? String(input.code).trim().toUpperCase() : null,
    description: String(input.description || "").trim(),
    promotionType,
    scope,
    restaurantId: toObjId(input.restaurantId),
    categoryId: toObjId(input.categoryId),
    itemId: toObjId(input.itemId),
    giftItemId: toObjId(input.giftItemId),
    discountType: normalizeDiscountType(input.discountType, promotionType),
    discountValue: Number(input.discountValue ?? 0),
    buyQuantity: Number(input.buyQuantity ?? 0),
    getQuantity: Number(input.getQuantity ?? 0),
    comboItems: sanitizeComboItems(input.comboItems),
    minOrderValue: Number(input.minOrderValue ?? 0),
    maxDiscount: Number(input.maxDiscount ?? 0),
    usageLimit: Number(input.usageLimit ?? 0),
    targetAudience: normalizeTargetAudience(input.targetAudience),
    conditions: Array.isArray(input.conditions)
      ? input.conditions.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
    level: Number(input.level ?? 1),
    startAt: toOptionalDate(input.startAt, "startAt"),
    endAt: toOptionalDate(input.endAt, "endAt"),
    isActive: typeof input.isActive === "boolean" ? input.isActive : true,
    stacking: Boolean(input.stacking),
  };

  if (scope !== "CATEGORY") payload.categoryId = null;
  if (scope !== "ITEM" && promotionType !== "BOGO") payload.itemId = null;
  if (promotionType !== "BOGO") payload.giftItemId = null;
  if (promotionType !== "COMBO") payload.comboItems = [];

  return payload;
};

const validatePromotionPayload = (payload) => {
  if (!payload.name || !payload.restaurantId) {
    throw new GraphQLError("Tên và nhà hàng là bắt buộc");
  }

  const nonNegativeFields = [
    ["discountValue", payload.discountValue],
    ["buyQuantity", payload.buyQuantity],
    ["getQuantity", payload.getQuantity],
    ["minOrderValue", payload.minOrderValue],
    ["maxDiscount", payload.maxDiscount],
    ["usageLimit", payload.usageLimit],
  ];

  for (const [fieldName, value] of nonNegativeFields) {
    if (!Number.isFinite(value) || value < 0) {
      throw new GraphQLError(`${fieldName} phải là số không âm`);
    }
  }

  if (!Number.isInteger(payload.level) || payload.level < 1 || payload.level > 3) {
    throw new GraphQLError("level phải là số nguyên từ 1 đến 3");
  }

  if (payload.startAt && payload.endAt && payload.startAt >= payload.endAt) {
    throw new GraphQLError("Thời gian kết thúc phải sau thời gian bắt đầu");
  }

  if (payload.scope === "CATEGORY" && !payload.categoryId) {
    throw new GraphQLError("Khuyến mãi theo danh mục cần categoryId");
  }

  if (payload.scope === "ITEM" && !payload.itemId) {
    throw new GraphQLError("Khuyến mãi theo món cần itemId");
  }

  if (payload.promotionType === "BOGO") {
    if (payload.scope !== "ITEM") {
      throw new GraphQLError("BOGO chỉ hỗ trợ phạm vi ITEM");
    }
    if (!payload.itemId || !payload.giftItemId) {
      throw new GraphQLError("BOGO cần món mua và món tặng");
    }
    if (payload.buyQuantity <= 0 || payload.getQuantity <= 0) {
      throw new GraphQLError("BOGO cần số lượng mua và số lượng tặng lớn hơn 0");
    }
    return;
  }

  if (payload.promotionType === "COMBO") {
    if (payload.scope !== "ORDER") {
      throw new GraphQLError("COMBO chỉ hỗ trợ phạm vi ORDER");
    }
    if (!Array.isArray(payload.comboItems) || payload.comboItems.length < 2) {
      throw new GraphQLError("COMBO cần ít nhất 2 món");
    }

    const seenItemIds = new Set();
    for (const comboItem of payload.comboItems) {
      const itemId = comboItem?.itemId ? String(comboItem.itemId) : "";
      if (!itemId) {
        throw new GraphQLError("Mỗi món COMBO cần itemId hợp lệ");
      }
      if (!Number.isInteger(comboItem.quantity) || comboItem.quantity < 1) {
        throw new GraphQLError("Số lượng món COMBO phải là số nguyên từ 1 trở lên");
      }
      if (seenItemIds.has(itemId)) {
        throw new GraphQLError("COMBO không cho phép chọn trùng món");
      }
      seenItemIds.add(itemId);
    }

    if (payload.discountValue <= 0) {
      throw new GraphQLError("COMBO cần giá trị giảm lớn hơn 0");
    }
    if (payload.discountType === "PERCENT" && payload.discountValue > 100) {
      throw new GraphQLError("Phần trăm giảm COMBO phải từ 1 đến 100");
    }
    return;
  }

  if (payload.promotionType === "FREESHIP") {
    if (payload.scope !== "ORDER") {
      throw new GraphQLError("FREESHIP chỉ hỗ trợ phạm vi ORDER");
    }
    return;
  }

  if (payload.discountValue <= 0) {
    throw new GraphQLError(`${payload.promotionType} cần giá trị giảm lớn hơn 0`);
  }
  if (payload.promotionType === "PERCENTAGE" && payload.discountValue > 100) {
    throw new GraphQLError("Phần trăm giảm phải từ 1 đến 100");
  }
};

const validateReferenceOwnership = async (payload) => {
  const restaurantId = payload.restaurantId;
  if (payload.categoryId) {
    const categoryExists = await Category.exists({
      _id: payload.categoryId,
      restaurantId,
    });
    if (!categoryExists) {
      throw new GraphQLError("Danh mục áp dụng không thuộc nhà hàng đã chọn");
    }
  }

  const itemIds = [
    payload.itemId,
    payload.giftItemId,
    ...(payload.comboItems || []).map((item) => item.itemId),
  ].filter(Boolean);
  const uniqueItemIds = [...new Map(itemIds.map((id) => [String(id), id])).values()];
  if (!uniqueItemIds.length) return;

  const itemCount = await MenuItem.countDocuments({
    _id: { $in: uniqueItemIds },
    restaurantId,
  });
  if (itemCount !== uniqueItemIds.length) {
    throw new GraphQLError("Một hoặc nhiều món không thuộc nhà hàng đã chọn");
  }
};

const loadPromotionForOutput = async (id) =>
  serializePromotion(await Promotion.findById(id).lean());

export const PromotionMutation = {
  async createPromotion(_, { input }, ctx) {
    const payload = sanitizeInput(input);
    validatePromotionPayload(payload);
    await requireRestaurantPermission(
      ctx,
      payload.restaurantId,
      PERMISSIONS.PROMOTION_WRITE,
    );
    await validateReferenceOwnership(payload);
    const created = await Promotion.create(payload);
    return (await loadPromotionForOutput(created._id)) || serializePromotion(created);
  },

  async updatePromotion(_, { id, input }, ctx) {
    if (!mongoose.isValidObjectId(id)) {
      throw new GraphQLError("promotion id không hợp lệ");
    }

    const existing = await Promotion.findById(id).lean();
    if (!existing) throw new GraphQLError("Không tìm thấy khuyến mãi");
    if (!existing.restaurantId || !mongoose.isValidObjectId(existing.restaurantId)) {
      throw new GraphQLError("Nhà hàng của khuyến mãi không hợp lệ");
    }

    await requireRestaurantPermission(
      ctx,
      existing.restaurantId,
      PERMISSIONS.PROMOTION_WRITE,
    );

    if (
      input?.restaurantId &&
      toObjectIdString(input.restaurantId) !== toObjectIdString(existing.restaurantId)
    ) {
      throw new GraphQLError(
        "Không thể chuyển khuyến mãi sang nhà hàng khác. Hãy tạo bản sao tại nhà hàng cần dùng.",
      );
    }

    const payload = sanitizeInput({
      ...input,
      restaurantId: existing.restaurantId,
    });
    validatePromotionPayload(payload);
    await validateReferenceOwnership(payload);
    const updated = await Promotion.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
    if (!updated) throw new GraphQLError("Không tìm thấy khuyến mãi");
    return (await loadPromotionForOutput(updated._id)) || serializePromotion(updated);
  },

  async deletePromotion(_, { id }, ctx) {
    if (!mongoose.isValidObjectId(id)) {
      throw new GraphQLError("promotion id không hợp lệ");
    }

    const existing = await Promotion.findById(id).lean();
    if (!existing) return false;
    await requireRestaurantPermission(
      ctx,
      existing.restaurantId,
      PERMISSIONS.PROMOTION_WRITE,
    );

    const result = await Promotion.deleteOne({ _id: id });
    return result.deletedCount > 0;
  },

  async togglePromotion(_, { id, isActive }, ctx) {
    if (!mongoose.isValidObjectId(id)) {
      throw new GraphQLError("promotion id không hợp lệ");
    }

    const existing = await Promotion.findById(id).lean();
    if (!existing) throw new GraphQLError("Không tìm thấy khuyến mãi");
    await requireRestaurantPermission(
      ctx,
      existing.restaurantId,
      PERMISSIONS.PROMOTION_WRITE,
    );

    const updated = await Promotion.findByIdAndUpdate(
      id,
      { isActive: Boolean(isActive) },
      { new: true, runValidators: true },
    );
    if (!updated) throw new GraphQLError("Không tìm thấy khuyến mãi");
    return (await loadPromotionForOutput(updated._id)) || serializePromotion(updated);
  },
};
