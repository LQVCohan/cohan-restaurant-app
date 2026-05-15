import { describe, expect, it } from "vitest";
import { getPayrollReadinessIssueAction } from "./payrollReadinessRouting";

describe("payrollReadinessRouting", () => {
  it("routes schedule publication issues to schedules page", () => {
    expect(
      getPayrollReadinessIssueAction({ code: "SCHEDULE_NOT_PUBLISHED" }),
    ).toMatchObject({
      label: "Đi tới lịch làm việc",
      page: "schedules",
      query: { focus: "publication" },
    });
  });

  it("routes off-schedule issues to staff attendance", () => {
    expect(
      getPayrollReadinessIssueAction({
        code: "OFF_SCHEDULE_ATTENDANCE_PENDING",
        employeeId: "e1",
      }),
    ).toMatchObject({
      page: "staff",
      query: {
        staffPage: "attendance",
        attendanceTab: "off_schedule",
        offScheduleStatus: "pending",
        employeeId: "e1",
      },
    });
  });

  it("routes overtime issues to staff attendance overtime", () => {
    expect(
      getPayrollReadinessIssueAction({ code: "OVERTIME_PENDING" }),
    ).toMatchObject({
      page: "staff",
      query: {
        staffPage: "attendance",
        attendanceTab: "overtime",
        overtimeStatus: "pending",
      },
    });
  });

  it("falls back to targetRoute when code is unknown", () => {
    expect(
      getPayrollReadinessIssueAction({ targetRoute: "attendance_correction" }),
    ).toMatchObject({
      page: "staff",
      query: {
        staffPage: "attendance",
        attendanceTab: "corrections",
        correctionStatus: "pending",
      },
    });
  });
});
