vi.mock("../../models/index.js", () => ({
  User: {},
  Table: {},
  Category: {},
  Review: {},
  Brand: {},
  BrandMembership: {},
}));

vi.mock("../../src/services/restaurantAvailability.service.js", () => ({
  computeRestaurantAvailability: vi.fn(() => ({})),
}));

describe("RestaurantCategoryIndex type resolver", () => {
  it("maps lean MongoDB _id values to the non-null GraphQL id field", async () => {
    const { default: restaurantTypes } = await import(
      "../../graphql/resolvers/restaurant/types.js"
    );
    const mongoId = { toString: () => "category-index-1" };

    expect(restaurantTypes.RestaurantCategoryIndex.id({ _id: mongoId })).toBe(
      "category-index-1",
    );
    expect(
      restaurantTypes.RestaurantCategoryIndex.id({ id: "existing-id", _id: mongoId }),
    ).toBe("existing-id");
  });
});
