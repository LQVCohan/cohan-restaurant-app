import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const session = {
    withTransaction: vi.fn(),
    endSession: vi.fn(),
  };
  return {
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn(() => ({ sort: vi.fn() })),
    findById: vi.fn(),
    adjustmentCreate: vi.fn(),
    snapshotFindOne: vi.fn(),
    resolveUserRoles: vi.fn(() => ["MANAGER"]),
    userCanAccessRestaurant: vi.fn(() => true),
    resolvePerformanceLevel: vi.fn((score) => (score >= 90 ? "excellent" : score >= 80 ? "good" : score >= 65 ? "average" : score >= 50 ? "needs_attention" : "poor")),
    session,
    startSession: vi.fn(),
  };
});

vi.mock("mongoose", () => ({
  default: {
    startSession: mocks.startSession,
  },
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
    mocks.startSession.mockResolvedValue(mocks.session);
    mocks.session.withTransaction.mockImplementation(async (callback) => callback());
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

  it("keeps attendance incidents out of score adjustments", async () => {
    const save = vi.fn();
    const incident = {
      restaurantId: "r1",
      sourceType: "timesheet",
      eventType: "ATTENDANCE_LATE",
      responsibilityStatus: "pending_review",
      scoreImpactStatus: "pending",
      proposedScoreDelta: -3,
      save,
    };
    save.mockResolvedValue(incident);
    mocks.findById.mockResolvedValue(incident);

    const reviewed = await reviewPerformanceIncident({
      input: {
        incidentId: "i1",
        responsibilityStatus: "staff_responsible",
      },
      ctx: { user: { id: "u1" } },
    });

    expect(reviewed).toBe(incident);
    expect(incident.scoreImpactStatus).toBe("not_applicable");
    expect(incident.proposedScoreDelta).toBe(0);
    expect(save).toHaveBeenCalled();
  });

  it("rejects promoting attendance incidents to eligible", async () => {
    mocks.findById.mockResolvedValue({
      restaurantId: "r1",
      sourceType: "timesheet",
      eventType: "ATTENDANCE_ABSENT",
      scoreImpactStatus: "pending",
      responsibilityStatus: "pending_review",
      save: vi.fn(),
    });

    await expect(markPerformanceIncidentEligible({
      input: {
        incidentId: "i1",
        responsibilityStatus: "staff_responsible",
        proposedScoreDelta: -10,
        note: "attendance",
      },
      ctx: { user: { id: "u1" } },
    })).rejects.toThrow("ATTENDANCE_SCORE_OWNED_BY_PUNCTUALITY");
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

  it("applies an eligible incident inside one transaction", async () => {
    const incidentSave = vi.fn();
    const snapshotSave = vi.fn();
    const incident = {
      _id: "i1",
      restaurantId: "r1",
      employeeId: "e1",
      sourceType: "schedule_revision",
      sourceId: "schedule1",
      eventType: "SCHEDULE_RETURNED_FOR_REVISION",
      occurredAt: "2026-04-10T00:00:00.000Z",
      scoreImpactStatus: "eligible",
      responsibilityStatus: "staff_responsible",
      proposedScoreDelta: -3,
      save: incidentSave,
    };
    const snapshot = {
      finalPerformanceScore: 100,
      performanceLevel: "excellent",
      save: snapshotSave,
    };
    mocks.findById.mockResolvedValue(incident);
    mocks.snapshotFindOne.mockResolvedValue(snapshot);
    mocks.adjustmentCreate.mockResolvedValue([{ _id: "adj1" }]);

    await applyPerformanceIncidentScore({ incidentId: "i1", actor: { id: "u1" }, note: "apply" });
    const snapshotQuery = mocks.snapshotFindOne.mock.calls[0][0];
    expect(snapshotQuery.periodStart.$lte.toISOString()).toBe(incident.occurredAt);
    expect(snapshotQuery.periodEnd.$gte.toISOString()).toBe(incident.occurredAt);
    expect(mocks.adjustmentCreate).toHaveBeenCalledWith(
      [expect.objectContaining({ scoreDelta: -3, previousScore: 100, newScore: 97 })],
      { session: mocks.session },
    );
    expect(snapshot.finalPerformanceScore).toBe(97);
    expect(snapshotSave).toHaveBeenCalledWith({ session: mocks.session });
    expect(incident.scoreImpactStatus).toBe("applied");
    expect(incidentSave).toHaveBeenCalledWith({ session: mocks.session });
    expect(mocks.session.endSession).toHaveBeenCalled();
  });

  it("requires a calculated snapshot before applying an incident", async () => {
    mocks.findById.mockResolvedValue({
      _id: "i1",
      restaurantId: "r1",
      employeeId: "e1",
      occurredAt: "2026-04-10T00:00:00.000Z",
      scoreImpactStatus: "eligible",
      responsibilityStatus: "staff_responsible",
      proposedScoreDelta: -3,
    });
    mocks.snapshotFindOne.mockResolvedValue(null);

    await expect(
      applyPerformanceIncidentScore({ incidentId: "i1", actor: { id: "u1" }, note: "apply" }),
    ).rejects.toThrow("STAFF_PERFORMANCE_SNAPSHOT_NOT_FOUND");
    expect(mocks.adjustmentCreate).not.toHaveBeenCalled();
    expect(mocks.session.endSession).toHaveBeenCalled();
  });

  it("clamps adjusted score at 0 and syncs performanceLevel", async () => {
    const incidentSave = vi.fn();
    const snapshotSave = vi.fn();
    const incident = {
      _id: "i1",
      restaurantId: "r1",
      employeeId: "e1",
      sourceType: "schedule_revision",
      sourceId: "schedule2",
      eventType: "SCHEDULE_RETURNED_FOR_REVISION",
      occurredAt: "2026-04-10T00:00:00.000Z",
      scoreImpactStatus: "eligible",
      responsibilityStatus: "staff_responsible",
      proposedScoreDelta: -20,
      save: incidentSave,
    };
    const snapshot = { finalPerformanceScore: 10, save: snapshotSave };
    mocks.findById.mockResolvedValue(incident);
    mocks.snapshotFindOne.mockResolvedValue(snapshot);
    mocks.adjustmentCreate.mockResolvedValue([{ _id: "adj2" }]);

    await applyPerformanceIncidentScore({ incidentId: "i1", actor: { id: "u1" }, note: "apply clamp" });
    expect(snapshot.finalPerformanceScore).toBe(0);
    expect(snapshot.performanceLevel).toBe("poor");
    expect(snapshotSave).toHaveBeenCalledWith({ session: mocks.session });
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