import { getGraphQLErrorCode, isForbiddenError, isUnauthenticatedError } from "@/utils/graphqlErrorUtils";

const sessionMessage = "⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";

export const getCartActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) return "❌ Bạn không có quyền thực hiện thao tác giỏ hàng này.";
  if (isUnauthenticatedError(error)) return sessionMessage;
  return fallback || `Thao tác giỏ hàng thất bại (${getGraphQLErrorCode(error) || "UNKNOWN"}).`;
};

export const getCustomerActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) return "❌ Bạn không có quyền thực hiện thao tác khách hàng này.";
  if (isUnauthenticatedError(error)) return sessionMessage;
  return fallback || `Thao tác khách hàng thất bại (${getGraphQLErrorCode(error) || "UNKNOWN"}).`;
};

export const getCheckoutActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) return "❌ Bạn không có quyền thực hiện thao tác checkout này.";
  if (isUnauthenticatedError(error)) return sessionMessage;
  return fallback || `Checkout thất bại (${getGraphQLErrorCode(error) || "UNKNOWN"}).`;
};
