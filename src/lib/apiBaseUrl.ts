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
