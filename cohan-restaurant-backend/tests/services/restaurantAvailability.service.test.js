import { describe, it, expect } from "vitest";
import { computeRestaurantAvailability } from "../../src/services/restaurantAvailability.service.js";

const base = { businessStatus: "active", publicationStatus: "published", operationalStatus: "normal", timezone: "Asia/Ho_Chi_Minh", weeklyOpeningHours: { tuesday: [{ open: "00:00", close: "23:59" }] } };

describe("computeRestaurantAvailability", () => {
  it("open when active+published+normal in slot", () => {
    const r = computeRestaurantAvailability(base, { now: new Date("2026-05-19T12:00:00+07:00") });
    expect(r.openingStatus).toBe("open");
    expect(r.canOrder).toBe(true);
  });
  it("inactive blocks visibility", () => {
    const r = computeRestaurantAvailability({ ...base, businessStatus: "inactive" });
    expect(r.openingStatus).toBe("inactive");
    expect(r.canView).toBe(false);
  });
});
