import { describe, expect, it } from "vitest";

import { buildVisibleScheduleInsights } from "./ScheduleManagement";

const baseShift = {
  id: "shift-1",
  date: "2026-04-29",
  startTime: "06:00",
  endTime: "14:00",
  shiftType: "morning",
  essentialJobs: [],
  records: [],
};

describe("buildVisibleScheduleInsights mandatory roles", () => {
  it("does not flag server role as missing when service staff is assigned", () => {
    const result = buildVisibleScheduleInsights({
      shifts: [{ ...baseShift, staffIds: ["staff-1"] }],
      staff: [{ id: "staff-1", department: "service", fullName: "S1" }],
      mandatoryShiftRoles: ["server"],
    });

    expect(result.issues.find((issue) => issue.id === "shift-1-missing-roles")).toBeUndefined();
  });

  it("flags cook role as missing when no kitchen staff is assigned", () => {
    const result = buildVisibleScheduleInsights({
      shifts: [{ ...baseShift, staffIds: ["staff-1"] }],
      staff: [{ id: "staff-1", department: "service", fullName: "S1" }],
      mandatoryShiftRoles: ["cook"],
    });

    const issue = result.issues.find((item) => item.id === "shift-1-missing-roles");
    expect(issue).toBeTruthy();
    expect(issue.type).toBe("missing");
    expect(issue.level).toBe("warning");
  });

  it("creates one missing-roles issue when multiple mandatory roles are missing", () => {
    const result = buildVisibleScheduleInsights({
      shifts: [{ ...baseShift, staffIds: ["staff-1"] }],
      staff: [{ id: "staff-1", department: "service", fullName: "S1" }],
      mandatoryShiftRoles: ["cook", "cashier", " cook ", "COOK"],
    });

    const missingRoleIssues = result.issues.filter((item) => item.id === "shift-1-missing-roles");
    expect(missingRoleIssues).toHaveLength(1);
    expect(missingRoleIssues[0].title).toContain("Bếp");
    expect(missingRoleIssues[0].title).toContain("Thu ngân");
  });
});

describe("buildVisibleScheduleInsights min weekly hours warnings", () => {
  const shifts = [{ ...baseShift, staffIds: ["pt-1"] }];
  const employmentTypePolicy = {
    full_time: { minWeeklyHours: 0 },
    part_time: { minWeeklyHours: 8 },
  };

  it("warns when part-time staff is scheduled below min", () => {
    const result = buildVisibleScheduleInsights({
      shifts: [{ ...baseShift, staffIds: ["pt-1"], endTime: "10:00" }],
      staff: [{ id: "pt-1", fullName: "PT", employmentType: "part_time" }],
      employmentTypePolicy,
    });
    expect(result.issues.find((issue) => issue.id === "pt-1-below-min-hours")).toBeTruthy();
  });

  it("does not warn when part-time staff reaches min", () => {
    const result = buildVisibleScheduleInsights({
      shifts,
      staff: [{ id: "pt-1", fullName: "PT", employmentType: "part_time" }],
      employmentTypePolicy,
    });
    expect(result.issues.find((issue) => issue.id === "pt-1-below-min-hours")).toBeUndefined();
  });

  it("does not warn when full-time min is zero", () => {
    const result = buildVisibleScheduleInsights({
      shifts: [{ ...baseShift, staffIds: ["ft-1"], endTime: "10:00" }],
      staff: [{ id: "ft-1", fullName: "FT", employmentType: "full_time" }],
      employmentTypePolicy,
    });
    expect(result.issues.find((issue) => issue.id === "ft-1-below-min-hours")).toBeUndefined();
  });

  it("warns when registered availability is below min", () => {
    const result = buildVisibleScheduleInsights({
      shifts: [],
      staff: [
        {
          id: "pt-1",
          fullName: "PT",
          employmentType: "part_time",
          weeklyAvailabilityHours: 6,
        },
      ],
      employmentTypePolicy,
    });
    expect(result.issues.find((issue) => issue.id === "pt-1-availability-below-min-hours")).toBeTruthy();
  });
});
