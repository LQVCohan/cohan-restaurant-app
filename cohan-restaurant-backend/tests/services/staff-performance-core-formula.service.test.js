import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  staffFindById: vi.fn(),
  staffFind: vi.fn(),
  timesheetFind: vi.fn(),
  shiftFind: vi.fn(),
  acrCountDocuments: vi.fn(),
  reviewFindOne: vi.fn(),
  orderAggregate: vi.fn(),
  customerReviewAggregate: vi.fn(),
  snapshotFindOneAndUpdate: vi.fn(),
}));

vi.mock("../../models/index.js", () => ({
  Staff: { findById: mocks.staffFindById, find: mocks.staffFind },
  Timesheet: { find: mocks.timesheetFind },
  Shift: { find: mocks.shiftFind },
  AttendanceCorrectionRequest: { countDocuments: mocks.acrCountDocuments },
  StaffPerformanceReview: { findOne: mocks.reviewFindOne },
  Order: { aggregate: mocks.orderAggregate },
  Review: { aggregate: mocks.customerReviewAggregate },
  StaffPerformanceSnapshot: { findOneAndUpdate: mocks.snapshotFindOneAndUpdate },
}));

import { recalculateStaffPerformanceSnapshots } from "../../src/services/staffPerformance/staffPerformance.service.js";

const employeeId = "6826acdf2c5f3a7493d1a001";
const restaurantId = "6826acdf2c5f3a7493d1b001";
const periodStart = "2026-05-01";
const periodEnd = "2026-05-15";

function chainLean(value) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

function snapshotDoc() {
  return {
    _id: "snap-1",
    employeeId: { _id: employeeId, fullName: "NV A", employeeCode: "E01" },
    restaurantId,
    periodStart: new Date("2026-05-01T00:00:00.000Z"),
    periodEnd: new Date("2026-05-15T23:59:59.999Z"),
  };
}

async function runCalc() {
  await recalculateStaffPerformanceSnapshots({
    input: { employeeId, restaurantId, periodStart, periodEnd },
    ctx: { user: { id: "m1", roleName: "manager", fullName: "Manager" } },
  });
  return mocks.snapshotFindOneAndUpdate.mock.calls.at(-1)[1].$set;
}

describe("staffPerformance core formula", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.staffFind.mockReturnValue({ select: vi.fn().mockReturnValue(chainLean([{ _id: employeeId }])) });
    mocks.staffFindById.mockReturnValue(chainLean({ _id: employeeId, userType: "STAFF", deletedAt: null }));
    mocks.timesheetFind.mockReturnValue(chainLean([]));
    mocks.shiftFind.mockReturnValue(chainLean([]));
    mocks.acrCountDocuments.mockResolvedValue(0);
    mocks.reviewFindOne.mockReturnValue(chainLean(null));
    mocks.orderAggregate.mockResolvedValue([]);
    mocks.customerReviewAggregate.mockResolvedValue([]);
    mocks.snapshotFindOneAndUpdate.mockReturnValue({ populate: vi.fn().mockReturnValue(chainLean(snapshotDoc())) });
  });

  it("scores productivity at 100 for 8h scheduled and 480 worked", async () => {
    mocks.shiftFind.mockReturnValue(chainLean([{ startTime: new Date("2026-05-02T08:00:00Z"), endTime: new Date("2026-05-02T16:00:00Z") }]));
    mocks.timesheetFind.mockReturnValue(chainLean([{ workedMinutes: 480, latenessMinutes: 0, earlyLeaveMinutes: 0, actualCheckInAt: new Date("2026-05-02T08:00:00Z") }]));

    const set = await runCalc();
    expect(set.productivity.score).toBe(100);
  });

  it("scores productivity near 50 for 8h scheduled and 240 worked", async () => {
    mocks.shiftFind.mockReturnValue(chainLean([{ startTime: new Date("2026-05-02T08:00:00Z"), endTime: new Date("2026-05-02T16:00:00Z") }]));
    mocks.timesheetFind.mockReturnValue(chainLean([{ workedMinutes: 240, latenessMinutes: 0, earlyLeaveMinutes: 0, actualCheckInAt: new Date("2026-05-02T08:00:00Z") }]));

    const set = await runCalc();
    expect(set.productivity.score).toBe(50);
  });

  it("does not fallback productivity to 75 when scheduled exists but no worked minutes", async () => {
    mocks.shiftFind.mockReturnValue(chainLean([{ startTime: new Date("2026-05-02T08:00:00Z"), endTime: new Date("2026-05-02T16:00:00Z") }]));
    mocks.timesheetFind.mockReturnValue(chainLean([{ workedMinutes: 0, latenessMinutes: 0, earlyLeaveMinutes: 0, actualCheckInAt: null, actualCheckOutAt: null }]));

    const set = await runCalc();
    expect(set.productivity.score).toBe(0);
  });

  it("marks insufficientData when no activity exists", async () => {
    const set = await runCalc();
    expect(set.finalPerformanceScore).toBe(0);
    expect(set.performanceLevel).toBe("poor");
    expect(set.factors.insufficientData).toBe(true);
  });

  it("keeps productivity unchanged when only orderCount changes", async () => {
    mocks.shiftFind.mockReturnValue(chainLean([{ startTime: new Date("2026-05-02T08:00:00Z"), endTime: new Date("2026-05-02T16:00:00Z") }]));
    mocks.timesheetFind.mockReturnValue(chainLean([{ workedMinutes: 240, latenessMinutes: 0, earlyLeaveMinutes: 0, actualCheckInAt: new Date("2026-05-02T08:00:00Z") }]));
    mocks.orderAggregate.mockResolvedValueOnce([{ _id: "u1", orderCount: 5 }]).mockResolvedValueOnce([{ _id: employeeId, orderCount: 50 }]);
    const first = await runCalc();

    mocks.orderAggregate.mockResolvedValueOnce([{ _id: "u1", orderCount: 999 }, { _id: employeeId, orderCount: 1 }]);
    const second = await runCalc();
    expect(first.productivity.score).toBe(second.productivity.score);
  });

  it("uses skillScore for quality and managerRatingScore for managerReview only", async () => {
    mocks.shiftFind.mockReturnValue(chainLean([{ startTime: new Date("2026-05-02T08:00:00Z"), endTime: new Date("2026-05-02T16:00:00Z") }]));
    mocks.timesheetFind.mockReturnValue(chainLean([{ workedMinutes: 480, latenessMinutes: 0, earlyLeaveMinutes: 0, actualCheckInAt: new Date("2026-05-02T08:00:00Z") }]));
    mocks.reviewFindOne.mockReturnValue(chainLean({ managerRatingScore: 92, skillScore: 61, attitudeScore: 10, teamworkScore: 20 }));

    const set = await runCalc();
    expect(set.quality.score).toBe(61);
    expect(set.managerReview.score).toBe(92);
  });
});
