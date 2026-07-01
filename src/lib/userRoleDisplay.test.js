import { describe, expect, it } from "vitest";
import { getBrandRoleLabel, getCombinedRoleLabel, getRoleTooltip } from "./userRoleDisplay";

describe("userRoleDisplay", () => {
  it("formats system and brand roles separately", () => {
    const user = { id: "u1", roleName: "manager" };
    const activeBrand = { id: "b1", membershipRole: "owner" };

    expect(getCombinedRoleLabel({ user, activeBrand })).toBe("Chủ thương hiệu · Quản lý hệ thống");
  });

  it("does not fallback system role into brand role", () => {
    const user = { id: "u1", roleName: "manager" };

    expect(getBrandRoleLabel({ user, activeBrand: { id: "b1" } })).toBeNull();
    expect(getRoleTooltip({ user, activeBrand: { id: "b1" } })).toBe(
      "Vai trò Brand: Chưa gắn Brand hiện tại | Vai trò hệ thống: Quản lý hệ thống",
    );
  });

  it("detects brand owner from ownerId when membership is missing", () => {
    expect(getBrandRoleLabel({ user: { id: "u1", roleName: "staff" }, activeBrand: { ownerId: "u1" } })).toBe(
      "Chủ thương hiệu",
    );
  });
});
