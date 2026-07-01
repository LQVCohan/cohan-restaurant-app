import { describe, expect, it } from "vitest";

import {
  OVERTIME_TIMEZONE_OFFSET,
  buildOvertimeFilter,
  toOvertimeIsoEndOfDay,
  toOvertimeIsoStartOfDay,
} from "./useOvertimeManagement";

describe("useOvertimeManagement date normalization", () => {
  it("uses the restaurant operating timezone for selected-date filters", () => {
    expect(OVERTIME_TIMEZONE_OFFSET).toBe("+07:00");
    expect(toOvertimeIsoStartOfDay("2026-07-01")).toBe(
      "2026-07-01T00:00:00.000+07:00",
    );
    expect(toOvertimeIsoEndOfDay("2026-07-01")).toBe(
      "2026-07-01T23:59:59.999+07:00",
    );

    expect(
      buildOvertimeFilter({
        selectedDate: "2026-07-01",
        status: "all",
        overtimeType: "all",
        restaurantId: "rest-1",
        search: "  Nguyen  ",
      }),
    ).toEqual({
      restaurantId: "rest-1",
      employeeId: undefined,
      status: undefined,
      overtimeType: undefined,
      startDate: "2026-07-01T00:00:00.000+07:00",
      endDate: "2026-07-01T23:59:59.999+07:00",
      search: "Nguyen",
    });
  });
});
