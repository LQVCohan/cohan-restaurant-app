import { describe, expect, it, beforeEach } from "vitest";
import {
  SESSION_ACCESS_TOKEN_KEY,
  clearAuth,
  getToken,
  setAuth,
} from "./authStorage";

describe("authStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAuth();
  });

  it("restores token from sessionStorage after memory token is empty", () => {
    setAuth({ token: "abc" });
    expect(getToken()).toBe("abc");
    expect(sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBe("abc");

    vi.resetModules();
    return import("./authStorage").then((freshStorage) => {
      expect(freshStorage.getToken()).toBe("abc");
      expect(localStorage.getItem("auth_token")).toBeNull();
      expect(sessionStorage.getItem("token")).toBeNull();
    });
  });

  it("clearAuth removes sessionStorage token and legacy keys", () => {
    setAuth({ token: "abc" });
    localStorage.setItem("auth_token", "x");
    localStorage.setItem("auth_user", "x");
    localStorage.setItem("auth_remember", "x");
    sessionStorage.setItem("token", "x");
    sessionStorage.setItem("auth_remember_until", "x");

    clearAuth();

    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(localStorage.getItem("auth_remember")).toBeNull();
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(sessionStorage.getItem("auth_remember_until")).toBeNull();
  });

  it("does not store refresh tokens or new access tokens in localStorage", () => {
    setAuth({ token: "access-only" });

    expect(localStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem("refresh_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });
});
