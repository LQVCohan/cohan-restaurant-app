import { useMemo } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";

export const USER_COUPON_FIELDS = gql`
  fragment UserCouponFields on UserCoupon {
    id
    userId
    couponId
    restaurantId
    status
    savedAt
    usedAt
    orderId
    invoiceId
    discountAmount
    metadata
    coupon {
      id
      name
      code
      category
      description
      discountType
      discountValue
      minOrderValue
      maxDiscount
      maxUsage
      used
      publishAt
      startAt
      endAt
      isActive
      constraints
      restaurantId
    }
  }
`;

export const MY_COUPONS = gql`
  ${USER_COUPON_FIELDS}
  query MyCoupons($restaurantId: ID, $status: String) {
    myCoupons(restaurantId: $restaurantId, status: $status) {
      ...UserCouponFields
    }
  }
`;

export const SAVE_COUPON = gql`
  ${USER_COUPON_FIELDS}
  mutation SaveCoupon($couponId: ID!) {
    saveCoupon(couponId: $couponId) {
      ...UserCouponFields
    }
  }
`;

export const REMOVE_SAVED_COUPON = gql`
  mutation RemoveSavedCoupon($couponId: ID!) {
    removeSavedCoupon(couponId: $couponId)
  }
`;

const toCouponId = (userCoupon) =>
  String(userCoupon?.couponId || userCoupon?.coupon?.id || "").trim();

export default function useUserCoupons({ restaurantId, status = "saved", skip = false } = {}) {
  const variables = useMemo(
    () => ({ restaurantId: restaurantId || null, status: status || null }),
    [restaurantId, status],
  );

  const { data, loading, error, refetch } = useQuery(MY_COUPONS, {
    variables,
    skip,
    fetchPolicy: "cache-and-network",
  });

  const refetchMyCoupons = { query: MY_COUPONS, variables };

  const [saveCouponMutation, { loading: saving }] = useMutation(SAVE_COUPON, {
    refetchQueries: [refetchMyCoupons],
    awaitRefetchQueries: true,
  });

  const [removeSavedCouponMutation, { loading: removing }] = useMutation(
    REMOVE_SAVED_COUPON,
    {
      refetchQueries: [refetchMyCoupons],
      awaitRefetchQueries: true,
    },
  );

  const myCoupons = useMemo(() => data?.myCoupons ?? [], [data?.myCoupons]);

  const savedCouponIds = useMemo(
    () => myCoupons.map(toCouponId).filter(Boolean),
    [myCoupons],
  );

  const saveCoupon = async (couponId) => {
    const result = await saveCouponMutation({ variables: { couponId } });
    return result.data?.saveCoupon;
  };

  const removeSavedCoupon = async (couponId) => {
    const result = await removeSavedCouponMutation({ variables: { couponId } });
    return Boolean(result.data?.removeSavedCoupon);
  };

  return {
    myCoupons,
    savedCouponIds,
    loading: loading || saving || removing,
    error,
    saveCoupon,
    removeSavedCoupon,
    refetch,
  };
}
