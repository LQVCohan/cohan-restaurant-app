import { mapCartItemToOrderItemInput } from "./discountPreviewPayload";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const buildCustomerPromotionPreviewInput = ({
  group,
  orderType,
  paymentMethod,
  couponCode,
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
    shippingFee: 0,
    voucherCode: couponCode || null,
  },
  promotionIds: [],
});

export const aggregateCustomerPromotionBreakdowns = (
  breakdowns = [],
  shippingFee = 0,
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
      total: 0,
      appliedPromotions: [],
    },
  );

  const normalizedShippingFee = Math.max(0, toNumber(shippingFee));
  return {
    ...aggregate,
    shippingFee: normalizedShippingFee,
    total: Math.max(0, aggregate.total + normalizedShippingFee),
    appliedPromotions: [...new Set(aggregate.appliedPromotions.map(String))],
  };
};
