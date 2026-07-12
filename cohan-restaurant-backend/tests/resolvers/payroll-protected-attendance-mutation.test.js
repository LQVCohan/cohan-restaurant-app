import { beforeEach, describe, expect, it, vi } from "vitest";

const ids = {
  shiftId: "64b000000000000000000011",
  restaurantId: "64b000000000000000000012",
  employeeId: "64b000000000000000000013",
};

const staffMutationMock = vi.hoisted(() => ({
  checkInShift: vi.fn(),
  checkOutShift: vi.fn(),
  upsertStaffAttendance: vi.fn(),
  markPayrollItemPaid: vi.fn(),
}));

const modelMocks = vi.hoisted(() => ({
  Shift: { findById: vi.fn() },
}));

const guardMocks = vi.hoisted(() => ({
  assertNoLockedPayrollPeriodOverlap: vi.fn(async () => true),
}));

vi.mock("../../graphql/resolvers/staff/mutation.js", () => ({
  default: staffMutationMock,
}));
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () =>
  guardMocks,
);

function query(value) {
  return {
    lean: vi.fn(async () => value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
}

describe("payroll protected staff mutations", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.Shift.findById.mockReturnValue(
      query({
        _id: ids.shiftId,
        restaurantId: ids.restaurantId,
        employeeId: ids.employeeId,
        startTime: new Date("2026-06-02T09:00:00.000Z"),
        endTime: new Date("2026-06-02T17:00:00.000Z"),
      }),
    );
    staffMutationMock.checkInShift.mockResolvedValue({ id: "attendance-1" });
    staffMutationMock.checkOutShift.mockResolvedValue({ id: "attendance-1" });
    staffMutationMock.upsertStaffAttendance.mockResolvedValue({
      id: "attendance-1",
    });
    staffMutationMock.markPayrollItemPaid.mockResolvedValue({
      id: "payroll-item-1",
    });
  });

  it("checks payroll lock before direct shift check-in", async () => {
    const mutation = (
      await import(
        "../../graphql/resolvers/staff/payrollProtectedAttendance.mutation.js"
      )
    ).default;

    await mutation.checkInShift(
      null,
      { shiftId: ids.shiftId },
      {},
      undefined,
    );

    expect(guardMocks.assertNoLockedPayrollPeriodOverlap).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: ids.restaurantId,
        employeeId: ids.employeeId,
        action: "attendance_check_in",
      }),
    );
    expect(staffMutationMock.checkInShift).toHaveBeenCalledTimes(1);
  });

  it("does not write attendance when payroll lock guard rejects", async () => {
    guardMocks.assertNoLockedPayrollPeriodOverlap.mockRejectedValueOnce(
      new Error("PAYROLL_PERIOD_LOCKED"),
    );
    const mutation = (
      await import(
        "../../graphql/resolvers/staff/payrollProtectedAttendance.mutation.js"
      )
    ).default;

    await expect(
      mutation.checkOutShift(
        null,
        { shiftId: ids.shiftId },
        {},
        undefined,
      ),
    ).rejects.toThrow("PAYROLL_PERIOD_LOCKED");
    expect(staffMutationMock.checkOutShift).not.toHaveBeenCalled();
  });

  it("requires staff self-service to use the published shift check-in flow", async () => {
    const mutation = (
      await import(
        "../../graphql/resolvers/staff/payrollProtectedAttendance.mutation.js"
      )
    ).default;

    await expect(
      mutation.upsertStaffAttendance(
        null,
        {
          input: {
            employeeId: ids.employeeId,
            restaurantId: ids.restaurantId,
            action: "check_in",
            timestamp: "2026-06-02T01:00:00.000Z",
          },
        },
        { user: { id: ids.employeeId, userType: "STAFF" } },
        undefined,
      ),
    ).rejects.toThrow(/ca đã công bố/i);

    expect(staffMutationMock.upsertStaffAttendance).not.toHaveBeenCalled();
  });

  it("keeps manager quick attendance available for another employee", async () => {
    const mutation = (
      await import(
        "../../graphql/resolvers/staff/payrollProtectedAttendance.mutation.js"
      )
    ).default;
    const args = {
      input: {
        employeeId: ids.employeeId,
        restaurantId: ids.restaurantId,
        action: "check_in",
      },
    };

    await mutation.upsertStaffAttendance(
      null,
      args,
      { user: { id: "64b000000000000000000099", userType: "MANAGER" } },
      undefined,
    );

    expect(staffMutationMock.upsertStaffAttendance).toHaveBeenCalledWith(
      null,
      args,
      expect.anything(),
      undefined,
    );
  });
});
