import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  snapshotFindOne: vi.fn(() => ({ sort: vi.fn() })),
  snapshotFind: vi.fn(() => ({ sort: vi.fn() })),
  adjustmentFind: vi.fn(),
  reversalFind: vi.fn(),
  incidentFind: vi.fn(),
  resolveUserRoles: vi.fn(() => ["MANAGER"]),
  userCanAccessRestaurant: vi.fn(() => true),
}));

vi.mock("../../models/index.js", () => ({
  Staff: { find: vi.fn() },
  StaffPerformanceSnapshot: { findOne: mocks.snapshotFindOne, find: mocks.snapshotFind },
  StaffPerformanceScoreAdjustment: { find: mocks.adjustmentFind },
  StaffPerformanceScoreReversal: { find: mocks.reversalFind },
  PerformanceIncident: { find: mocks.incidentFind },
}));

vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  resolveUserRoles: mocks.resolveUserRoles,
  userCanAccessRestaurant: mocks.userCanAccessRestaurant,
}));

import {
  getStaffPerformanceSummary,
  getStaffPerformanceScoreTimeline,
  listStaffPerformanceScoreAdjustments,
} from "../../src/services/performance/staffPerformanceReporting.service.js";

describe("staffPerformanceReporting.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveUserRoles.mockReturnValue(["MANAGER"]);
    mocks.userCanAccessRestaurant.mockResolvedValue(true);
    mocks.reversalFind.mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });
  });

  it("allows staff to read own summary only", async () => {
    mocks.resolveUserRoles.mockReturnValue(["STAFF"]);
    mocks.snapshotFindOne.mockReturnValue({ sort: vi.fn().mockResolvedValue({ finalPerformanceScore: 88 }) });
    mocks.adjustmentFind.mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });
    mocks.incidentFind.mockResolvedValue([]);

    await expect(getStaffPerformanceSummary({ restaurantId: "r1", employeeId: "u1" }, { id: "u1" })).resolves.toBeTruthy();
    await expect(getStaffPerformanceSummary({ restaurantId: "r1", employeeId: "u2" }, { id: "u1" })).rejects.toThrow("FORBIDDEN");
  });

  it("returns zero instead of a perfect score when no snapshot exists", async () => {
    mocks.snapshotFindOne.mockReturnValue({ sort: vi.fn().mockResolvedValue(null) });
    mocks.adjustmentFind.mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });
    mocks.incidentFind.mockResolvedValue([]);

    const result = await getStaffPerformanceSummary(
      { restaurantId: "r1", employeeId: "e1", month: 7, year: 2026 },
      { id: "m1" },
    );

    expect(result.finalPerformanceScore).toBe(0);
    expect(result.appliedAdjustmentCount).toBe(0);
    expect(result.totalScoreDelta).toBe(0);
  });

  it("preserves the calculated score when a snapshot exists", async () => {
    mocks.snapshotFindOne.mockReturnValue({ sort: vi.fn().mockResolvedValue({ finalPerformanceScore: 100 }) });
    mocks.adjustmentFind.mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });
    mocks.incidentFind.mockResolvedValue([]);

    const result = await getStaffPerformanceSummary(
      { restaurantId: "r1", employeeId: "e1", month: 7, year: 2026 },
      { id: "m1" },
    );

    expect(result.finalPerformanceScore).toBe(100);
  });

  it("includes appeal reversals in summary aggregates", async () => {
    mocks.snapshotFindOne.mockReturnValue({ sort: vi.fn().mockResolvedValue({ finalPerformanceScore: 96 }) });
    mocks.adjustmentFind.mockReturnValue({ sort: vi.fn().mockResolvedValue([
      { scoreDelta: -5, reason: "ATTENDANCE_LATE", appliedAt: "2026-04-10T00:00:00.000Z" },
    ]) });
    mocks.reversalFind.mockReturnValue({ sort: vi.fn().mockResolvedValue([
      { reversalDelta: 1, reversedAt: "2026-04-12T00:00:00.000Z" },
    ]) });
    mocks.incidentFind.mockResolvedValue([
      { scoreImpactStatus: "applied", responsibilityStatus: "staff_responsible", scoreDelta: -5 },
    ]);

    const result = await getStaffPerformanceSummary(
      { restaurantId: "r1", employeeId: "e1", month: 4, year: 2026 },
      { id: "m1" },
    );

    expect(result.totalScoreDelta).toBe(-4);
    expect(result.appliedAdjustmentCount).toBe(2);
    expect(result.latestAppliedAt).toBe("2026-04-12T00:00:00.000Z");
    expect(result.scoreBreakdownByEventType).toContainEqual({
      eventType: "APPEAL_SCORE_REVERSED",
      totalDelta: 1,
      count: 1,
    });
  });

  it("builds summary aggregates", async () => {
    mocks.snapshotFindOne.mockReturnValue({ sort: vi.fn().mockResolvedValue({ finalPerformanceScore: 94 }) });
    mocks.adjustmentFind.mockReturnValue({ sort: vi.fn().mockResolvedValue([
      { scoreDelta: -2, reason: "ATTENDANCE_LATE", appliedAt: "2026-04-11T00:00:00.000Z" },
      { scoreDelta: 0, reason: "ATTENDANCE_LATE", appliedAt: "2026-04-10T00:00:00.000Z" },
    ]) });
    mocks.incidentFind.mockResolvedValue([
      { scoreImpactStatus: "eligible" },
      { scoreImpactStatus: "pending", responsibilityStatus: "pending_review" },
      { scoreImpactStatus: "waived" },
      { scoreImpactStatus: "applied", responsibilityStatus: "staff_responsible", scoreDelta: -2 },
    ]);

    const result = await getStaffPerformanceSummary({ restaurantId: "r1", employeeId: "e1" }, { id: "m1" });
    expect(result.finalPerformanceScore).toBe(94);
    expect(result.totalScoreDelta).toBe(-2);
    expect(result.appliedAdjustmentCount).toBe(2);
    expect(result.eligibleIncidentCount).toBe(1);
    expect(result.pendingReviewIncidentCount).toBe(1);
    expect(result.waivedIncidentCount).toBe(1);
  });

  it("filters adjustments and includes reversals in the timeline", async () => {
    const rows = [
      { appliedAt: "2026-04-12T00:00:00.000Z", newScore: 95, previousScore: 97, scoreDelta: -2, incidentId: "i2", reason: "B", note: "n2" },
      { appliedAt: "2026-04-10T00:00:00.000Z", newScore: 97, previousScore: 100, scoreDelta: -3, incidentId: "i1", reason: "A", note: "n1" },
    ];
    mocks.adjustmentFind
      .mockReturnValueOnce({
        sort: vi.fn(() => ({ skip: vi.fn(() => ({ limit: vi.fn().mockResolvedValue(rows) })) })),
      })
      .mockReturnValueOnce({ sort: vi.fn().mockResolvedValue(rows) });
    mocks.reversalFind.mockReturnValue({ sort: vi.fn().mockResolvedValue([
      { reversedAt: "2026-04-11T00:00:00.000Z", newScore: 98, reversalDelta: 1, incidentId: "i1", note: "accepted" },
    ]) });

    const list = await listStaffPerformanceScoreAdjustments({ restaurantId: "r1", employeeId: "e1", eventType: "A" }, { id: "m1" });
    expect(list).toEqual(rows);
    const timeline = await getStaffPerformanceScoreTimeline({ restaurantId: "r1", employeeId: "e1" }, { id: "m1" });
    expect(timeline.map((row) => row.score)).toEqual([97, 98, 95]);
    expect(timeline[1]).toEqual(expect.objectContaining({
      scoreDelta: 1,
      eventType: "APPEAL_SCORE_REVERSED",
      note: "accepted",
    }));
  });
});
