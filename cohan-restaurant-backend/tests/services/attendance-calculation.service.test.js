import { describe, expect, it } from "vitest";
import {
  calculateAttendanceMetrics,
  deriveAttendanceStatus,
} from "../../src/services/attendance/attendanceCalculation.service.js";

describe("attendance timestamp calculation", () => {
  it("calculates work, lateness, early leave and overtime from one timestamp source", () => {
    const metrics = calculateAttendanceMetrics({
      plannedStartTime: "2026-07-12T09:00:00.000Z",
      plannedEndTime: "2026-07-12T17:00:00.000Z",
      actualCheckInAt: "2026-07-12T09:12:00.000Z",
      actualCheckOutAt: "2026-07-12T17:45:00.000Z",
    });

    expect(metrics).toEqual({
      workedMinutes: 513,
      hours: 8.55,
      latenessMinutes: 12,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 45,
    });
    expect(
      deriveAttendanceStatus({
        actualCheckInAt: "2026-07-12T09:12:00.000Z",
        actualCheckOutAt: "2026-07-12T17:45:00.000Z",
        isOffSchedule: false,
        latenessMinutes: metrics.latenessMinutes,
        earlyLeaveMinutes: metrics.earlyLeaveMinutes,
      }),
    ).toBe("late");
  });

  it("supports overnight shifts and rejects durations over 24 hours", () => {
    expect(
      calculateAttendanceMetrics({
        plannedStartTime: "2026-07-12T22:00:00.000Z",
        plannedEndTime: "2026-07-13T06:00:00.000Z",
        actualCheckInAt: "2026-07-12T22:00:00.000Z",
        actualCheckOutAt: "2026-07-13T06:30:00.000Z",
      }),
    ).toEqual({
      workedMinutes: 510,
      hours: 8.5,
      latenessMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 30,
    });

    expect(() =>
      calculateAttendanceMetrics({
        actualCheckInAt: "2026-07-12T08:00:00.000Z",
        actualCheckOutAt: "2026-07-13T08:01:00.000Z",
      }),
    ).toThrow("Tổng thời gian làm việc không được vượt quá 24 giờ.");
  });

  it("derives valid off-schedule statuses even before check-in", () => {
    expect(
      deriveAttendanceStatus({
        actualCheckInAt: null,
        actualCheckOutAt: null,
        isOffSchedule: true,
      }),
    ).toBe("unscheduled_absent");
    expect(
      deriveAttendanceStatus({
        actualCheckInAt: "2026-07-12T09:00:00.000Z",
        actualCheckOutAt: null,
        isOffSchedule: true,
      }),
    ).toBe("unscheduled_checkin");
  });
});
