import { gql } from "@apollo/client";
import { useCallback } from "react";
import { useLazyQuery } from "@apollo/client/react";

const DISCOUNT_BREAKDOWN_FIELDS = gql`
  fragment CustomerDiscountBreakdownFields on DiscountBreakdown {
    subtotal
    eligibleSubtotal
    promotionDiscount
    voucherDiscount
    couponDiscount
    shippingDiscount
    totalDiscount
    discount
    promotionLines {
      lineId
      dishId
      menuId
      categoryId
      name
      quantity
      lineSubtotal
      promotionId
      promotionName
      promotionScope
      discountType
      discountValue
      discount
    }
    eligibleGiftItems {
      promotionId
      promotionName
      promotionCode
      buyItemId
      buyItemName
      giftItemId
      giftItemName
      giftItemImage
      giftItemPrice
      giftMenuId
      giftCategoryId
      giftDefaultServingKey
      buyQuantity
      getQuantity
      purchasedQuantity
      giftQuantityLimit
      giftQuantityInOrder
      missingGiftQuantity
      message
    }
    service
    serviceRate
    tax
    taxRate
    shippingFee
    finalTotal
    grandTotal
    voucherCode
    couponId
    appliedPromotions
    appliedCoupons
    discountReason
  }
`;

export const PREVIEW_ORDER_DISCOUNT = gql`
  query PreviewOrderDiscount($input: PreviewOrderDiscountInput!) {
    previewOrderDiscount(input: $input) {
      ...CustomerDiscountBreakdownFields
    }
  }
  ${DISCOUNT_BREAKDOWN_FIELDS}
`;

export const CUSTOMER_PROMOTION_PREVIEW = gql`
  query CustomerPromotionPreview($input: CustomerPromotionPreviewInput!) {
    customerPromotionPreview(input: $input) {
      ...CustomerDiscountBreakdownFields
    }
  }
  ${DISCOUNT_BREAKDOWN_FIELDS}
`;

export function getDiscountPreviewErrorMessage(error) {
  const graphQLError = error?.graphQLErrors?.[0];
  const code = graphQLError?.extensions?.code;
  const message = graphQLError?.message || error?.message || "";

  if (code === "UNAUTHENTICATED") {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }

  if (code === "FORBIDDEN") {
    return "Bạn không có quyền xem trước ưu đãi cho nhà hàng này.";
  }

  if (code === "BAD_USER_INPUT") {
    return message || "Coupon hoặc khuyến mãi không hợp lệ.";
  }

  if (code === "PROMOTION_USAGE_LIMIT_REACHED") {
    return "Khuyến mãi vừa hết lượt sử dụng. Vui lòng kiểm tra lại tổng tiền.";
  }

  if (/usage limit/i.test(message)) {
    return "Coupon đã hết lượt sử dụng.";
  }

  if (/minimum order/i.test(message)) {
    return "Đơn hàng chưa đạt giá trị tối thiểu để dùng coupon.";
  }

  if (/expired/i.test(message)) {
    return "Coupon đã hết hạn.";
  }

  if (/inactive/i.test(message)) {
    return "Coupon chưa được kích hoạt hoặc không còn khả dụng.";
  }

  return message || "Không thể tính ưu đãi. Vui lòng thử lại.";
}

export function useDiscountPreview() {
  const [runPreview, state] = useLazyQuery(PREVIEW_ORDER_DISCOUNT, {
    fetchPolicy: "network-only",
  });

  const previewOrderDiscount = useCallback(
    async (input) => {
      const res = await runPreview({
        variables: { input },
      });

      return res?.data?.previewOrderDiscount || null;
    },
    [runPreview],
  );

  return {
    previewOrderDiscount,
    breakdown: state.data?.previewOrderDiscount || null,
    loading: state.loading,
    error: state.error,
    errorMessage: state.error
      ? getDiscountPreviewErrorMessage(state.error)
      : "",
    called: state.called,
  };
}

export function useCustomerPromotionPreview() {
  const [runPreview, state] = useLazyQuery(CUSTOMER_PROMOTION_PREVIEW, {
    fetchPolicy: "network-only",
  });

  const previewCustomerPromotion = useCallback(
    async (input) => {
      const response = await runPreview({ variables: { input } });
      return response?.data?.customerPromotionPreview || null;
    },
    [runPreview],
  );

  return {
    previewCustomerPromotion,
    breakdown: state.data?.customerPromotionPreview || null,
    loading: state.loading,
    error: state.error,
    errorMessage: state.error
      ? getDiscountPreviewErrorMessage(state.error)
      : "",
    called: state.called,
  };
}
