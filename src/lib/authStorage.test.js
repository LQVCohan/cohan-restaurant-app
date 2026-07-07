import { beforeEach, describe, expect, it } from "vitest";
import {
  SESSION_ACCESS_TOKEN_KEY,
  clearAuth,
  setAuth,
} from "./authStorage";

describe("authStorage manager workspace cleanup", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("clears the previous manager page, Brand and restaurant on logout", () => {
    setAuth({ token: "token-1" });
    localStorage.setItem("manager.currentPage", "brands");
    localStorage.setItem("manager.selectedBrandId", "brand-1");
    localStorage.setItem("manager.selectedRestaurantId", "restaurant-1");

    clearAuth();

    expect(sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem("manager.currentPage")).toBeNull();
    expect(localStorage.getItem("manager.selectedBrandId")).toBeNull();
    expect(localStorage.getItem("manager.selectedRestaurantId")).toBeNull();
  });
});
