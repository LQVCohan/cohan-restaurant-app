import { describe, expect, it } from "vitest";

import {
  buildDefenseAccountTypeRepair,
  expectedDefenseUserType,
} from "../../scripts/repairDefenseAccountDiscriminators.js";

describe("defense account discriminator repair", () => {
  it("maps every defense account family to its real user type", () => {
    expect(expectedDefenseUserType("admin.demo@cohan.local")).toBe("ADMIN");
    expect(expectedDefenseUserType("business.owner.demo@cohan.local")).toBe(
      "MANAGER",
    );
    expect(expectedDefenseUserType("manager.demo@cohan.local")).toBe(
      "MANAGER",
    );
    expect(expectedDefenseUserType("manager.branch2.demo@cohan.local")).toBe(
      "MANAGER",
    );
    expect(expectedDefenseUserType("hr.demo@cohan.local")).toBe("HR");
    expect(expectedDefenseUserType("accountant.demo@cohan.local")).toBe(
      "ACCOUNTANT",
    );
    expect(expectedDefenseUserType("staff.chef.demo@cohan.local")).toBe(
      "STAFF",
    );
    expect(expectedDefenseUserType("customer.demo@cohan.local")).toBe(
      "CUSTOMER",
    );
    expect(expectedDefenseUserType("customer@example.com")).toBeNull();
  });

  it("removes customer-only fields when a manager was stored as CUSTOMER", () => {
    const update = buildDefenseAccountTypeRepair({
      email: "manager.demo@cohan.local",
      userType: "CUSTOMER",
    });

    expect(update.$set.userType).toBe("MANAGER");
    expect(update.$unset).toMatchObject({
      customerType: "",
      totalOrders: "",
      totalSpending: "",
      isGuest: "",
      foodPreferences: "",
    });
  });

  it("keeps customer profile fields for the actual customer account", () => {
    const update = buildDefenseAccountTypeRepair({
      email: "customer.demo@cohan.local",
      userType: "CUSTOMER",
    });

    expect(update).toEqual({ $set: { userType: "CUSTOMER" } });
  });
});
