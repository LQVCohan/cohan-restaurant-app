import { describe, expect, it } from "vitest";
import {
  assertOrderItemPreparationStationAccess,
  resolvePreparationStationScope,
  scopeOrdersForPreparationStation,
  withPreparationStationOrderFilter,
} from "../../graphql/resolvers/order/accessGuard.js";

const mixedOrders = [
  {
    _id: "order-mixed",
    items: [
      { _id: "kitchen-item", prepStation: "kitchen", name: "Phở bò" },
      { _id: "bar-item", prepStation: "bar", name: "Trà đào" },
    ],
  },
  {
    _id: "order-kitchen-only",
    items: [{ _id: "kitchen-2", prepStation: "kitchen", name: "Cơm gà" }],
  },
];

describe("staff preparation station access", () => {
  it("resolves built-in and custom kitchen/bar roles", () => {
    expect(resolvePreparationStationScope({ roleName: "bartender" })).toBe("bar");
    expect(resolvePreparationStationScope({ roleName: "chef" })).toBe("kitchen");
    expect(
      resolvePreparationStationScope({
        roleName: "bar-lead",
        userType: "STAFF",
        department: "bar",
        role: { parentRole: { slug: "staff" } },
      }),
    ).toBe("bar");
    expect(resolvePreparationStationScope({ roleName: "manager" })).toBeNull();
  });

  it("filters orders and items to the authenticated station", () => {
    const result = scopeOrdersForPreparationStation(mixedOrders, {
      roleName: "bartender",
    });

    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("order-mixed");
    expect(result[0].items).toEqual([
      expect.objectContaining({ _id: "bar-item", prepStation: "bar" }),
    ]);
    expect(mixedOrders[0].items).toHaveLength(2);
  });

  it("adds the station predicate only for scoped kitchen/bar roles", () => {
    expect(
      withPreparationStationOrderFilter(
        { restaurantId: "restaurant-1" },
        { roleName: "bartender" },
      ),
    ).toEqual({
      restaurantId: "restaurant-1",
      "items.prepStation": "bar",
    });

    expect(
      withPreparationStationOrderFilter(
        { restaurantId: "restaurant-1" },
        { roleName: "manager" },
      ),
    ).toEqual({ restaurantId: "restaurant-1" });
  });

  it("rejects cross-station item updates", () => {
    expect(() =>
      assertOrderItemPreparationStationAccess(
        { roleName: "bartender" },
        { prepStation: "kitchen" },
      ),
    ).toThrow("Bạn không có quyền xử lý món thuộc khu vực này.");

    expect(() =>
      assertOrderItemPreparationStationAccess(
        { roleName: "bartender" },
        { prepStation: "bar" },
      ),
    ).not.toThrow();
  });
});
