import { describe, expect, it } from "vitest";

import {
  buildAttendanceCorrectionFilter,
  buildAttendanceQueryVars,
  hasAttendanceCorrectionScope,
  toAttendanceIsoEndOfDay,
  toAttendanceIsoStartOfDay,
} from "./useAttendanceManagement";

describe("useAttendanceManagement date normalization", () => {
  it("converts a selected date into valid DateTime query variables", () => {
    expect(
      buildAttendanceQueryVars({
        selectedDate: "2026-04-23",
        status: "all",
        search: "  Nguyen  ",
      })
    ).toEqual({
      restaurantId: undefined,
      startDate: "2026-04-23T00:00:00.000Z",
      endDate: "2026-04-23T23:59:59.999Z",
      status: undefined,
      search: "Nguyen",
    });
  });

  it("keeps explicit status filters and normalizes start/end helpers", () => {
    expect(toAttendanceIsoStartOfDay("2026-04-24")).toBe(
      "2026-04-24T00:00:00.000Z"
    );
    expect(toAttendanceIsoEndOfDay("2026-04-24")).toBe(
      "2026-04-24T23:59:59.999Z"
    );
    expect(
      buildAttendanceQueryVars({
        selectedDate: "2026-04-24",
        status: "late",
        search: "",
      }).status
    ).toBe("late");
  });

  it("returns null date boundaries when selected date is missing", () => {
    expect(toAttendanceIsoStartOfDay()).toBeNull();
    expect(toAttendanceIsoEndOfDay()).toBeNull();
  });
});

describe("useAttendanceManagement correction filters", () => {
  it("builds scoped correction filter with status and trimmed search", () => {
    expect(
      buildAttendanceCorrectionFilter({
        selectedDate: "2026-05-11",
        correctionStatus: "pending",
        search: "  Nguyen  ",
        restaurantId: "restaurant-1",
      })
    ).toEqual({
      restaurantId: "restaurant-1",
      employeeId: undefined,
      status: "pending",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      search: "Nguyen",
    });
  });

  it("omits correction status when all is selected", () => {
    expect(
      buildAttendanceCorrectionFilter({
        selectedDate: "2026-05-11",
        correctionStatus: "all",
      }).status
    ).toBeUndefined();
  });

  it("requires restaurant or employee scope before querying corrections", () => {
    expect(hasAttendanceCorrectionScope({ restaurantId: "restaurant-1" })).toBe(
      true
    );
    expect(hasAttendanceCorrectionScope({ employeeId: "employee-1" })).toBe(
      true
    );
    expect(hasAttendanceCorrectionScope({})).toBe(false);
  });
});
