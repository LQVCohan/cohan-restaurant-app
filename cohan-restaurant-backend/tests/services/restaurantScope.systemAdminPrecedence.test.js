import { describe, expect, it } from "vitest";
import { isSystemAdmin } from "../../src/services/auth/restaurantScope.service.js";

describe("isSystemAdmin role precedence", () => {
  it("does not treat a current manager role as admin because userType is stale", () => {
    expect(
      isSystemAdmin({ roleName: "manager", userType: "ADMIN" }),
    ).toBe(false);
  });

  it("keeps userType fallback for legacy contexts without a current role", () => {
    expect(isSystemAdmin({ userType: "ADMIN" })).toBe(true);
  });

  it("uses the current admin role even when userType is stale", () => {
    expect(
      isSystemAdmin({ roleName: "admin", userType: "MANAGER" }),
    ).toBe(true);
  });
});
