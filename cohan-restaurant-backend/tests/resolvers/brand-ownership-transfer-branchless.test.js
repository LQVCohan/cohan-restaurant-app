import { describe, expect, it } from "vitest";
import { validateBrandMembershipScope } from "../../models/brandMembership.model.js";

describe("branchless owner transfer membership", () => {
  it("allows the previous owner to become chain admin without restaurants", () => {
    expect(validateBrandMembershipScope({ role: "admin", restaurantIds: [] })).toEqual([]);
  });
});
