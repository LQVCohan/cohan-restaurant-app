import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  incidentFind: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })),
  adjustmentFind: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })),
  staffFind: vi.fn(() => ({
    select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })),
  })),
  getSummary: vi.fn(),
  getMembershipFilter: vi.fn(() => ({ _id: { $in: ["e1", "e2"] } })),
  resolveUserRoles: vi.fn(() => ["MANAGER"]),
  userCanAccessRestaurant: vi.fn(() => true),
}));

vi.mock("../../models/index.js", () => ({
  PerformanceIncident: { find: mocks.incidentFind },
  Staff: { find: mocks.staffFind },
  StaffPerformanceScoreAdjustment: { find: mocks.adjustmentFind },
}));

vi.mock("../../src/services/performance/staffPerformanceReporting.service.js", () => ({
  getStaffPerformanceSummary: mocks.getSummary,
}));

vi.mock("../../src/services/auth/restaurantScope.service.js", () => ({
  getStaffMembershipRestaurantFilter: mocks.getMembershipFilter,
}));

vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  resolveUserRoles: mocks.resolveUserRoles,
  userCanAccessRestaurant: mocks.userCanAccessRestaurant,
}));

import { getManagerPerformanceDashboard } from "../../src/services/performance/managerPerformanceDashboard.service.js";

describe("managerPerformanceDashboard.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveUserRoles.mockReturnValue(["MANAGER"]);
    mocks.userCanAccessRestaurant.mockResolvedValue(true);
    mocks.getMembershipFilter.mockResolvedValue({ _id: { $in: ["e1", "e2"] } });
    mocks.staffFind.mockReturnValue({
      select: vi.fn(() => ({
        lean: vi.fn().mockResolvedValue([{ _id: "e1" }, { _id: "e2" }]),
      })),
    });
    mocks.getSummary.mockImplementation(({ employeeId }) =>
      Promise.resolve(
        employeeId === "e1"
          ? {
              employeeId: "e1",
              finalPerformanceScore: 65,
              totalScoreDelta: -10,
              appliedAdjustmentCount: 2,
              eligibleIncidentCount: 3,
            }
          : {
              employeeId: "e2",
              finalPerformanceScore: 91,
              totalScoreDelta: -1,
              appliedAdjustmentCount: 1,
              eligibleIncidentCount: 0,
            },
      ),
    );
  });

  it("forbids staff", async () => {
    mocks.resolveUserRoles.mockReturnValue(["STAFF"]);

    await expect(
      getManagerPerformanceDashboard({ restaurantId: "r1" }, { id: "u1" }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("uses active membership staff and builds overview actions", async () => {
    mocks.incidentFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          employeeId: "e1",
          eventType: "off_schedule",
          severity: "warning",
          responsibilityStatus: "pending_review",
          scoreImpactStatus: "pending",
          createdAt: "2026-04-01T00:00:00Z",
          occurredAt: "2026-04-01T00:00:00Z",
          proposedScoreDelta: -2,
          scoreDelta: 0,
        },
        {
          employeeId: "e1",
          eventType: "attendance_correction",
          severity: "critical",
          responsibilityStatus: "staff_responsible",
          scoreImpactStatus: "eligible",
          createdAt: "2026-04-01T00:00:00Z",
          occurredAt: "2026-04-01T00:00:00Z",
          proposedScoreDelta: -3,
          scoreDelta: 0,
        },
        {
          employeeId: "e2",
          eventType: "off_schedule",
          severity: "info",
          responsibilityStatus: "staff_responsible",
          scoreImpactStatus: "waived",
          createdAt: "2026-04-02T00:00:00Z",
          occurredAt: "2026-04-02T00:00:00Z",
          proposedScoreDelta: -1,
          scoreDelta: 0,
        },
      ]),
    });
    mocks.adjustmentFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ scoreDelta: -4 }, { scoreDelta: -2 }]),
    });

    const result = await getManagerPerformanceDashboard(
      { restaurantId: "r1", limit: 1 },
      { id: "m1" },
    );

    expect(mocks.getMembershipFilter).toHaveBeenCalledWith("r1");
    expect(mocks.staffFind).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $in: ["e1", "e2"] },
        employmentStatus: "working",
        status: "active",
      }),
    );
    expect(result.incidentOverview.pendingReviewCount).toBe(1);
    expect(result.incidentOverview.eligibleCount).toBe(1);
    expect(result.incidentOverview.waivedCount).toBe(1);
    expect(result.scoringOverview.totalScoreDelta).toBe(-6);
    expect(result.scoringOverview.eligibleScoreDeltaPending).toBe(-3);
    expect(
      result.recommendedActions.find(
        (item) => item.action === "apply_or_waive_eligible_incidents",
      )?.count,
    ).toBe(1);
    expect(result.topRiskEmployees).toHaveLength(1);
  });

  it("returns an empty dashboard without querying unscoped staff data", async () => {
    mocks.staffFind.mockReturnValue({
      select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })),
    });

    const result = await getManagerPerformanceDashboard(
      { restaurantId: "r1" },
      { id: "m1" },
    );

    expect(result.scoringOverview.averageScore).toBe(0);
    expect(result.incidentOverview.totalIncidents).toBe(0);
    expect(mocks.getSummary).not.toHaveBeenCalled();
    expect(mocks.incidentFind).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: { $in: [] } }),
    );
  });
});
