export function getGraphqlUrl() {
  return import.meta.env.VITE_API_URL || "http://localhost:4000/graphql";
}

const stripGraphqlSuffix = (value: string) =>
  String(value || "").replace(/\/graphql\/?$/, "").replace(/\/$/, "");

const stripApiSuffix = (value: string) =>
  String(value || "").replace(/\/api\/?$/, "").replace(/\/$/, "");

export function getBackendRootUrl() {
  const gqlUrl = getGraphqlUrl();
  const baseWithoutGraphql = stripGraphqlSuffix(gqlUrl);

  // Non-GraphQL Fastify routes such as /upload, /upload/sign,
  // /table-3d-assets/upload and /table-3d-ai/generate are mounted at backend
  // root, not under /api. Keep this helper separate from getApiBaseUrl().
  if (!baseWithoutGraphql || baseWithoutGraphql === "/") return "";

  if (baseWithoutGraphql.startsWith("/")) {
    return stripApiSuffix(baseWithoutGraphql);
  }

  try {
    const parsed = new URL(baseWithoutGraphql);
    parsed.pathname = stripApiSuffix(parsed.pathname);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return stripApiSuffix(baseWithoutGraphql);
  }
}

export function toBackendRootUrl(pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getBackendRootUrl()}${normalizedPath}`;
}

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
  // upload.route.js is currently exposed by Fastify at /uploads/*.
  // Older frontend code incorrectly rewrote those assets to /api/uploads/*,
  // which produces a 404 even when the file exists on disk.
  if (pathname === "/api/uploads") return "/uploads";
  if (pathname.startsWith("/api/uploads/")) return pathname.slice(4);
  if (pathname === "/uploads" || pathname.startsWith("/uploads/")) return pathname;
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
  const backendRoot = getBackendRootUrl();

  if (/^https?:\/\//.test(value)) {
    try {
      const assetUrl = new URL(value);
      const graphqlOrigin = gqlUrl.startsWith("/") ? null : new URL(gqlUrl).origin;

      // Normalize only same-origin local upload URLs. External object storage
      // and CDN URLs must remain unchanged.
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
  // them before joining with the backend origin so browsers receive a valid URL.
  const safePath = value.replace(/\\/g, "/");
  const normalizedPath = normalizeLocalUploadPath(
    safePath.startsWith("/") ? safePath : `/${safePath}`,
  );

  if (gqlUrl.startsWith("/")) return normalizedPath;

  try {
    const parsedBackendRoot = new URL(backendRoot || gqlUrl);
    return `${parsedBackendRoot.origin}${normalizedPath}`;
  } catch {
    return normalizedPath;
  }
}
