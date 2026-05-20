import { describe, expect, it } from "vitest";
import {
  computeRestaurantAvailability,
  getNextOpeningTime,
} from "../../src/services/restaurantAvailability.service.js";

const base = {
  businessStatus: "active",
  publicationStatus: "published",
  operationalStatus: "normal",
  timezone: "Asia/Ho_Chi_Minh",
  weeklyOpeningHours: {
    tuesday: [{ open: "08:00", close: "22:00" }],
    wednesday: [{ open: "09:00", close: "21:00" }],
  },
};

describe("restaurant availability", () => {
  const nowOpen = new Date("2026-05-19T10:00:00+07:00");
  const nowClosed = new Date("2026-05-19T23:30:00+07:00");

  it("next opening tomorrow when today closed", () => {
    const next = getNextOpeningTime(base, nowClosed);
    expect(next).toBe("2026-05-20T02:00:00.000Z");
  });

  it("next opening later today", () => {
    const restaurant = {
      ...base,
      weeklyOpeningHours: {
        tuesday: [
          { open: "08:00", close: "10:00" },
          { open: "18:00", close: "22:00" },
        ],
      },
    };

    expect(getNextOpeningTime(restaurant, new Date("2026-05-19T12:00:00+07:00"))).toBe(
      "2026-05-19T11:00:00.000Z",
    );
  });

  it("overnight slot", () => {
    const restaurant = {
      ...base,
      weeklyOpeningHours: {
        tuesday: [{ open: "18:00", close: "02:00" }],
        wednesday: [{ open: "18:00", close: "02:00" }],
      },
    };

    expect(
      computeRestaurantAvailability(restaurant, { now: new Date("2026-05-19T23:00:00+07:00") }).openingStatus,
    ).toBe("open");
    expect(
      computeRestaurantAvailability(restaurant, { now: new Date("2026-05-20T01:00:00+07:00") }).openingStatus,
    ).toBe("open");
    expect(
      computeRestaurantAvailability(restaurant, { now: new Date("2026-05-20T03:00:00+07:00") }).openingStatus,
    ).toBe("closed");
  });

  it("reserve policy when closed", () => {
    expect(
      computeRestaurantAvailability(
        { ...base, reservationPolicy: { allowWhenClosed: true } },
        { now: nowClosed },
      ).canReserve,
    ).toBe(true);

    expect(
      computeRestaurantAvailability(
        { ...base, reservationPolicy: { allowWhenClosed: false } },
        { now: nowClosed },
      ).canReserve,
    ).toBe(false);
  });

  it("order policy and capability", () => {
    expect(
      computeRestaurantAvailability({ ...base, orderPolicy: { allowWhenClosed: false } }, { now: nowClosed }).canOrder,
    ).toBe(false);
    expect(
      computeRestaurantAvailability({ ...base, capabilities: { acceptsOrders: true } }, { now: nowOpen }).canOrder,
    ).toBe(true);
    expect(
      computeRestaurantAvailability({ ...base, capabilities: { acceptsOrders: false } }, { now: nowOpen }).canOrder,
    ).toBe(false);
  });

  it("paused / maintenance / inactive / hidden / suspended / archived statuses", () => {
    expect(computeRestaurantAvailability({ ...base, operationalStatus: "paused" }).openingStatus).toBe("paused");
    expect(computeRestaurantAvailability({ ...base, operationalStatus: "maintenance" }).openingStatus).toBe("maintenance");
    expect(computeRestaurantAvailability({ ...base, businessStatus: "inactive" }).openingStatus).toBe("inactive");
    expect(computeRestaurantAvailability({ ...base, publicationStatus: "hidden" }).openingStatus).toBe("hidden");
    expect(computeRestaurantAvailability({ ...base, businessStatus: "suspended" }).openingStatus).toBe("suspended");
    expect(computeRestaurantAvailability({ ...base, businessStatus: "archived" }).openingStatus).toBe("archived");
  });
});
