import { beforeEach, describe, expect, it } from "vitest";
import { clearAuth, clearLegacyAuthStorage, getToken, setAuth } from "./authStorage";

describe("authStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAuth();
  });

  it("keeps access token in memory only", () => {
    setAuth({ token: "abc" });
    expect(getToken()).toBe("abc");
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(sessionStorage.getItem("token")).toBeNull();
  });

  it("clears legacy auth keys", () => {
    ["auth_token", "auth_user", "auth_remember", "token", "auth_remember_until"].forEach((k) => {
      localStorage.setItem(k, "x");
      sessionStorage.setItem(k, "x");
    });
    clearLegacyAuthStorage();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(sessionStorage.getItem("token")).toBeNull();
  });
});
