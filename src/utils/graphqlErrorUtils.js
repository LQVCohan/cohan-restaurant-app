const firstErrorCode = (errors) => {
  if (!Array.isArray(errors)) return "";
  for (const item of errors) {
    const code = item?.extensions?.code;
    if (code) return String(code);
  }
  return "";
};

const firstErrorMessage = (errors) => {
  if (!Array.isArray(errors)) return "";
  for (const item of errors) {
    const message = String(item?.message || "").trim();
    if (message) return message;
  }
  return "";
};

export const getGraphQLErrorCode = (error) => {
  // Apollo Client can expose GraphQL failures through different shapes:
  // - ApolloError.graphQLErrors (legacy/current v3 paths)
  // - CombinedGraphQLErrors.errors (newer error handling paths)
  // - networkError.result.errors (HTTP transport errors)
  // Keep this helper as the single compatibility layer for the UI.
  const graphCode = firstErrorCode(error?.graphQLErrors);
  if (graphCode) return graphCode;

  const combinedCode = firstErrorCode(error?.errors);
  if (combinedCode) return combinedCode;

  const networkCode = firstErrorCode(error?.networkError?.result?.errors);
  if (networkCode) return networkCode;

  const responseCode = firstErrorCode(error?.result?.errors);
  if (responseCode) return responseCode;

  const causeCode =
    error?.cause?.extensions?.code ||
    firstErrorCode(error?.cause?.graphQLErrors) ||
    firstErrorCode(error?.cause?.errors);
  if (causeCode) return String(causeCode);

  const fallbackCode = error?.extensions?.code;
  return fallbackCode ? String(fallbackCode) : "";
};

export const getGraphQLErrorMessage = (error, fallback = "") => {
  const candidates = [
    firstErrorMessage(error?.graphQLErrors),
    firstErrorMessage(error?.errors),
    firstErrorMessage(error?.networkError?.result?.errors),
    firstErrorMessage(error?.result?.errors),
    firstErrorMessage(error?.cause?.graphQLErrors),
    firstErrorMessage(error?.cause?.errors),
    String(error?.cause?.message || "").trim(),
    String(error?.message || "").trim(),
  ];

  return candidates.find(Boolean) || fallback;
};

export const isForbiddenError = (error) =>
  getGraphQLErrorCode(error) === "FORBIDDEN";

export const isUnauthenticatedError = (error) =>
  getGraphQLErrorCode(error) === "UNAUTHENTICATED";
