export function getGraphqlUrl() {
  return import.meta.env.VITE_API_URL || "http://localhost:4000/graphql";
}

export function toApiAuthUrl(pathname: "/refresh" | "/logout") {
  const gqlUrl = getGraphqlUrl();
  if (gqlUrl.startsWith("/")) return `/api/auth${pathname}`;
  const base = gqlUrl.endsWith("/graphql") ? gqlUrl.slice(0, -"/graphql".length) : gqlUrl;
  return `${base}/api/auth${pathname}`;
}

export const getRefreshUrl = () => toApiAuthUrl("/refresh");
export const getLogoutUrl = () => toApiAuthUrl("/logout");

export function toApiAssetUrl(path: string | null | undefined) {
  if (!path) return "";

  const value = String(path).trim();
  if (!value) return "";

  // Local image URIs are resolved by LocalImageView/useLocalImageUrl and must
  // never be rewritten as an HTTP URL.
  if (
    value.startsWith("local-image://") ||
    /^(https?:)?\/\//.test(value) ||
    value.startsWith("data:image") ||
    value.startsWith("blob:")
  ) {
    return value;
  }

  // Windows-style paths can be returned by local upload adapters. Convert
  // them before joining with the API origin so browsers receive a valid URL.
  const safePath = value.replace(/\\/g, "/");
  const normalizedPath = safePath.startsWith("/") ? safePath : `/${safePath}`;
  const gqlUrl = getGraphqlUrl();
  if (gqlUrl.startsWith("/")) return normalizedPath;

  const base = gqlUrl.endsWith("/graphql")
    ? gqlUrl.slice(0, -"/graphql".length)
    : gqlUrl.replace(/\/$/, "");

  return `${base}${normalizedPath}`;
}
