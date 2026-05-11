import {
  clearAuth,
  getAuthUser,
  getToken,
  setAuth,
} from "../authStorage.ts";

describe("authStorage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearAuth();
  });

  it("stores and restores auth data from browser storage", () => {
    setAuth({
      token: "browser-token",
      user: { id: "u-1", roleName: "customer" },
      remember: true,
    });

    expect(getToken()).toBe("browser-token");
    expect(getAuthUser()).toEqual({ id: "u-1", roleName: "customer" });
  });

  it("falls back to in-memory storage when Safari blocks web storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });

    setAuth({
      token: "memory-token",
      user: { id: "u-2", roleName: "manager" },
      remember: true,
    });

    expect(getToken()).toBe("memory-token");
    expect(getAuthUser()).toEqual({ id: "u-2", roleName: "manager" });

    clearAuth();
    expect(getToken()).toBeNull();
    expect(getAuthUser()).toBeNull();
  });
});
