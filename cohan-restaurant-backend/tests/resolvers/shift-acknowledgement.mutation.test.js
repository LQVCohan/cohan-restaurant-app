import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  updateManyMock: vi.fn(),
  findByIdMock: vi.fn(),
  Staff: {},
  Role: {},
  EventLog: { create: vi.fn() },
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
  SchedulePublication: { findById: vi.fn() },
  ShiftAcknowledgement: { updateMany: vi.fn(), findById: vi.fn(), findOne: vi.fn() },
  Restaurant: { exists: vi.fn() },
}));

modelMocks.ShiftAcknowledgement.updateMany = modelMocks.updateManyMock;
modelMocks.ShiftAcknowledgement.findById = modelMocks.findByIdMock;
modelMocks.ShiftAcknowledgement.findOne = vi.fn();

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
    modelMocks.Restaurant.exists.mockResolvedValue(true);
    modelMocks.SchedulePublication.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: "pub-1",
        status: "published",
      }),
    });
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

  it("declines pending acknowledgement before deadline as pending manager review", async () => {
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
    expect(result.declineClassification).toBe("unknown");
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

  it("manager reviews declined acknowledgement as valid", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    const doc = {
      _id: "ack-1",
      restaurantId: oid("r1"),
      shiftId: oid("s1"),
      status: "declined",
      declineClassification: "unknown",
      save: vi.fn().mockResolvedValue(true),
    };
    modelMocks.findByIdMock.mockResolvedValue(doc);

    const result = await mutation.reviewShiftAcknowledgement(
      null,
      { input: { acknowledgementId: "ack-1", classification: "valid" } },
      { user: { id: "mgr-1", roles: ["manager"] } },
    );

    expect(result.declineClassification).toBe("valid");
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(modelMocks.EventLog.create).toHaveBeenCalledTimes(1);
  });

  it("manager reviews declined acknowledgement as invalid", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    const doc = {
      _id: "ack-2",
      restaurantId: oid("r1"),
      shiftId: oid("s2"),
      status: "declined",
      declineClassification: "unknown",
      save: vi.fn().mockResolvedValue(true),
    };
    modelMocks.findByIdMock.mockResolvedValue(doc);

    const result = await mutation.reviewShiftAcknowledgement(
      null,
      { input: { acknowledgementId: "ack-2", classification: "invalid" } },
      { user: { id: "mgr-1", roles: ["manager"] } },
    );

    expect(result.declineClassification).toBe("invalid");
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  it("blocks manager review when decline classification is late", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    const doc = {
      _id: "ack-late",
      restaurantId: oid("r1"),
      shiftId: oid("s3"),
      status: "declined",
      declineClassification: "late",
      save: vi.fn().mockResolvedValue(true),
    };
    modelMocks.findByIdMock.mockResolvedValue(doc);

    await expect(
      mutation.reviewShiftAcknowledgement(
        null,
        { input: { acknowledgementId: "ack-late", classification: "valid" } },
        { user: { id: "mgr-1", roles: ["manager"] } },
      ),
    ).rejects.toThrow("SHIFT_ACKNOWLEDGEMENT_LATE_REVIEW_NOT_ALLOWED");
    expect(doc.save).not.toHaveBeenCalled();
  });

  it("respondShiftAcknowledgement persists declined status and reason fields", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    const doc = {
      employeeId: { __oid: "staff-1" },
      publicationId: "pub-1",
      status: "pending",
      deadlineAt: "2099-01-01T00:00:00.000Z",
      reason: "",
      reasonCategory: "other",
      declineClassification: "unknown",
      save: vi.fn().mockResolvedValue(true),
    };
    modelMocks.ShiftAcknowledgement.findOne.mockResolvedValue(doc);

    const result = await mutation.respondShiftAcknowledgement(
      null,
      {
        input: {
          shiftId: "shift-1",
          response: "decline",
          reason: "Không thể đi làm ca này",
          reasonCategory: "personal",
        },
      },
      { user: { id: "staff-1", roles: ["staff"] } },
    );

    expect(result.status).toBe("declined");
    expect(result.reason).toBe("Không thể đi làm ca này");
    expect(result.reasonCategory).toBe("personal");
    expect(result.respondedAt).toBeInstanceOf(Date);
    expect(doc.declineClassification).toBe("unknown");
    expect(doc.save).toHaveBeenCalledTimes(1);
  });
});
