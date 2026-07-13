const TECHNICAL_ERROR_PATTERN =
  /(Variable\s+"\$|got invalid value|cannot represent|GraphQL|ApolloError|TypeError|ReferenceError|SyntaxError|ObjectId|ECONN(?:REFUSED|RESET)|\bat input\.[a-z]|\bextensions\.code\b|\bstatus code\s*\d{3}\b|\b[a-f0-9]{24}\b|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|stack trace|resolver|non-nullable)/i;

const getRawMessage = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return (
    value?.graphQLErrors?.[0]?.message ||
    value?.networkError?.message ||
    value?.message ||
    String(value)
  );
};

export const isTechnicalErrorMessage = (value) =>
  TECHNICAL_ERROR_PATTERN.test(getRawMessage(value));

export const toUserFacingErrorMessage = (
  value,
  fallback = "Thao tác chưa hoàn tất. Vui lòng thử lại.",
) => {
  const raw = getRawMessage(value).trim();
  if (!raw || TECHNICAL_ERROR_PATTERN.test(raw)) return fallback;
  return raw
    .replace(
      /\b(categoryId|itemId|restaurantId|orderId|userId)\b/gi,
      "thông tin liên quan",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
};
