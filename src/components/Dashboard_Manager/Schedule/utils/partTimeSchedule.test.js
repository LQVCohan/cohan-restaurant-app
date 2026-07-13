import { describe, expect, it } from "vitest";
import {
  buildLocalShiftRange,
  getNextPartTimeStart,
  groupPartTimeShiftRows,
  isPartTimeEmployment,
} from "./partTimeSchedule";

describe("part-time schedule utilities", () => {
  it("classifies only part-time and seasonal staff as flexible workforce", () => {
    expect(isPartTimeEmployment({ employmentType: "part_time" })).toBe(true);
    expect(isPartTimeEmployment({ employmentType: "seasonal" })).toBe(true);
    expect(isPartTimeEmployment({ employmentType: "full_time" })).toBe(false);
    expect(isPartTimeEmployment({ employmentType: "contract" })).toBe(false);
  });

  it("groups assignments by exact start and end instead of only shift type", () => {
    const staffById = new Map([
      ["pt-1", { id: "pt-1", employmentType: "part_time" }],
      ["pt-2", { id: "pt-2", employmentType: "part_time" }],
      ["ft-1", { id: "ft-1", employmentType: "full_time" }],
    ]);
    const rows = [
      {
        id: "shift-1",
        employeeId: "pt-1",
        shiftType: "rotating",
        startTime: "2026-07-13T01:00:00.000Z",
        endTime: "2026-07-13T05:00:00.000Z",
      },
      {
        id: "shift-2",
        employeeId: "pt-2",
        shiftType: "rotating",
        startTime: "2026-07-13T05:00:00.000Z",
        endTime: "2026-07-13T09:00:00.000Z",
      },
      {
        id: "shift-3",
        employeeId: "ft-1",
        shiftType: "rotating",
        startTime: "2026-07-13T01:00:00.000Z",
        endTime: "2026-07-13T05:00:00.000Z",
      },
    ];

    const groups = groupPartTimeShiftRows(rows, staffById);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      date: "2026-07-13",
      startLabel: "08:00",
      endLabel: "12:00",
      staffIds: ["pt-1"],
    });
    expect(groups[1]).toMatchObject({
      startLabel: "12:00",
      endLabel: "16:00",
      staffIds: ["pt-2"],
    });
  });

  it("uses the previous block end as the next block start", () => {
    const blocks = [
      {
        date: "2026-07-13",
        endTime: "2026-07-13T05:00:00.000Z",
      },
      {
        date: "2026-07-13",
        endTime: "2026-07-13T09:00:00.000Z",
      },
    ];

    expect(getNextPartTimeStart(blocks, "2026-07-13", "08:00")).toBe("16:00");
    expect(getNextPartTimeStart([], "2026-07-14", "08:00")).toBe("08:00");
  });

  it("defaults to a four-hour range and supports business-defined duration", () => {
    const defaultRange = buildLocalShiftRange({
      date: "2026-07-20",
      startTime: "08:00",
    });
    const customRange = buildLocalShiftRange({
      date: "2026-07-20",
      startTime: "08:00",
      durationHours: 5.5,
    });

    expect(defaultRange.endTime - defaultRange.startTime).toBe(4 * 60 * 60 * 1000);
    expect(customRange.endTime - customRange.startTime).toBe(5.5 * 60 * 60 * 1000);
  });
});
