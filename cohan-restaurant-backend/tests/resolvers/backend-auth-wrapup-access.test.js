import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  User: {},
  Staff: { aggregate: vi.fn() },
  BrandMembership: {},
  MenuItem: { aggregate: vi.fn() },
  Restaurant: { find: vi.fn(), aggregate: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);

describe("backend authorization wrap-up", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.Staff.aggregate.mockResolvedValue([]);
  });

  it("keeps search suggestions intentionally public", async () => {
    modelMocks.Restaurant.find.mockReturnValue({
      limit: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({ lean: vi.fn(async () => []) }),
      }),
    });
    modelMocks.MenuItem.aggregate.mockResolvedValue([]);
    modelMocks.Restaurant.aggregate.mockResolvedValue([]);

    const searchQueryResolvers = (await import("../../graphql/resolvers/search/query.js")).default;

    const result = await searchQueryResolvers.searchSuggestions(
      null,
      { query: "pho", limit: 3 },
      {},
    );

    expect(result).toEqual({
      restaurants: [],
      menuItems: [],
      chefs: [],
      locations: [],
      owners: [],
    });
  });
});
