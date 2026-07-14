import { describe, expect, it } from "vitest";
import {
  SCHEDULE_EMPLOYMENT_SCOPES,
  filterStaffForScheduleScope,
  matchesScheduleEmploymentScope,
  resolveStaffShiftType,
} from "./ScheduleEmploymentScope";

describe("ScheduleEmploymentScope rotating staff", () => {
  const staff = [
    {
      id: "full-time",
      employmentType: "FULL_TIME",
      shiftType: "MORNING",
    },
    {
      id: "part-time",
      employmentType: "PART_TIME",
      shiftType: "EVENING",
    },
    {
      id: "rotating-direct",
      employmentType: "FULL_TIME",
      shiftType: "ROTATING",
    },
    {
      id: "rotating-from-query",
      employmentType: null,
    },
  ];

  const shiftTypeByStaffId = new Map([
    ["rotating-from-query", "rotating"],
  ]);

  it("recognizes rotating shift type from the staff object or metadata query", () => {
    expect(resolveStaffShiftType(staff[2], shiftTypeByStaffId)).toBe("rotating");
    expect(resolveStaffShiftType(staff[3], shiftTypeByStaffId)).toBe("rotating");
  });

  it("puts rotating employees in their own scope", () => {
    const result = filterStaffForScheduleScope(
      staff,
      SCHEDULE_EMPLOYMENT_SCOPES.ROTATING,
      shiftTypeByStaffId,
    );

    expect(result.map((person) => person.id)).toEqual([
      "rotating-direct",
      "rotating-from-query",
    ]);
  });

  it("does not mix rotating employees into full-time or part-time lists", () => {
    expect(
      filterStaffForScheduleScope(
        staff,
        SCHEDULE_EMPLOYMENT_SCOPES.FULL_TIME,
        shiftTypeByStaffId,
      ).map((person) => person.id),
    ).toEqual(["full-time"]);

    expect(
      filterStaffForScheduleScope(
        staff,
        SCHEDULE_EMPLOYMENT_SCOPES.PART_TIME,
        shiftTypeByStaffId,
      ).map((person) => person.id),
    ).toEqual(["part-time"]);
  });

  it("keeps the all scope backward compatible", () => {
    expect(
      staff.every((person) =>
        matchesScheduleEmploymentScope(
          person,
          SCHEDULE_EMPLOYMENT_SCOPES.ALL,
          shiftTypeByStaffId,
        ),
      ),
    ).toBe(true);
  });
});
