import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(() => ({ sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })) })),
  resolveUserRoles: vi.fn(() => ["MANAGER"]),
  userCanAccessRestaurant: vi.fn(() => true),
}));

vi.mock("../../models/index.js", () => ({ PerformanceIncident: { find: mocks.find } }));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  resolveUserRoles: mocks.resolveUserRoles,
  userCanAccessRestaurant: mocks.userCanAccessRestaurant,
}));

import {
  computeIncidentPriority,
  computeIncidentSlaStatus,
  getManagerIncidentReviewQueueSummary,
  listManagerIncidentReviewQueue,
} from "../../src/services/performance/performanceIncidentQueue.service.js";

describe("performanceIncidentQueue.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveUserRoles.mockReturnValue(["MANAGER"]);
  });

  it("computes overdue and dueSoon SLA", () => {
    const now = new Date("2026-05-02T12:00:00.000Z");
    const overdue = computeIncidentSlaStatus({ severity: "warning", scoreImpactStatus: "pending", createdAt: "2026-04-30T11:00:00.000Z" }, now);
    expect(overdue.slaStatus).toBe("overdue");

    const dueSoon = computeIncidentSlaStatus({ severity: "warning", scoreImpactStatus: "pending", createdAt: "2026-04-30T17:00:00.000Z" }, now);
    expect(dueSoon.slaStatus).toBe("due_soon");
    expect(dueSoon.dueSoon).toBe(true);
  });

  it("computes priority and resolved SLA", () => {
    expect(computeIncidentPriority({ severity: "critical", scoreImpactStatus: "pending", createdAt: new Date() })).toBe("critical");
    const resolved = computeIncidentSlaStatus({ severity: "info", scoreImpactStatus: "waived", createdAt: new Date() });
    expect(resolved.slaStatus).toBe("not_required");
  });

  it("enforces permission", async () => {
    mocks.resolveUserRoles.mockReturnValue(["STAFF"]);
    await expect(listManagerIncidentReviewQueue({ restaurantId: "r1" }, { id: "u1" })).rejects.toThrow("FORBIDDEN");
  });

  it("returns queue with default filtering and role capabilities", async () => {
    const rows = [
      { _id: "i1", restaurantId: "r1", employeeId: "e1", sourceType: "timesheet", eventType: "ATTENDANCE_LATE", severity: "warning", responsibilityStatus: "pending_review", scoreImpactStatus: "pending", createdAt: "2026-05-01T00:00:00.000Z", occurredAt: "2026-05-01T00:00:00.000Z" },
      { _id: "i2", restaurantId: "r1", employeeId: "e1", sourceType: "timesheet", eventType: "ATTENDANCE_ABSENT", severity: "violation", responsibilityStatus: "staff_responsible", scoreImpactStatus: "eligible", createdAt: "2026-05-01T00:00:00.000Z", occurredAt: "2026-05-01T00:00:00.000Z" },
      { _id: "i3", restaurantId: "r1", employeeId: "e2", sourceType: "timesheet", eventType: "ATTENDANCE_LATE", severity: "info", responsibilityStatus: "no_fault", scoreImpactStatus: "waived", createdAt: "2026-05-01T00:00:00.000Z", occurredAt: "2026-05-01T00:00:00.000Z" },
    ];
    mocks.find.mockReturnValueOnce({ sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(rows) })) });
    const result = await listManagerIncidentReviewQueue({ restaurantId: "r1" }, { id: "m1" });
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.any(Array) }));
    expect(result.items.length).toBeGreaterThan(0);
    const eligibleAttendance = result.items.find(
      (x) => x.scoreImpactStatus === "eligible",
    );
    expect(eligibleAttendance?.canApplyScore).toBe(false);
    expect(eligibleAttendance?.recommendedAction).toBe("already_in_punctuality");

    mocks.resolveUserRoles.mockReturnValue(["ACCOUNTANT"]);
    mocks.find.mockReturnValueOnce({ sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([rows[1]]) })) });
    const accountant = await listManagerIncidentReviewQueue({ restaurantId: "r1" }, { id: "a1" });
    expect(accountant.items[0].canReview).toBe(false);
    expect(accountant.items[0].canApplyScore).toBe(false);
  });

  it("builds queue summary", async () => {
    const rows = [
      { restaurantId: "r1", employeeId: "e1", sourceType: "timesheet", eventType: "ATTENDANCE_LATE", severity: "warning", responsibilityStatus: "pending_review", scoreImpactStatus: "pending", createdAt: "2026-05-01T00:00:00.000Z", occurredAt: "2026-05-01T00:00:00.000Z" },
      { restaurantId: "r1", employeeId: "e1", sourceType: "timesheet", eventType: "ATTENDANCE_ABSENT", severity: "violation", responsibilityStatus: "staff_responsible", scoreImpactStatus: "eligible", createdAt: "2026-05-01T00:00:00.000Z", occurredAt: "2026-05-01T00:00:00.000Z" },
      { restaurantId: "r1", employeeId: "e2", sourceType: "timesheet", eventType: "ATTENDANCE_LATE", severity: "info", responsibilityStatus: "no_fault", scoreImpactStatus: "waived", createdAt: "2026-05-01T00:00:00.000Z", occurredAt: "2026-05-01T00:00:00.000Z" },
    ];
    mocks.find.mockReturnValueOnce({ sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(rows) })) });
    const summary = await getManagerIncidentReviewQueueSummary({ restaurantId: "r1", includeResolved: true }, { id: "m1" });
    expect(summary.pendingReviewCount).toBe(1);
    expect(summary.eligibleCount).toBe(1);
    expect(summary.waivedCount).toBe(1);
    expect(summary.bySeverity.find((x) => x.key === "warning")?.count).toBe(1);
  });
});
