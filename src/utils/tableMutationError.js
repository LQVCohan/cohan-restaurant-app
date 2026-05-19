const ACTIVE_ORDER_CODES = new Set(["TABLE_HAS_ACTIVE_ORDERS", "TABLE_HAS_ACTIVE_SESSION"]);

const getGraphQLErrors = (error) =>
  error?.graphQLErrors || error?.networkError?.result?.errors || [];

export const getTableMutationErrorCode = (error) => {
  const gqlError = getGraphQLErrors(error)[0] || null;
  return gqlError?.extensions?.code || error?.extensions?.code || null;
};

export const mapTableMutationError = (
  error,
  fallbackMessage = "Không thể cập nhật trạng thái bàn."
) => {
  const gqlError = getGraphQLErrors(error)[0] || null;
  const code = getTableMutationErrorCode(error);

  if (ACTIVE_ORDER_CODES.has(code)) {
    return "Không thể thao tác vì bàn đang có đơn hàng hoặc phiên bàn đang hoạt động.";
  }

  if (code === "TABLE_HAS_ACTIVE_RESERVATION") {
    return "Không thể thao tác vì bàn đang có đặt chỗ hoạt động.";
  }

  const message = gqlError?.message || error?.message;
  if (typeof message === "string" && message.trim()) return message.trim();

  return fallbackMessage;
};
