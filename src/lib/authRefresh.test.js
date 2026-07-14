import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRefreshPromise,
  refreshAccessTokenOnce,
  STALE_AUTH_REFRESH_CODE,
  TRANSIENT_AUTH_REFRESH_CODE,
} from "./authRefresh";
import {
  clearAuth,
  getToken,
  setAuth,
  subscribeAuthSession,
} from "./authStorage";

function createDeferred() {
  let resolve;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe("auth refresh session isolation", () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearAuth();
    clearRefreshPromise();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    clearRefreshPromise();
    clearAuth();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps a newly logged-in token when an older refresh fails late", async () => {
    const oldRefresh = createDeferred();
    fetch.mockReturnValueOnce(oldRefresh.promise);

    setAuth({ token: "expired-token" });
    const oldPromise = refreshAccessTokenOnce();
    const oldRefreshSignal = fetch.mock.calls[0][1].signal;

    expect(oldRefreshSignal.aborted).toBe(false);
    clearRefreshPromise();
    expect(oldRefreshSignal.aborted).toBe(true);

    setAuth({ token: "new-login-token" });
    oldRefresh.resolve({ ok: false });

    await expect(oldPromise).rejects.toMatchObject({
      code: STALE_AUTH_REFRESH_CODE,
    });
    expect(getToken()).toBe("new-login-token");
  });

  it("does not let an older successful refresh overwrite a new login", async () => {
    const oldRefresh = createDeferred();
    fetch.mockReturnValueOnce(oldRefresh.promise);

    setAuth({ token: "expired-token" });
    const oldPromise = refreshAccessTokenOnce();

    clearRefreshPromise();
    setAuth({ token: "new-login-token" });
    oldRefresh.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        token: "old-refreshed-token",
        user: { id: "old-user" },
      }),
    });

    await expect(oldPromise).rejects.toMatchObject({
      code: STALE_AUTH_REFRESH_CODE,
    });
    expect(getToken()).toBe("new-login-token");
  });

  it("does not let an older promise finalizer clear the active refresh", async () => {
    const oldRefresh = createDeferred();
    const activeRefresh = createDeferred();
    fetch
      .mockReturnValueOnce(oldRefresh.promise)
      .mockReturnValueOnce(activeRefresh.promise);

    setAuth({ token: "expired-token" });
    const oldPromise = refreshAccessTokenOnce();

    clearRefreshPromise();
    setAuth({ token: "new-login-token" });
    const activePromise = refreshAccessTokenOnce();

    oldRefresh.resolve({ ok: false });
    await expect(oldPromise).rejects.toMatchObject({
      code: STALE_AUTH_REFRESH_CODE,
    });

    expect(refreshAccessTokenOnce()).toBe(activePromise);
    expect(fetch).toHaveBeenCalledTimes(2);

    activeRefresh.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        token: "rotated-new-token",
        user: { id: "new-user" },
      }),
    });

    await expect(activePromise).resolves.toMatchObject({
      token: "rotated-new-token",
      user: { id: "new-user" },
    });
  });

  it("preserves the current session when the refresh request has a network failure", async () => {
    setAuth({ token: "still-valid-local-token" });
    fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(refreshAccessTokenOnce()).rejects.toMatchObject({
      code: TRANSIENT_AUTH_REFRESH_CODE,
    });
    expect(getToken()).toBe("still-valid-local-token");
  });

  it("preserves the current session when the auth service returns a temporary server error", async () => {
    setAuth({ token: "token-before-503" });
    fetch.mockResolvedValueOnce({ ok: false, status: 503 });

    await expect(refreshAccessTokenOnce()).rejects.toMatchObject({
      code: TRANSIENT_AUTH_REFRESH_CODE,
      status: 503,
    });
    expect(getToken()).toBe("token-before-503");
  });

  it("publishes and stores a successful refreshed session", async () => {
    const changes = [];
    const unsubscribe = subscribeAuthSession((change) => changes.push(change));
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        token: "fresh-token",
        user: { id: "user-1", fullName: "Nguyễn An" },
      }),
    });

    await expect(refreshAccessTokenOnce()).resolves.toMatchObject({
      token: "fresh-token",
    });

    expect(getToken()).toBe("fresh-token");
    expect(changes).toContainEqual({
      status: "authenticated",
      token: "fresh-token",
      user: { id: "user-1", fullName: "Nguyễn An" },
    });
    unsubscribe();
  });

  it("clears and publishes the session only for an explicit auth rejection", async () => {
    const changes = [];
    const unsubscribe = subscribeAuthSession((change) => changes.push(change));
    setAuth({ token: "expired-token" });
    fetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(refreshAccessTokenOnce()).resolves.toBeNull();
    expect(getToken()).toBeNull();
    expect(changes).toContainEqual({
      status: "anonymous",
      token: null,
      user: null,
      reason: "refresh_rejected",
    });
    unsubscribe();
  });
});
