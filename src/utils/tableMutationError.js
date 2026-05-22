const TABLE_BUSINESS_ERROR_MESSAGES = {
  TABLE_HAS_UNSERVED_ITEMS: "Không thể trả bàn về trống vì còn món chưa phục vụ.",
  TABLE_HAS_UNPAID_ORDERS: "Không thể trả bàn về trống vì còn hóa đơn chưa thanh toán.",
  TABLE_PAYMENT_PENDING: "Không thể trả bàn về trống vì bàn đang chờ thanh toán.",
  TABLE_HAS_ACTIVE_SESSION: "Không thể trả bàn về trống vì còn phiên bàn đang hoạt động.",
  TABLE_HAS_ACTIVE_RESERVATION: "Không thể trả bàn về trống vì còn đặt chỗ hoạt động.",
};

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

  if (code === "TABLE_HAS_ACTIVE_ORDERS") {
    return gqlError?.message || "Không thể trả bàn về trống vì còn order hoạt động.";
  }

  if (TABLE_BUSINESS_ERROR_MESSAGES[code]) {
    return TABLE_BUSINESS_ERROR_MESSAGES[code];
  }

  const message = gqlError?.message || error?.message;
  if (typeof message === "string" && message.trim()) return message.trim();

  return fallbackMessage;
};
