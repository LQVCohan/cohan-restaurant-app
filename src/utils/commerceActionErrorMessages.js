import { getGraphQLErrorCode, isForbiddenError, isUnauthenticatedError } from "@/utils/graphqlErrorUtils";

const sessionMessage = "⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";

export const getOrderActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) return "❌ Bạn không có quyền thực hiện thao tác đơn hàng này.";
  if (isUnauthenticatedError(error)) return sessionMessage;
  return fallback || `Thao tác đơn hàng thất bại (${getGraphQLErrorCode(error) || "UNKNOWN"}).`;
};

export const getPaymentActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) return "❌ Bạn không có quyền thực hiện thao tác thanh toán này.";
  if (isUnauthenticatedError(error)) return sessionMessage;
  return fallback || `Thao tác thanh toán thất bại (${getGraphQLErrorCode(error) || "UNKNOWN"}).`;
};

export const getReservationActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) return "❌ Bạn không có quyền thực hiện thao tác đặt bàn này.";
  if (isUnauthenticatedError(error)) return sessionMessage;
  return fallback || `Thao tác đặt bàn thất bại (${getGraphQLErrorCode(error) || "UNKNOWN"}).`;
};
