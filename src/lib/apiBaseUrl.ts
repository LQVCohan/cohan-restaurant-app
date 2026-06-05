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
  if (/^(https?:)?\/\//.test(path) || path.startsWith("data:image") || path.startsWith("blob:")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const gqlUrl = getGraphqlUrl();
  if (gqlUrl.startsWith("/")) return normalizedPath;

  const base = gqlUrl.endsWith("/graphql")
    ? gqlUrl.slice(0, -"/graphql".length)
    : gqlUrl.replace(/\/$/, "");

  return `${base}${normalizedPath}`;
}
