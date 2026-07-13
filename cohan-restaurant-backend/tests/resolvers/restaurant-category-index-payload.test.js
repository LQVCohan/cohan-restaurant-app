import { withRestaurantCategoryIndexId } from "../../graphql/resolvers/restaurant/categoryIndexPayload.js";

describe("RestaurantCategoryIndex payload normalization", () => {
  it("preserves an existing id", () => {
    expect(
      withRestaurantCategoryIndexId({ id: "index-1", _id: "mongo-1" }),
    ).toMatchObject({ id: "index-1" });
  });

  it("maps a MongoDB _id to the GraphQL id field", () => {
    const mongoId = { toString: () => "mongo-index-1" };

    expect(withRestaurantCategoryIndexId({ _id: mongoId })).toMatchObject({
      id: "mongo-index-1",
    });
  });

  it("uses the restaurant and time slot as a defensive fallback", () => {
    expect(
      withRestaurantCategoryIndexId(
        { restaurantId: "restaurant-1", timeSlot: "lunch" },
        { restaurantId: "restaurant-1", timeSlot: "lunch" },
      ),
    ).toMatchObject({ id: "restaurant-1:lunch" });
  });
});
