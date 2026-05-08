export const getGraphQLErrorCode = (error) => {
  const graphCode = error?.graphQLErrors?.[0]?.extensions?.code;
  if (graphCode) return graphCode;

  const networkCode = error?.networkError?.result?.errors?.[0]?.extensions?.code;
  if (networkCode) return networkCode;

  const fallbackCode = error?.extensions?.code;
  return fallbackCode || "";
};

export const isForbiddenError = (error) => getGraphQLErrorCode(error) === "FORBIDDEN";

export const isUnauthenticatedError = (error) =>
  getGraphQLErrorCode(error) === "UNAUTHENTICATED";
