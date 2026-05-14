import { gql, useQuery } from "@apollo/client";

const Q_COUPON_ANALYTICS = gql`
  query CouponAnalyticsByRestaurant($restaurantId: ID!) {
    couponAnalyticsByRestaurant(restaurantId: $restaurantId) {
      totalCoupons
      activeCoupons
      savedCoupons
      usedCoupons
      totalRedemptions
      totalDiscountAmount
      usageRate
      expiringSoon
      nearUsageLimit
      topCoupons {
        couponId
        couponCode
        couponName
        usageCount
        totalDiscount
      }
    }
  }
`;

const EMPTY_ANALYTICS = {
  totalCoupons: 0,
  activeCoupons: 0,
  savedCoupons: 0,
  usedCoupons: 0,
  totalRedemptions: 0,
  totalDiscountAmount: 0,
  usageRate: 0,
  expiringSoon: 0,
  nearUsageLimit: 0,
  topCoupons: [],
};

export function useCouponAnalytics(restaurantId) {
  const { data, loading, error, refetch } = useQuery(Q_COUPON_ANALYTICS, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  return {
    analytics: data?.couponAnalyticsByRestaurant || EMPTY_ANALYTICS,
    loading,
    error,
    refetch,
  };
}
