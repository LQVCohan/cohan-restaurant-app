import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuth,
  getToken,
  SESSION_ACCESS_TOKEN_KEY,
  setAuth,
} from "./authStorage";

describe("authStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAuth();
    vi.restoreAllMocks();
  });

  it("stores token in memory and sessionStorage without using legacy localStorage keys", () => {
    setAuth({ token: "abc" });

    expect(getToken()).toBe("abc");
    expect(sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBe("abc");
    expect(localStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(sessionStorage.getItem("token")).toBeNull();
  });

  it("restores token from sessionStorage when memory token is empty", () => {
    sessionStorage.setItem(SESSION_ACCESS_TOKEN_KEY, "restored-token");

    expect(getToken()).toBe("restored-token");
  });

  it("falls back to private localStorage when sessionStorage rejects writes", () => {
    const nativeSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function setItem(
      key,
      value,
    ) {
      if (this === window.sessionStorage && key === SESSION_ACCESS_TOKEN_KEY) {
        throw new DOMException("Blocked by privacy mode", "SecurityError");
      }
      return nativeSetItem.call(this, key, value);
    });

    setAuth({ token: "private-mobile-token" });

    expect(sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBe(
      "private-mobile-token",
    );
    expect(getToken()).toBe("private-mobile-token");
  });

  it("restores token from the privacy-mode local fallback", () => {
    localStorage.setItem(SESSION_ACCESS_TOKEN_KEY, "local-fallback-token");

    expect(getToken()).toBe("local-fallback-token");
  });

  it("setAuth without a token removes every access token copy", () => {
    sessionStorage.setItem(SESSION_ACCESS_TOKEN_KEY, "session-token");
    localStorage.setItem(SESSION_ACCESS_TOKEN_KEY, "fallback-token");

    setAuth({ token: null });

    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBeNull();
  });

  it("clearAuth removes access tokens and legacy keys", () => {
    setAuth({ token: "abc" });
    localStorage.setItem(SESSION_ACCESS_TOKEN_KEY, "fallback-token");
    localStorage.setItem("auth_token", "x");
    localStorage.setItem("auth_user", "x");
    localStorage.setItem("auth_remember", "x");
    sessionStorage.setItem("token", "x");
    sessionStorage.setItem("auth_remember_until", "x");

    clearAuth();

    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(localStorage.getItem("auth_remember")).toBeNull();
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(sessionStorage.getItem("auth_remember_until")).toBeNull();
  });
});
