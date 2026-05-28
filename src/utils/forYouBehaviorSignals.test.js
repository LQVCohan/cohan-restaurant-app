import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_SIGNAL_ITEMS,
  getForYouBehaviorScore,
  getForYouBehaviorStorageKey,
  hasForYouBehaviorSignals,
  readForYouBehaviorSignals,
  recordForYouItemInteraction,
} from "./forYouBehaviorSignals";

const makeItem = (overrides = {}) => ({
  id: "dish-1",
  name: "Bún bò",
  restaurantId: "restaurant-1",
  restaurantName: "Cohan Quận 1",
  categoryId: "category-1",
  ...overrides,
});

describe("forYouBehaviorSignals", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("returns a safe default when no behavior has been stored", () => {
    expect(readForYouBehaviorSignals("user-1")).toEqual({
      viewedItems: [],
      clickedItems: [],
      restaurantCounts: {},
      categoryCounts: {},
      itemCounts: {},
      updatedAt: null,
    });
  });

  it("records lightweight item interactions under a user-scoped key", () => {
    const signals = recordForYouItemInteraction("user-1", makeItem(), "click");

    expect(window.localStorage.getItem(getForYouBehaviorStorageKey("user-1"))).toBeTruthy();
    expect(signals.clickedItems).toHaveLength(1);
    expect(signals.clickedItems[0]).toMatchObject({
      id: "dish-1",
      name: "Bún bò",
      restaurantId: "restaurant-1",
      restaurantName: "Cohan Quận 1",
      categoryId: "category-1",
      type: "click",
    });
    expect(signals.restaurantCounts).toEqual({ "restaurant-1": 1 });
    expect(signals.categoryCounts).toEqual({ "category-1": 1 });
    expect(signals.itemCounts).toEqual({ "dish-1": 1 });
    expect(hasForYouBehaviorSignals(signals)).toBe(true);
  });

  it("caps recent item records", () => {
    for (let index = 0; index < MAX_SIGNAL_ITEMS + 5; index += 1) {
      recordForYouItemInteraction("user-1", makeItem({ id: `dish-${index}` }), "view");
    }

    const signals = readForYouBehaviorSignals("user-1");
    expect(signals.viewedItems).toHaveLength(MAX_SIGNAL_ITEMS);
    expect(signals.viewedItems[0].id).toBe(`dish-${MAX_SIGNAL_ITEMS + 4}`);
  });

  it("caps behavior score at 3 with same item, restaurant, and category signals", () => {
    recordForYouItemInteraction("user-1", makeItem(), "click");
    const signals = readForYouBehaviorSignals("user-1");

    expect(getForYouBehaviorScore(makeItem(), signals)).toBe(3);
    expect(getForYouBehaviorScore(makeItem({ id: "dish-2" }), signals)).toBe(2);
    expect(getForYouBehaviorScore(makeItem({ id: "dish-3", restaurantId: "restaurant-2", categoryId: "category-2" }), signals)).toBe(0);
  });

  it("does not crash when localStorage is unavailable", () => {
    const storageSpy = vi.spyOn(window.localStorage.__proto__, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    expect(() => recordForYouItemInteraction("user-1", makeItem(), "view")).not.toThrow();
    expect(readForYouBehaviorSignals("user-1")).toEqual({
      viewedItems: [],
      clickedItems: [],
      restaurantCounts: {},
      categoryCounts: {},
      itemCounts: {},
      updatedAt: null,
    });

    storageSpy.mockRestore();
  });
});
