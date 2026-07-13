import { getGraphQLErrorCode, isForbiddenError, isUnauthenticatedError } from "@/utils/graphqlErrorUtils";

const sessionMessage = "⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";

const ORDER_ERROR_MESSAGES = {
  ORDER_STATUS_NOT_CANCELABLE: "❌ Đơn đã được bếp xử lý nên bạn không thể tự hủy trên ứng dụng.",
  ORDER_ALREADY_PAID: "❌ Đơn đã thanh toán nên không thể tự hủy trên ứng dụng.",
};

const RESERVATION_ERROR_MESSAGES = {
  USER_RESERVATION_TIME_CONFLICT:
    "❌ Bạn đã có một lịch đặt bàn khác trùng khung giờ tại nhà hàng này. Vui lòng đổi giờ hoặc hủy lịch cũ trước.",
  RESERVATION_NOT_CONFIRMED:
    "❌ Chỉ lịch đặt bàn đã được xác nhận mới có thể check-in.",
  RESERVATION_CHANGE_PENDING:
    "❌ Lịch đang chờ nhà hàng duyệt thay đổi nên chưa thể check-in.",
  RESERVATION_CHECK_IN_TOO_EARLY:
    "❌ Chưa đến thời gian nhận khách. Chỉ được check-in sớm tối đa 15 phút trước giờ đặt.",
  TABLE_SESSION_CONFLICT:
    "❌ Bàn đang có phiên phục vụ khác nên chưa thể check-in lịch này.",
  TABLE_UNAVAILABLE:
    "❌ Bàn chưa sẵn sàng để check-in. Vui lòng kiểm tra trạng thái bàn.",
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

  const code = getGraphQLErrorCode(error);
  if (RESERVATION_ERROR_MESSAGES[code]) return RESERVATION_ERROR_MESSAGES[code];

  return fallback || `Thao tác đặt bàn thất bại (${code || "UNKNOWN"}).`;
};
