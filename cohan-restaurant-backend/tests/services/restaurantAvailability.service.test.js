import { describe, it, expect } from "vitest";
import { computeRestaurantAvailability, getNextOpeningTime } from "../../src/services/restaurantAvailability.service.js";

const base = {
  businessStatus: "active",
  publicationStatus: "published",
  operationalStatus: "normal",
  timezone: "Asia/Ho_Chi_Minh",
  weeklyOpeningHours: { tuesday: [{ open: "08:00", close: "22:00" }], wednesday: [{ open: "09:00", close: "21:00" }] },
};

describe("restaurant availability", () => {
  const nowOpen = new Date("2026-05-19T10:00:00+07:00");
  const nowClosed = new Date("2026-05-19T23:30:00+07:00");

  it("next opening tomorrow when today closed", () => {
    const next = getNextOpeningTime(base, nowClosed);
    expect(next).toBeTruthy();
  });
  it("next opening later today", () => {
    const r = { ...base, weeklyOpeningHours: { tuesday: [{ open: "08:00", close: "10:00" }, { open: "18:00", close: "22:00" }] } };
    expect(getNextOpeningTime(r, new Date("2026-05-19T12:00:00+07:00"))).toBeTruthy();
  });
  it("overnight slot", () => {
    const r = { ...base, weeklyOpeningHours: { tuesday: [{ open: "18:00", close: "02:00" }], wednesday: [{ open: "18:00", close: "02:00" }] } };
    expect(computeRestaurantAvailability(r, { now: new Date("2026-05-19T23:00:00+07:00") }).openingStatus).toBe("open");
    expect(computeRestaurantAvailability(r, { now: new Date("2026-05-20T01:00:00+07:00") }).openingStatus).toBe("open");
    expect(computeRestaurantAvailability(r, { now: new Date("2026-05-20T03:00:00+07:00") }).openingStatus).toBe("closed");
  });
  it("reserve policy when closed", () => {
    expect(computeRestaurantAvailability({ ...base, reservationPolicy: { allowWhenClosed: true } }, { now: nowClosed }).canReserve).toBe(true);
    expect(computeRestaurantAvailability({ ...base, reservationPolicy: { allowWhenClosed: false } }, { now: nowClosed }).canReserve).toBe(false);
  });
  it("order policy and capability", () => {
    expect(computeRestaurantAvailability({ ...base, orderPolicy: { allowWhenClosed: false } }, { now: nowClosed }).canOrder).toBe(false);
    expect(computeRestaurantAvailability({ ...base, capabilities: { acceptsOrders: true } }, { now: nowOpen }).canOrder).toBe(true);
    expect(computeRestaurantAvailability({ ...base, capabilities: { acceptsOrders: false } }, { now: nowOpen }).canOrder).toBe(false);
  });
});
