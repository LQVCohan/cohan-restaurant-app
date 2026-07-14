import { getRefreshUrl } from "@/lib/apiBaseUrl";
import { publishAuthenticatedSession } from "@/lib/authStorage";

export const STALE_AUTH_REFRESH_CODE = "STALE_AUTH_REFRESH";
export const TRANSIENT_AUTH_REFRESH_CODE = "TRANSIENT_AUTH_REFRESH";

let refreshPromise = null;
let refreshAbortController = null;
let refreshGeneration = 0;

function createStaleAuthRefreshError() {
  const error = new Error("Auth refresh belongs to an inactive session");
  error.code = STALE_AUTH_REFRESH_CODE;
  return error;
}

function createTransientAuthRefreshError(message, status = null, cause = null) {
  const error = new Error(message || "Authentication service is temporarily unavailable");
  error.code = TRANSIENT_AUTH_REFRESH_CODE;
  error.status = status;
  if (cause) error.cause = cause;
  return error;
}

export function isTransientAuthRefreshError(error) {
  return error?.code === TRANSIENT_AUTH_REFRESH_CODE;
}

export async function refreshAccessToken({ signal } = {}) {
  let response;
  try {
    response = await fetch(getRefreshUrl(), {
      method: "POST",
      credentials: "include",
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw createTransientAuthRefreshError(
      "Không thể kết nối dịch vụ xác thực. Phiên hiện tại được giữ nguyên.",
      null,
      error,
    );
  }

  if (response.status === 401 || response.status === 403) return null;

  if (!response.ok) {
    throw createTransientAuthRefreshError(
      `Dịch vụ xác thực tạm thời phản hồi lỗi ${response.status || "không xác định"}.`,
      response.status || null,
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw createTransientAuthRefreshError(
      "Phản hồi khôi phục phiên không hợp lệ. Phiên hiện tại được giữ nguyên.",
      response.status,
      error,
    );
  }

  if (!payload?.token) {
    throw createTransientAuthRefreshError(
      "Dịch vụ xác thực chưa trả về token mới. Phiên hiện tại được giữ nguyên.",
      response.status,
    );
  }

  return {
    token: payload.token,
    user: payload.user,
  };
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
          throw createStaleAuthRefreshError();
        }

        // A missing/blocked refresh cookie does not prove that the access token
        // already stored by the browser is invalid. The request that receives
        // an actual access-token 401 decides when the session must be cleared.
        if (payload?.token) publishAuthenticatedSession(payload);
        return payload;
      })
      .catch((error) => {
        if (generation !== refreshGeneration) {
          throw createStaleAuthRefreshError();
        }
        throw error;
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
