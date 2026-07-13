import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRefreshPromise,
  refreshAccessTokenOnce,
  STALE_AUTH_REFRESH_CODE,
} from "./authRefresh";
import { clearAuth, getToken, setAuth } from "./authStorage";

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
});
