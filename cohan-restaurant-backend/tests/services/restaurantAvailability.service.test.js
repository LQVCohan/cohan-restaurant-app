import { describe, it, expect } from "vitest";
import { computeRestaurantAvailability } from "../../src/services/restaurantAvailability.service.js";

const base = {
  businessStatus: "active",
  publicationStatus: "published",
  operationalStatus: "normal",
  timezone: "Asia/Ho_Chi_Minh",
  weeklyOpeningHours: { tuesday: [{ open: "08:00", close: "22:00" }] },
};

describe("restaurant availability", () => {
  const nowOpen = new Date("2026-05-19T10:00:00+07:00");
  const nowClosed = new Date("2026-05-19T23:30:00+07:00");

  it("open", () => expect(computeRestaurantAvailability(base, { now: nowOpen }).openingStatus).toBe("open"));
  it("closed", () => expect(computeRestaurantAvailability(base, { now: nowClosed }).openingStatus).toBe("closed"));
  it("paused", () => expect(computeRestaurantAvailability({ ...base, operationalStatus: "paused" }).openingStatus).toBe("paused"));
  it("maintenance", () => expect(computeRestaurantAvailability({ ...base, operationalStatus: "maintenance" }).openingStatus).toBe("maintenance"));
  it("holiday", () => expect(computeRestaurantAvailability({ ...base, specialHours: [{ date: "2026-05-19", isClosed: true, reason: "Nghỉ lễ" }] }, { now: nowOpen }).openingStatus).toBe("holiday"));
  it("inactive", () => expect(computeRestaurantAvailability({ ...base, businessStatus: "inactive" }).openingStatus).toBe("inactive"));
  it("hidden", () => expect(computeRestaurantAvailability({ ...base, publicationStatus: "hidden" }).openingStatus).toBe("hidden"));
  it("suspended", () => expect(computeRestaurantAvailability({ ...base, businessStatus: "suspended" }).openingStatus).toBe("suspended"));
  it("archived", () => expect(computeRestaurantAvailability({ ...base, businessStatus: "archived" }).openingStatus).toBe("archived"));
});
