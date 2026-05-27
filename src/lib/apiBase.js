const DEFAULT_API_ORIGIN = "http://localhost:4000";

export function getBackendApiBase(viteApiUrl = import.meta.env.VITE_API_URL) {
  const raw = String(viteApiUrl || "").trim();
  if (!raw) return DEFAULT_API_ORIGIN;

  if (raw.startsWith("/")) return "";

  try {
    const parsed = new URL(raw);
    if (parsed.pathname.endsWith("/graphql")) {
      parsed.pathname = parsed.pathname.slice(0, -"/graphql".length) || "/";
    }
    parsed.search = "";
    parsed.hash = "";
    return parsed.pathname === "/"
      ? parsed.origin
      : `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return DEFAULT_API_ORIGIN;
  }
}

export function buildBackendAuthUrl(path) {
  const base = getBackendApiBase();
  const cleanPath = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
