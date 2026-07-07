import { describe, expect, it } from "vitest";

import {
  buildDefenseAccountDefinitions,
  buildDefenseBrandMembershipDefinitions,
  buildSeedSteps,
} from "../../scripts/seedDefenseDemo.js";

describe("defense demo seed contract", () => {
  it("runs shared seeds in dependency order and confirms the customer seed", () => {
    const restaurantId = "507f1f77bcf86cd799439011";
    const steps = buildSeedSteps({ restaurantId, reset: true });

    expect(steps.map((step) => step.script)).toEqual([
      "seedPermissions.js",
      "seedParentRoles.js",
      "seedRoles.js",
      "seedSchedulingAttendanceDemo.js",
      "seedMenuManagementDemo.js",
      "seedCouponPromotionDemo.js",
      "seedCustomerDemoData.js",
    ]);
    expect(steps[3].args).toContain("--reset");
    expect(steps.at(-1).args).toEqual([
      "--confirm",
      `--restaurantId=${restaurantId}`,
    ]);
  });

  it("builds active verified accounts for the business and both branches", () => {
    const primaryRestaurantId = "507f1f77bcf86cd799439011";
    const secondaryRestaurantId = "507f1f77bcf86cd799439012";
    const roleBySlug = new Map(
      ["admin", "manager", "customer", "server"].map((slug) => [
        slug,
        { _id: `${slug}-role` },
      ]),
    );
    const accounts = buildDefenseAccountDefinitions({
      primaryRestaurantId,
      secondaryRestaurantId,
      roleBySlug,
      passwordHash: "hashed-password",
      now: new Date("2026-07-07T00:00:00.000Z"),
    });

    expect(accounts.map((account) => account.email)).toEqual([
      "admin.demo@cohan.local",
      "business.owner.demo@cohan.local",
      "manager.demo@cohan.local",
      "manager.branch2.demo@cohan.local",
      "customer.demo@cohan.local",
      "staff.server.demo@cohan.local",
      "staff.branch2.demo@cohan.local",
    ]);
    expect(accounts.every((account) => account.payload.status === "active")).toBe(true);
    expect(accounts.every((account) => account.payload.emailVerified === true)).toBe(true);
    expect(
      accounts.find((account) => account.email === "business.owner.demo@cohan.local")
        ?.payload.refRestaurants,
    ).toEqual([primaryRestaurantId, secondaryRestaurantId]);
    expect(
      accounts.find((account) => account.email === "manager.demo@cohan.local")
        ?.payload.refRestaurants,
    ).toEqual([primaryRestaurantId]);
    expect(
      accounts.find((account) => account.email === "manager.branch2.demo@cohan.local")
        ?.payload.refRestaurants,
    ).toEqual([secondaryRestaurantId]);
    expect(
      accounts.find((account) => account.email === "customer.demo@cohan.local")
        ?.payload.refRestaurants,
    ).toEqual([primaryRestaurantId]);
  });

  it("assigns owner/admin business scope and one manager per restaurant", () => {
    const brandId = "507f1f77bcf86cd799439010";
    const primaryRestaurantId = "507f1f77bcf86cd799439011";
    const secondaryRestaurantId = "507f1f77bcf86cd799439012";
    const emails = [
      "business.owner.demo@cohan.local",
      "admin.demo@cohan.local",
      "manager.demo@cohan.local",
      "manager.branch2.demo@cohan.local",
      "staff.server.demo@cohan.local",
      "staff.branch2.demo@cohan.local",
    ];
    const userIdByEmail = new Map(emails.map((email, index) => [email, `user-${index}`]));

    const memberships = buildDefenseBrandMembershipDefinitions({
      brandId,
      primaryRestaurantId,
      secondaryRestaurantId,
      userIdByEmail,
    });

    expect(memberships.map(({ email, role, restaurantIds }) => ({
      email,
      role,
      restaurantIds,
    }))).toEqual([
      { email: "business.owner.demo@cohan.local", role: "owner", restaurantIds: [] },
      { email: "admin.demo@cohan.local", role: "admin", restaurantIds: [] },
      { email: "manager.demo@cohan.local", role: "manager", restaurantIds: [primaryRestaurantId] },
      { email: "manager.branch2.demo@cohan.local", role: "manager", restaurantIds: [secondaryRestaurantId] },
      { email: "staff.server.demo@cohan.local", role: "staff", restaurantIds: [primaryRestaurantId] },
      { email: "staff.branch2.demo@cohan.local", role: "staff", restaurantIds: [secondaryRestaurantId] },
    ]);
  });
});
