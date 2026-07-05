import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  staffPerformanceSnapshots: vi.fn(),
  staffPayrollOverview: vi.fn(),
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(),
}));

vi.mock("../../graphql/resolvers/staff/query.js", () => ({
  default: {
    staffPerformanceSnapshots: mocks.staffPerformanceSnapshots,
    staffPayrollOverview: mocks.staffPayrollOverview,
  },
}));
vi.mock("../../graphql/resolvers/staff/payrollReadiness.query.js", () => ({ default: {} }));
vi.mock("../../graphql/resolvers/staff/mutation.js", () => ({ default: {} }));
vi.mock("../../graphql/resolvers/staff/staffAvatar.mutation.js", () => ({ default: {} }));
vi.mock("../../graphql/resolvers/staff/payrollFinalizeReadiness.mutation.js", () => ({ default: {} }));
vi.mock("../../graphql/resolvers/staff/payrollProtectedAttendance.mutation.js", () => ({ default: {} }));
vi.mock("../../graphql/guards.js", () => ({
  requireAuth: mocks.requireAuth,
  requireRestaurantAccess: mocks.requireRestaurantAccess,
}));

import resolvers from "../../graphql/resolvers/staff/index.js";

const resolveSnapshots = resolvers.Query.staffPerformanceSnapshots;

describe("staff performance snapshot query scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRestaurantAccess.mockResolvedValue(undefined);
    mocks.staffPerformanceSnapshots.mockResolvedValue([]);
  });

  it("checks restaurant access before delegating", async () => {
    mocks.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN"));

    await expect(
      resolveSnapshots(null, { filter: { restaurantId: "r1" } }, { user: { id: "manager-1" } }),
    ).rejects.toThrow("FORBIDDEN");

    expect(mocks.requireAuth).toHaveBeenCalled();
    expect(mocks.staffPerformanceSnapshots).not.toHaveBeenCalled();
  });

  it("normalizes legacy top-level period arguments into the scoped filter", async () => {
    await resolveSnapshots(
      null,
      {
        restaurantId: "r1",
        periodStart: "2026-07-01T00:00:00.000Z",
        periodEnd: "2026-07-31T23:59:59.999Z",
      },
      { user: { id: "manager-1" } },
    );

    expect(mocks.requireRestaurantAccess).toHaveBeenCalledWith(expect.anything(), "r1");
    expect(mocks.staffPerformanceSnapshots).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        filter: expect.objectContaining({
          restaurantId: "r1",
          periodStart: "2026-07-01T00:00:00.000Z",
          periodEnd: "2026-07-31T23:59:59.999Z",
        }),
      }),
      expect.anything(),
      undefined,
    );
  });

  it("allows staff to read only their own snapshots without restaurantId", async () => {
    await resolveSnapshots(
      null,
      { filter: { employeeId: "staff-1" } },
      { user: { id: "staff-1" } },
    );

    expect(mocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(mocks.staffPerformanceSnapshots).toHaveBeenCalled();
  });

  it("blocks unscoped access to another employee", async () => {
    await expect(
      resolveSnapshots(
        null,
        { filter: { employeeId: "staff-2" } },
        { user: { id: "manager-1" } },
      ),
    ).rejects.toThrow("restaurantId is required");

    expect(mocks.staffPerformanceSnapshots).not.toHaveBeenCalled();
  });
});
