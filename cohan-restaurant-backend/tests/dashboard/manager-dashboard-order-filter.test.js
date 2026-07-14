import { describe, expect, it } from "vitest";
import { buildDashboardOrderFilter } from "../../graphql/resolvers/dashboard/index.js";

describe("manager dashboard order filtering", () => {
  it("keeps only real order batches or legacy orders", () => {
    expect(
      buildDashboardOrderFilter({
        restaurantId: "restaurant-1",
        currentStatus: { $in: ["pending", "customer_attached"] },
        "items.0": { $exists: true },
      }),
    ).toEqual({
      $and: [
        {
          restaurantId: "restaurant-1",
          currentStatus: { $in: ["pending", "customer_attached"] },
          "items.0": { $exists: true },
        },
        {
          $or: [
            { orderKind: "order_batch" },
            { orderKind: { $exists: false } },
            { orderKind: null },
          ],
        },
      ],
    });
  });
});
