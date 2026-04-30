import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  updateManyMock: vi.fn(),
  Staff: {},
  Role: {},
  EventLog: {},
  Shift: {},
  Timesheet: {},
  LeaveRequest: {},
  LeaveBalance: {},
  PayrollSetting: {},
  PayrollPeriod: {},
  PayrollItem: {},
  PayrollAdjustment: {},
  EmployeeCodeCounter: {},
  Notification: {},
  SchedulePublication: {},
  ShiftAcknowledgement: { updateMany: vi.fn() },
}));

modelMocks.ShiftAcknowledgement.updateMany = modelMocks.updateManyMock;

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn() } }));
vi.mock("../../src/services/staffPerformance/staffPerformance.service.js", () => ({
  recalculateStaffPerformanceSnapshots: vi.fn(),
  upsertStaffPerformanceReview: vi.fn(),
}));
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => ({ updateSchedulingPolicy: vi.fn() }));
vi.mock("../../src/services/scheduling/shiftAssignmentValidation.service.js", () => ({
  assertShiftAssignmentValid: vi.fn(),
  validateShiftAssignment: vi.fn(),
}));
vi.mock("../../src/services/attendance/attendanceCorrectionWorkflow.service.js", () => ({
  approveAttendanceCorrectionRequest: vi.fn(),
  cancelAttendanceCorrectionRequest: vi.fn(),
  createAttendanceCorrectionRequest: vi.fn(),
  rejectAttendanceCorrectionRequest: vi.fn(),
}));
vi.mock("../../src/services/overtime/overtimeRequest.service.js", () => ({
  approveOvertimeRequest: vi.fn(),
  cancelOvertimeRequest: vi.fn(),
  completeOvertimeRequest: vi.fn(),
  confirmOvertimeRequest: vi.fn(),
  createOvertimeRequest: vi.fn(),
  rejectOvertimeRequest: vi.fn(),
}));
vi.mock("../../src/services/payroll/payrollRuntime.service.js", () => ({
  getPayrollSettings: vi.fn(),
  getPeriodDetail: vi.fn(),
  mapPayrollDocToGql: vi.fn(),
  toEndOfDay: vi.fn(),
  toObjectId: vi.fn(),
  toStartOfDay: vi.fn(),
  upsertPeriodItems: vi.fn(),
}));
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => ({ assertNoLockedPayrollPeriodOverlap: vi.fn() }));
vi.mock("../../src/services/payroll/payrollValidation.service.js", () => ({
  validatePayrollPeriod: vi.fn(),
  hasBlockingPayrollIssues: vi.fn(),
}));
vi.mock("../../src/services/payroll/payrollPermission.service.js", () => ({ assertPayrollPermission: vi.fn() }));
vi.mock("../../src/services/payroll/payrollEventLog.service.js", () => ({ logPayrollEvent: vi.fn() }));
vi.mock("../../src/config/payrollPolicy.vn.js", () => ({ getPayrollPolicyForDate: vi.fn() }));
vi.mock("../../src/services/scheduling/scheduleLifecycle.service.js", () => ({
  mapSchedulePublicationOutput: vi.fn(),
  resolveScheduleLifecycleStatus: vi.fn(),
}));
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: {
      ObjectId: function ObjectId(value) {
        return { __oid: value };
      },
    },
  },
}));

describe("shift acknowledgement mutation resolvers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.updateManyMock.mockResolvedValue({ modifiedCount: 1 });
  });

  it("blocks anonymous users from expiring pending acknowledgements", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;

    await expect(
      mutation.expirePendingShiftAcknowledgements(null, {}, { user: null }),
    ).rejects.toThrow("UNAUTHENTICATED");
    expect(modelMocks.updateManyMock).not.toHaveBeenCalled();
  });

  it("blocks authenticated users without manager/admin roles", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;

    await expect(
      mutation.expirePendingShiftAcknowledgements(null, {}, { user: { id: "staff-1", roles: ["staff"] } }),
    ).rejects.toThrow("FORBIDDEN");
    expect(modelMocks.updateManyMock).not.toHaveBeenCalled();
  });

  it("allows manager/admin and expires only pending rows past deadline", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;

    const result = await mutation.expirePendingShiftAcknowledgements(
      null,
      {},
      { user: { id: "mgr-1", roles: ["manager"] } },
    );

    expect(result).toBe(1);
    expect(modelMocks.updateManyMock).toHaveBeenCalledTimes(1);
    const [filter, update] = modelMocks.updateManyMock.mock.calls[0];
    expect(filter.status).toBe("pending");
    expect(filter.deadlineAt.$lt).toBeInstanceOf(Date);
    expect(update).toEqual({ $set: { status: "expired" } });
  });
});
