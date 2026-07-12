import { describe, expect, it } from "vitest";
import { buildAttendanceOvertimeState } from "../../src/services/attendance/attendanceOvertimeState.service.js";

describe("attendance overtime state", () => {
  it("rejects a newly approved amount above actual overtime", () => {
    expect(() =>
      buildAttendanceOvertimeState({
        overtimeMinutes: 60,
        currentStatus: "approved",
        approvedOvertimeMinutes: 90,
      }),
    ).toThrow("OVERTIME_APPROVED_MINUTES_EXCEED_ACTUAL");
  });

  it("resets approval to pending when recalculated overtime changes", () => {
    expect(
      buildAttendanceOvertimeState({
        overtimeMinutes: 60,
        previousOvertimeMinutes: 90,
        currentStatus: "approved",
        approvedOvertimeMinutes: 90,
        preserveApproved: true,
        reviewNote: "Đã duyệt trước khi sửa công",
      }),
    ).toEqual({
      approvedOvertimeMinutes: 0,
      overtimeApprovalStatus: "pending",
      overtimeReviewNote: "",
      overtimeReviewedBy: null,
      overtimeReviewedAt: null,
    });
  });

  it("preserves an approved amount that is within actual overtime", () => {
    expect(
      buildAttendanceOvertimeState({
        overtimeMinutes: 90,
        currentStatus: "approved",
        approvedOvertimeMinutes: 60,
        reviewNote: "Duyệt 60 phút",
      }),
    ).toEqual({
      approvedOvertimeMinutes: 60,
      overtimeApprovalStatus: "approved",
      overtimeReviewNote: "Duyệt 60 phút",
      overtimeReviewedBy: null,
      overtimeReviewedAt: null,
    });
  });
});
