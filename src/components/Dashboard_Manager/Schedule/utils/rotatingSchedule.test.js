import { describe, expect, it } from "vitest";
import {
  buildVietnamShiftRange,
  groupRotatingShiftRows,
  hasRotatingShiftOverlap,
  isRotatingStaff,
} from "./rotatingSchedule";

describe("rotatingSchedule helpers", () => {
  it("identifies rotating staff without changing working days", () => {
    expect(isRotatingStaff({ shiftType: "ROTATING", workingDays: [] })).toBe(true);
    expect(isRotatingStaff({ shiftType: "morning", workingDays: ["MON"] })).toBe(false);
  });

  it("builds Vietnam time ranges and supports overnight shifts", () => {
    const range = buildVietnamShiftRange({
      date: "2026-07-20",
      startTime: "22:00",
      endTime: "06:00",
    });

    expect(range.startTime.toISOString()).toBe("2026-07-20T15:00:00.000Z");
    expect(range.endTime.toISOString()).toBe("2026-07-20T23:00:00.000Z");
    expect(range.endTime.getTime()).toBeGreaterThan(range.startTime.getTime());
  });

  it("detects employee overlap but allows adjacent shifts", () => {
    const rows = [
      {
        employeeId: "staff-1",
        startTime: "2026-07-20T01:00:00.000Z",
        endTime: "2026-07-20T05:00:00.000Z",
      },
    ];

    expect(
      hasRotatingShiftOverlap(
        rows,
        "staff-1",
        "2026-07-20T04:00:00.000Z",
        "2026-07-20T08:00:00.000Z",
      ),
    ).toBe(true);
    expect(
      hasRotatingShiftOverlap(
        rows,
        "staff-1",
        "2026-07-20T05:00:00.000Z",
        "2026-07-20T09:00:00.000Z",
      ),
    ).toBe(false);
  });

  it("groups only rotating employees by exact time range", () => {
    const staffById = new Map([
      ["rotating-1", { id: "rotating-1", shiftType: "ROTATING" }],
      ["fulltime-1", { id: "fulltime-1", shiftType: "MORNING" }],
    ]);
    const rows = [
      {
        id: "shift-1",
        employeeId: "rotating-1",
        startTime: "2026-07-20T01:00:00.000Z",
        endTime: "2026-07-20T09:00:00.000Z",
      },
      {
        id: "shift-2",
        employeeId: "fulltime-1",
        startTime: "2026-07-20T01:00:00.000Z",
        endTime: "2026-07-20T09:00:00.000Z",
      },
    ];

    const groups = groupRotatingShiftRows(rows, staffById);
    expect(groups).toHaveLength(1);
    expect(groups[0].staffIds).toEqual(["rotating-1"]);
    expect(groups[0].records.map((row) => row.id)).toEqual(["shift-1"]);
  });
});
