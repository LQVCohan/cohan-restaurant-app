import { describe, expect, it } from "vitest";

import {
  buildScopedDemoMembershipDefinitions,
  customerTypeFromSpending,
  resolveAssignedRestaurantIds,
} from "../../scripts/finalizeDefenseDemoDataset.js";

describe("defense dataset finalization contract", () => {
  const primaryRestaurantId = "507f1f77bcf86cd799439011";
  const secondaryRestaurantId = "507f1f77bcf86cd799439012";
  const brandId = "507f1f77bcf86cd799439010";

  it("keeps only defense restaurant assignments and removes duplicates", () => {
    const ids = resolveAssignedRestaurantIds(
      {
        restaurantForStaff: primaryRestaurantId,
        refRestaurants: [
          primaryRestaurantId,
          secondaryRestaurantId,
          "507f1f77bcf86cd799439099",
        ],
      },
      { primaryRestaurantId, secondaryRestaurantId },
    );

    expect(ids).toEqual([primaryRestaurantId, secondaryRestaurantId]);
  });

  it("builds staff-scope memberships for Staff, HR and Accountant demo users", () => {
    const users = [
      {
        _id: "user-staff",
        email: "staff.cashier.demo@cohan.local",
        restaurantForStaff: primaryRestaurantId,
        refRestaurants: [primaryRestaurantId],
      },
      {
        _id: "user-hr",
        email: "hr.demo@cohan.local",
        refRestaurants: [primaryRestaurantId],
      },
      {
        _id: "user-accountant",
        email: "accountant.demo@cohan.local",
        restaurantForStaff: primaryRestaurantId,
      },
      {
        _id: "user-branch2",
        email: "staff.branch2.demo@cohan.local",
        refRestaurants: [secondaryRestaurantId],
      },
      {
        _id: "user-unscoped",
        email: "staff.unscoped.demo@cohan.local",
        refRestaurants: ["507f1f77bcf86cd799439099"],
      },
    ];

    const memberships = buildScopedDemoMembershipDefinitions({
      brandId,
      primaryRestaurantId,
      secondaryRestaurantId,
      users,
    });

    expect(memberships).toEqual([
      {
        brandId,
        userId: "user-staff",
        email: "staff.cashier.demo@cohan.local",
        role: "staff",
        restaurantIds: [primaryRestaurantId],
        status: "active",
      },
      {
        brandId,
        userId: "user-hr",
        email: "hr.demo@cohan.local",
        role: "staff",
        restaurantIds: [primaryRestaurantId],
        status: "active",
      },
      {
        brandId,
        userId: "user-accountant",
        email: "accountant.demo@cohan.local",
        role: "staff",
        restaurantIds: [primaryRestaurantId],
        status: "active",
      },
      {
        brandId,
        userId: "user-branch2",
        email: "staff.branch2.demo@cohan.local",
        role: "staff",
        restaurantIds: [secondaryRestaurantId],
        status: "active",
      },
    ]);
  });

  it("derives the displayed customer tier from linked order spending", () => {
    expect(customerTypeFromSpending(0)).toBe("NEW");
    expect(customerTypeFromSpending(5_000_000)).toBe("OFTEN");
    expect(customerTypeFromSpending(20_000_000)).toBe("VIP");
  });
});
