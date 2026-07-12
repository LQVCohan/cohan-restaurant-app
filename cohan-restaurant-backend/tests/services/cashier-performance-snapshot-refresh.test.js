import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  enrich: vi.fn(),
  applyPolicy: vi.fn(),
}));

vi.mock("mongoose", () => {
  function ObjectId(value) {
    this.value = String(value);
    this.toString = () => this.value;
  }
  return {
    default: {
      isValidObjectId: vi.fn((value) => Boolean(value)),
      Types: { ObjectId },
    },
  };
});

vi.mock("../../models/index.js", () => ({
  StaffPerformanceSnapshot: { find: mocks.find },
}));
vi.mock(
  "../../src/services/staffPerformance/cashierShiftReconciliation.service.js",
  () => ({
    enrichCashierPerformanceRecalculationResult: mocks.enrich,
  }),
);
vi.mock(
  "../../src/services/staffPerformance/staffPerformancePolicy.service.js",
  () => ({
    applyPerformancePolicyToRecalculationResult: mocks.applyPolicy,
  }),
);

const queryResult = (value) => {
  const query = {
    populate: vi.fn(),
    lean: vi.fn().mockResolvedValue(value),
  };
  query.populate.mockReturnValue(query);
  return query;
};

describe("cashier performance snapshot refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enrich.mockImplementation(async ({ result }) =>
      result.map((snapshot) => ({ ...snapshot, finalPerformanceScore: 81 })),
    );
    mocks.applyPolicy.mockImplementation(async ({ result }) => result);
  });

  it("recalculates only snapshots overlapping the reviewed cashier shift", async () => {
    mocks.find.mockReturnValue(
      queryResult([
        {
          _id: "snapshot-1",
          employeeId: {
            _id: "cashier-1",
            fullName: "Nguyễn Thu Ngân",
            positionTitle: "Thu ngân",
          },
          restaurantId: "restaurant-1",
          periodStart: new Date("2026-07-01T00:00:00.000Z"),
          periodEnd: new Date("2026-07-31T23:59:59.999Z"),
          productivity: { score: 80 },
          punctuality: { score: 80 },
          quality: { score: 80 },
          managerReview: { score: 80 },
          compliance: { score: 80 },
          factors: {},
        },
      ]),
    );
    const { refreshCashierPerformanceSnapshotsForReconciliation } =
      await import(
        "../../src/services/staffPerformance/cashierPerformanceSnapshotRefresh.service.js"
      );

    const result = await refreshCashierPerformanceSnapshotsForReconciliation({
      restaurantId: "restaurant-1",
      cashierId: "cashier-1",
      openedAt: "2026-07-12T01:00:00.000Z",
      closedAt: "2026-07-12T09:00:00.000Z",
    });

    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        periodStart: { $lte: new Date("2026-07-12T09:00:00.000Z") },
        periodEnd: { $gte: new Date("2026-07-12T01:00:00.000Z") },
      }),
    );
    expect(mocks.enrich).toHaveBeenCalledWith(
      expect.objectContaining({
        result: [expect.objectContaining({ id: "snapshot-1" })],
      }),
    );
    expect(mocks.applyPolicy).toHaveBeenCalled();
    expect(result[0].finalPerformanceScore).toBe(81);
  });

  it("does nothing when no saved performance period overlaps", async () => {
    mocks.find.mockReturnValue(queryResult([]));
    const { refreshCashierPerformanceSnapshotsForReconciliation } =
      await import(
        "../../src/services/staffPerformance/cashierPerformanceSnapshotRefresh.service.js"
      );

    await expect(
      refreshCashierPerformanceSnapshotsForReconciliation({
        restaurantId: "restaurant-1",
        cashierId: "cashier-1",
        openedAt: "2026-07-12T01:00:00.000Z",
        closedAt: "2026-07-12T09:00:00.000Z",
      }),
    ).resolves.toEqual([]);
    expect(mocks.enrich).not.toHaveBeenCalled();
    expect(mocks.applyPolicy).not.toHaveBeenCalled();
  });
});
