import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuth,
  FALLBACK_ACCESS_TOKEN_KEY,
  getToken,
  SESSION_ACCESS_TOKEN_KEY,
  setAuth,
} from "./authStorage";

describe("authStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAuth();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores token in memory and sessionStorage without using legacy localStorage keys", () => {
    setAuth({ token: "abc" });

    expect(getToken()).toBe("abc");
    expect(sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBe("abc");
    expect(localStorage.getItem(FALLBACK_ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(sessionStorage.getItem("token")).toBeNull();
  });

  it("restores token from sessionStorage when memory token is empty", () => {
    sessionStorage.setItem(SESSION_ACCESS_TOKEN_KEY, "restored-token");

    expect(getToken()).toBe("restored-token");
  });

  it("falls back to localStorage when privacy mode rejects sessionStorage writes", () => {
    const blockedSessionStorage = {
      getItem: vi.fn(() => {
        throw new Error("sessionStorage blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("sessionStorage blocked");
      }),
      removeItem: vi.fn(() => {
        throw new Error("sessionStorage blocked");
      }),
    } as unknown as Storage;
    vi.spyOn(window, "sessionStorage", "get").mockReturnValue(
      blockedSessionStorage,
    );

    setAuth({ token: "privacy-mode-token" });

    expect(getToken()).toBe("privacy-mode-token");
    expect(localStorage.getItem(FALLBACK_ACCESS_TOKEN_KEY)).toBe(
      "privacy-mode-token",
    );
  });

  it("setAuth without a token removes all access-token storage", () => {
    setAuth({ token: "abc" });
    localStorage.setItem(FALLBACK_ACCESS_TOKEN_KEY, "fallback-token");
    setAuth({ token: null });

    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(FALLBACK_ACCESS_TOKEN_KEY)).toBeNull();
  });

  it("clearAuth removes session token, privacy fallback and legacy keys", () => {
    setAuth({ token: "abc" });
    localStorage.setItem(FALLBACK_ACCESS_TOKEN_KEY, "fallback-token");
    localStorage.setItem("auth_token", "x");
    localStorage.setItem("auth_user", "x");
    localStorage.setItem("auth_remember", "x");
    sessionStorage.setItem("token", "x");
    sessionStorage.setItem("auth_remember_until", "x");

    clearAuth();

    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(FALLBACK_ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(localStorage.getItem("auth_remember")).toBeNull();
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(sessionStorage.getItem("auth_remember_until")).toBeNull();
  });
});
