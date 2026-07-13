import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const session = {
    withTransaction: vi.fn(),
    endSession: vi.fn(),
  };
  return {
    incidentFindById: vi.fn(),
    incidentSave: vi.fn(),
    adjustmentCreate: vi.fn(),
    snapshotFindOne: vi.fn(),
    snapshotFindOneAndUpdate: vi.fn(),
    snapshotSave: vi.fn(),
    resolveUserRoles: vi.fn(() => ["MANAGER"]),
    userCanAccessRestaurant: vi.fn(() => true),
    resolvePerformanceLevel: vi.fn(() => "excellent"),
    startSession: vi.fn(),
    session,
  };
});

vi.mock("mongoose", () => ({
  default: {
    startSession: mocks.startSession,
  },
}));

vi.mock("../../models/index.js", () => ({
  PerformanceIncident: {
    findById: mocks.incidentFindById,
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

import { applyPerformanceIncidentScore } from "../../src/services/performance/performanceIncident.service.js";

describe("defense seed performance snapshot fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "development";
    process.env.DEMO_SEED_ALLOW_ATTENDANCE_SCORING = "true";
    mocks.startSession.mockResolvedValue(mocks.session);
    mocks.session.withTransaction.mockImplementation(async (callback) => callback());
  });

  afterEach(() => {
    delete process.env.DEMO_SEED_ALLOW_ATTENDANCE_SCORING;
    delete process.env.NODE_ENV;
  });

  it("creates the incident employee monthly snapshot before applying a defense seed score", async () => {
    const occurredAt = new Date("2026-07-20T08:00:00.000Z");
    const incident = {
      _id: "incident-1",
      employeeId: "parttime-1",
      restaurantId: "restaurant-1",
      sourceType: "timesheet",
      sourceId: "timesheet-1",
      eventType: "ATTENDANCE_LATE",
      occurredAt,
      scoreImpactStatus: "eligible",
      responsibilityStatus: "staff_responsible",
      proposedScoreDelta: -5,
      save: mocks.incidentSave,
    };
    const snapshot = {
      finalPerformanceScore: 100,
      save: mocks.snapshotSave,
    };

    mocks.incidentFindById.mockResolvedValue(incident);
    mocks.snapshotFindOne.mockResolvedValue(null);
    mocks.snapshotFindOneAndUpdate.mockResolvedValue(snapshot);
    mocks.adjustmentCreate.mockResolvedValue([{ _id: "adjustment-1" }]);

    await applyPerformanceIncidentScore({
      incidentId: incident._id,
      actor: { id: "manager-1", userType: "MANAGER", roleName: "manager" },
      note: "Demo apply",
    });

    expect(mocks.snapshotFindOneAndUpdate).toHaveBeenCalledWith(
      {
        employeeId: incident.employeeId,
        restaurantId: incident.restaurantId,
        periodStart: new Date("2026-07-01T00:00:00.000Z"),
        periodEnd: new Date("2026-07-31T23:59:59.999Z"),
      },
      { $setOnInsert: { finalPerformanceScore: 100 } },
      { upsert: true, new: true, session: mocks.session },
    );
    expect(snapshot.finalPerformanceScore).toBe(95);
    expect(mocks.snapshotSave).toHaveBeenCalledWith({ session: mocks.session });
    expect(incident.scoreImpactStatus).toBe("applied");
    expect(mocks.session.endSession).toHaveBeenCalled();
  });
});
