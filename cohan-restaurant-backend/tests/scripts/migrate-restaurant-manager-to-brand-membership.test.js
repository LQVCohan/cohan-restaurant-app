import { describe, expect, it, vi } from "vitest";
import { migrateRestaurantManagersToBrandMembership } from "../../scripts/migrate-restaurant-manager-to-brand-membership.js";

const chain = (rows) => ({ select: () => ({ lean: async () => rows }) });

describe("migrateRestaurantManagersToBrandMembership", () => {
  it("assigns unbranded restaurants to the only Brand during dry-run", async () => {
    const updateOne = vi.fn();
    const models = {
      Brand: {
        find: vi.fn(() => chain([{ _id: "b1", ownerId: "owner1", name: "Cohan" }])),
      },
      Restaurant: {
        find: vi.fn(() => chain([
          { _id: "r1", brandId: "b1", managerId: "m1", name: "Branch 1" },
          { _id: "r2", managerId: "m2", name: "Legacy branch" },
        ])),
      },
      User: {
        find: vi.fn(() => chain([])),
      },
      Role: {
        find: vi.fn(() => chain([{ _id: "manager-role", slug: "manager" }])),
      },
      BrandMembership: {
        find: vi.fn(() => chain([])),
        updateOne,
      },
    };

    const logger = { log: vi.fn() };
    const report = await migrateRestaurantManagersToBrandMembership({
      models,
      logger,
    });

    expect(report).toMatchObject({
      ownerCandidates: 1,
      managerCandidates: 2,
      restaurantsAssignedToOnlyBrand: 1,
      conflicts: [],
    });
    expect(updateOne).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("Using database"));
  });
});
