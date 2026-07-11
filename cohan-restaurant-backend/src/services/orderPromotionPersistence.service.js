import { GraphQLError } from "graphql";

const INSTALL_FLAG = Symbol.for("cohan.orderPromotionPersistenceInstalled");

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeIds = (values = []) => [
  ...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  ),
];

const resolveCreateOptions = (args = []) => {
  const candidate = args[1];
  return candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};
};

const hasItems = (doc = {}) =>
  Array.isArray(doc.items) && doc.items.some((item) => toNumber(item?.quantity) > 0);

const hasAuthoritativeBreakdown = (doc = {}) =>
  Array.isArray(doc?.totals?.appliedPromotions) ||
  doc?.totals?.couponId ||
  doc?.clientMeta?.promotionPricing?.calculated === true;

const shouldCalculateDineInPricing = (doc = {}) =>
  String(doc.orderType || "").toLowerCase() === "dine_in" &&
  String(doc.orderKind || "order_batch").toLowerCase() !== "table_session" &&
  hasItems(doc) &&
  !hasAuthoritativeBreakdown(doc);

const getSession = (options = {}) => options?.session || null;

const buildPromotionMetadata = (breakdown = {}, source = "order_create") => ({
  calculated: true,
  source,
  subtotal: toNumber(breakdown.subtotal),
  promotionDiscount: toNumber(breakdown.promotionDiscount),
  voucherDiscount: toNumber(breakdown.voucherDiscount),
  shippingDiscount: toNumber(breakdown.shippingDiscount),
  totalDiscount: toNumber(breakdown.totalDiscount ?? breakdown.discount),
  grandTotal: toNumber(breakdown.grandTotal ?? breakdown.finalTotal),
  appliedPromotions: normalizeIds(breakdown.appliedPromotions),
  appliedCoupons: normalizeIds(breakdown.appliedCoupons),
  couponId: breakdown.couponId ? String(breakdown.couponId) : null,
  promotionLines: Array.isArray(breakdown.promotionLines)
    ? breakdown.promotionLines
    : [],
});

const captureExistingPricingMetadata = (doc = {}) => {
  const totals = doc.totals || {};
  const existing = doc?.clientMeta?.promotionPricing;
  if (existing?.calculated) return existing;

  const appliedPromotions = normalizeIds(totals.appliedPromotions);
  const appliedCoupons = normalizeIds(totals.appliedCoupons);
  if (!appliedPromotions.length && !appliedCoupons.length && !totals.couponId) {
    return null;
  }

  return buildPromotionMetadata(
    {
      ...totals,
      appliedPromotions,
      appliedCoupons,
    },
    "authoritative_mutation",
  );
};

const applyBreakdownToOrderInput = (doc, breakdown) => {
  const metadata = buildPromotionMetadata(breakdown, "dine_in_auto");
  const firstPromotionId = metadata.appliedPromotions[0] || null;

  doc.totals = {
    ...(doc.totals || {}),
    subtotal: toNumber(breakdown.subtotal),
    discount: toNumber(breakdown.totalDiscount ?? breakdown.discount),
    discountReason: breakdown.discountReason || undefined,
    voucherCode: breakdown.voucherCode || undefined,
    promotionId: firstPromotionId || undefined,
    service: toNumber(breakdown.service),
    serviceRate: toNumber(breakdown.serviceRate),
    tax: toNumber(breakdown.tax),
    taxRate: toNumber(breakdown.taxRate),
    shippingFee: toNumber(breakdown.shippingFee),
    grandTotal: toNumber(breakdown.grandTotal ?? breakdown.finalTotal),
  };
  doc.clientMeta = {
    ...(doc.clientMeta || {}),
    promotionPricing: metadata,
  };

  const expectedLinkedMenuTotal = Number(
    doc?.clientMeta?.expectedLinkedMenuTotal ??
      doc?.clientMeta?.linkedMenuTotal,
  );
  if (
    Number.isFinite(expectedLinkedMenuTotal) &&
    expectedLinkedMenuTotal >= 0 &&
    Math.abs(expectedLinkedMenuTotal - metadata.grandTotal) > 1
  ) {
    throw new GraphQLError(
      "Ưu đãi hoặc giá món đã thay đổi. Vui lòng kiểm tra lại món trước khi hoàn tất đặt bàn.",
      {
        extensions: {
          code: "RESERVATION_ADDON_PRICE_CHANGED",
          expectedTotal: expectedLinkedMenuTotal,
          currentTotal: metadata.grandTotal,
        },
      },
    );
  }

  return metadata;
};

async function calculateDineInBreakdown(doc, session) {
  const { calculateDiscountBreakdown } = await import(
    "./discountCalculation.service.js"
  );
  return calculateDiscountBreakdown({
    restaurantId: doc.restaurantId,
    items: doc.items || [],
    pricing: {
      taxRate: doc?.totals?.taxRate,
      serviceRate: doc?.totals?.serviceRate,
      shippingFee: doc?.totals?.shippingFee,
    },
    orderType: "dine_in",
    userId: doc.userId,
    session,
  });
}

async function incrementAppliedPromotionUsage({ metadata, session }) {
  const promotionIds = normalizeIds(metadata?.appliedPromotions);
  if (!promotionIds.length || metadata?.couponId) return;

  const mongoose = (await import("mongoose")).default;
  const Promotion = mongoose.models.Promotion;
  if (!Promotion) {
    throw new Error("Promotion model is not registered");
  }

  for (const promotionId of promotionIds) {
    const result = await Promotion.updateOne(
      {
        _id: promotionId,
        isActive: true,
        $or: [
          { maxUsage: { $exists: false } },
          { maxUsage: null },
          { maxUsage: { $lte: 0 } },
          {
            $expr: {
              $lt: [{ $ifNull: ["$used", 0] }, "$maxUsage"],
            },
          },
        ],
      },
      { $inc: { used: 1 } },
      session ? { session } : undefined,
    );
    if (Number(result?.modifiedCount || 0) !== 1) {
      throw new GraphQLError(
        "Khuyến mãi vừa hết lượt sử dụng. Vui lòng kiểm tra lại tổng tiền.",
        { extensions: { code: "PROMOTION_USAGE_LIMIT_REACHED" } },
      );
    }
  }
}

export function installOrderPromotionPersistence(Order) {
  if (!Order || Order[INSTALL_FLAG]) return Order;

  const originalCreate = Order.create.bind(Order);
  Object.defineProperty(Order, INSTALL_FLAG, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  Order.create = async function promotionAwareCreate(...args) {
    const source = args[0];
    const inputDocs = Array.isArray(source) ? source : [source];
    const options = resolveCreateOptions(args);
    const session = getSession(options);
    const pricingMetadata = [];

    for (const doc of inputDocs) {
      if (!doc || typeof doc !== "object") {
        pricingMetadata.push(null);
        continue;
      }

      let metadata = captureExistingPricingMetadata(doc);
      if (!metadata && shouldCalculateDineInPricing(doc)) {
        const breakdown = await calculateDineInBreakdown(doc, session);
        metadata = applyBreakdownToOrderInput(doc, breakdown);
      } else if (metadata) {
        doc.clientMeta = {
          ...(doc.clientMeta || {}),
          promotionPricing: metadata,
        };
      }
      pricingMetadata.push(metadata);
    }

    const created = await originalCreate(...args);

    for (const metadata of pricingMetadata) {
      await incrementAppliedPromotionUsage({ metadata, session });
    }

    return created;
  };

  return Order;
}
