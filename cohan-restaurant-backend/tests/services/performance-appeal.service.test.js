import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const session = { withTransaction: vi.fn(), endSession: vi.fn() };
  return {
    incidentFindById: vi.fn(), appealFindOne: vi.fn(), appealCreate: vi.fn(), appealFindById: vi.fn(),
    appealFind: vi.fn(() => ({ sort: vi.fn(() => ({ skip: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })) })),
    adjustmentFindById: vi.fn(), adjustmentFindOne: vi.fn(), reversalCreate: vi.fn(), snapshotFindOne: vi.fn(),
    resolveUserRoles: vi.fn(() => ["STAFF"]), userCanAccessRestaurant: vi.fn(() => true),
    resolvePerformanceLevel: vi.fn((score) => (score >= 90 ? "excellent" : score >= 80 ? "good" : score >= 65 ? "average" : score >= 50 ? "needs_attention" : "poor")),
    notifyReviewers: vi.fn(), notifyUser: vi.fn(), session, startSession: vi.fn(),
  };
});

vi.mock("mongoose", () => ({ default: { startSession: mocks.startSession } }));
vi.mock("../../models/index.js", () => ({
  PerformanceIncident: { findById: mocks.incidentFindById },
  PerformanceIncidentAppeal: { findOne: mocks.appealFindOne, create: mocks.appealCreate, findById: mocks.appealFindById, find: mocks.appealFind },
  StaffPerformanceScoreAdjustment: { findById: mocks.adjustmentFindById, findOne: mocks.adjustmentFindOne },
  StaffPerformanceScoreReversal: { create: mocks.reversalCreate },
  StaffPerformanceSnapshot: { findOne: mocks.snapshotFindOne },
}));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({ resolveUserRoles: mocks.resolveUserRoles, userCanAccessRestaurant: mocks.userCanAccessRestaurant }));
vi.mock("../../src/services/notification/notificationWorkflow.service.js", () => ({ notifyReviewers: mocks.notifyReviewers, notifyUser: mocks.notifyUser }));
vi.mock("../../src/services/staffPerformance/staffPerformance.service.js", () => ({ resolvePerformanceLevel: mocks.resolvePerformanceLevel }));

import { createPerformanceIncidentAppeal, reviewPerformanceIncidentAppeal, reverseScoreForAcceptedAppeal } from "../../src/services/performance/performanceAppeal.service.js";

describe("performanceAppeal.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveUserRoles.mockReturnValue(["STAFF"]);
    mocks.userCanAccessRestaurant.mockResolvedValue(true);
    mocks.startSession.mockResolvedValue(mocks.session);
    mocks.session.withTransaction.mockImplementation(async (callback) => callback());
    mocks.notifyReviewers.mockResolvedValue(undefined);
    mocks.notifyUser.mockResolvedValue(undefined);
  });

  it("staff can create own appeal and blocks duplicate open appeal", async () => {
    mocks.incidentFindById.mockResolvedValue({ _id: "i1", restaurantId: "r1", employeeId: "u1", scoreImpactStatus: "pending" });
    mocks.appealFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: "a1" });
    mocks.appealCreate.mockResolvedValue({ _id: "a2" });
    await expect(createPerformanceIncidentAppeal({ incidentId: "i1", reason: "Need review" }, { id: "u1" })).resolves.toBeTruthy();
    await expect(createPerformanceIncidentAppeal({ incidentId: "i1", reason: "Need review" }, { id: "u1" })).rejects.toThrow("OPEN_APPEAL_ALREADY_EXISTS");
  });

  it("maps a duplicate-key race to the open appeal error", async () => {
    mocks.incidentFindById.mockResolvedValue({ _id: "i1", restaurantId: "r1", employeeId: "u1", scoreImpactStatus: "pending" });
    mocks.appealFindOne.mockResolvedValue(null);
    mocks.appealCreate.mockRejectedValue(Object.assign(new Error("duplicate"), { code: 11000 }));

    await expect(
      createPerformanceIncidentAppeal({ incidentId: "i1", reason: "Need review" }, { id: "u1" }),
    ).rejects.toThrow("OPEN_APPEAL_ALREADY_EXISTS");
    expect(mocks.notifyReviewers).not.toHaveBeenCalled();
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

  it("does not reopen or change a terminal appeal decision", async () => {
    mocks.resolveUserRoles.mockReturnValue(["MANAGER"]);
    const save = vi.fn();
    mocks.appealFindById.mockResolvedValue({ _id: "a1", incidentId: "i1", restaurantId: "r1", status: "accepted", save });

    await expect(
      reviewPerformanceIncidentAppeal({ appealId: "a1", status: "rejected", decisionReason: "changed" }, { id: "m1" }),
    ).rejects.toThrow("PERFORMANCE_APPEAL_ALREADY_RESOLVED");
    expect(mocks.incidentFindById).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("updates all reversal records in one transaction", async () => {
    mocks.resolveUserRoles.mockReturnValue(["MANAGER"]);
    const appealSave = vi.fn(); const incidentSave = vi.fn(); const snapshotSave = vi.fn();
    const appeal = { _id: "a1", incidentId: "i1", restaurantId: "r1", employeeId: "e1", status: "accepted", save: appealSave };
    const incident = { _id: "i1", restaurantId: "r1", employeeId: "e1", occurredAt: "2026-04-10T00:00:00.000Z", scoreImpactStatus: "applied", scoreDelta: -5, save: incidentSave, scoreAdjustmentId: "adj1" };
    const snapshot = { finalPerformanceScore: 90, productivity: { score: 77 }, save: snapshotSave };
    mocks.appealFindById.mockResolvedValue(appeal); mocks.incidentFindById.mockResolvedValue(incident);
    mocks.adjustmentFindById.mockResolvedValue({ _id: "adj1", scoreDelta: -5 }); mocks.snapshotFindOne.mockResolvedValue(snapshot);
    mocks.reversalCreate.mockResolvedValue([{ _id: "rev1" }]);

    await reverseScoreForAcceptedAppeal({ appealId: "a1", actor: { id: "m1" }, reversalDelta: 2, note: "reviewed" });

    expect(mocks.reversalCreate).toHaveBeenCalledWith([expect.objectContaining({ reversalDelta: 2, previousScore: 90, newScore: 92 })], { session: mocks.session });
    expect(snapshot.finalPerformanceScore).toBe(92);
    expect(snapshot.productivity.score).toBe(77);
    expect(snapshotSave).toHaveBeenCalledWith({ session: mocks.session });
    expect(appealSave).toHaveBeenCalledWith({ session: mocks.session });
    expect(incidentSave).toHaveBeenCalledWith({ session: mocks.session });
    expect(mocks.session.endSession).toHaveBeenCalled();
  });

  it("rejects invalid reversal amounts", async () => {
    mocks.resolveUserRoles.mockReturnValue(["MANAGER"]);
    mocks.appealFindById.mockResolvedValue({ _id: "a1", incidentId: "i1", restaurantId: "r1", status: "accepted" });
    mocks.incidentFindById.mockResolvedValue({ _id: "i1", scoreImpactStatus: "applied", scoreAdjustmentId: "adj1" });
    mocks.adjustmentFindById.mockResolvedValue({ _id: "adj1", scoreDelta: -5 });
    await expect(reverseScoreForAcceptedAppeal({ appealId: "a1", actor: { id: "m1" }, reversalDelta: 0, note: "reviewed" })).rejects.toThrow("PERFORMANCE_REVERSAL_DELTA_INVALID");
    await expect(reverseScoreForAcceptedAppeal({ appealId: "a1", actor: { id: "m1" }, reversalDelta: 6, note: "reviewed" })).rejects.toThrow("PERFORMANCE_REVERSAL_DELTA_EXCEEDS_ORIGINAL");
    expect(mocks.reversalCreate).not.toHaveBeenCalled();
  });

  it("keeps the final value within its upper bound", async () => {
    mocks.resolveUserRoles.mockReturnValue(["MANAGER"]);
    const appealSave = vi.fn(); const incidentSave = vi.fn(); const snapshotSave = vi.fn();
    const snapshot = { finalPerformanceScore: 99, save: snapshotSave };
    mocks.appealFindById.mockResolvedValue({ _id: "a1", incidentId: "i1", restaurantId: "r1", employeeId: "e1", status: "accepted", save: appealSave });
    mocks.incidentFindById.mockResolvedValue({ _id: "i1", restaurantId: "r1", employeeId: "e1", occurredAt: "2026-04-10T00:00:00.000Z", scoreImpactStatus: "applied", scoreDelta: -5, save: incidentSave, scoreAdjustmentId: "adj1" });
    mocks.adjustmentFindById.mockResolvedValue({ _id: "adj1", scoreDelta: -5 }); mocks.snapshotFindOne.mockResolvedValue(snapshot);
    mocks.reversalCreate.mockResolvedValue([{ _id: "rev1" }]);
    await reverseScoreForAcceptedAppeal({ appealId: "a1", actor: { id: "m1" }, reversalDelta: 5, note: "reviewed" });
    expect(snapshot.finalPerformanceScore).toBe(100);
    expect(snapshot.performanceLevel).toBe("excellent");
  });
});
