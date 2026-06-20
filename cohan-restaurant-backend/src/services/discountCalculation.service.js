import mongoose from "mongoose";
import {
  Coupon,
  Category,
  CouponRedemption,
  Invoice,
  Order,
  Promotion,
} from "../../models/index.js";

const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const roundVnd = (v) => Math.max(0, Math.round(toNum(v, 0)));
function normalizeScope(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizePromotionType(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function isBogoPromotion(promotion) {
  return normalizePromotionType(promotion?.promotionType) === "BOGO";
}

function isFreeshipPromotion(promotion) {
  return normalizePromotionType(promotion?.promotionType) === "FREESHIP";
}

function isComboPromotion(promotion) {
  return normalizePromotionType(promotion?.promotionType) === "COMBO";
}

function isDirectDiscountPromotion(promotion) {
  const promotionType = normalizePromotionType(promotion?.promotionType);
  const discountType = String(promotion?.discountType || "")
    .trim()
    .toUpperCase();

  return (
    ["PERCENTAGE", "FIXED", ""].includes(promotionType) &&
    ["PERCENT", "AMOUNT"].includes(discountType)
  );
}

function promotionMatchesItem(promotion, item) {
  const scope = normalizeScope(promotion?.scope);

  if (scope === "ITEM") {
    return itemMatchesMenuItemId(item, promotion?.itemId);
  }

  if (scope === "CATEGORY") {
    const promotionCategoryId = promotion?.categoryId
      ? String(promotion.categoryId)
      : "";
    const candidateCategoryIds = [
      item?.categoryId,
      item?.category?.id,
      item?.category?._id,
    ]
      .filter(Boolean)
      .map(String);

    return (
      promotionCategoryId && candidateCategoryIds.includes(promotionCategoryId)
    );
  }

  return false;
}

function getItemCandidateIds(item) {
  return [
    item?.id,
    item?._id,
    item?.dishId,
    item?.menuId,
    item?.menuItemId,
    item?.menuItem?.id,
    item?.menuItem?._id,
  ]
    .filter(Boolean)
    .map(String);
}

function itemMatchesMenuItemId(item, menuItemId) {
  const targetId = menuItemId ? String(menuItemId) : "";
  if (!targetId) return false;
  return getItemCandidateIds(item).includes(targetId);
}

function getLinePromotionRank(promotion) {
  const scope = normalizeScope(promotion?.scope);
  const scopeWeight = scope === "ITEM" ? 1000 : scope === "CATEGORY" ? 500 : 0;

  return scopeWeight + getPriority(promotion);
}

function getBestLinePromotionForItem(promotions, item) {
  return (
    promotions
      .filter((promotion) => promotionMatchesItem(promotion, item))
      .sort((a, b) => getLinePromotionRank(b) - getLinePromotionRank(a))[0] ||
    null
  );
}

function calculateBogoPromotionDiscount({ promotion, items = [] }) {
  if (!promotion || !isBogoPromotion(promotion)) {
    return {
      discount: 0,
      lines: [],
    };
  }

  const buyQuantity = Math.max(1, toNum(promotion.buyQuantity, 1));
  const getQuantity = Math.max(1, toNum(promotion.getQuantity, 1));

  const buyItemId = promotion.itemId ? String(promotion.itemId) : "";
  const giftItemId = promotion.giftItemId ? String(promotion.giftItemId) : "";

  if (!buyItemId || !giftItemId) {
    return {
      discount: 0,
      lines: [],
    };
  }

  let purchasedQuantity = 0;
  const giftLines = [];

  for (const item of items || []) {
    const status = String(item?.status || "");
    if (status === "cancelled" || status === "returned") continue;

    const quantity = getLineQuantity(item);
    if (quantity <= 0) continue;

    if (itemMatchesMenuItemId(item, buyItemId)) {
      purchasedQuantity += quantity;
    }

    if (itemMatchesMenuItemId(item, giftItemId)) {
      giftLines.push(item);
    }
  }

  const freeQuantityLimit =
    Math.floor(purchasedQuantity / buyQuantity) * getQuantity;
  if (freeQuantityLimit <= 0 || !giftLines.length) {
    return {
      discount: 0,
      lines: [],
    };
  }

  let remainingFreeQuantity = freeQuantityLimit;
  let totalDiscount = 0;
  const lines = [];

  for (const giftLine of giftLines) {
    if (remainingFreeQuantity <= 0) break;

    const lineQuantity = getLineQuantity(giftLine);
    const unitPrice = getUnitPriceFromLine(giftLine);
    if (lineQuantity <= 0 || unitPrice <= 0) continue;

    const freeQuantity = Math.min(lineQuantity, remainingFreeQuantity);
    const lineDiscount = roundVnd(unitPrice * freeQuantity);

    if (lineDiscount <= 0) continue;

    remainingFreeQuantity -= freeQuantity;
    totalDiscount += lineDiscount;

    lines.push({
      lineId: giftLine?._id ? String(giftLine._id) : giftLine?.lineId || "",
      dishId: giftLine?.dishId || null,
      menuId: giftLine?.menuId || null,
      categoryId: giftLine?.categoryId || null,
      name: giftLine?.name || "",
      quantity: lineQuantity,
      lineSubtotal: getLineSubtotal(giftLine),
      promotionId: String(promotion._id),
      promotionName: promotion.name || promotion.code || "Mua tặng",
      promotionScope: "ITEM",
      promotionType: "BOGO",
      buyQuantity,
      getQuantity,
      freeQuantity,
      discountType: "BOGO",
      discountValue: 0,
      discount: lineDiscount,
    });
  }

  return {
    discount: roundVnd(totalDiscount),
    lines,
  };
}


function calculateComboPromotionDiscount({ promotion, items = [] }) {
  if (!promotion || !isComboPromotion(promotion)) {
    return { discount: 0, lines: [] };
  }

  const comboItems = Array.isArray(promotion.comboItems)
    ? promotion.comboItems
        .map((comboItem) => ({
          itemId: comboItem?.itemId ? String(comboItem.itemId) : "",
          quantity: Math.max(1, Math.floor(toNum(comboItem?.quantity, 0))),
        }))
        .filter((comboItem) => comboItem.itemId && comboItem.quantity >= 1)
    : [];

  if (comboItems.length < 2) {
    return { discount: 0, lines: [] };
  }

  const orderItemsById = new Map();

  for (const item of items || []) {
    const status = String(item?.status || "");
    if (status === "cancelled" || status === "returned") continue;

    const quantity = getLineQuantity(item);
    const unitPrice = getUnitPriceFromLine(item);
    if (quantity <= 0 || unitPrice <= 0) continue;

    for (const itemId of new Set(getItemCandidateIds(item))) {
      const current = orderItemsById.get(itemId) || {
        quantity: 0,
        weightedSubtotal: 0,
      };
      current.quantity += quantity;
      current.weightedSubtotal += unitPrice * quantity;
      orderItemsById.set(itemId, current);
    }
  }

  let comboCount = Infinity;
  const resolvedComboItems = [];

  for (const comboItem of comboItems) {
    const orderItem = orderItemsById.get(comboItem.itemId);
    const orderQuantity = orderItem?.quantity || 0;
    const possibleCount = Math.floor(orderQuantity / comboItem.quantity);
    comboCount = Math.min(comboCount, possibleCount);

    resolvedComboItems.push({
      itemId: comboItem.itemId,
      quantity: comboItem.quantity,
      orderQuantity,
      unitPrice: orderQuantity > 0 ? orderItem.weightedSubtotal / orderQuantity : 0,
    });
  }

  if (!Number.isFinite(comboCount) || comboCount <= 0) {
    return { discount: 0, lines: [] };
  }

  const comboBase = roundVnd(
    resolvedComboItems.reduce(
      (sum, comboItem) => sum + comboItem.quantity * comboItem.unitPrice,
      0,
    ) * comboCount,
  );

  const discountType = String(promotion.discountType || "").toUpperCase();
  const discount = calcDiscountAmount({
    discountType,
    discountValue:
      discountType === "AMOUNT"
        ? toNum(promotion.discountValue) * comboCount
        : promotion.discountValue,
    subtotal: comboBase,
    maxDiscount: promotion.maxDiscount,
  });

  if (discount <= 0) {
    return { discount: 0, lines: [] };
  }

  return {
    discount,
    lines: [
      {
        promotionId: String(promotion._id),
        promotionName: promotion.name || promotion.code || "Combo",
        promotionScope: "ORDER",
        promotionType: "COMBO",
        comboCount,
        comboItems: resolvedComboItems.map((comboItem) => ({
          itemId: comboItem.itemId,
          quantity: comboItem.quantity,
          orderQuantity: comboItem.orderQuantity,
          unitPrice: roundVnd(comboItem.unitPrice),
        })),
        comboBase,
        discountType: promotion.discountType,
        discountValue: toNum(promotion.discountValue),
        discount,
      },
    ],
  };
}

function inWindow(doc, now) {
  return (
    (!doc.publishAt || doc.publishAt <= now) &&
    (!doc.startAt || doc.startAt <= now) &&
    (!doc.endAt || doc.endAt >= now)
  );
}

function calcDiscountAmount({
  discountType,
  discountValue,
  subtotal,
  maxDiscount,
}) {
  const base = Math.max(0, toNum(subtotal));
  if (base <= 0) return 0;
  let amount = 0;
  if (String(discountType).toUpperCase() === "PERCENT") {
    amount = (base * toNum(discountValue)) / 100;
    if (toNum(maxDiscount) > 0) amount = Math.min(amount, toNum(maxDiscount));
  } else {
    amount = toNum(discountValue);
  }
  return Math.min(base, roundVnd(amount));
}

function getLineQuantity(item) {
  const quantity = toNum(item?.quantity, 0);
  return quantity > 0 ? quantity : 0;
}

function getLineSubtotal(item) {
  return roundVnd(item?.lineSubtotal);
}


function normalizeCategoryConstraintIds(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return [...new Set(source.map((item) => String(item || "").trim()).filter(Boolean))];
}

function normalizeCategoryConstraintNames(value) {
  return normalizeConstraintArray(value);
}

function getItemCategoryCandidateIds(item = {}) {
  return [
    item.categoryId,
    item.category?.id,
    item.category?._id,
    item.menuItem?.categoryId,
    item.menuItem?.category?.id,
    item.menuItem?.category?._id,
    item.categorySnapshot?.id,
    item.categorySnapshot?._id,
    item.snapshot?.categoryId,
    item.snapshot?.category?.id,
    item.snapshot?.category?._id,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function normalizeCategoryName(value) {
  return String(value || "").trim().toLowerCase();
}

function getItemCategoryCandidateNames(item = {}, categoryNameById = new Map()) {
  const names = [];
  const categoryValue = item.category;
  if (typeof categoryValue === "string") names.push(categoryValue);
  else if (categoryValue?.name) names.push(categoryValue.name);

  names.push(
    item.categoryName,
    item.menuItem?.categoryName,
    item.menuItem?.category?.name,
    item.categorySnapshot?.name,
    item.snapshot?.categoryName,
    item.snapshot?.category?.name,
  );

  for (const id of getItemCategoryCandidateIds(item)) {
    if (categoryNameById.has(id)) names.push(categoryNameById.get(id));
  }

  return [...new Set(names.map(normalizeCategoryName).filter(Boolean))];
}

async function resolveCategoryNamesByIds({ categoryIds = [], restaurantId, session }) {
  const ids = [...new Set(categoryIds.filter((id) => mongoose.isValidObjectId(id)))];
  if (!ids.length) return new Map();

  const restaurantObjectId = mongoose.isValidObjectId(restaurantId)
    ? new mongoose.Types.ObjectId(restaurantId)
    : restaurantId;

  const docs = await Category.find({
    restaurantId: restaurantObjectId,
    _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
  }).session(session);

  return new Map(
    (docs || []).map((doc) => [String(doc._id || doc.id), normalizeCategoryName(doc.name)]),
  );
}

function itemMatchesCouponCategory({ item, categoryIds, categoryNames, categoryNameById }) {
  const itemCategoryIds = getItemCategoryCandidateIds(item);
  const itemCategoryNames = getItemCategoryCandidateNames(item, categoryNameById);

  return (
    itemCategoryIds.some((id) => categoryIds.includes(id)) ||
    itemCategoryNames.some((name) => categoryNames.includes(name))
  );
}

async function calculateCouponEligibleSubtotal({ coupon, items = [], restaurantId, session }) {
  const constraints = coupon?.constraints || {};
  const categoryIds = normalizeCategoryConstraintIds(constraints.categoryIds);
  const categoryNames = normalizeCategoryConstraintNames(constraints.categories);
  const hasConstraints = categoryIds.length > 0 || categoryNames.length > 0;

  if (!hasConstraints) {
    return { hasConstraints: false, eligibleSubtotal: 0 };
  }

  const itemCategoryIds = items.flatMap((item) => getItemCategoryCandidateIds(item));
  const categoryNameById = await resolveCategoryNamesByIds({
    categoryIds: itemCategoryIds,
    restaurantId,
    session,
  });

  const eligibleSubtotal = roundVnd(
    items.reduce((sum, item) => {
      const status = String(item?.status || "");
      if (status === "cancelled" || status === "returned") return sum;
      if (!itemMatchesCouponCategory({ item, categoryIds, categoryNames, categoryNameById })) return sum;
      return sum + getLineSubtotal(item);
    }, 0),
  );

  return { hasConstraints: true, eligibleSubtotal };
}

function getUnitPriceFromLine(item) {
  const quantity = getLineQuantity(item);
  const lineSubtotal = getLineSubtotal(item);

  if (quantity <= 0 || lineSubtotal <= 0) return 0;
  return lineSubtotal / quantity;
}

function getPriority(doc) {
  return toNum(doc?.priority ?? doc?.constraints?.priority ?? doc?.level, 0);
}

function isExclusive(doc) {
  return Boolean(doc?.exclusive ?? doc?.constraints?.exclusive);
}

function normalizeConstraintToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function normalizeConstraintArray(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return [...new Set(source.map(normalizeConstraintToken).filter(Boolean))];
}

function matchesConstraintValue(allowedValues, actualValue) {
  if (!allowedValues.length) return true;
  const normalizedActual = normalizeConstraintToken(actualValue);
  return Boolean(normalizedActual) && allowedValues.includes(normalizedActual);
}

export function matchesOrderType(constraints = {}, orderType) {
  return matchesConstraintValue(
    normalizeConstraintArray(constraints.orderTypes),
    orderType,
  );
}

export function matchesPaymentMethod(constraints = {}, paymentMethod) {
  return matchesConstraintValue(
    normalizeConstraintArray(constraints.paymentMethods),
    paymentMethod,
  );
}

export function matchesCustomerRank(constraints = {}, customerRanks = []) {
  const allowed = normalizeConstraintArray(constraints.customerRanks);
  if (!allowed.length) return true;

  const actual = normalizeConstraintArray(
    Array.isArray(customerRanks) ? customerRanks : [customerRanks],
  );

  return actual.some((rank) => allowed.includes(rank));
}

export async function checkFirstOrderOnly({
  coupon,
  userId,
  restaurantId,
  session,
}) {
  const uid = mongoose.isValidObjectId(userId)
    ? new mongoose.Types.ObjectId(userId)
    : null;

  if (!uid) {
    throw new Error(
      "Invalid coupon: first-order eligibility requires an authenticated customer",
    );
  }

  // Completed paid Order history is the most reliable customer-scoped signal
  // in POS payment flows because Order.userId stores the customer while an
  // Invoice may store the payment actor. Invoice history is still checked for
  // legacy/online flows. If neither exists, fall back to coupon-specific
  // CouponRedemption history so sparse legacy data still prevents repeated use.
  const paidOrderCount = await Order.countDocuments({
    restaurantId,
    userId: uid,
    $or: [
      { "payment.status": { $in: ["paid", "partially_refunded", "refunded"] } },
      { orderPaymentStatus: "paid" },
      { currentStatus: "completed", "payment.status": "paid" },
    ],
  }).session(session);

  if (paidOrderCount > 0) {
    throw new Error(
      "Invalid coupon: only valid for the customer's first order",
    );
  }

  const paidInvoiceCount = await Invoice.countDocuments({
    restaurantId,
    userId: uid,
    status: { $in: ["PAID", "PARTIAL"] },
  }).session(session);

  if (paidInvoiceCount > 0) {
    throw new Error(
      "Invalid coupon: only valid for the customer's first order",
    );
  }

  const couponRedemptionCount = await CouponRedemption.countDocuments({
    couponId: coupon._id,
    userId: uid,
    restaurantId,
  }).session(session);

  if (couponRedemptionCount > 0) {
    throw new Error(
      "Invalid coupon: only valid for the customer's first order",
    );
  }
}

export async function assertCouponEligibility({
  coupon,
  subtotal,
  userId,
  restaurantId,
  orderType,
  paymentMethod,
  customerRank,
  customerRanks,
  now = new Date(),
  session,
}) {
  if (!coupon || !inWindow(coupon, now)) {
    throw new Error("Invalid coupon: not found or not active");
  }

  if (subtotal < Math.max(0, toNum(coupon.minOrderValue))) {
    throw new Error(
      `Invalid coupon: minimum order value is ${Math.max(0, toNum(coupon.minOrderValue))}`,
    );
  }

  const maxUsage = toNum(coupon.maxUsage);
  if (maxUsage > 0 && toNum(coupon.used) >= maxUsage) {
    throw new Error("Invalid coupon: usage limit reached");
  }

  const constraints = coupon.constraints || {};
  const orderTypes = normalizeConstraintArray(constraints.orderTypes);
  if (orderTypes.length && !matchesOrderType(constraints, orderType)) {
    throw new Error(
      orderType
        ? "Invalid coupon: order type is not eligible"
        : "Invalid coupon: order type is required for this coupon",
    );
  }

  const paymentMethods = normalizeConstraintArray(constraints.paymentMethods);
  if (
    paymentMethods.length &&
    !matchesPaymentMethod(constraints, paymentMethod)
  ) {
    throw new Error(
      paymentMethod
        ? "Invalid coupon: payment method is not eligible"
        : "Invalid coupon: payment method is required for this coupon",
    );
  }

  const allowedCustomerRanks = normalizeConstraintArray(constraints.customerRanks);
  const actualCustomerRanks = normalizeConstraintArray(
    Array.isArray(customerRanks)
      ? customerRanks
      : [customerRanks ?? customerRank],
  );
  if (allowedCustomerRanks.length && !matchesCustomerRank(constraints, actualCustomerRanks)) {
    throw new Error(
      actualCustomerRanks.length
        ? "Invalid coupon: customer rank is not eligible"
        : "Invalid coupon: customer rank is required for this coupon",
    );
  }

  const uid = mongoose.isValidObjectId(userId)
    ? new mongoose.Types.ObjectId(userId)
    : null;

  const perUserLimit = toNum(constraints.perUserLimit, 0);
  if (perUserLimit > 0) {
    if (!uid) {
      throw new Error(
        "Invalid coupon: authenticated customer is required for per-user limit",
      );
    }

    const userRedemptionCount = await CouponRedemption.countDocuments({
      couponId: coupon._id,
      userId: uid,
    }).session(session);
    if (userRedemptionCount >= perUserLimit) {
      throw new Error("Invalid coupon: per-user usage limit reached");
    }
  }

  if (constraints.firstOrderOnly === true) {
    await checkFirstOrderOnly({ coupon, userId, restaurantId, session });
  }
}

function canStack({ coupon, promotionSelected }) {
  if (!promotionSelected) return true;

  // Cả promotion và coupon đều phải cho phép dùng chồng.
  if (!promotionSelected.stacking) return false;

  const constraints = coupon?.constraints || {};

  if (typeof constraints.combinableWithPromotions === "boolean") {
    return constraints.combinableWithPromotions;
  }

  if (typeof constraints.stackable === "boolean") {
    return constraints.stackable;
  }

  return false;
}

export async function calculateDiscountBreakdown({
  restaurantId,
  items = [],
  pricing = {},
  now = new Date(),
  session,
  promotionIds = [],
  userId,
  orderType,
  paymentMethod,
  customerRank,
  customerRanks,
}) {
  const subtotal = roundVnd(
    items.reduce(
      (s, it) =>
        s +
        (String(it?.status || "") === "cancelled" ||
        String(it?.status || "") === "returned"
          ? 0
          : toNum(it?.lineSubtotal)),
      0,
    ),
  );
  const serviceRate = Math.max(0, toNum(pricing.serviceRate));
  const taxRate = Math.max(0, toNum(pricing.taxRate));
  const shippingFee = Math.max(0, roundVnd(pricing.shippingFee));

  const rid = mongoose.isValidObjectId(restaurantId)
    ? new mongoose.Types.ObjectId(restaurantId)
    : restaurantId;

  const activeLinePromotions = await Promotion.find({
    restaurantId: rid,
    isActive: true,
    scope: { $in: ["ITEM", "CATEGORY"] },
  }).session(session);

  const eligibleLinePromotions = activeLinePromotions.filter(
    (promotion) =>
      promotion &&
      inWindow(promotion, now) &&
      (isDirectDiscountPromotion(promotion) || isBogoPromotion(promotion)) &&
      subtotal >= Math.max(0, toNum(promotion.minOrderValue)),
  );
  const promotionLines = [];
  const appliedPromotionIds = new Set();
  const appliedPromotionDocsById = new Map();
  let linePromotionDiscount = 0;

  for (const item of items || []) {
    const status = String(item?.status || "");
    if (status === "cancelled" || status === "returned") continue;

    const lineSubtotal = roundVnd(item?.lineSubtotal);
    if (lineSubtotal <= 0) continue;

    const promotion = getBestLinePromotionForItem(
      eligibleLinePromotions.filter(isDirectDiscountPromotion),
      item,
    );
    if (!promotion) continue;

    const discount = calcDiscountAmount({
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      subtotal: lineSubtotal,
      maxDiscount: promotion.maxDiscount,
    });

    if (discount <= 0) continue;

    linePromotionDiscount += discount;
    appliedPromotionIds.add(String(promotion._id));
    appliedPromotionDocsById.set(String(promotion._id), promotion);
    promotionLines.push({
      lineId: item?._id ? String(item._id) : item?.lineId || "",
      dishId: item?.dishId || null,
      menuId: item?.menuId || null,
      categoryId: item?.categoryId || null,
      name: item?.name || "",
      quantity: toNum(item?.quantity, 0),
      lineSubtotal,
      promotionId: String(promotion._id),
      promotionName: promotion.name || promotion.code || "Khuyến mãi",
      promotionScope: normalizeScope(promotion.scope),
      discountType: promotion.discountType,
      discountValue: toNum(promotion.discountValue),
      discount,
    });
  }
  const eligibleBogoPromotions = eligibleLinePromotions.filter(isBogoPromotion);

  for (const promotion of eligibleBogoPromotions) {
    const { discount, lines } = calculateBogoPromotionDiscount({
      promotion,
      items,
    });

    if (discount <= 0) continue;

    linePromotionDiscount += discount;
    appliedPromotionIds.add(String(promotion._id));
    appliedPromotionDocsById.set(String(promotion._id), promotion);
    promotionLines.push(...lines);
  }
  let selectedPromotion = null;
  if (promotionIds?.length) {
    const promotions = await Promise.all(
      promotionIds.map((id) =>
        Promotion.findOne({
          _id: id,
          restaurantId: rid,
          isActive: true,
        }).session(session),
      ),
    );
    selectedPromotion =
      promotions
        .filter(
          (p) =>
            p &&
            normalizeScope(p.scope) === "ORDER" &&
            inWindow(p, now) &&
            (isDirectDiscountPromotion(p) || isFreeshipPromotion(p) || isComboPromotion(p)) &&
            subtotal >= Math.max(0, toNum(p.minOrderValue)),
        )
        .sort((a, b) => getPriority(b) - getPriority(a))[0] || null;
  }
  let orderPromotionDiscount = 0;
  let shippingDiscount = 0;
  if (selectedPromotion) {
    if (isFreeshipPromotion(selectedPromotion)) {
      shippingDiscount = shippingFee;
      if (toNum(selectedPromotion.maxDiscount) > 0) {
        shippingDiscount = Math.min(
          shippingFee,
          toNum(selectedPromotion.maxDiscount),
        );
      }
      shippingDiscount = roundVnd(shippingDiscount);
    } else if (isComboPromotion(selectedPromotion)) {
      const { discount, lines } = calculateComboPromotionDiscount({
        promotion: selectedPromotion,
        items,
      });
      orderPromotionDiscount += discount;
      promotionLines.push(...lines);
    } else {
      const orderPromotionBase = Math.max(0, subtotal - linePromotionDiscount);

      orderPromotionDiscount = calcDiscountAmount({
        discountType: selectedPromotion.discountType,
        discountValue: selectedPromotion.discountValue,
        subtotal: orderPromotionBase,
        maxDiscount: selectedPromotion.maxDiscount,
      });
    }

    if (orderPromotionDiscount > 0 || shippingDiscount > 0) {
      appliedPromotionIds.add(String(selectedPromotion._id));
      appliedPromotionDocsById.set(
        String(selectedPromotion._id),
        selectedPromotion,
      );
    }
  }

  let promotionDiscount = linePromotionDiscount + orderPromotionDiscount;
  const resetAppliedPromotions = () => {
    promotionDiscount = 0;
    linePromotionDiscount = 0;
    orderPromotionDiscount = 0;
    shippingDiscount = 0;
    promotionLines.length = 0;
    appliedPromotionIds.clear();
    appliedPromotionDocsById.clear();
  };
  const code = String(pricing?.voucherCode || "")
    .trim()
    .toUpperCase();
  let coupon = null;
  let voucherDiscount = 0;
  if (code) {
    coupon = await Coupon.findOne({
      restaurantId: rid,
      code,
      isActive: true,
    }).session(session);
    await assertCouponEligibility({
      coupon,
      subtotal,
      userId,
      restaurantId: rid,
      orderType,
      paymentMethod,
      customerRank,
      customerRanks,
      now,
      session,
    });

    const appliedPromotionDocs = Array.from(appliedPromotionDocsById.values());
    const hasPromotion = promotionDiscount > 0 || shippingDiscount > 0;
    const couponExclusive = isExclusive(coupon);
    const promotionExclusive = appliedPromotionDocs.some((promotion) =>
      isExclusive(promotion),
    );
    const stackAllowed = appliedPromotionDocs.every((promotion) =>
      canStack({
        coupon,
        promotionSelected: promotion,
      }),
    );

    let shouldApplyVoucher = true;

    if (hasPromotion) {
      if (couponExclusive) {
        // Coupon độc quyền: giữ coupon, bỏ promotion.
        resetAppliedPromotions();
      } else if (promotionExclusive) {
        // Legacy/backward-compatible: nếu promotion có exclusive thì giữ promotion, bỏ coupon.
        shouldApplyVoucher = false;
      } else if (!stackAllowed) {
        // Không được dùng chồng: coupon code do user nhập được ưu tiên,
        // promotion tự động/được chọn sẽ bị bỏ.
        resetAppliedPromotions();
      }
    }

    if (shouldApplyVoucher) {
      const categoryScope = await calculateCouponEligibleSubtotal({
        coupon,
        items,
        restaurantId: rid,
        session,
      });
      const couponEligibleSubtotal = categoryScope.hasConstraints
        ? categoryScope.eligibleSubtotal
        : subtotal;

      if (categoryScope.hasConstraints && couponEligibleSubtotal <= 0) {
        throw new Error("Invalid coupon: no eligible items for category constraints");
      }

      voucherDiscount = calcDiscountAmount({
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        subtotal: couponEligibleSubtotal,
        maxDiscount: coupon.maxDiscount,
      });
      coupon.couponEligibleSubtotal = couponEligibleSubtotal;
      coupon.couponCategoryScoped = categoryScope.hasConstraints;
    } else {
      coupon = null;
      voucherDiscount = 0;
    }
  }

  const service = roundVnd(subtotal * serviceRate);
  const itemAndOrderDiscount = Math.min(
    subtotal + service,
    promotionDiscount + voucherDiscount,
  );
  const totalDiscount = itemAndOrderDiscount + shippingDiscount;
  const beforeTax = Math.max(0, subtotal + service - itemAndOrderDiscount);
  const tax = roundVnd(beforeTax * taxRate);
  const grandTotal = roundVnd(
    beforeTax + tax + shippingFee - shippingDiscount,
  );

  return {
    subtotal,
    eligibleSubtotal: subtotal,
    promotionDiscount,
    voucherDiscount,
    couponDiscount: voucherDiscount,
    shippingDiscount,
    totalDiscount,
    finalTotal: grandTotal,
    appliedPromotions: Array.from(appliedPromotionIds),
    appliedPromotionDetails: Array.from(appliedPromotionDocsById.values()).map((promotion) => ({
      promotionId: String(promotion?._id || ""),
      promotionName: promotion?.name || promotion?.code || "",
      promotionType: String(promotion?.promotionType || ""),
      promotionScope: normalizeScope(promotion?.scope),
      discountType: String(promotion?.discountType || ""),
      discountValue: toNum(promotion?.discountValue),
    })),
    promotionLines,
    appliedCoupons: coupon ? [String(coupon._id)] : [],
    voucherCode: code || undefined,
    couponId: coupon?._id,
    couponEligibleSubtotal: coupon?.couponEligibleSubtotal,
    couponCategoryScoped: Boolean(coupon?.couponCategoryScoped),
    discountReason: coupon ? `coupon:${coupon._id}` : undefined,
    tax,
    service,
    shippingFee,
    taxRate,
    serviceRate,
    grandTotal,
    discount: totalDiscount,
  };
}
