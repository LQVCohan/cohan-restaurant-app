import { describe, expect, it } from "vitest";

import {
  buildDefenseAccountDefinitions,
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

  it("builds active verified accounts with the expected role and restaurant scope", () => {
    const restaurantId = "507f1f77bcf86cd799439011";
    const roleBySlug = new Map(
      ["admin", "manager", "customer", "server"].map((slug) => [
        slug,
        { _id: `${slug}-role` },
      ]),
    );
    const accounts = buildDefenseAccountDefinitions({
      restaurantId,
      roleBySlug,
      passwordHash: "hashed-password",
      now: new Date("2026-07-07T00:00:00.000Z"),
    });

    expect(accounts.map((account) => account.email)).toEqual([
      "admin.demo@cohan.local",
      "manager.demo@cohan.local",
      "customer.demo@cohan.local",
      "staff.server.demo@cohan.local",
    ]);
    expect(accounts.every((account) => account.payload.status === "active")).toBe(true);
    expect(accounts.every((account) => account.payload.emailVerified === true)).toBe(true);
    expect(accounts.find((account) => account.email.startsWith("manager"))?.payload.refRestaurants).toEqual([restaurantId]);
    expect(accounts.find((account) => account.email.startsWith("customer"))?.payload.refRestaurants).toEqual([restaurantId]);
  });
});
