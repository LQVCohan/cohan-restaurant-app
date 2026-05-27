import { getRefreshUrl } from "@/lib/apiBaseUrl";

let refreshPromise = null;

export async function refreshAccessToken() {
  try {
    const response = await fetch(getRefreshUrl(), {
      method: "POST",
      credentials: "include",
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
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function clearRefreshPromise() {
  refreshPromise = null;
}
