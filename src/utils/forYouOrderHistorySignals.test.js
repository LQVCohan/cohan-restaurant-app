import { describe, expect, it } from "vitest";
import {
  buildForYouOrderHistorySignals,
  getForYouOrderHistoryScore,
  normalizeForYouOrderHistoryRecords,
} from "./forYouOrderHistorySignals";

const now = new Date("2026-06-01T00:00:00.000Z").getTime();

describe("forYouOrderHistorySignals", () => {
  it("normalizes only recent non-sensitive order item fields", () => {
    const records = normalizeForYouOrderHistoryRecords([
      { menuItemId: "m1", restaurantId: "r1", categoryId: "c1", createdAt: "2026-05-20T00:00:00.000Z", phone: "secret" },
      { menuItemId: "old", restaurantId: "r1", createdAt: "2025-01-01T00:00:00.000Z" },
    ], now);

    expect(records).toEqual([
      { itemId: "m1", restaurantId: "r1", categoryId: "c1", createdAt: "2026-05-20T00:00:00.000Z" },
    ]);
    expect(records[0].phone).toBeUndefined();
  });

  it("scores item, restaurant, and category matches with a cap", () => {
    const signals = buildForYouOrderHistorySignals([
      { menuItemId: "m1", restaurantId: "r1", categoryId: "c1", createdAt: "2026-05-20T00:00:00.000Z" },
    ], now);

    expect(getForYouOrderHistoryScore({ id: "m1", restaurantId: "r1", categoryId: "c1" }, signals)).toBe(4);
    expect(getForYouOrderHistoryScore({ id: "m2", restaurantId: "r1", categoryId: "c1" }, signals)).toBe(2);
    expect(getForYouOrderHistoryScore({ id: "m2", restaurantId: "r2", categoryId: "c2" }, signals)).toBe(0);
  });
});
