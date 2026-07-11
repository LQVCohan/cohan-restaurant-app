import { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";

const Q_ACTIVE_DISCOUNT_PROMOTIONS = gql`
  query ActiveDiscountPromotions(
    $restaurantId: ID!
    $activeOnly: Boolean!
    $limit: Int!
    $offset: Int!
  ) {
    promotionsByRestaurant(
      restaurantId: $restaurantId
      activeOnly: $activeOnly
      limit: $limit
      offset: $offset
    ) {
      id
      name
      code
      promotionType
      scope
      discountType
      discountValue
      minOrderValue
      maxDiscount
      level
      stacking
      isActive
    }
  }
`;

const normalizePromotionType = (value, discountType) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (normalized === "FIXED") return "fixed";
  if (normalized === "PERCENTAGE") return "percentage";
  if (normalized === "COMBO") return "combo";
  if (normalized === "FREESHIP") return "freeship";

  return String(discountType || "PERCENT")
    .trim()
    .toUpperCase() === "AMOUNT"
    ? "fixed"
    : "percentage";
};

const normalizeDiscountPromotion = (row) => ({
  id: row?.id || "",
  name: row?.name || row?.code || "Khuyến mãi",
  code: row?.code || "",
  type: normalizePromotionType(row?.promotionType, row?.discountType),
  promotionType: String(row?.promotionType || "").trim().toUpperCase(),
  scope: String(row?.scope || "ORDER").toLowerCase(),
  discountType:
    String(row?.discountType || "PERCENT").toUpperCase() === "AMOUNT"
      ? "fixed"
      : "percent",
  discountValue: Number(row?.discountValue || 0),
  minOrderValue: Number(row?.minOrderValue || 0),
  maxDiscount: Number(row?.maxDiscount || 0),
  level: Number(row?.level || 1),
  stacking: Boolean(row?.stacking),
});

export const __testables = {
  normalizeDiscountPromotion,
};

export function useActiveDiscountPromotions(
  restaurantId,
  { skip = false } = {},
) {
  const { data, loading, error } = useQuery(Q_ACTIVE_DISCOUNT_PROMOTIONS, {
    variables: {
      restaurantId,
      activeOnly: true,
      limit: 100,
      offset: 0,
    },
    skip: skip || !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const promotions = useMemo(
    () =>
      (data?.promotionsByRestaurant || [])
        .map(normalizeDiscountPromotion)
        .filter(
          (promotion) =>
            promotion.id &&
            promotion.scope === "order" &&
            ["percentage", "fixed", "combo", "freeship"].includes(
              promotion.type,
            ),
        ),
    [data?.promotionsByRestaurant],
  );

  return {
    promotions,
    loading,
    error,
  };
}
