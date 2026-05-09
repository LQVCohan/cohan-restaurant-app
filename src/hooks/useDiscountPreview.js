import { gql } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";

export const PREVIEW_ORDER_DISCOUNT = gql`
  query PreviewOrderDiscount($input: PreviewOrderDiscountInput!) {
    previewOrderDiscount(input: $input) {
      subtotal
      eligibleSubtotal
      promotionDiscount
      voucherDiscount
      couponDiscount
      shippingDiscount
      totalDiscount
      discount
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
  }
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
    return message || "Voucher hoặc khuyến mãi không hợp lệ.";
  }

  if (/usage limit/i.test(message)) {
    return "Voucher đã hết lượt sử dụng.";
  }

  if (/minimum order/i.test(message)) {
    return "Đơn hàng chưa đạt giá trị tối thiểu để dùng voucher.";
  }

  if (/expired/i.test(message)) {
    return "Voucher đã hết hạn.";
  }

  if (/inactive/i.test(message)) {
    return "Voucher chưa được kích hoạt hoặc không còn khả dụng.";
  }

  return message || "Không thể tính ưu đãi. Vui lòng thử lại.";
}

export function useDiscountPreview() {
  const [runPreview, state] = useLazyQuery(PREVIEW_ORDER_DISCOUNT, {
    fetchPolicy: "network-only",
  });

  const previewOrderDiscount = async (input) => {
    const res = await runPreview({
      variables: { input },
    });

    return res?.data?.previewOrderDiscount || null;
  };

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
