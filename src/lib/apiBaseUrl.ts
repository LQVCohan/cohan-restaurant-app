export function getGraphqlUrl() {
  return import.meta.env.VITE_API_URL || "http://localhost:4000/graphql";
}

const stripGraphqlSuffix = (value: string) =>
  String(value || "").replace(/\/graphql\/?$/, "").replace(/\/$/, "");

export function getApiBaseUrl() {
  const gqlUrl = getGraphqlUrl();
  const baseWithoutGraphql = stripGraphqlSuffix(gqlUrl);

  if (baseWithoutGraphql.startsWith("/")) {
    if (baseWithoutGraphql === "/api" || baseWithoutGraphql.endsWith("/api")) {
      return baseWithoutGraphql;
    }
    return `${baseWithoutGraphql}/api`.replace(/\/+/g, "/");
  }

  try {
    const parsed = new URL(baseWithoutGraphql);
    const pathname = parsed.pathname.replace(/\/$/, "");
    parsed.pathname =
      pathname === "/api" || pathname.endsWith("/api")
        ? pathname
        : `${pathname}/api`.replace(/\/+/g, "/");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return `${baseWithoutGraphql}/api`.replace(/\/+/g, "/");
  }
}

export function toApiUrl(pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const pathWithoutDuplicateApiPrefix =
    normalizedPath === "/api"
      ? ""
      : normalizedPath.startsWith("/api/")
        ? normalizedPath.slice(4)
        : normalizedPath;

  return `${getApiBaseUrl()}${pathWithoutDuplicateApiPrefix}`;
}

export function toApiAuthUrl(pathname: "/refresh" | "/logout") {
  return toApiUrl(`/auth${pathname}`);
}

export const getRefreshUrl = () => toApiAuthUrl("/refresh");
export const getLogoutUrl = () => toApiAuthUrl("/logout");

const normalizeLocalUploadPath = (pathname: string) => {
  if (pathname.startsWith("/api/uploads/")) return pathname;
  if (pathname === "/uploads") return "/api/uploads";
  if (pathname.startsWith("/uploads/")) return `/api${pathname}`;
  return pathname;
};

export function toApiAssetUrl(path: string | null | undefined) {
  if (!path) return "";

  const value = String(path).trim();
  if (!value) return "";

  // Local image URIs are resolved by LocalImageView/useLocalImageUrl and must
  // never be rewritten as an HTTP URL.
  if (
    value.startsWith("local-image://") ||
    value.startsWith("data:image") ||
    value.startsWith("blob:")
  ) {
    return value;
  }

  const gqlUrl = getGraphqlUrl();
  const apiBase = getApiBaseUrl();

  if (/^https?:\/\//.test(value)) {
    try {
      const assetUrl = new URL(value);
      const graphqlOrigin = gqlUrl.startsWith("/") ? null : new URL(gqlUrl).origin;

      // The local Fastify upload plugin is mounted at /api, while historical
      // upload responses were emitted as /uploads/*. Repair those URLs only
      // when they point to the same API origin; external/S3 URLs stay intact.
      if (graphqlOrigin && assetUrl.origin === graphqlOrigin) {
        assetUrl.pathname = normalizeLocalUploadPath(assetUrl.pathname);
      }
      return assetUrl.toString();
    } catch {
      return value;
    }
  }

  if (value.startsWith("//")) return value;

  // Windows-style paths can be returned by local upload adapters. Convert
  // them before joining with the API origin so browsers receive a valid URL.
  const safePath = value.replace(/\\/g, "/");
  const normalizedPath = normalizeLocalUploadPath(
    safePath.startsWith("/") ? safePath : `/${safePath}`,
  );

  if (gqlUrl.startsWith("/")) return normalizedPath;

  try {
    const parsedApiBase = new URL(apiBase);
    // Assets outside /uploads should resolve from the API origin, not from the
    // /api route prefix.
    return `${parsedApiBase.origin}${normalizedPath}`;
  } catch {
    return normalizedPath;
  }
}
