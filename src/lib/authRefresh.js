import { getRefreshUrl } from "@/lib/apiBaseUrl";
import { getToken } from "@/lib/authStorage";

let refreshPromise = null;
let refreshAbortController = null;
let refreshGeneration = 0;

function getCurrentSessionPayload() {
  const token = getToken();
  return token ? { token, user: undefined, stale: true } : null;
}

export async function refreshAccessToken({ signal } = {}) {
  try {
    const response = await fetch(getRefreshUrl(), {
      method: "POST",
      credentials: "include",
      signal,
    });

    if (!response.ok) return null;

    const payload = await response.json();
    if (!payload?.token) return null;

    return {
      token: payload.token,
      user: payload.user,
    };
  } catch {
    return null;
  }
}

export function refreshAccessTokenOnce() {
  if (!refreshPromise) {
    const generation = refreshGeneration;
    const controller =
      typeof AbortController === "function" ? new AbortController() : null;
    refreshAbortController = controller;

    const pendingRefresh = refreshAccessToken({ signal: controller?.signal })
      .then((payload) => {
        if (generation !== refreshGeneration) {
          return getCurrentSessionPayload();
        }
        return payload;
      })
      .finally(() => {
        if (refreshPromise === pendingRefresh) {
          refreshPromise = null;
        }
        if (refreshAbortController === controller) {
          refreshAbortController = null;
        }
      });

    refreshPromise = pendingRefresh;
  }
  return refreshPromise;
}

export function clearRefreshPromise() {
  refreshGeneration += 1;
  refreshAbortController?.abort();
  refreshAbortController = null;
  refreshPromise = null;
}
