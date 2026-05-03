import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  incidentFindById: vi.fn(),
  appealFindOne: vi.fn(),
  appealCreate: vi.fn(),
  appealFindById: vi.fn(),
  appealFind: vi.fn(() => ({ sort: vi.fn(() => ({ skip: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })) })),
  adjustmentFindById: vi.fn(),
  adjustmentFindOne: vi.fn(),
  reversalCreate: vi.fn(),
  snapshotFindOne: vi.fn(),
  resolveUserRoles: vi.fn(() => ["STAFF"]),
  userCanAccessRestaurant: vi.fn(() => true),
}));

vi.mock("../../models/index.js", () => ({
  PerformanceIncident: { findById: mocks.incidentFindById },
  PerformanceIncidentAppeal: { findOne: mocks.appealFindOne, create: mocks.appealCreate, findById: mocks.appealFindById, find: mocks.appealFind },
  StaffPerformanceScoreAdjustment: { findById: mocks.adjustmentFindById, findOne: mocks.adjustmentFindOne },
  StaffPerformanceScoreReversal: { create: mocks.reversalCreate },
  StaffPerformanceSnapshot: { findOne: mocks.snapshotFindOne },
}));

vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  resolveUserRoles: mocks.resolveUserRoles,
  userCanAccessRestaurant: mocks.userCanAccessRestaurant,
}));

import { createPerformanceIncidentAppeal, reviewPerformanceIncidentAppeal, reverseScoreForAcceptedAppeal } from "../../src/services/performance/performanceAppeal.service.js";

describe("performanceAppeal.service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("staff can create own appeal and blocks duplicate open appeal", async () => {
    mocks.incidentFindById.mockResolvedValue({ _id: "i1", restaurantId: "r1", employeeId: "u1", scoreImpactStatus: "pending" });
    mocks.appealFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: "a1" });
    mocks.appealCreate.mockResolvedValue({ _id: "a2" });
    await expect(createPerformanceIncidentAppeal({ incidentId: "i1", reason: "Need review" }, { id: "u1" })).resolves.toBeTruthy();
    await expect(createPerformanceIncidentAppeal({ incidentId: "i1", reason: "Need review" }, { id: "u1" })).rejects.toThrow("OPEN_APPEAL_ALREADY_EXISTS");
  });

  it("forbids staff creating appeal for other employee and empty reason", async () => {
    mocks.incidentFindById.mockResolvedValue({ _id: "i1", restaurantId: "r1", employeeId: "u2", scoreImpactStatus: "pending" });
    await expect(createPerformanceIncidentAppeal({ incidentId: "i1", reason: "ok" }, { id: "u1" })).rejects.toThrow("FORBIDDEN");
    mocks.incidentFindById.mockResolvedValue({ _id: "i1", restaurantId: "r1", employeeId: "u1", scoreImpactStatus: "pending" });
    await expect(createPerformanceIncidentAppeal({ incidentId: "i1", reason: "   " }, { id: "u1" })).rejects.toThrow("APPEAL_REASON_REQUIRED");
  });

  it("review accepted does not auto-change score", async () => {
    mocks.resolveUserRoles.mockReturnValue(["MANAGER"]);
    const save = vi.fn();
    mocks.appealFindById.mockResolvedValue({ _id: "a1", incidentId: "i1", restaurantId: "r1", status: "submitted", save });
    mocks.incidentFindById.mockResolvedValue({ _id: "i1", scoreImpactStatus: "applied" });
    await reviewPerformanceIncidentAppeal({ appealId: "a1", status: "accepted", decisionReason: "valid" }, { id: "m1" });
    expect(save).toHaveBeenCalled();
    expect(mocks.snapshotFindOne).not.toHaveBeenCalled();
  });

  it("reversal requires accepted appeal, note, valid delta and updates entities", async () => {
    mocks.resolveUserRoles.mockReturnValue(["MANAGER"]);
    const appealSave = vi.fn();
    const incidentSave = vi.fn();
    const snapshotSave = vi.fn();
    mocks.appealFindById.mockResolvedValue({ _id: "a1", incidentId: "i1", restaurantId: "r1", status: "accepted", save: appealSave });
    mocks.incidentFindById.mockResolvedValue({ _id: "i1", restaurantId: "r1", employeeId: "e1", occurredAt: "2026-04-10T00:00:00.000Z", scoreImpactStatus: "applied", scoreDelta: -5, save: incidentSave, scoreAdjustmentId: "adj1" });
    mocks.adjustmentFindById.mockResolvedValue({ _id: "adj1", scoreDelta: -5 });
    mocks.snapshotFindOne.mockResolvedValue({ finalPerformanceScore: 90, save: snapshotSave });
    mocks.reversalCreate.mockResolvedValue({ _id: "rev1" });

    await expect(reverseScoreForAcceptedAppeal({ appealId: "a1", actor: { id: "m1" }, reversalDelta: 6, note: "n" })).rejects.toThrow("PERFORMANCE_REVERSAL_DELTA_EXCEEDS_ORIGINAL");
    await expect(reverseScoreForAcceptedAppeal({ appealId: "a1", actor: { id: "m1" }, reversalDelta: 2, note: "" })).rejects.toThrow("REVERSAL_NOTE_REQUIRED");
    await expect(reverseScoreForAcceptedAppeal({ appealId: "a1", actor: { id: "m1" }, reversalDelta: 2, note: "reverse" })).resolves.toBeTruthy();
    expect(snapshotSave).toHaveBeenCalled();
    expect(appealSave).toHaveBeenCalled();
    expect(incidentSave).toHaveBeenCalled();
  });
});
