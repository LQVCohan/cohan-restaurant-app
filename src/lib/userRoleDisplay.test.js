import { describe, expect, it } from "vitest";
import { getBrandRoleLabel, getCombinedRoleLabel, getMembershipScopeLabel, getRoleTooltip } from "./userRoleDisplay";

describe("userRoleDisplay", () => {
  it("formats system and brand roles separately", () => {
    const user = { id: "u1", roleName: "manager" };
    const activeBrand = { id: "b1", membershipRole: "owner" };

    expect(getCombinedRoleLabel({ user, activeBrand })).toBe("Chủ chuỗi · Quản lý");
    expect(getCombinedRoleLabel({ user, activeBrand, compact: true })).toBe("Chủ chuỗi");
  });

  it("does not fallback system role into brand role", () => {
    const user = { id: "u1", roleName: "manager" };

    expect(getBrandRoleLabel({ user, activeBrand: { id: "b1" } })).toBeNull();
    expect(getRoleTooltip({ user, activeBrand: { id: "b1" } })).toBe(
      "Cấp tài khoản: Quản lý | Quyền trong chuỗi: Chưa tham gia chuỗi",
    );
  });

  it("detects brand owner from ownerId when membership is missing", () => {
    expect(getBrandRoleLabel({ user: { id: "u1", roleName: "staff" }, activeBrand: { ownerId: "u1" } })).toBe(
      "Chủ chuỗi",
    );
  });
});


it("formats BrandMembership scope labels", () => {
  const restaurants = [{ id: "r1", name: "Cohan Quận 7" }, { id: "r2", name: "Cohan Quận 1" }];

  expect(getBrandRoleLabel({ membership: { role: "owner" } })).toBe("Chủ chuỗi");
  expect(getMembershipScopeLabel({ role: "admin" }, restaurants)).toBe("Tất cả chi nhánh trong chuỗi");
  expect(getMembershipScopeLabel({ role: "admin" }, restaurants, "Cohan Business")).toBe("Tất cả chi nhánh thuộc Cohan Business");
  expect(getBrandRoleLabel({ membership: { role: "manager" } })).toBe("Quản lý chi nhánh");
  expect(getMembershipScopeLabel({ role: "manager", restaurantIds: ["r1"] }, restaurants)).toBe("Cohan Quận 7");
  expect(getBrandRoleLabel({ membership: { role: "staff" } })).toBe("Nhân viên chi nhánh");
  expect(getMembershipScopeLabel({ role: "staff", restaurantIds: ["r1", "r2"] }, restaurants)).toBe("Cohan Quận 7, Cohan Quận 1");
});
