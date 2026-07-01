import { describe, expect, it } from "vitest";
import { validateBrandMembershipScope } from "../../models/brandMembership.model.js";

describe("validateBrandMembershipScope", () => {
  it("requires exactly one restaurant for manager", () => {
    expect(() => validateBrandMembershipScope({ role: "manager", restaurantIds: [] })).toThrow("đúng 1 nhà hàng");
    expect(() => validateBrandMembershipScope({ role: "manager", restaurantIds: ["r1", "r2"] })).toThrow("đúng 1 nhà hàng");
    expect(validateBrandMembershipScope({ role: "manager", restaurantIds: ["r1"] })).toEqual(["r1"]);
  });

  it("allows admin brand-wide scope without restaurantIds", () => {
    expect(validateBrandMembershipScope({ role: "admin", restaurantIds: ["ignored"] })).toEqual([]);
  });

  it("requires at least one restaurant for staff", () => {
    expect(() => validateBrandMembershipScope({ role: "staff", restaurantIds: [] })).toThrow("ít nhất 1 nhà hàng");
    expect(validateBrandMembershipScope({ role: "staff", restaurantIds: ["r1", "r2"] })).toEqual(["r1", "r2"]);
  });
});
