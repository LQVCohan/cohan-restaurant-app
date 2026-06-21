import mongoose from "mongoose";
import { Coupon } from "../../models/index.js";
import { calculateDiscountBreakdown } from "./discountCalculation.service.js";
import { hydrateCheckoutOrderItems } from "./orderItemHydration.service.js";
import {
  loadCustomerRankContext,
  resolveCustomerRankAliasesForRestaurant,
} from "./customerRankSetting.service.js";

const MAX_COUPON_CODES = 50;

const REASON_MESSAGES = {
  COUPON_NOT_FOUND: "Không tìm thấy ưu đãi phù hợp cho nhà hàng này.",
  COUPON_NOT_ACTIVE: "Ưu đãi hiện chưa khả dụng.",
  MIN_ORDER_NOT_MET: "Đơn hàng chưa đạt giá trị tối thiểu của ưu đãi.",
  ORDER_TYPE_REQUIRED: "Vui lòng chọn hình thức nhận hàng để xác minh ưu đãi.",
  ORDER_TYPE_NOT_ELIGIBLE: "Ưu đãi không áp dụng cho hình thức nhận hàng này.",
  PAYMENT_METHOD_REQUIRED: "Vui lòng chọn phương thức thanh toán để xác minh ưu đãi.",
  PAYMENT_METHOD_NOT_ELIGIBLE: "Ưu đãi không áp dụng cho phương thức thanh toán này.",
  CUSTOMER_LOGIN_REQUIRED: "Vui lòng đăng nhập để sử dụng ưu đãi này.",
  CUSTOMER_RANK_REQUIRED: "Ưu đãi này yêu cầu hạng khách hàng phù hợp.",
  CUSTOMER_RANK_NOT_ELIGIBLE: "Ưu đãi này chỉ dành cho hạng khách hàng phù hợp.",
  PER_USER_LIMIT_REACHED: "Bạn đã sử dụng hết lượt của ưu đãi này.",
  FIRST_ORDER_ONLY: "Ưu đãi chỉ áp dụng cho đơn hàng đầu tiên.",
  NO_ELIGIBLE_CATEGORY_ITEMS: "Không có món thuộc danh mục áp dụng.",
  USAGE_LIMIT_REACHED: "Ưu đãi đã hết lượt sử dụng.",
  INVALID_ITEMS: "Không thể xác minh món trong giỏ hàng.",
  UNKNOWN: "Không thể xác minh ưu đãi lúc này.",
};

export function normalizeCheckoutCouponCodes(couponCodes = []) {
  if (!Array.isArray(couponCodes)) return [];
  return [
    ...new Set(
      couponCodes
        .map((code) => String(code || "").trim().toUpperCase())
        .filter(Boolean),
    ),
  ].slice(0, MAX_COUPON_CODES);
}

const ELIGIBILITY_REASON_CODES = new Set(Object.keys(REASON_MESSAGES));

function legacyReasonCodeFromMessage(error) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("not found") || message.includes("not active")) return "COUPON_NOT_ACTIVE";
  if (message.includes("minimum order value")) return "MIN_ORDER_NOT_MET";
  if (message.includes("usage limit reached")) return "USAGE_LIMIT_REACHED";
  if (message.includes("order type is required")) return "ORDER_TYPE_REQUIRED";
  if (message.includes("order type is not eligible")) return "ORDER_TYPE_NOT_ELIGIBLE";
  if (message.includes("payment method is required")) return "PAYMENT_METHOD_REQUIRED";
  if (message.includes("payment method is not eligible")) return "PAYMENT_METHOD_NOT_ELIGIBLE";
  if (message.includes("authenticated customer is required")) return "CUSTOMER_LOGIN_REQUIRED";
  if (message.includes("customer rank is required")) return "CUSTOMER_RANK_REQUIRED";
  if (message.includes("customer rank is not eligible")) return "CUSTOMER_RANK_NOT_ELIGIBLE";
  if (message.includes("per-user usage limit reached")) return "PER_USER_LIMIT_REACHED";
  if (message.includes("first order")) return "FIRST_ORDER_ONLY";
  if (message.includes("no eligible items for category constraints")) return "NO_ELIGIBLE_CATEGORY_ITEMS";
  return "UNKNOWN";
}

function reasonCodeFromError(error) {
  const structuredCode = error?.code || error?.extensions?.code;
  if (ELIGIBILITY_REASON_CODES.has(structuredCode)) return structuredCode;
  const legacyCode = legacyReasonCodeFromMessage(error);
  return ELIGIBILITY_REASON_CODES.has(legacyCode) ? legacyCode : "UNKNOWN";
}

function buildResult({ couponCode, eligible, reasonCode, subtotal = 0, eligibleSubtotal = 0, estimatedDiscount = 0 }) {
  return {
    couponCode,
    eligible: Boolean(eligible),
    reasonCode: reasonCode || null,
    reason: reasonCode ? REASON_MESSAGES[reasonCode] || REASON_MESSAGES.UNKNOWN : null,
    subtotal: Math.max(0, Math.round(Number(subtotal || 0))),
    eligibleSubtotal: Math.max(0, Math.round(Number(eligibleSubtotal || 0))),
    estimatedDiscount: Math.max(0, Math.round(Number(estimatedDiscount || 0))),
  };
}


export async function evaluateCheckoutCouponEligibilities({
  userId,
  restaurantId,
  couponCodes,
  items,
  orderType,
  paymentMethod,
  session,
}) {
  const rid = mongoose.isValidObjectId(restaurantId)
    ? new mongoose.Types.ObjectId(restaurantId)
    : null;
  if (!rid) throw new Error("Invalid restaurantId");

  const codes = normalizeCheckoutCouponCodes(couponCodes);
  let hydratedItems = [];
  let subtotal = 0;
  try {
    hydratedItems = await hydrateCheckoutOrderItems({ restaurantId: rid, items, session });
    subtotal = hydratedItems.reduce((sum, item) => sum + Number(item.lineSubtotal || 0), 0);
  } catch (error) {
    return codes.map((couponCode) => buildResult({
      couponCode,
      eligible: false,
      reasonCode: "INVALID_ITEMS",
    }));
  }

  const query = Coupon.find({ restaurantId: rid, code: { $in: codes } });
  const coupons = await (session ? query.session(session) : query).lean({ virtuals: true });
  const couponByCode = new Map((coupons || []).map((coupon) => [String(coupon.code || "").toUpperCase(), coupon]));
  const userContext = await loadCustomerRankContext(userId, session);
  const customerRanks = await resolveCustomerRankAliasesForRestaurant({
    userContext,
    restaurantId: rid,
    session,
  });

  const results = [];
  for (const couponCode of codes) {
    const coupon = couponByCode.get(couponCode);
    if (!coupon) {
      results.push(buildResult({ couponCode, eligible: false, reasonCode: "COUPON_NOT_FOUND", subtotal }));
      continue;
    }
    if (coupon.isActive === false) {
      results.push(buildResult({ couponCode, eligible: false, reasonCode: "COUPON_NOT_ACTIVE", subtotal }));
      continue;
    }

    try {
      const totals = await calculateDiscountBreakdown({
        restaurantId: rid,
        items: hydratedItems,
        pricing: { voucherCode: couponCode, taxRate: 0, serviceRate: 0, shippingFee: 0 },
        promotionIds: [],
        userId,
        orderType,
        paymentMethod,
        customerRanks,
        session,
      });
      const eligibleSubtotal = totals.couponEligibleSubtotal ?? totals.subtotal ?? subtotal;
      results.push(buildResult({
        couponCode,
        eligible: true,
        subtotal: totals.subtotal ?? subtotal,
        eligibleSubtotal,
        estimatedDiscount: totals.voucherDiscount || totals.couponDiscount || 0,
      }));
    } catch (error) {
      const reasonCode = reasonCodeFromError(error);
      results.push(buildResult({ couponCode, eligible: false, reasonCode, subtotal, eligibleSubtotal: subtotal }));
    }
  }

  return results;
}
