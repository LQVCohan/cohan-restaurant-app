import { getGraphQLErrorCode, isForbiddenError, isUnauthenticatedError } from "@/utils/graphqlErrorUtils";

const sessionMessage = "⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";

export const getReviewActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) return "❌ Bạn không có quyền thực hiện thao tác đánh giá/bình luận này.";
  if (isUnauthenticatedError(error)) return sessionMessage;
  return fallback || `Thao tác đánh giá thất bại (${getGraphQLErrorCode(error) || "UNKNOWN"}).`;
};

export const getCommunicationActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) return "❌ Bạn không có quyền thực hiện thao tác tin nhắn/thông báo này.";
  if (isUnauthenticatedError(error)) return sessionMessage;
  return fallback || `Thao tác liên lạc thất bại (${getGraphQLErrorCode(error) || "UNKNOWN"}).`;
};

export const getEventLogActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) return "❌ Bạn không có quyền xem nhật ký hoạt động này.";
  if (isUnauthenticatedError(error)) return sessionMessage;
  return fallback || `Không thể tải nhật ký (${getGraphQLErrorCode(error) || "UNKNOWN"}).`;
};

export const getSearchActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) return "❌ Bạn không có quyền thực hiện tìm kiếm này.";
  if (isUnauthenticatedError(error)) return sessionMessage;
  return fallback || `Tìm kiếm thất bại (${getGraphQLErrorCode(error) || "UNKNOWN"}).`;
};
