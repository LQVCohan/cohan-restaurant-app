import { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";

const Q_ACTIVE_MENU_PROMOTIONS = gql`
  query ActiveMenuPromotions(
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
      categoryId
      itemId
      level
      stacking
      isActive
      startAt
      endAt
    }
  }
`;

const normalizePromotionType = (value, discountType) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (normalized === "FIXED") return "fixed";
  if (normalized === "PERCENTAGE") return "percentage";

  return String(discountType || "PERCENT")
    .trim()
    .toUpperCase() === "AMOUNT"
    ? "fixed"
    : "percentage";
};

const normalizeMenuPromotion = (row) => ({
  id: row?.id || "",
  name: row?.name || row?.code || "Khuyến mãi",
  code: row?.code || "",
  promotionType: row?.promotionType || "",
  type: normalizePromotionType(row?.promotionType, row?.discountType),
  scope: String(row?.scope || "").toLowerCase(),
  discountType:
    String(row?.discountType || "PERCENT").toUpperCase() === "AMOUNT"
      ? "fixed"
      : "percent",
  discountValue: Number(row?.discountValue || 0),
  minOrderValue: Number(row?.minOrderValue || 0),
  maxDiscount: Number(row?.maxDiscount || 0),
  categoryId: row?.categoryId ? String(row.categoryId) : "",
  itemId: row?.itemId ? String(row.itemId) : "",
  level: Number(row?.level || 1),
  stacking: Boolean(row?.stacking),
});

const getPromotionLabel = (promotion) => {
  if (!promotion) return "";

  if (promotion.discountType === "percent") {
    return `-${promotion.discountValue}%`;
  }

  if (promotion.discountValue > 0) {
    return `Giảm ${promotion.discountValue.toLocaleString("vi-VN")}đ`;
  }

  return "Ưu đãi";
};

const getPromotionRank = (promotion) => {
  const scopeWeight = promotion?.scope === "item" ? 1000 : 500;
  return scopeWeight + Number(promotion?.level || 0);
};

export const __testables = {
  normalizeMenuPromotion,
  getPromotionLabel,
  getPromotionRank,
};

export function useActiveMenuPromotions(restaurantId, { skip = false } = {}) {
  const { data, loading, error } = useQuery(Q_ACTIVE_MENU_PROMOTIONS, {
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
        .map(normalizeMenuPromotion)
        .filter(
          (promotion) =>
            promotion.id &&
            ["item", "category"].includes(promotion.scope) &&
            ["percentage", "fixed"].includes(promotion.type),
        ),
    [data?.promotionsByRestaurant],
  );

  const promotionByItemId = useMemo(() => {
    const map = new Map();

    for (const promotion of promotions) {
      if (!promotion.itemId) continue;

      const current = map.get(promotion.itemId);
      if (!current || getPromotionRank(promotion) > getPromotionRank(current)) {
        map.set(promotion.itemId, promotion);
      }
    }

    return map;
  }, [promotions]);

  const promotionByCategoryId = useMemo(() => {
    const map = new Map();

    for (const promotion of promotions) {
      if (!promotion.categoryId) continue;

      const current = map.get(promotion.categoryId);
      if (!current || getPromotionRank(promotion) > getPromotionRank(current)) {
        map.set(promotion.categoryId, promotion);
      }
    }

    return map;
  }, [promotions]);

  const getPromotionForMenuItem = (item) => {
    const itemId = String(item?.id || item?._id || item?.menuItemId || "");
    const categoryId = String(item?.categoryId || item?.category?.id || "");

    return (
      promotionByItemId.get(itemId) ||
      promotionByCategoryId.get(categoryId) ||
      null
    );
  };

  return {
    promotions,
    promotionByItemId,
    promotionByCategoryId,
    getPromotionForMenuItem,
    getPromotionLabel,
    loading,
    error,
  };
}
