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
