import { describe, expect, it } from "vitest";

import {
  buildAttendanceCorrectionFilter,
  buildAttendanceQueryVars,
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
      }),
    ).toEqual({
      startDate: "2026-04-23T00:00:00.000Z",
      endDate: "2026-04-23T23:59:59.999Z",
      status: undefined,
      search: "Nguyen",
    });
  });

  it("keeps explicit status filters and normalizes start/end helpers", () => {
    expect(toAttendanceIsoStartOfDay("2026-04-24")).toBe(
      "2026-04-24T00:00:00.000Z",
    );
    expect(toAttendanceIsoEndOfDay("2026-04-24")).toBe(
      "2026-04-24T23:59:59.999Z",
    );
    expect(
      buildAttendanceQueryVars({
        selectedDate: "2026-04-24",
        status: "late",
        search: "",
      }).status,
    ).toBe("late");
  });

  it("maps correction filter status and trims search text", () => {
    expect(
      buildAttendanceCorrectionFilter({
        selectedDate: "2026-05-11",
        correctionStatus: "pending",
        search: "  camera  ",
        restaurantId: "rest-1",
        employeeId: "emp-1",
      }),
    ).toEqual({
      restaurantId: "rest-1",
      employeeId: "emp-1",
      status: "pending",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      search: "camera",
    });
  });

  it("omits all-status correction filters", () => {
    expect(
      buildAttendanceCorrectionFilter({
        selectedDate: "2026-05-11",
        correctionStatus: "all",
        search: "",
        restaurantId: "",
      }),
    ).toEqual({
      restaurantId: undefined,
      employeeId: undefined,
      status: undefined,
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      search: undefined,
    });
  });
});
