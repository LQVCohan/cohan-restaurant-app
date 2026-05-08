import {
  getGraphQLErrorCode,
  isForbiddenError,
  isUnauthenticatedError,
} from "@/utils/graphqlErrorUtils";

const getAuthMessage = (error, forbiddenMessage) => {
  if (isForbiddenError(error)) return forbiddenMessage;
  if (isUnauthenticatedError(error)) {
    return "⚠️ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }
  return null;
};

export const getInventoryActionErrorMessage = (error, fallback) =>
  getAuthMessage(error, "❌ Bạn không có quyền thực hiện thao tác kho/vật tư này.") ||
  fallback ||
  `Thao tác kho/vật tư thất bại (${getGraphQLErrorCode(error) || "UNKNOWN"}).`;

export const getSupplyActionErrorMessage = (error, fallback) =>
  getAuthMessage(error, "❌ Bạn không có quyền thực hiện thao tác kho/vật tư này.") ||
  fallback ||
  `Thao tác vật tư thất bại (${getGraphQLErrorCode(error) || "UNKNOWN"}).`;

export const getSupplierActionErrorMessage = (error, fallback) =>
  getAuthMessage(error, "❌ Bạn không có quyền thực hiện thao tác nhà cung cấp này.") ||
  fallback ||
  `Thao tác nhà cung cấp thất bại (${getGraphQLErrorCode(error) || "UNKNOWN"}).`;

export const getPrintSettingActionErrorMessage = (error, fallback) =>
  getAuthMessage(
    error,
    "❌ Bạn không có quyền quản lý thiết lập in của nhà hàng này.",
  ) ||
  fallback ||
  `Thao tác thiết lập in thất bại (${getGraphQLErrorCode(error) || "UNKNOWN"}).`;
