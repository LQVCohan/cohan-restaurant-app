import { gql, useQuery } from "@apollo/client";

const Q_PROMOTION_ANALYTICS = gql`
  query PromotionAnalyticsByRestaurant($restaurantId: ID!) {
    promotionAnalyticsByRestaurant(restaurantId: $restaurantId) {
      totalPromotions
      activePromotions
      scheduledPromotions
      expiredPromotions
      totalRedemptions
      totalPromotionDiscount
      totalShippingDiscount
      totalDiscountAmount
      usageRate
      topPromotions {
        promotionId
        promotionName
        promotionCode
        promotionType
        usageCount
        totalDiscount
      }
      byType {
        promotionType
        usageCount
        totalDiscount
      }
    }
  }
`;

export const EMPTY_ANALYTICS = {
  totalPromotions: 0,
  activePromotions: 0,
  scheduledPromotions: 0,
  expiredPromotions: 0,
  totalRedemptions: 0,
  totalPromotionDiscount: 0,
  totalShippingDiscount: 0,
  totalDiscountAmount: 0,
  usageRate: 0,
  topPromotions: [],
  byType: [],
};

export function usePromotionAnalytics(restaurantId) {
  const { data, loading, error, refetch } = useQuery(Q_PROMOTION_ANALYTICS, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  return {
    analytics: data?.promotionAnalyticsByRestaurant || EMPTY_ANALYTICS,
    loading,
    error,
    refetch,
  };
}
