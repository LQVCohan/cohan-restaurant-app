import { print } from "graphql";
import { describe, expect, it } from "vitest";

import {
  QUERY_ATTENDANCE_PAGE,
  buildAttendanceCorrectionFilter,
  buildAttendanceQueryVars,
  toAttendanceIsoEndOfDay,
  toAttendanceIsoStartOfDay,
  ATTENDANCE_TIMEZONE_OFFSET,
} from "./useAttendanceManagement";

describe("useAttendanceManagement date normalization", () => {
  it("exports the expected attendance timezone offset", () => {
    expect(ATTENDANCE_TIMEZONE_OFFSET).toBe("+07:00");
  });

  it("does not query unsupported timesheetId on StaffAttendanceRecord", () => {
    expect(print(QUERY_ATTENDANCE_PAGE)).not.toContain("timesheetId");
  });

  it("converts a selected date into valid DateTime query variables", () => {
    expect(
      buildAttendanceQueryVars({
        selectedDate: "2026-04-23",
        status: "all",
        search: "  Nguyen  ",
      }),
    ).toEqual({
      restaurantId: undefined,
      startDate: "2026-04-23T00:00:00.000+07:00",
      endDate: "2026-04-23T23:59:59.999+07:00",
      status: undefined,
      search: "Nguyen",
    });
  });

  it("keeps explicit status filters and normalizes start/end helpers", () => {
    expect(toAttendanceIsoStartOfDay("2026-04-24")).toBe(
      "2026-04-24T00:00:00.000+07:00",
    );
    expect(toAttendanceIsoEndOfDay("2026-04-24")).toBe(
      "2026-04-24T23:59:59.999+07:00",
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
      startDate: "2026-05-11T00:00:00.000+07:00",
      endDate: "2026-05-11T23:59:59.999+07:00",
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
      startDate: "2026-05-11T00:00:00.000+07:00",
      endDate: "2026-05-11T23:59:59.999+07:00",
      search: undefined,
    });
  });
});
