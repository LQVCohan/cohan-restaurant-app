import { beforeEach, describe, expect, it, vi } from "vitest";

const tableMocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  find: vi.fn(),
}));
const authorizationMocks = vi.hoisted(() => ({
  requireAnyRestaurantPermission: vi.fn(),
  requireRestaurantPermission: vi.fn(),
}));

vi.mock("../../models/table.model.js", () => ({
  default: tableMocks,
}));
vi.mock("../../src/services/auth/authorization.service.js", () =>
  authorizationMocks,
);
vi.mock("../../src/services/restaurantAvailability.service.js", () => ({
  computeRestaurantAvailability: vi.fn(() => ({ canView: true })),
}));
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
  },
}));

function tableQueryResult(value = []) {
  return {
    select: vi.fn(() => ({
      sort: vi.fn(() => ({
        limit: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(value),
        })),
      })),
    })),
  };
}

describe("table legacy deposit normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tableMocks.updateMany.mockResolvedValue({ modifiedCount: 0 });
    tableMocks.find.mockReturnValue(tableQueryResult());
    authorizationMocks.requireAnyRestaurantPermission.mockResolvedValue(undefined);
  });

  it("migrates the old 1đ sentinel before returning tables", async () => {
    const { default: tableQueries } = await import(
      "../../graphql/resolvers/table/query.js"
    );

    await tableQueries.tables(
      null,
      { restaurantId: "restaurant-1", floorId: "floor-1", limit: 20 },
      { user: { id: "manager-1" } },
    );

    expect(tableMocks.updateMany).toHaveBeenCalledWith(
      { restaurantId: "restaurant-1", deposit: 1 },
      { $set: { deposit: 0 } },
    );
  });
});
