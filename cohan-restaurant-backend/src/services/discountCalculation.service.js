import mongoose from "mongoose";
import {
  Coupon,
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
    const promotionItemId = promotion?.itemId ? String(promotion.itemId) : "";
    const candidateItemIds = [
      item?.id,
      item?._id,
      item?.dishId,
      item?.menuItemId,
      item?.menuItem?.id,
      item?.menuItem?._id,
    ]
      .filter(Boolean)
      .map(String);

    return promotionItemId && candidateItemIds.includes(promotionItemId);
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

export function matchesCustomerRank(constraints = {}, customerRank) {
  return matchesConstraintValue(
    normalizeConstraintArray(constraints.customerRanks),
    customerRank,
  );
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

  const customerRanks = normalizeConstraintArray(constraints.customerRanks);
  if (customerRanks.length && !matchesCustomerRank(constraints, customerRank)) {
    throw new Error(
      customerRank
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
      isDirectDiscountPromotion(promotion) &&
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

    const promotion = getBestLinePromotionForItem(eligibleLinePromotions, item);
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
            isDirectDiscountPromotion(p) &&
            subtotal >= Math.max(0, toNum(p.minOrderValue)),
        )
        .sort((a, b) => getPriority(b) - getPriority(a))[0] || null;
  }
  let orderPromotionDiscount = 0;
  if (selectedPromotion) {
    const orderPromotionBase = Math.max(0, subtotal - linePromotionDiscount);

    orderPromotionDiscount = calcDiscountAmount({
      discountType: selectedPromotion.discountType,
      discountValue: selectedPromotion.discountValue,
      subtotal: orderPromotionBase,
      maxDiscount: selectedPromotion.maxDiscount,
    });

    if (orderPromotionDiscount > 0) {
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
      now,
      session,
    });

    const appliedPromotionDocs = Array.from(appliedPromotionDocsById.values());
    const hasPromotion = promotionDiscount > 0;
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
      voucherDiscount = calcDiscountAmount({
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        subtotal,
        maxDiscount: coupon.maxDiscount,
      });
    } else {
      coupon = null;
      voucherDiscount = 0;
    }
  }

  const service = roundVnd(subtotal * serviceRate);
  const totalDiscount = Math.min(
    subtotal + service,
    promotionDiscount + voucherDiscount,
  );
  const beforeTax = Math.max(0, subtotal + service - totalDiscount);
  const tax = roundVnd(beforeTax * taxRate);
  const grandTotal = roundVnd(beforeTax + tax + shippingFee);

  return {
    subtotal,
    eligibleSubtotal: subtotal,
    promotionDiscount,
    voucherDiscount,
    couponDiscount: voucherDiscount,
    shippingDiscount: 0,
    totalDiscount,
    finalTotal: grandTotal,
    appliedPromotions: Array.from(appliedPromotionIds),
    promotionLines,
    appliedCoupons: coupon ? [String(coupon._id)] : [],
    voucherCode: code || undefined,
    couponId: coupon?._id,
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
