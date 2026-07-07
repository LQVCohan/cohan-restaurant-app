import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Role: { findById: vi.fn() },
  User: { findById: vi.fn() },
  Restaurant: { find: vi.fn() },
}));
vi.mock("../../models/index.js", () => modelMocks);

const chain = (value) => ({ lean: vi.fn().mockResolvedValue(value) });
const ids = ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"];

describe("User.refRestaurants GraphQL field", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns public customer recent restaurants in original order", async () => {
    modelMocks.Restaurant.find.mockReturnValue(chain([{ _id: ids[1], name: "second" }, { _id: ids[0], name: "first" }]));
    const { default: userTypes } = await import("../../graphql/resolvers/user/types.js");
    const rows = await userTypes.User.refRestaurants({ userType: "CUSTOMER", refRestaurants: ids });
    expect(rows.map((row) => String(row._id))).toEqual(ids);
    expect(modelMocks.Restaurant.find.mock.calls[0][0].$or).toEqual(expect.arrayContaining([
      { businessStatus: "active", publicationStatus: "published" },
      expect.objectContaining({ status: "active" }),
    ]));
  });

  it("does not expose recent history for staff or managers", async () => {
    const { default: userTypes } = await import("../../graphql/resolvers/user/types.js");
    expect(userTypes.User.refRestaurants({ userType: "STAFF", refRestaurants: ids })).toEqual([]);
    expect(modelMocks.Restaurant.find).not.toHaveBeenCalled();
  });
});
