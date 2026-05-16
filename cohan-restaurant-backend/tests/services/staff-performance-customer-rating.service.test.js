import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  staffFindById: vi.fn(),
  staffFind: vi.fn(),
  timesheetFind: vi.fn(),
  shiftCountDocuments: vi.fn(),
  acrCountDocuments: vi.fn(),
  reviewFindOne: vi.fn(),
  orderAggregate: vi.fn(),
  customerReviewAggregate: vi.fn(),
  snapshotFindOneAndUpdate: vi.fn(),
}));

vi.mock("../../models/index.js", () => ({
  Staff: {
    findById: mocks.staffFindById,
    find: mocks.staffFind,
  },
  Timesheet: { find: mocks.timesheetFind },
  Shift: { countDocuments: mocks.shiftCountDocuments },
  AttendanceCorrectionRequest: { countDocuments: mocks.acrCountDocuments },
  StaffPerformanceReview: { findOne: mocks.reviewFindOne },
  Order: { aggregate: mocks.orderAggregate },
  Review: { aggregate: mocks.customerReviewAggregate },
  StaffPerformanceSnapshot: { findOneAndUpdate: mocks.snapshotFindOneAndUpdate },
}));

import { recalculateStaffPerformanceSnapshots } from "../../src/services/staffPerformance/staffPerformance.service.js";

const employeeId = "6826acdf2c5f3a7493d1a001";
const restaurantId = "6826acdf2c5f3a7493d1b001";

function chainLean(value) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

function snapshotDocWithScore(finalPerformanceScore = 69) {
  return {
    _id: "snap-1",
    employeeId: { _id: employeeId, fullName: "NV A", employeeCode: "E01" },
    restaurantId,
    periodStart: new Date("2026-05-01T00:00:00.000Z"),
    periodEnd: new Date("2026-05-15T23:59:59.999Z"),
    productivity: { score: 75, weight: 25, note: "" },
    punctuality: { score: 75, weight: 25, note: "" },
    quality: { score: 75, weight: 20, note: "" },
    managerReview: { score: 60, weight: 20, note: "" },
    compliance: { score: 60, weight: 10, note: "" },
    finalPerformanceScore,
    performanceLevel: "average",
    factors: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("staffPerformance customer rating factors", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.staffFind.mockReturnValue({ select: vi.fn().mockReturnValue(chainLean([{ _id: employeeId }])) });
    mocks.staffFindById.mockReturnValue(chainLean({ _id: employeeId, userType: "STAFF", deletedAt: null }));
    mocks.timesheetFind.mockReturnValue(chainLean([]));
    mocks.shiftCountDocuments.mockResolvedValue(0);
    mocks.acrCountDocuments.mockResolvedValue(0);
    mocks.reviewFindOne.mockReturnValue(chainLean({ managerRatingScore: 60, attitudeScore: 60, teamworkScore: 60, skillScore: 60 }));
    mocks.orderAggregate.mockResolvedValue([]);
    mocks.snapshotFindOneAndUpdate.mockReturnValue({
      populate: vi.fn().mockReturnValue(chainLean(snapshotDocWithScore())),
    });
  });

  it("ignores reviews without matching staffId and writes zero factors", async () => {
    mocks.customerReviewAggregate.mockResolvedValue([]);

    await recalculateStaffPerformanceSnapshots({
      input: { employeeId, restaurantId, periodStart: "2026-05-01", periodEnd: "2026-05-15" },
      ctx: { user: { id: "m1", roleName: "manager", fullName: "Manager" } },
    });

    const update = mocks.snapshotFindOneAndUpdate.mock.calls[0][1].$set;
    expect(update.factors.staffRate).toBe(0);
    expect(update.factors.staffRateCount).toBe(0);
    expect(update.factors.customerRatingScore).toBe(0);
  });

  it("counts reviews in period for exact staffId", async () => {
    mocks.customerReviewAggregate.mockResolvedValue([{ averageRating: 4.2, totalReviews: 5 }]);

    await recalculateStaffPerformanceSnapshots({
      input: { employeeId, restaurantId, periodStart: "2026-05-01", periodEnd: "2026-05-15" },
      ctx: { user: { id: "m1", roleName: "manager", fullName: "Manager" } },
    });

    const update = mocks.snapshotFindOneAndUpdate.mock.calls[0][1].$set;
    expect(update.factors.staffRate).toBe(4.2);
    expect(update.factors.staffRateCount).toBe(5);
    expect(update.factors.customerRatingScore).toBe(84);
  });

  it("filters only published (visible) reviews in aggregate pipeline", async () => {
    mocks.customerReviewAggregate.mockResolvedValue([{ averageRating: 4, totalReviews: 2 }]);

    await recalculateStaffPerformanceSnapshots({
      input: { employeeId, restaurantId, periodStart: "2026-05-01", periodEnd: "2026-05-15" },
      ctx: { user: { id: "m1", roleName: "manager", fullName: "Manager" } },
    });

    const pipeline = mocks.customerReviewAggregate.mock.calls[0][0];
    expect(pipeline[0].$match.status).toBe("published");
  });

  it("ignores pending/hidden/rejected reviews and counts only published", async () => {
    mocks.customerReviewAggregate.mockResolvedValue([{ averageRating: 5, totalReviews: 1 }]);

    await recalculateStaffPerformanceSnapshots({
      input: { employeeId, restaurantId, periodStart: "2026-05-01", periodEnd: "2026-05-15" },
      ctx: { user: { id: "m1", roleName: "manager", fullName: "Manager" } },
    });

    const update = mocks.snapshotFindOneAndUpdate.mock.calls[0][1].$set;
    expect(update.factors.staffRateCount).toBe(1);
    expect(update.factors.staffRate).toBe(5);
    expect(update.factors.customerRatingScore).toBe(100);
  });

  it("does not change finalPerformanceScore when only customer review data changes", async () => {
    mocks.customerReviewAggregate.mockResolvedValueOnce([]);
    await recalculateStaffPerformanceSnapshots({
      input: { employeeId, restaurantId, periodStart: "2026-05-01", periodEnd: "2026-05-15" },
      ctx: { user: { id: "m1", roleName: "manager", fullName: "Manager" } },
    });

    mocks.customerReviewAggregate.mockResolvedValueOnce([{ averageRating: 5, totalReviews: 10 }]);
    await recalculateStaffPerformanceSnapshots({
      input: { employeeId, restaurantId, periodStart: "2026-05-01", periodEnd: "2026-05-15" },
      ctx: { user: { id: "m1", roleName: "manager", fullName: "Manager" } },
    });

    const firstScore = mocks.snapshotFindOneAndUpdate.mock.calls[0][1].$set.finalPerformanceScore;
    const secondScore = mocks.snapshotFindOneAndUpdate.mock.calls[1][1].$set.finalPerformanceScore;
    expect(firstScore).toBe(secondScore);
  });
});
