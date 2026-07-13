const TABLE_VR_ROUTE_PREFIX = "/vr/table/";
const NEW_TAB_PARAM = "openedInNewTab";
const RETURN_TO_PARAM = "returnTo";

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

export const buildTableVrViewerUrl = (vrUrl, { returnTo = "" } = {}) => {
  const raw = String(vrUrl || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw, getOrigin());
    const isInternalViewer =
      parsed.origin === getOrigin() &&
      parsed.pathname.startsWith(TABLE_VR_ROUTE_PREFIX);

    if (!isInternalViewer) return raw;

    parsed.searchParams.set(NEW_TAB_PARAM, "1");
    const safeReturnTo = sanitizeTableVrReturnTo(returnTo);
    if (safeReturnTo) parsed.searchParams.set(RETURN_TO_PARAM, safeReturnTo);

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return raw;
  }
};

export const openTableVrViewerInNewTab = (
  vrUrl,
  { returnTo = "", openWindow } = {},
) => {
  const targetUrl = buildTableVrViewerUrl(vrUrl, { returnTo });
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
  };
};

export const getCurrentPageReturnTo = () => {
  if (typeof window === "undefined") return "";
  return sanitizeTableVrReturnTo(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
};
