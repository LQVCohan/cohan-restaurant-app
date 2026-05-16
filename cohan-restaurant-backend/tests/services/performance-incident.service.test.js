import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findOneAndUpdate: vi.fn(),
  find: vi.fn(() => ({ sort: vi.fn() })),
  findById: vi.fn(),
  adjustmentCreate: vi.fn(),
  snapshotFindOne: vi.fn(),
  snapshotFindOneAndUpdate: vi.fn(),
  resolveUserRoles: vi.fn(() => ["MANAGER"]),
  userCanAccessRestaurant: vi.fn(() => true),
  resolvePerformanceLevel: vi.fn((score) => (score >= 90 ? "excellent" : score >= 80 ? "good" : score >= 65 ? "average" : score >= 50 ? "needs_attention" : "poor")),
}));

vi.mock("../../models/index.js", () => ({
  PerformanceIncident: {
    create: mocks.create,
    findOneAndUpdate: mocks.findOneAndUpdate,
    find: mocks.find,
    findById: mocks.findById,
  },
  StaffPerformanceScoreAdjustment: {
    create: mocks.adjustmentCreate,
  },
  StaffPerformanceSnapshot: {
    findOne: mocks.snapshotFindOne,
    findOneAndUpdate: mocks.snapshotFindOneAndUpdate,
  },
}));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  resolveUserRoles: mocks.resolveUserRoles,
  userCanAccessRestaurant: mocks.userCanAccessRestaurant,
}));
vi.mock("../../src/services/staffPerformance/staffPerformance.service.js", () => ({
  resolvePerformanceLevel: mocks.resolvePerformanceLevel,
}));

import {
  buildIncidentUniqueKey,
  createPerformanceIncident,
  createPerformanceIncidentOnce,
  listPerformanceIncidents,
  reviewPerformanceIncident,
  waivePerformanceIncident,
  markPerformanceIncidentEligible,
  applyPerformanceIncidentScore,
} from "../../src/services/performance/performanceIncident.service.js";

describe("performanceIncident.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates incident with scoreDelta=0 by default", async () => {
    mocks.create.mockResolvedValue({ _id: "1" });
    await createPerformanceIncident({ sourceType: "timesheet", sourceId: "ts1", eventType: "ATTENDANCE_LATE" });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ scoreDelta: 0 }));
  });

  it("does not duplicate on create once", async () => {
    mocks.findOneAndUpdate.mockResolvedValue({ _id: "1" });
    await createPerformanceIncidentOnce({ sourceType: "timesheet", sourceId: "ts1", eventType: "ATTENDANCE_LATE" });
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { uniqueKey: "timesheet:ts1:ATTENDANCE_LATE" },
      expect.any(Object),
      expect.objectContaining({ upsert: true }),
    );
  });

  it("builds unique key", () => {
    expect(buildIncidentUniqueKey("a", "b", "c")).toBe("a:b:c");
  });

  it("filters list incidents by pending/eligible/waived flags", async () => {
    const sort = vi.fn();
    mocks.find.mockReturnValueOnce({ sort });
    await listPerformanceIncidents({ restaurantId: "r1", onlyPendingReview: true });
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ responsibilityStatus: "pending_review" }));
  });

  it("review blocks applied status", async () => {
    mocks.findById.mockResolvedValue({
      restaurantId: "r1",
      responsibilityStatus: "pending_review",
      scoreImpactStatus: "pending",
      save: vi.fn(),
    });
    await expect(reviewPerformanceIncident({
      input: { incidentId: "i1", scoreImpactStatus: "applied" },
      ctx: { user: { id: "u1" } },
    })).rejects.toThrow("SCORE_IMPACT_APPLIED_NOT_ALLOWED");
  });

  it("waive is idempotent for waived incident", async () => {
    const doc = { restaurantId: "r1", scoreImpactStatus: "waived" };
    mocks.findById.mockResolvedValue(doc);
    const result = await waivePerformanceIncident({ incidentId: "i1", reason: "ok", ctx: { user: { id: "u1" } } });
    expect(result).toBe(doc);
  });

  it("eligible rejects positive delta", async () => {
    mocks.findById.mockResolvedValue({
      restaurantId: "r1",
      scoreImpactStatus: "pending",
      save: vi.fn(),
    });
    await expect(markPerformanceIncidentEligible({
      input: { incidentId: "i1", responsibilityStatus: "staff_responsible", proposedScoreDelta: 1, note: "x" },
      ctx: { user: { id: "u1" } },
    })).rejects.toThrow("INVALID_PROPOSED_SCORE_DELTA");
  });

  it("applies eligible incident score and writes adjustment", async () => {
    const save = vi.fn();
    mocks.findById.mockResolvedValue({
      _id: "i1",
      restaurantId: "r1",
      employeeId: "e1",
      sourceType: "timesheet",
      sourceId: "ts1",
      eventType: "ATTENDANCE_LATE",
      occurredAt: "2026-04-10T00:00:00.000Z",
      scoreImpactStatus: "eligible",
      responsibilityStatus: "staff_responsible",
      proposedScoreDelta: -3,
      save,
    });
    mocks.snapshotFindOne.mockResolvedValue(null);
    mocks.adjustmentCreate.mockResolvedValue({ _id: "adj1" });
    await applyPerformanceIncidentScore({ incidentId: "i1", actor: { id: "u1" }, note: "apply" });
    expect(mocks.adjustmentCreate).toHaveBeenCalledWith(expect.objectContaining({ scoreDelta: -3, previousScore: 100, newScore: 97 }));
    expect(mocks.snapshotFindOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        $set: expect.objectContaining({ finalPerformanceScore: 97, performanceLevel: "excellent" }),
      }),
      expect.any(Object),
    );
    expect(save).toHaveBeenCalled();
  });

  it("clamps adjusted score at 0 and syncs performanceLevel", async () => {
    const save = vi.fn();
    mocks.findById.mockResolvedValue({
      _id: "i1",
      restaurantId: "r1",
      employeeId: "e1",
      sourceType: "timesheet",
      sourceId: "ts1",
      eventType: "ATTENDANCE_ABSENT",
      occurredAt: "2026-04-10T00:00:00.000Z",
      scoreImpactStatus: "eligible",
      responsibilityStatus: "staff_responsible",
      proposedScoreDelta: -20,
      save,
    });
    mocks.snapshotFindOne.mockResolvedValue({ finalPerformanceScore: 10 });
    mocks.adjustmentCreate.mockResolvedValue({ _id: "adj2" });

    await applyPerformanceIncidentScore({ incidentId: "i1", actor: { id: "u1" }, note: "apply clamp" });
    expect(mocks.snapshotFindOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        $set: expect.objectContaining({ finalPerformanceScore: 0, performanceLevel: "poor" }),
      }),
      expect.any(Object),
    );
  });

  it("blocks already applied incident", async () => {
    mocks.findById.mockResolvedValue({ restaurantId: "r1", scoreImpactStatus: "applied" });
    await expect(applyPerformanceIncidentScore({ incidentId: "i1", actor: { id: "u1" } })).rejects.toThrow("PERFORMANCE_INCIDENT_ALREADY_APPLIED");
  });

  it("requires note for zero delta", async () => {
    mocks.findById.mockResolvedValue({
      restaurantId: "r1",
      scoreImpactStatus: "eligible",
      responsibilityStatus: "shared",
      proposedScoreDelta: 0,
    });
    await expect(applyPerformanceIncidentScore({ incidentId: "i1", actor: { id: "u1" }, note: "" })).rejects.toThrow("NOTE_REQUIRED_FOR_ZERO_DELTA");
  });

});
