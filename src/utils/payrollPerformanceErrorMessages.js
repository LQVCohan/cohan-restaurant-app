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
  const code = getGraphQLErrorCode(error) || error?.message || "";
  if (String(code).includes("PAYROLL_PAYOUT_PROVIDER_NOT_CONFIGURED")) {
    return "⚠️ Nhà cung cấp payout/chuyển khoản chưa được cấu hình.";
  }
  if (String(code).includes("EMPLOYEE_BANK_ACCOUNT_NOT_VERIFIED")) {
    return "⚠️ Tài khoản nhận lương của nhân viên chưa được xác minh.";
  }
  if (String(code).includes("PAYROLL_PERIOD_NOT_PAYABLE")) {
    return "⚠️ Kỳ lương chưa ở trạng thái được phép chi trả.";
  }
  return fallback || `Thao tác payroll thất bại (${code || "UNKNOWN"}).`;
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
