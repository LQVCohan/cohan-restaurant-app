import { getGraphQLErrorCode, isForbiddenError, isUnauthenticatedError } from "@/utils/graphqlErrorUtils";

const sessionMessage = "⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";

const ORDER_ERROR_MESSAGES = {
  ORDER_STATUS_NOT_CANCELABLE: "❌ Đơn đã được bếp xử lý nên bạn không thể tự hủy trên ứng dụng.",
  ORDER_ALREADY_PAID: "❌ Đơn đã thanh toán nên không thể tự hủy trên ứng dụng.",
};

export const getOrderActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) return "❌ Bạn không có quyền thực hiện thao tác đơn hàng này.";
  if (isUnauthenticatedError(error)) return sessionMessage;

  const code = getGraphQLErrorCode(error);
  if (ORDER_ERROR_MESSAGES[code]) return ORDER_ERROR_MESSAGES[code];

  return fallback || `Thao tác đơn hàng thất bại (${code || "UNKNOWN"}).`;
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
