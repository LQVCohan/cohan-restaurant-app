import { getToken } from "@/lib/authStorage";

const TABLE_3D_ENDPOINT_RE = /\/table-3d-(assets|ai)\//;
const INSTALL_FLAG = "__cohanTable3DTransportAuthInstalled";

const isTable3DEndpoint = (url) => TABLE_3D_ENDPOINT_RE.test(String(url || ""));

const getRequestUrl = (input) => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return "";
};

const buildAuthHeaders = (input, init = {}) => {
  const headers = new Headers(
    init.headers ||
      (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined),
  );
  const token = getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
};

export function installAuthenticatedTable3DTransport() {
  if (typeof window === "undefined" || window[INSTALL_FLAG]) return;
  window[INSTALL_FLAG] = true;

  const originalFetch = window.fetch?.bind(window);
  if (originalFetch) {
    window.fetch = (input, init = {}) => {
      const url = getRequestUrl(input);
      if (!isTable3DEndpoint(url)) return originalFetch(input, init);

      const headers = buildAuthHeaders(input, init);
      if (typeof Request !== "undefined" && input instanceof Request) {
        return originalFetch(new Request(input, { ...init, headers }));
      }
      return originalFetch(input, { ...init, headers });
    };
  }

  if (typeof XMLHttpRequest === "undefined") return;
  const proto = XMLHttpRequest.prototype;
  const originalOpen = proto.open;
  const originalSend = proto.send;
  const originalSetRequestHeader = proto.setRequestHeader;

  proto.open = function patchedOpen(method, url, ...args) {
    this.__cohanTable3DRequestUrl = String(url || "");
    this.__cohanTable3DRequestHeaders = new Set();
    return originalOpen.call(this, method, url, ...args);
  };

  proto.setRequestHeader = function patchedSetRequestHeader(name, value) {
    this.__cohanTable3DRequestHeaders?.add(String(name || "").toLowerCase());
    return originalSetRequestHeader.call(this, name, value);
  };

  proto.send = function patchedSend(body) {
    if (isTable3DEndpoint(this.__cohanTable3DRequestUrl)) {
      const token = getToken();
      const alreadyHasAuth = this.__cohanTable3DRequestHeaders?.has("authorization");
      if (token && !alreadyHasAuth) {
        try {
          originalSetRequestHeader.call(this, "Authorization", `Bearer ${token}`);
        } catch {
          // Ignore header injection failures and let the request surface its original auth error.
        }
      }
    }
    return originalSend.call(this, body);
  };
}
