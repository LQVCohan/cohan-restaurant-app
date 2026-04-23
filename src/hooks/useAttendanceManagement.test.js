import { describe, expect, it } from "vitest";

import {
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
      })
    ).toEqual({
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
});
