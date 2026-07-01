import { describe, expect, it, vi } from "vitest";
import { migrateRestaurantManagersToBrandMembership } from "../../scripts/migrate-restaurant-manager-to-brand-membership.js";

const chain = (rows) => ({ select: () => ({ lean: async () => rows }) });
const findOne = (value) => ({ lean: async () => value });

describe("migrateRestaurantManagersToBrandMembership", () => {
  it("reports dry-run creates/updates/skips/conflicts without writing", async () => {
    const updateOne = vi.fn();
    const restaurants = [
      { _id: "r-create", brandId: "b1", managerId: "m1" },
      { _id: "r-update", brandId: "b1", managerId: "m2" },
      { _id: "r-no-brand", managerId: "m3" },
      { _id: "r-no-manager", brandId: "b1" },
      { _id: "r-conflict", brandId: "b1", managerId: "m4" },
    ];
    const models = {
      Restaurant: { find: vi.fn(() => chain(restaurants)) },
      BrandMembership: {
        findOne: vi.fn((query) => {
          if (String(query.restaurantIds || "") === "r-conflict") return findOne({ userId: "other" });
          if (String(query.userId || "") === "m2") return findOne({ userId: "m2" });
          return findOne(null);
        }),
        updateOne,
      },
    };

    const report = await migrateRestaurantManagersToBrandMembership({ models, logger: { log: vi.fn() } });

    expect(report).toMatchObject({ created: 1, updated: 1, skippedNoBrandId: 1, skippedNoManagerId: 1 });
    expect(report.conflicts).toHaveLength(1);
    expect(updateOne).not.toHaveBeenCalled();
  });
});
