import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FOR_YOU_SIGNAL_TTL_DAYS,
  MAX_SIGNAL_ITEMS,
  clearForYouBehaviorSignals,
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

const DAY_MS = 24 * 60 * 60 * 1000;

const makeStoredItem = (overrides = {}) => ({
  id: "dish-stored",
  name: "Món đã lưu",
  restaurantId: "restaurant-stored",
  restaurantName: "Cohan đã lưu",
  categoryId: "category-stored",
  type: "view",
  at: Date.now(),
  ...overrides,
});

const writeStoredSignals = (userId, signals) => {
  window.localStorage.setItem(getForYouBehaviorStorageKey(userId), JSON.stringify(signals));
};

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

  it("exports a 30-day behavior signal TTL", () => {
    expect(FOR_YOU_SIGNAL_TTL_DAYS).toBe(30);
  });

  it("keeps interactions that are still inside the TTL", () => {
    recordForYouItemInteraction("user-1", makeItem(), "view");
    vi.setSystemTime(new Date(Date.now() + (FOR_YOU_SIGNAL_TTL_DAYS - 1) * DAY_MS));

    const signals = readForYouBehaviorSignals("user-1");

    expect(signals.viewedItems).toHaveLength(1);
    expect(signals.viewedItems[0].id).toBe("dish-1");
    expect(signals.restaurantCounts).toEqual({ "restaurant-1": 1 });
    expect(hasForYouBehaviorSignals(signals)).toBe(true);
  });

  it("prunes interactions older than the TTL", () => {
    const oldAt = Date.now() - (FOR_YOU_SIGNAL_TTL_DAYS + 1) * DAY_MS;
    writeStoredSignals("user-1", {
      viewedItems: [makeStoredItem({ id: "old-view", at: oldAt })],
      clickedItems: [makeStoredItem({ id: "old-click", type: "click", at: oldAt })],
      restaurantCounts: { "restaurant-stored": 10 },
      categoryCounts: { "category-stored": 10 },
      itemCounts: { "old-view": 5, "old-click": 5 },
      updatedAt: new Date(oldAt).toISOString(),
    });

    const signals = readForYouBehaviorSignals("user-1");

    expect(signals.viewedItems).toEqual([]);
    expect(signals.clickedItems).toEqual([]);
    expect(signals.restaurantCounts).toEqual({});
    expect(signals.categoryCounts).toEqual({});
    expect(signals.itemCounts).toEqual({});
    expect(hasForYouBehaviorSignals(signals)).toBe(false);
    expect(window.localStorage.getItem(getForYouBehaviorStorageKey("user-1"))).toBeNull();
  });

  it("keeps newest recent interactions first before capping", () => {
    const baseAt = Date.now() - DAY_MS;
    const shuffledItems = Array.from({ length: MAX_SIGNAL_ITEMS + 3 }, (_, index) => (
      makeStoredItem({
        id: `view-${index}`,
        restaurantId: `restaurant-${index}`,
        categoryId: `category-${index}`,
        at: baseAt + index,
      })
    )).reverse();
    writeStoredSignals("user-1", {
      viewedItems: [shuffledItems[10], shuffledItems[0], ...shuffledItems.slice(1, 10), ...shuffledItems.slice(11)],
      clickedItems: [
        makeStoredItem({ id: "click-older", type: "click", at: baseAt + 10 }),
        makeStoredItem({ id: "click-newer", type: "click", at: baseAt + 20 }),
      ],
      restaurantCounts: {},
      categoryCounts: {},
      itemCounts: {},
      updatedAt: new Date().toISOString(),
    });

    const signals = readForYouBehaviorSignals("user-1");

    expect(signals.viewedItems).toHaveLength(MAX_SIGNAL_ITEMS);
    expect(signals.viewedItems[0].id).toBe(`view-${MAX_SIGNAL_ITEMS + 2}`);
    expect(signals.viewedItems[signals.viewedItems.length - 1].id).toBe("view-3");
    expect(signals.viewedItems.some((item) => item.id === "view-0")).toBe(false);
    expect(signals.viewedItems.some((item) => item.id === "view-1")).toBe(false);
    expect(signals.viewedItems.some((item) => item.id === "view-2")).toBe(false);
    expect(signals.clickedItems.map((item) => item.id)).toEqual(["click-newer", "click-older"]);
  });

  it("keeps storage key when at least one recent signal remains", () => {
    const oldAt = Date.now() - (FOR_YOU_SIGNAL_TTL_DAYS + 1) * DAY_MS;
    const recentAt = Date.now() - DAY_MS;
    writeStoredSignals("user-1", {
      viewedItems: [
        makeStoredItem({ id: "old-view", restaurantId: "old-restaurant", categoryId: "old-category", at: oldAt }),
        makeStoredItem({ id: "recent-view", restaurantId: "recent-restaurant", categoryId: "recent-category", at: recentAt }),
      ],
      clickedItems: [],
      restaurantCounts: { "old-restaurant": 1, "recent-restaurant": 1 },
      categoryCounts: { "old-category": 1, "recent-category": 1 },
      itemCounts: { "old-view": 1, "recent-view": 1 },
      updatedAt: new Date().toISOString(),
    });

    const signals = readForYouBehaviorSignals("user-1");
    const storedSignals = JSON.parse(window.localStorage.getItem(getForYouBehaviorStorageKey("user-1")));

    expect(signals.viewedItems.map((item) => item.id)).toEqual(["recent-view"]);
    expect(storedSignals.viewedItems.map((item) => item.id)).toEqual(["recent-view"]);
    expect(storedSignals.restaurantCounts).toEqual({ "recent-restaurant": 1 });
  });

  it("rebuilds count maps from recent interactions after pruning old ones", () => {
    const oldAt = Date.now() - (FOR_YOU_SIGNAL_TTL_DAYS + 1) * DAY_MS;
    const recentAt = Date.now() - 5 * DAY_MS;
    writeStoredSignals("user-1", {
      viewedItems: [
        makeStoredItem({ id: "old-view", restaurantId: "old-restaurant", categoryId: "old-category", at: oldAt }),
        makeStoredItem({ id: "recent-view", restaurantId: "recent-restaurant", categoryId: "recent-category", at: recentAt }),
      ],
      clickedItems: [
        makeStoredItem({ id: "old-click", restaurantId: "old-restaurant", categoryId: "old-category", type: "click", at: oldAt }),
        makeStoredItem({ id: "recent-order", restaurantId: "recent-restaurant", categoryId: "recent-category", type: "order_intent", at: recentAt }),
      ],
      restaurantCounts: { "old-restaurant": 99, "recent-restaurant": 99 },
      categoryCounts: { "old-category": 99, "recent-category": 99 },
      itemCounts: { "old-view": 99, "old-click": 99, "recent-view": 99, "recent-order": 99 },
      updatedAt: new Date().toISOString(),
    });

    const signals = readForYouBehaviorSignals("user-1");

    expect(signals.viewedItems.map((item) => item.id)).toEqual(["recent-view"]);
    expect(signals.clickedItems.map((item) => item.id)).toEqual(["recent-order"]);
    expect(signals.restaurantCounts).toEqual({ "recent-restaurant": 3 });
    expect(signals.categoryCounts).toEqual({ "recent-category": 3 });
    expect(signals.itemCounts).toEqual({ "recent-view": 1, "recent-order": 2 });
    expect(signals.restaurantCounts).not.toHaveProperty("old-restaurant");
    expect(signals.categoryCounts).not.toHaveProperty("old-category");
    expect(signals.itemCounts).not.toHaveProperty("old-view");
    expect(signals.itemCounts).not.toHaveProperty("old-click");
  });

  it("persists pruned signals after reading old stored data", () => {
    const oldAt = Date.now() - (FOR_YOU_SIGNAL_TTL_DAYS + 1) * DAY_MS;
    const recentAt = Date.now() - DAY_MS;
    writeStoredSignals("user-1", {
      viewedItems: [
        makeStoredItem({ id: "old-view", restaurantId: "old-restaurant", categoryId: "old-category", at: oldAt }),
        makeStoredItem({ id: "recent-view", restaurantId: "recent-restaurant", categoryId: "recent-category", at: recentAt }),
      ],
      clickedItems: [],
      restaurantCounts: { "old-restaurant": 1, "recent-restaurant": 1 },
      categoryCounts: { "old-category": 1, "recent-category": 1 },
      itemCounts: { "old-view": 1, "recent-view": 1 },
      updatedAt: new Date().toISOString(),
    });

    readForYouBehaviorSignals("user-1");

    const storedSignals = JSON.parse(window.localStorage.getItem(getForYouBehaviorStorageKey("user-1")));
    expect(storedSignals.viewedItems.map((item) => item.id)).toEqual(["recent-view"]);
    expect(storedSignals.restaurantCounts).toEqual({ "recent-restaurant": 1 });
    expect(storedSignals.categoryCounts).toEqual({ "recent-category": 1 });
    expect(storedSignals.itemCounts).toEqual({ "recent-view": 1 });
  });

  it("caps behavior score at 3 with same item, restaurant, and category signals", () => {
    recordForYouItemInteraction("user-1", makeItem(), "click");
    const signals = readForYouBehaviorSignals("user-1");

    expect(getForYouBehaviorScore(makeItem(), signals)).toBe(3);
    expect(getForYouBehaviorScore(makeItem({ id: "dish-2" }), signals)).toBe(2);
    expect(getForYouBehaviorScore(makeItem({ id: "dish-3", restaurantId: "restaurant-2", categoryId: "category-2" }), signals)).toBe(0);
  });

  it("clears behavior signals for the selected user", () => {
    recordForYouItemInteraction("user-1", makeItem(), "click");

    const clearedSignals = clearForYouBehaviorSignals("user-1");

    expect(clearedSignals).toEqual({
      viewedItems: [],
      clickedItems: [],
      restaurantCounts: {},
      categoryCounts: {},
      itemCounts: {},
      updatedAt: null,
    });
    expect(readForYouBehaviorSignals("user-1")).toEqual(clearedSignals);
  });

  it("only clears the user-scoped behavior key", () => {
    recordForYouItemInteraction("user-1", makeItem({ id: "dish-user-1" }), "click");
    recordForYouItemInteraction("user-2", makeItem({ id: "dish-user-2" }), "click");

    clearForYouBehaviorSignals("user-1");

    expect(window.localStorage.getItem(getForYouBehaviorStorageKey("user-1"))).toBeNull();
    expect(window.localStorage.getItem(getForYouBehaviorStorageKey("user-2"))).toBeTruthy();
    expect(hasForYouBehaviorSignals(readForYouBehaviorSignals("user-2"))).toBe(true);
  });

  it("does not crash when clearing while storage is unavailable", () => {
    const storageSpy = vi.spyOn(window.localStorage.__proto__, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    expect(() => clearForYouBehaviorSignals("user-1")).not.toThrow();
    expect(clearForYouBehaviorSignals("user-1")).toEqual({
      viewedItems: [],
      clickedItems: [],
      restaurantCounts: {},
      categoryCounts: {},
      itemCounts: {},
      updatedAt: null,
    });

    storageSpy.mockRestore();
  });

  it("reports no behavior signals after clearing", () => {
    recordForYouItemInteraction("user-1", makeItem(), "view");
    const clearedSignals = clearForYouBehaviorSignals("user-1");

    expect(hasForYouBehaviorSignals(clearedSignals)).toBe(false);
    expect(hasForYouBehaviorSignals(readForYouBehaviorSignals("user-1"))).toBe(false);
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
