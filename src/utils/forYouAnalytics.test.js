import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FOR_YOU_ANALYTICS_EVENTS,
  clearForYouAnalyticsEvents,
  getForYouAnalyticsSummary,
  readForYouAnalyticsEvents,
  recordForYouAnalyticsEvent,
  sanitizeForYouAnalyticsPayload,
} from "./forYouAnalytics";

afterEach(() => {
  clearForYouAnalyticsEvents();
  vi.restoreAllMocks();
});

describe("forYouAnalytics", () => {
  it("sanitizes payload to non-sensitive allowlisted fields", () => {
    const payload = sanitizeForYouAnalyticsPayload({
      userId: "u1",
      itemId: "i1",
      restaurantId: "r1",
      categoryId: "c1",
      source: "checkout",
      reasonType: "allergy_warning",
      phone: "secret",
      address: "secret",
      payment: { card: "secret" },
      note: "secret",
      cart: [{ id: "i1" }],
    });

    expect(payload).toEqual({
      userId: "u1",
      itemId: "i1",
      restaurantId: "r1",
      categoryId: "c1",
      source: "checkout",
      reasonType: "allergy_warning",
      timestamp: expect.any(Number),
    });
    expect(payload.phone).toBeUndefined();
    expect(payload.address).toBeUndefined();
    expect(payload.payment).toBeUndefined();
    expect(payload.note).toBeUndefined();
    expect(payload.cart).toBeUndefined();
  });

  it("stores local frontend analytics and summarizes manager-safe counters", () => {
    recordForYouAnalyticsEvent(FOR_YOU_ANALYTICS_EVENTS.VIEW, { source: "for_you" });
    recordForYouAnalyticsEvent(FOR_YOU_ANALYTICS_EVENTS.CARD_CLICK, { itemId: "i1", source: "for_you" });
    recordForYouAnalyticsEvent(FOR_YOU_ANALYTICS_EVENTS.ADD_TO_CART_INTENT, { itemId: "i1", source: "food_detail" });

    expect(readForYouAnalyticsEvents()).toHaveLength(3);
    expect(getForYouAnalyticsSummary()).toEqual({ views: 1, cardClicks: 1, addToCartIntents: 1 });
  });

  it("ignores unknown event names", () => {
    expect(recordForYouAnalyticsEvent("unknown", { phone: "secret" })).toBeNull();
    expect(readForYouAnalyticsEvents()).toEqual([]);
  });
});
