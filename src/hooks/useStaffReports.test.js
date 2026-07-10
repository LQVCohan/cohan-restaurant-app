import { describe, expect, it } from "vitest";
import { buildStaffReportsInput } from "./useStaffReports";

describe("buildStaffReportsInput", () => {
  it("keeps the active restaurant and current/comparison periods in the GraphQL input", () => {
    expect(
      buildStaffReportsInput({
        restaurantId: "restaurant-active",
        startDate: "2026-07-01",
        endDate: "2026-07-10",
        compareStartDate: "2026-06-21",
        compareEndDate: "2026-06-30",
      }),
    ).toEqual({
      restaurantId: "restaurant-active",
      startDate: "2026-07-01T00:00:00.000Z",
      endDate: "2026-07-10T23:59:59.999Z",
      compareStartDate: "2026-06-21T00:00:00.000Z",
      compareEndDate: "2026-06-30T23:59:59.999Z",
    });
  });
});
