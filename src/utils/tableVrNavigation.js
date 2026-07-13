const TABLE_VR_ROUTE_PREFIX = "/vr/table/";
const NEW_TAB_PARAM = "openedInNewTab";
const RETURN_TO_PARAM = "returnTo";
const SOURCE_PARAM = "src";
const IMAGE_EXTENSION_PATTERN = /\.(?:jpe?g|png|webp|avif)(?:$|[?#])/i;

const getOrigin = () =>
  typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "http://localhost";

export const sanitizeTableVrReturnTo = (value) => {
  const raw = String(value || "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "";

  try {
    const parsed = new URL(raw, getOrigin());
    if (parsed.origin !== getOrigin()) return "";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "";
  }
};

export const sanitizeTableVrImageUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return "";
  try {
    const parsed = new URL(raw, getOrigin());
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return raw.startsWith("/") && !raw.startsWith("//")
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : parsed.toString();
  } catch {
    return "";
  }
};

export const normalizeTableVrStoredUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, getOrigin());
    if (parsed.pathname === "/uploads" || parsed.pathname.startsWith("/uploads/")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return raw;
  } catch {
    return raw;
  }
};

export const isTableVrImageUrl = (value) => {
  const safeUrl = sanitizeTableVrImageUrl(value);
  if (!safeUrl) return false;
  try {
    const parsed = new URL(safeUrl, getOrigin());
    return (
      IMAGE_EXTENSION_PATTERN.test(`${parsed.pathname}${parsed.search}`) ||
      parsed.pathname.includes("/uploads/")
    );
  } catch {
    return false;
  }
};

const applyViewerNavigationParams = (parsed, { returnTo = "", imageUrl = "" } = {}) => {
  parsed.searchParams.set(NEW_TAB_PARAM, "1");
  const safeReturnTo = sanitizeTableVrReturnTo(returnTo);
  if (safeReturnTo) parsed.searchParams.set(RETURN_TO_PARAM, safeReturnTo);
  const safeImageUrl = sanitizeTableVrImageUrl(imageUrl);
  if (safeImageUrl) parsed.searchParams.set(SOURCE_PARAM, safeImageUrl);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};

export const buildTableVrViewerUrl = (
  vrUrl,
  { tableId = "", returnTo = "" } = {},
) => {
  const raw = String(vrUrl || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw, getOrigin());
    const isInternalViewer =
      parsed.origin === getOrigin() &&
      parsed.pathname.startsWith(TABLE_VR_ROUTE_PREFIX);

    if (isInternalViewer) {
      return applyViewerNavigationParams(parsed, { returnTo });
    }

    if (tableId && isTableVrImageUrl(raw)) {
      const viewer = new URL(
        `${TABLE_VR_ROUTE_PREFIX}${encodeURIComponent(tableId)}`,
        getOrigin(),
      );
      return applyViewerNavigationParams(viewer, {
        returnTo,
        imageUrl: raw,
      });
    }

    return raw;
  } catch {
    return raw;
  }
};

export const openTableVrViewerInNewTab = (
  vrUrl,
  { tableId = "", returnTo = "", openWindow } = {},
) => {
  const targetUrl = buildTableVrViewerUrl(vrUrl, { tableId, returnTo });
  if (!targetUrl) return null;

  const opener =
    openWindow ||
    (typeof window !== "undefined" ? window.open.bind(window) : null);
  if (!opener) return null;

  return opener(targetUrl, "_blank", "noopener,noreferrer");
};

export const getTableVrViewerNavigation = (search = "") => {
  const params = new URLSearchParams(search);
  return {
    openedInNewTab: params.get(NEW_TAB_PARAM) === "1",
    returnTo: sanitizeTableVrReturnTo(params.get(RETURN_TO_PARAM)),
    imageUrl: sanitizeTableVrImageUrl(params.get(SOURCE_PARAM)),
  };
};

export const getCurrentPageReturnTo = () => {
  if (typeof window === "undefined") return "";
  return sanitizeTableVrReturnTo(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
};
