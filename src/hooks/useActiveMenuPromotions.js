import { useCallback, useMemo } from "react";
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
const UNSUPPORTED_PROMOTION_TYPES = new Set(["BOGO", "COMBO", "FREESHIP"]);
const SUPPORTED_DISCOUNT_TYPES = new Set(["AMOUNT", "PERCENT"]);

const normalizeEntityId = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const collectCandidateIds = (values = []) => {
  const seen = new Set();

  return values.reduce((ids, value) => {
    const normalizedId = normalizeEntityId(value);
    if (!normalizedId || seen.has(normalizedId)) {
      return ids;
    }

    seen.add(normalizedId);
    ids.push(normalizedId);
    return ids;
  }, []);
};

const getMenuItemCandidateIds = (item = {}) =>
  collectCandidateIds([
    item?.id,
    item?._id,
    item?.dishId,
    item?.menuItemId,
    item?.menuItem?.id,
    item?.menuItem?._id,
  ]);

const getMenuCategoryCandidateIds = (item = {}) =>
  collectCandidateIds([
    item?.categoryId,
    item?.category?.id,
    item?.category?._id,
  ]);

const normalizeMenuPromotion = (row = {}) => ({
  id: normalizeEntityId(row?.id),
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
  categoryId: normalizeEntityId(row?.categoryId),
  itemId: normalizeEntityId(row?.itemId),
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

  if (UNSUPPORTED_PROMOTION_TYPES.has(promotion.promotionType)) {
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
    const targetId = normalizeEntityId(promotion?.[key]);
    if (!targetId) return lookup;

    lookup[targetId] = pickHigherLevelPromotion(lookup[targetId], promotion);
    return lookup;
  }, {});

const findPromotionInLookup = (candidateIds = [], lookup = {}) => {
  for (const candidateId of candidateIds) {
    if (lookup[candidateId]) {
      return lookup[candidateId];
    }
  }

  return null;
};

const selectPromotionForMenuItem = (
  item,
  { promotionByItemId = {}, promotionByCategoryId = {} } = {},
) => {
  if (!item) return null;

  const itemPromotion = findPromotionInLookup(
    getMenuItemCandidateIds(item),
    promotionByItemId,
  );
  if (itemPromotion) return itemPromotion;

  return findPromotionInLookup(
    getMenuCategoryCandidateIds(item),
    promotionByCategoryId,
  );
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

  let discountLabel = "Ưu đãi";
  if (
    promotion.discountType === "PERCENT" ||
    promotion.promotionType === "PERCENTAGE"
  ) {
    discountLabel = `-${formatDiscountValue(promotion.discountValue)}%`;
  } else if (
    promotion.discountType === "AMOUNT" ||
    promotion.promotionType === "FIXED"
  ) {
    discountLabel = `Giảm ${formatAmountLabel(promotion.discountValue)}`;
  }

  const minimum = Math.max(0, Number(promotion.minOrderValue || 0));
  return minimum > 0
    ? `${discountLabel} · đơn từ ${formatAmountLabel(minimum)}`
    : discountLabel;
};

const calculatePromotionPricePreview = (
  promotion,
  unitPrice,
  quantity = 1,
) => {
  const safeUnitPrice = Math.max(0, Number(unitPrice || 0));
  const safeQuantity = Math.max(1, Number(quantity || 1));
  const originalTotal = Math.round(safeUnitPrice * safeQuantity);
  const requiresOrderMinimum = Number(promotion?.minOrderValue || 0) > 0;

  if (!promotion || originalTotal <= 0 || requiresOrderMinimum) {
    return {
      originalTotal,
      finalTotal: originalTotal,
      discount: 0,
      requiresOrderMinimum,
    };
  }

  const discountType = String(promotion.discountType || "").toUpperCase();
  let discount =
    discountType === "PERCENT"
      ? (originalTotal * Math.max(0, Number(promotion.discountValue || 0))) / 100
      : Math.max(0, Number(promotion.discountValue || 0));

  const maxDiscount = Math.max(0, Number(promotion.maxDiscount || 0));
  if (discountType === "PERCENT" && maxDiscount > 0) {
    discount = Math.min(discount, maxDiscount);
  }

  discount = Math.min(originalTotal, Math.max(0, Math.round(discount)));
  return {
    originalTotal,
    finalTotal: originalTotal - discount,
    discount,
    requiresOrderMinimum: false,
  };
};

export const __testables = {
  buildPromotionLookup,
  calculatePromotionPricePreview,
  collectCandidateIds,
  findPromotionInLookup,
  getMenuCategoryCandidateIds,
  getMenuItemCandidateIds,
  getPromotionLabel,
  isSupportedDisplayPromotion,
  normalizeEntityId,
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

  const getPromotionForMenuItem = useCallback(
    (item) =>
      selectPromotionForMenuItem(item, {
        promotionByItemId,
        promotionByCategoryId,
      }),
    [promotionByCategoryId, promotionByItemId],
  );

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
