import { describe, expect, it } from "vitest";
import { buildAttendanceReconciliationSummary } from "./attendanceReconciliationUtils";

describe("attendanceReconciliationUtils", () => {
  it("returns neutral summary for empty records", () => {
    const summary = buildAttendanceReconciliationSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.score).toBeNull();
    expect(summary.tone).toBe("neutral");
  });

  it("counts completed records as on time with high score", () => {
    const summary = buildAttendanceReconciliationSummary([
      { id: "1", status: "completed", actualCheckInAt: "2026-05-20T01:00:00.000Z", actualCheckOutAt: "2026-05-20T09:00:00.000Z" },
    ]);
    expect(summary.onTime).toBe(1);
    expect(summary.score).toBe(100);
    expect(summary.tone).toBe("success");
  });

  it("classifies late, early leave, missed checkout, no-show and off-schedule", () => {
    const now = new Date("2026-05-20T10:00:00.000Z");
    const summary = buildAttendanceReconciliationSummary([
      { id: "late", status: "late", latenessMinutes: 12 },
      { id: "early", status: "early_leave", earlyLeaveMinutes: 15 },
      { id: "missed", status: "checked_in", actualCheckInAt: "2026-05-20T01:00:00.000Z", plannedEndTime: "2026-05-20T08:00:00.000Z" },
      { id: "absent", status: "scheduled_absent" },
      { id: "off", status: "unscheduled_checkin", isOffSchedule: true },
    ], now);

    expect(summary.late).toBe(1);
    expect(summary.earlyLeave).toBe(1);
    expect(summary.missedCheckout).toBe(1);
    expect(summary.noShow).toBe(1);
    expect(summary.offSchedule).toBe(1);
    expect(summary.needsReview).toBe(5);
  });

  it("clamps score between zero and one hundred", () => {
    const manyRisks = [
      ...new Array(20).fill(null).map((_, i) => ({ id: `absent-${i}`, status: "scheduled_absent" })),
      ...new Array(20).fill(null).map((_, i) => ({ id: `late-${i}`, status: "late", latenessMinutes: 10 })),
      ...new Array(20).fill(null).map((_, i) => ({ id: `early-${i}`, status: "early_leave", earlyLeaveMinutes: 10 })),
      ...new Array(20).fill(null).map((_, i) => ({ id: `off-${i}`, status: "unscheduled_checkin", isOffSchedule: true })),
      ...new Array(20).fill(null).map((_, i) => ({ id: `miss-${i}`, status: "missed_checkout" })),
    ];
    const summary = buildAttendanceReconciliationSummary(manyRisks);
    expect(summary.score).toBe(0);
  });

  it("limits review items to top five", () => {
    const records = new Array(8).fill(null).map((_, i) => ({ id: `r-${i}`, status: "late", latenessMinutes: 5 }));
    const summary = buildAttendanceReconciliationSummary(records);
    expect(summary.reviewItems).toHaveLength(5);
  });
});
