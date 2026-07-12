import { beforeEach, describe, expect, it, vi } from "vitest";

const ids = {
  shiftId: "64b000000000000000000011",
  restaurantId: "64b000000000000000000012",
  employeeId: "64b000000000000000000013",
  requestId: "64b000000000000000000014",
  timesheetId: "64b000000000000000000015",
};

const staffMutationMock = vi.hoisted(() => ({
  checkInShift: vi.fn(),
  checkOutShift: vi.fn(),
  upsertStaffAttendance: vi.fn(),
  completeOvertimeRequest: vi.fn(),
  markPayrollItemPaid: vi.fn(),
}));

const modelMocks = vi.hoisted(() => ({
  OvertimeRequest: { findById: vi.fn() },
  Shift: { findById: vi.fn() },
  Timesheet: { findOne: vi.fn() },
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
  const result = {
    select: vi.fn(),
    sort: vi.fn(),
    lean: vi.fn(async () => value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  result.select.mockReturnValue(result);
  result.sort.mockReturnValue(result);
  return result;
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
    modelMocks.OvertimeRequest.findById.mockReturnValue(
      query({
        _id: ids.requestId,
        employeeId: ids.employeeId,
        restaurantId: ids.restaurantId,
        shiftId: ids.shiftId,
        timesheetId: ids.timesheetId,
        workDate: new Date("2026-06-02T00:00:00.000Z"),
      }),
    );
    modelMocks.Timesheet.findOne.mockReturnValue(
      query({
        _id: ids.timesheetId,
        employeeId: ids.employeeId,
        restaurantId: ids.restaurantId,
        overtimeMinutes: 60,
      }),
    );
    staffMutationMock.checkInShift.mockResolvedValue({ id: "attendance-1" });
    staffMutationMock.checkOutShift.mockResolvedValue({ id: "attendance-1" });
    staffMutationMock.upsertStaffAttendance.mockResolvedValue({
      id: "attendance-1",
    });
    staffMutationMock.completeOvertimeRequest.mockResolvedValue({
      id: ids.requestId,
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

  it("uses the Timesheet overtime as the completion source of truth", async () => {
    const mutation = (
      await import(
        "../../graphql/resolvers/staff/payrollProtectedAttendance.mutation.js"
      )
    ).default;

    await mutation.completeOvertimeRequest(
      null,
      { id: ids.requestId },
      { user: { id: "manager-1", userType: "MANAGER" } },
      undefined,
    );

    expect(staffMutationMock.completeOvertimeRequest).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        input: expect.objectContaining({
          requestId: ids.requestId,
          actualOvertimeMinutes: 60,
        }),
      }),
      expect.anything(),
      undefined,
    );
  });

  it("rejects completion minutes that differ from recorded attendance", async () => {
    const mutation = (
      await import(
        "../../graphql/resolvers/staff/payrollProtectedAttendance.mutation.js"
      )
    ).default;

    await expect(
      mutation.completeOvertimeRequest(
        null,
        {
          input: {
            requestId: ids.requestId,
            actualOvertimeMinutes: 90,
          },
        },
        { user: { id: "manager-1", userType: "MANAGER" } },
        undefined,
      ),
    ).rejects.toThrow(/bản ghi chấm công/i);

    expect(staffMutationMock.completeOvertimeRequest).not.toHaveBeenCalled();
  });

  it("rejects payable overtime above the recorded actual minutes", async () => {
    const mutation = (
      await import(
        "../../graphql/resolvers/staff/payrollProtectedAttendance.mutation.js"
      )
    ).default;

    await expect(
      mutation.completeOvertimeRequest(
        null,
        {
          input: {
            requestId: ids.requestId,
            approvedOvertimeMinutes: 90,
          },
        },
        { user: { id: "manager-1", userType: "MANAGER" } },
        undefined,
      ),
    ).rejects.toThrow(/không được vượt/i);

    expect(staffMutationMock.completeOvertimeRequest).not.toHaveBeenCalled();
  });
});
