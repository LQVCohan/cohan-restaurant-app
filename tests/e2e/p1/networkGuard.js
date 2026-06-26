const DEFAULT_MONITORED_URL_PARTS = ["/graphql", "/api/"];

const EXPECTED_AUTH_REFRESH_STATUSES = new Set([204, 401]);

const toSafeUrl = (url) => {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return String(url).split("?")[0];
  }
};

const matchesUrl = (url, matcher) => {
  if (typeof matcher === "string") return url.includes(matcher);
  return matcher.test(url);
};

const isJsonResponse = (response) => {
  const contentType = response.headers()["content-type"] || "";
  return contentType.toLowerCase().includes("application/json");
};

const isExpectedAuthRefresh = (response) => {
  const url = response.url();
  return url.includes("/api/auth/refresh") && EXPECTED_AUTH_REFRESH_STATUSES.has(response.status());
};

const getOperationName = (request) => {
  try {
    const payload = request.postDataJSON();
    if (Array.isArray(payload)) {
      return payload.map((entry) => entry?.operationName).filter(Boolean).join(", ") || null;
    }
    return payload?.operationName || null;
  } catch {
    return null;
  }
};

const normalizeGraphqlErrors = (body) => {
  const entries = Array.isArray(body) ? body : [body];
  return entries.flatMap((entry) => {
    if (!Array.isArray(entry?.errors)) return [];
    return entry.errors.map((error) => error?.message || JSON.stringify(error));
  });
};

const formatFailure = (failure, index) => {
  const operation = failure.operationName ? ` (${failure.operationName})` : "";
  const status = failure.status ? ` status=${failure.status}` : "";
  const messages = failure.messages?.length ? ` :: ${failure.messages.join(" | ")}` : "";
  return `${index + 1}. [${failure.kind}] ${failure.method} ${failure.url}${operation}${status}${messages}`;
};

export function installP1NetworkGuard(page, options = {}) {
  const monitoredUrlParts = options.monitoredUrlParts || DEFAULT_MONITORED_URL_PARTS;
  const failures = [];

  const shouldWatch = (url) => monitoredUrlParts.some((matcher) => matchesUrl(url, matcher));

  const record = (failure) => {
    failures.push({ ...failure, at: new Date().toISOString() });
  };

  page.on("requestfailed", (request) => {
    if (!shouldWatch(request.url())) return;

    record({
      kind: "requestfailed",
      method: request.method(),
      url: toSafeUrl(request.url()),
      operationName: getOperationName(request),
      messages: [request.failure()?.errorText || "request failed"],
    });
  });

  page.on("response", async (response) => {
    if (!shouldWatch(response.url())) return;
    if (isExpectedAuthRefresh(response)) return;
    if (options.ignoreResponse?.(response)) return;

    const request = response.request();
    const status = response.status();
    const baseFailure = {
      method: request.method(),
      url: toSafeUrl(response.url()),
      operationName: getOperationName(request),
      status,
    };

    if (status >= 400) {
      record({
        ...baseFailure,
        kind: "http",
        messages: [response.statusText() || `HTTP ${status}`],
      });
    }

    if (!isJsonResponse(response)) return;

    const body = await response.json().catch(() => null);
    const graphqlErrors = normalizeGraphqlErrors(body);
    if (graphqlErrors.length > 0) {
      record({
        ...baseFailure,
        kind: "graphql",
        messages: graphqlErrors,
      });
    }
  });

  return {
    failures,
    clear() {
      failures.length = 0;
    },
    assertNoBackendErrors(label = "P1 backend/network guard") {
      if (failures.length === 0) return;
      throw new Error(`${label} detected ${failures.length} backend/network failure(s):\n${failures.map(formatFailure).join("\n")}`);
    },
  };
}
