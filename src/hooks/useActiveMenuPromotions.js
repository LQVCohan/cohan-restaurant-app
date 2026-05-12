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

const SUPPORTED_SCOPES = new Set(["item", "category"]);
const SUPPORTED_PROMOTION_TYPES = new Set(["FIXED", "PERCENTAGE"]);
const SUPPORTED_DISCOUNT_TYPES = new Set(["AMOUNT", "PERCENT"]);

const normalizeMenuPromotion = (row = {}) => ({
  id: row?.id || "",
  name: row?.name || row?.code || "Ưu đãi",
  code: row?.code || "",
  promotionType: String(row?.promotionType || "")
    .trim()
    .toUpperCase(),
  scope: String(row?.scope || "")
    .trim()
    .toLowerCase(),
  discountType: String(row?.discountType || "")
    .trim()
    .toUpperCase(),
  discountValue: Number(row?.discountValue || 0),
  minOrderValue: Number(row?.minOrderValue || 0),
  maxDiscount: Number(row?.maxDiscount || 0),
  categoryId: row?.categoryId || "",
  itemId: row?.itemId || "",
  level: Number(row?.level || 0),
  stacking: Boolean(row?.stacking),
  isActive: Boolean(row?.isActive),
  startAt: row?.startAt || null,
  endAt: row?.endAt || null,
});

const isSupportedDisplayPromotion = (promotion) => {
  if (!promotion?.id || !SUPPORTED_SCOPES.has(promotion.scope)) {
    return false;
  }

  if (SUPPORTED_PROMOTION_TYPES.has(promotion.promotionType)) {
    return true;
  }

  return SUPPORTED_DISCOUNT_TYPES.has(promotion.discountType);
};

const pickHigherLevelPromotion = (currentPromotion, candidatePromotion) => {
  if (!currentPromotion) return candidatePromotion;

  const currentLevel = Number(currentPromotion?.level || 0);
  const candidateLevel = Number(candidatePromotion?.level || 0);

  return candidateLevel > currentLevel ? candidatePromotion : currentPromotion;
};

const buildPromotionLookup = (promotions, key) =>
  promotions.reduce((lookup, promotion) => {
    const targetId = promotion?.[key];
    if (!targetId) return lookup;

    return {
      ...lookup,
      [targetId]: pickHigherLevelPromotion(lookup[targetId], promotion),
    };
  }, {});

const selectPromotionForMenuItem = (
  item,
  { promotionByItemId = {}, promotionByCategoryId = {} } = {},
) => {
  if (!item) return null;

  const itemPromotion = promotionByItemId[item.id];
  if (itemPromotion) return itemPromotion;

  return promotionByCategoryId[item.categoryId] || null;
};

const formatDiscountValue = (value) => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "0";
  }

  if (Number.isInteger(numericValue)) {
    return String(numericValue);
  }

  return String(Number(numericValue.toFixed(2)));
};

const formatAmountLabel = (value) =>
  `${new Intl.NumberFormat("vi-VN").format(Math.round(Number(value || 0)))}đ`;

const getPromotionLabel = (promotion) => {
  if (!promotion) return "";

  if (
    promotion.discountType === "PERCENT" ||
    promotion.promotionType === "PERCENTAGE"
  ) {
    return `-${formatDiscountValue(promotion.discountValue)}%`;
  }

  if (
    promotion.discountType === "AMOUNT" ||
    promotion.promotionType === "FIXED"
  ) {
    return `Giảm ${formatAmountLabel(promotion.discountValue)}`;
  }

  return "Ưu đãi";
};

export const __testables = {
  buildPromotionLookup,
  getPromotionLabel,
  isSupportedDisplayPromotion,
  normalizeMenuPromotion,
  pickHigherLevelPromotion,
  selectPromotionForMenuItem,
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
        .filter(isSupportedDisplayPromotion),
    [data?.promotionsByRestaurant],
  );

  const promotionByItemId = useMemo(
    () => buildPromotionLookup(promotions, "itemId"),
    [promotions],
  );

  const promotionByCategoryId = useMemo(
    () => buildPromotionLookup(promotions, "categoryId"),
    [promotions],
  );

  return {
    promotions,
    promotionByItemId,
    promotionByCategoryId,
    getPromotionForMenuItem: (item) =>
      selectPromotionForMenuItem(item, {
        promotionByItemId,
        promotionByCategoryId,
      }),
    getPromotionLabel,
    loading,
    error,
  };
}
