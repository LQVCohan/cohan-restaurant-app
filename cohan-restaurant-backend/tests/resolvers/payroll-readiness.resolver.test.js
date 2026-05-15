import { beforeEach, describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(async () => true),
}));
const permissions = vi.hoisted(() => ({ assertPayrollPermission: vi.fn() }));
const readinessService = vi.hoisted(() => ({
  buildPayrollReadiness: vi.fn(async () => ({
    periodId: "p1",
    restaurantId: "r1",
    status: "draft",
    readyToFinalize: true,
    blockingCount: 0,
    warningCount: 0,
    sections: {
      schedule: { status: "ready", blockingCount: 0, warningCount: 0, metrics: {}, issues: [] },
      attendance: { status: "ready", blockingCount: 0, warningCount: 0, metrics: {}, issues: [] },
      approvals: { status: "ready", blockingCount: 0, warningCount: 0, metrics: {}, issues: [] },
      payroll: { status: "ready", blockingCount: 0, warningCount: 0, metrics: {}, issues: [] },
    },
    issues: [],
  })),
}));
const modelMocks = vi.hoisted(() => ({ PayrollPeriod: { findById: vi.fn() } }));

vi.mock("../../graphql/guards.js", () => guards);
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/payroll/payrollPermission.service.js", () => permissions);
vi.mock("../../src/services/payroll/payrollReadiness.service.js", () => readinessService);

const periodChain = (value) => ({
  select: vi.fn().mockReturnThis(),
  lean: vi.fn(async () => value),
});

describe("payrollReadiness resolver", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.PayrollPeriod.findById.mockReturnValue(periodChain({ _id: "p1", restaurantId: "r1" }));
  });

  it("checks access and calls the readiness service", async () => {
    const query = (await import("../../graphql/resolvers/staff/payrollReadiness.query.js")).default;
    const ctx = { user: { id: "u1", userType: "MANAGER" } };

    const result = await query.payrollReadiness(null, { periodId: "p1" }, ctx);

    expect(guards.requireAuth).toHaveBeenCalledWith(ctx);
    expect(permissions.assertPayrollPermission).toHaveBeenCalledWith(ctx, "payroll.view");
    expect(guards.requireRestaurantAccess).toHaveBeenCalledWith(ctx, "r1");
    expect(readinessService.buildPayrollReadiness).toHaveBeenCalledWith({
      periodId: "p1",
      actor: ctx.user,
      context: ctx,
    });
    expect(result.readyToFinalize).toBe(true);
  });

  it("throws PAYROLL_PERIOD_NOT_FOUND when period is missing", async () => {
    modelMocks.PayrollPeriod.findById.mockReturnValueOnce(periodChain(null));
    const query = (await import("../../graphql/resolvers/staff/payrollReadiness.query.js")).default;

    await expect(
      query.payrollReadiness(null, { periodId: "missing" }, { user: { id: "u1", userType: "ADMIN" } }),
    ).rejects.toThrow("PAYROLL_PERIOD_NOT_FOUND");
    expect(readinessService.buildPayrollReadiness).not.toHaveBeenCalled();
  });

  it("rejects a user without payroll permission", async () => {
    permissions.assertPayrollPermission.mockImplementationOnce(() => {
      throw new Error("FORBIDDEN");
    });
    const query = (await import("../../graphql/resolvers/staff/payrollReadiness.query.js")).default;

    await expect(
      query.payrollReadiness(null, { periodId: "p1" }, { user: { id: "staff", userType: "STAFF" } }),
    ).rejects.toThrow("FORBIDDEN");
    expect(guards.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(readinessService.buildPayrollReadiness).not.toHaveBeenCalled();
  });
});
