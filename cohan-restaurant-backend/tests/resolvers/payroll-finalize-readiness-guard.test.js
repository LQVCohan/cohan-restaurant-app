import { beforeEach, describe, expect, it, vi } from "vitest";

const guardMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(async () => true),
}));

const permissionMocks = vi.hoisted(() => ({
  assertPayrollPermission: vi.fn(),
}));

const readinessMocks = vi.hoisted(() => ({
  buildPayrollReadiness: vi.fn(),
}));

const eventMocks = vi.hoisted(() => ({
  logPayrollEvent: vi.fn(async () => true),
}));

const modelMocks = vi.hoisted(() => ({
  PayrollPeriod: {
    findById: vi.fn(),
  },
}));

const staffMutationMocks = vi.hoisted(() => ({
  finalizePayrollPeriod: vi.fn(async () => ({ id: "p1", status: "finalized" })),
}));

vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/payroll/payrollPermission.service.js", () => permissionMocks);
vi.mock("../../src/services/payroll/payrollReadiness.service.js", () => readinessMocks);
vi.mock("../../src/services/payroll/payrollEventLog.service.js", () => eventMocks);
vi.mock("../../graphql/resolvers/staff/mutation.js", () => ({
  default: staffMutationMocks,
}));

const buildPeriod = () => ({
  _id: "p1",
  restaurantId: "r1",
  status: "draft",
});

describe("payroll finalize readiness guard resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.PayrollPeriod.findById.mockResolvedValue(buildPeriod());
    readinessMocks.buildPayrollReadiness.mockResolvedValue({
      readyToFinalize: true,
      blockingCount: 0,
      warningCount: 0,
      issues: [],
    });
  });

  it("throws PAYROLL_PERIOD_NOT_READY and does not call legacy finalize when readiness blocks", async () => {
    readinessMocks.buildPayrollReadiness.mockResolvedValueOnce({
      readyToFinalize: false,
      blockingCount: 2,
      warningCount: 1,
      issues: [
        { code: "SCHEDULE_NOT_PUBLISHED" },
        { code: "ATTENDANCE_CORRECTION_PENDING" },
      ],
    });

    const resolver = (await import("../../graphql/resolvers/staff/payrollFinalizeReadiness.mutation.js")).default;

    await expect(
      resolver.finalizePayrollPeriod(null, { periodId: "p1" }, { user: { id: "u1" } }),
    ).rejects.toThrow("PAYROLL_PERIOD_NOT_READY");

    expect(guardMocks.requireAuth).toHaveBeenCalled();
    expect(permissionMocks.assertPayrollPermission).toHaveBeenCalledWith(
      { user: { id: "u1" } },
      "payroll.period.finalize",
    );
    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      { user: { id: "u1" } },
      "r1",
    );
    expect(eventMocks.logPayrollEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "r1",
        verb: "payroll.readiness.failed",
        status: "failed",
        meta: expect.objectContaining({
          blockingCount: 2,
          warningCount: 1,
          issueCodes: ["SCHEDULE_NOT_PUBLISHED", "ATTENDANCE_CORRECTION_PENDING"],
        }),
      }),
    );
    expect(staffMutationMocks.finalizePayrollPeriod).not.toHaveBeenCalled();
  });

  it("delegates to legacy finalize resolver when readiness passes", async () => {
    const resolver = (await import("../../graphql/resolvers/staff/payrollFinalizeReadiness.mutation.js")).default;

    const result = await resolver.finalizePayrollPeriod(
      null,
      { periodId: "p1" },
      { user: { id: "u1" } },
    );

    expect(readinessMocks.buildPayrollReadiness).toHaveBeenCalledWith({
      periodId: "p1",
      actor: { id: "u1" },
      context: { user: { id: "u1" } },
    });
    expect(staffMutationMocks.finalizePayrollPeriod).toHaveBeenCalledWith(
      null,
      { periodId: "p1" },
      { user: { id: "u1" } },
    );
    expect(result).toEqual({ id: "p1", status: "finalized" });
  });

  it("checks period status before readiness", async () => {
    modelMocks.PayrollPeriod.findById.mockResolvedValueOnce({
      ...buildPeriod(),
      status: "finalized",
    });

    const resolver = (await import("../../graphql/resolvers/staff/payrollFinalizeReadiness.mutation.js")).default;

    await expect(
      resolver.finalizePayrollPeriod(null, { periodId: "p1" }, { user: { id: "u1" } }),
    ).rejects.toThrow("Chỉ có thể chốt kỳ lương đang ở trạng thái nháp.");

    expect(readinessMocks.buildPayrollReadiness).not.toHaveBeenCalled();
    expect(staffMutationMocks.finalizePayrollPeriod).not.toHaveBeenCalled();
  });
});
