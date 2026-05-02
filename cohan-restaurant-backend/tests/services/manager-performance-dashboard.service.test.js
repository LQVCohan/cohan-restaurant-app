import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  incidentFind: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })),
  adjustmentFind: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })),
  listSummaries: vi.fn().mockResolvedValue([]),
  resolveUserRoles: vi.fn(() => ["MANAGER"]),
  userCanAccessRestaurant: vi.fn(() => true),
}));

vi.mock("../../models/index.js", () => ({
  PerformanceIncident: { find: mocks.incidentFind },
  StaffPerformanceScoreAdjustment: { find: mocks.adjustmentFind },
}));

vi.mock("../../src/services/performance/staffPerformanceReporting.service.js", () => ({
  listStaffPerformanceSummaries: mocks.listSummaries,
}));

vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  resolveUserRoles: mocks.resolveUserRoles,
  userCanAccessRestaurant: mocks.userCanAccessRestaurant,
}));

import { getManagerPerformanceDashboard } from "../../src/services/performance/managerPerformanceDashboard.service.js";

describe("managerPerformanceDashboard.service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("forbids staff", async () => {
    mocks.resolveUserRoles.mockReturnValue(["STAFF"]);
    await expect(getManagerPerformanceDashboard({ restaurantId: "r1" }, { id: "u1" })).rejects.toThrow("FORBIDDEN");
  });

  it("builds overview and recommended actions", async () => {
    mocks.resolveUserRoles.mockReturnValue(["MANAGER"]);
    mocks.listSummaries.mockResolvedValue([
      { employeeId: "e1", finalPerformanceScore: 65, totalScoreDelta: -10, appliedAdjustmentCount: 2, eligibleIncidentCount: 3 },
      { employeeId: "e2", finalPerformanceScore: 91, totalScoreDelta: -1, appliedAdjustmentCount: 1, eligibleIncidentCount: 0 },
    ]);
    mocks.incidentFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([
      { employeeId: "e1", eventType: "off_schedule", severity: "warning", responsibilityStatus: "pending_review", scoreImpactStatus: "pending", createdAt: "2026-04-01T00:00:00Z", occurredAt: "2026-04-01T00:00:00Z", proposedScoreDelta: -2, scoreDelta: 0 },
      { employeeId: "e1", eventType: "attendance_correction", severity: "critical", responsibilityStatus: "staff_responsible", scoreImpactStatus: "eligible", createdAt: "2026-04-01T00:00:00Z", occurredAt: "2026-04-01T00:00:00Z", proposedScoreDelta: -3, scoreDelta: 0 },
      { employeeId: "e2", eventType: "off_schedule", severity: "info", responsibilityStatus: "staff_responsible", scoreImpactStatus: "waived", createdAt: "2026-04-02T00:00:00Z", occurredAt: "2026-04-02T00:00:00Z", proposedScoreDelta: -1, scoreDelta: 0 },
    ]) });
    mocks.adjustmentFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([{ scoreDelta: -4 }, { scoreDelta: -2 }]) });

    const result = await getManagerPerformanceDashboard({ restaurantId: "r1", limit: 1 }, { id: "m1" });
    expect(result.incidentOverview.pendingReviewCount).toBe(1);
    expect(result.incidentOverview.eligibleCount).toBe(1);
    expect(result.incidentOverview.waivedCount).toBe(1);
    expect(result.scoringOverview.totalScoreDelta).toBe(-6);
    expect(result.scoringOverview.eligibleScoreDeltaPending).toBe(-3);
    expect(result.recommendedActions.find((a) => a.action === "apply_or_waive_eligible_incidents")?.count).toBe(1);
    expect(result.topRiskEmployees.length).toBe(1);
  });
});
