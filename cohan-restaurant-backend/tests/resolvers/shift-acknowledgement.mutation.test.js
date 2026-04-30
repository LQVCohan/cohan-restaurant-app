import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  updateManyMock: vi.fn(),
  findByIdMock: vi.fn(),
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
  ShiftAcknowledgement: { updateMany: vi.fn(), findById: vi.fn() },
}));

modelMocks.ShiftAcknowledgement.updateMany = modelMocks.updateManyMock;
modelMocks.ShiftAcknowledgement.findById = modelMocks.findByIdMock;

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

  function buildAckDoc({ employeeId = { __oid: "staff-1" }, status = "pending", deadlineAt = "2099-01-01T00:00:00.000Z" } = {}) {
    return {
      employeeId,
      status,
      deadlineAt,
      reason: "",
      reasonCategory: "other",
      declineClassification: "unknown",
      save: vi.fn().mockResolvedValue(true),
    };
  }
  function oid(value) {
    return { __oid: value, toString: () => value };
  }

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

  it("accepts pending acknowledgement owned by current staff", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    const doc = buildAckDoc();
    modelMocks.findByIdMock.mockResolvedValue(doc);

    const result = await mutation.acceptShiftAcknowledgement(
      null,
      { id: "ack-1", note: "ok" },
      { user: { id: "staff-1", roles: ["staff"] } },
    );

    expect(result.status).toBe("accepted");
    expect(result.respondedAt).toBeInstanceOf(Date);
    expect(result.reason).toBe("ok");
    expect(result.declineClassification).toBe("unknown");
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  it("declines pending acknowledgement before deadline as valid", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    const doc = buildAckDoc({ deadlineAt: "2099-01-01T00:00:00.000Z" });
    modelMocks.findByIdMock.mockResolvedValue(doc);

    const result = await mutation.declineShiftAcknowledgement(
      null,
      { id: "ack-1", reasonCategory: "sick", reason: "  ill  " },
      { user: { id: "staff-1", roles: ["staff"] } },
    );

    expect(result.status).toBe("declined");
    expect(result.reason).toBe("ill");
    expect(result.declineClassification).toBe("valid");
    expect(result.respondedAt).toBeInstanceOf(Date);
  });

  it("declines pending acknowledgement after deadline as late", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    const doc = buildAckDoc({ deadlineAt: "2000-01-01T00:00:00.000Z" });
    modelMocks.findByIdMock.mockResolvedValue(doc);

    const result = await mutation.declineShiftAcknowledgement(
      null,
      { id: "ack-1", reasonCategory: "other", reason: "conflict" },
      { user: { id: "staff-1", roles: ["staff"] } },
    );

    expect(result.declineClassification).toBe("late");
  });

  it.each(["accepted", "declined"])("blocks responding when already %s", async (status) => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    modelMocks.findByIdMock.mockResolvedValue(buildAckDoc({ status }));

    await expect(
      mutation.acceptShiftAcknowledgement(null, { id: "ack-1", note: "" }, { user: { id: "staff-1", roles: ["staff"] } }),
    ).rejects.toThrow("SHIFT_ACKNOWLEDGEMENT_ALREADY_RESPONDED");

    await expect(
      mutation.declineShiftAcknowledgement(
        null,
        { id: "ack-1", reasonCategory: "other", reason: "x" },
        { user: { id: "staff-1", roles: ["staff"] } },
      ),
    ).rejects.toThrow("SHIFT_ACKNOWLEDGEMENT_ALREADY_RESPONDED");
  });

  it.each(["expired", "cancelled"])("blocks responding when status is %s", async (status) => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    modelMocks.findByIdMock.mockResolvedValue(buildAckDoc({ status }));
    const expectedCode = status === "expired" ? "SHIFT_ACKNOWLEDGEMENT_EXPIRED" : "SHIFT_ACKNOWLEDGEMENT_CANCELLED";

    await expect(
      mutation.acceptShiftAcknowledgement(null, { id: "ack-1", note: "" }, { user: { id: "staff-1", roles: ["staff"] } }),
    ).rejects.toThrow(expectedCode);

    await expect(
      mutation.declineShiftAcknowledgement(
        null,
        { id: "ack-1", reasonCategory: "other", reason: "x" },
        { user: { id: "staff-1", roles: ["staff"] } },
      ),
    ).rejects.toThrow(expectedCode);
  });

  it("blocks staff from responding to someone else's acknowledgement", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    modelMocks.findByIdMock.mockResolvedValue(buildAckDoc({ employeeId: oid("staff-2") }));

    await expect(
      mutation.acceptShiftAcknowledgement(null, { id: "ack-1", note: "" }, { user: { id: "staff-1", roles: ["staff"] } }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it.each([
    ["HR", ["hr"]],
    ["ACCOUNTANT", ["accountant"]],
    ["MANAGER", ["manager"]],
    ["ADMIN", ["admin"]],
  ])("blocks %s from responding for other employee", async (_, roles) => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    modelMocks.findByIdMock.mockResolvedValue(buildAckDoc({ employeeId: oid("staff-2") }));

    await expect(
      mutation.declineShiftAcknowledgement(
        null,
        { id: "ack-1", reasonCategory: "other", reason: "x" },
        { user: { id: "staff-1", roles } },
      ),
    ).rejects.toThrow("FORBIDDEN");
  });
});
