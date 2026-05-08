import mongoose from "mongoose";
import { Coupon, Promotion } from "../../models/index.js";

const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const roundVnd = (v) => Math.max(0, Math.round(toNum(v, 0)));

function inWindow(doc, now) {
  return (!doc.publishAt || doc.publishAt <= now) && (!doc.startAt || doc.startAt <= now) && (!doc.endAt || doc.endAt >= now);
}

function calcDiscountAmount({ discountType, discountValue, subtotal, maxDiscount }) {
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

function canStack({ coupon, promotionSelected }) {
  if (!promotionSelected) return true;
  const constraints = coupon?.constraints || {};
  if (typeof constraints.combinableWithPromotions === "boolean") return constraints.combinableWithPromotions;
  if (typeof constraints.stackable === "boolean") return constraints.stackable;
  return Boolean(promotionSelected.stacking);
}

export async function calculateDiscountBreakdown({ restaurantId, items = [], pricing = {}, now = new Date(), session, promotionIds = [] }) {
  const subtotal = roundVnd(items.reduce((s, it) => s + (String(it?.status || "") === "cancelled" || String(it?.status || "") === "returned" ? 0 : toNum(it?.lineSubtotal)), 0));
  const serviceRate = Math.max(0, toNum(pricing.serviceRate));
  const taxRate = Math.max(0, toNum(pricing.taxRate));
  const shippingFee = Math.max(0, roundVnd(pricing.shippingFee));

  const rid = mongoose.isValidObjectId(restaurantId) ? new mongoose.Types.ObjectId(restaurantId) : restaurantId;
  let selectedPromotion = null;
  if (promotionIds?.length) {
    const promotions = await Promise.all(promotionIds.map((id) => Promotion.findOne({ _id: id, restaurantId: rid, isActive: true }).session(session)));
    selectedPromotion = (promotions.filter((p) => p && inWindow(p, now) && subtotal >= Math.max(0, toNum(p.minOrderValue)))
      .sort((a, b) => getPriority(b) - getPriority(a))[0]) || null;
  }

  let promotionDiscount = 0;
  if (selectedPromotion) {
    promotionDiscount = calcDiscountAmount({
      discountType: selectedPromotion.discountType,
      discountValue: selectedPromotion.discountValue,
      subtotal,
      maxDiscount: selectedPromotion.maxDiscount,
    });
  }

  const code = String(pricing?.voucherCode || "").trim().toUpperCase();
  let coupon = null;
  let voucherDiscount = 0;
  if (code) {
    coupon = await Coupon.findOne({ restaurantId: rid, code, isActive: true }).session(session);
    if (!coupon || !inWindow(coupon, now)) throw new Error("Invalid voucher: not found or not active");
    if (subtotal < Math.max(0, toNum(coupon.minOrderValue))) throw new Error(`Invalid voucher: minimum order value is ${Math.max(0, toNum(coupon.minOrderValue))}`);
    const maxUsage = toNum(coupon.maxUsage);
    if (maxUsage > 0 && toNum(coupon.used) >= maxUsage) throw new Error("Invalid voucher: usage limit reached");
    if (isExclusive(selectedPromotion) || isExclusive(coupon) || !canStack({ coupon, promotionSelected: selectedPromotion })) {
      promotionDiscount = 0;
    }
    voucherDiscount = calcDiscountAmount({
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      subtotal,
      maxDiscount: coupon.maxDiscount,
    });
  }

  const service = roundVnd(subtotal * serviceRate);
  const totalDiscount = Math.min(subtotal + service, promotionDiscount + voucherDiscount);
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
    appliedPromotions: selectedPromotion ? [String(selectedPromotion._id)] : [],
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
