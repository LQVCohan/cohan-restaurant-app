import {
  getGraphQLErrorCode,
  isForbiddenError,
  isUnauthenticatedError,
} from "@/utils/graphqlErrorUtils";

export const getPayrollActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) {
    return "❌ Bạn không có quyền thực hiện thao tác bảng lương này.";
  }
  if (isUnauthenticatedError(error)) {
    return "⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }
  return fallback || `Thao tác payroll thất bại (${getGraphQLErrorCode(error) || "UNKNOWN"}).`;
};

export const getPerformanceActionErrorMessage = (error, fallback) => {
  if (isForbiddenError(error)) {
    return "❌ Bạn không có quyền thực hiện thao tác đánh giá hiệu suất này.";
  }
  if (isUnauthenticatedError(error)) {
    return "⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }
  return fallback || `Thao tác hiệu suất thất bại (${getGraphQLErrorCode(error) || "UNKNOWN"}).`;
};
