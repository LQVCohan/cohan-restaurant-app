import { mapCartItemToOrderItemInput } from "./discountPreviewPayload";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const resolveCheckoutGroupShippingFee = ({
  orderType,
  shippingFee,
  groupCount,
}) => {
  const normalizedFee = Math.max(0, toNumber(shippingFee));
  const normalizedCount = Math.max(1, Math.floor(toNumber(groupCount, 1)));
  return orderType === "delivery" && normalizedCount > 1
    ? Math.round(normalizedFee / normalizedCount)
    : normalizedFee;
};

export const buildCustomerPromotionPreviewInput = ({
  group,
  orderType,
  paymentMethod,
  couponCode,
  shippingFee = 0,
  groupCount = 1,
}) => ({
  restaurantId: group.restaurantId,
  orderType,
  paymentMethod: paymentMethod || null,
  items: (group.items || []).map((item) =>
    mapCartItemToOrderItemInput(item, { includeCartHoldRef: true }),
  ),
  pricing: {
    taxRate: 0.1,
    serviceRate: 0,
    shippingFee: resolveCheckoutGroupShippingFee({
      orderType,
      shippingFee,
      groupCount,
    }),
    voucherCode: couponCode || null,
  },
  promotionIds: [],
});

export const aggregateCustomerPromotionBreakdowns = (
  breakdowns = [],
  checkoutShippingFee = 0,
) => {
  const aggregate = breakdowns.reduce(
    (total, breakdown) => ({
      subtotal: total.subtotal + toNumber(breakdown?.subtotal),
      promotionDiscount:
        total.promotionDiscount + toNumber(breakdown?.promotionDiscount),
      couponDiscount:
        total.couponDiscount +
        toNumber(
          breakdown?.couponDiscount ?? breakdown?.voucherDiscount,
        ),
      service: total.service + toNumber(breakdown?.service),
      tax: total.tax + toNumber(breakdown?.tax),
      shippingFee:
        total.shippingFee + toNumber(breakdown?.shippingFee),
      total:
        total.total +
        toNumber(breakdown?.grandTotal ?? breakdown?.finalTotal),
      appliedPromotions: [
        ...total.appliedPromotions,
        ...(breakdown?.appliedPromotions || []),
      ],
    }),
    {
      subtotal: 0,
      promotionDiscount: 0,
      couponDiscount: 0,
      service: 0,
      tax: 0,
      shippingFee: 0,
      total: 0,
      appliedPromotions: [],
    },
  );

  const previewAlreadyIncludesShipping = aggregate.shippingFee > 0;
  const groupCount = Math.max(1, breakdowns.length);
  const fallbackGroupShipping = resolveCheckoutGroupShippingFee({
    orderType: "delivery",
    shippingFee: checkoutShippingFee,
    groupCount,
  });
  const fallbackShipping = previewAlreadyIncludesShipping
    ? 0
    : fallbackGroupShipping * groupCount;

  return {
    ...aggregate,
    shippingFee: aggregate.shippingFee + fallbackShipping,
    total: Math.max(0, aggregate.total + fallbackShipping),
    appliedPromotions: [...new Set(aggregate.appliedPromotions.map(String))],
  };
};
