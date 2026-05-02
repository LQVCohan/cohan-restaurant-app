import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findOneAndUpdate: vi.fn(),
  find: vi.fn(() => ({ sort: vi.fn() })),
  findById: vi.fn(),
  resolveUserRoles: vi.fn(() => ["MANAGER"]),
  userCanAccessRestaurant: vi.fn(() => true),
}));

vi.mock("../../models/index.js", () => ({
  PerformanceIncident: {
    create: mocks.create,
    findOneAndUpdate: mocks.findOneAndUpdate,
    find: mocks.find,
    findById: mocks.findById,
  },
}));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  resolveUserRoles: mocks.resolveUserRoles,
  userCanAccessRestaurant: mocks.userCanAccessRestaurant,
}));

import {
  buildIncidentUniqueKey,
  createPerformanceIncident,
  createPerformanceIncidentOnce,
  listPerformanceIncidents,
  reviewPerformanceIncident,
  waivePerformanceIncident,
  markPerformanceIncidentEligible,
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
});
