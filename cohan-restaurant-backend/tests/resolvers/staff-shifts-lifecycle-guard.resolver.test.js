import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Staff: { findById: vi.fn() },
  Role: {},
  EventLog: {},
  Shift: { create: vi.fn() },
  Timesheet: {},
  LeaveRequest: {},
  LeaveBalance: {},
  PayrollSetting: {},
  PayrollPeriod: {},
  PayrollItem: {},
  PayrollAdjustment: {},
  EmployeeCodeCounter: {},
  Notification: {},
  SchedulePublication: { findOne: vi.fn() },
  ShiftAcknowledgement: {},
  ScheduleAcknowledgement: {},
}));

const scheduleLifecycleMocks = vi.hoisted(() => ({
  mapSchedulePublicationOutput: vi.fn((v) => v),
  resolveScheduleLifecycleStatus: vi.fn(),
}));

const validationMocks = vi.hoisted(() => ({
  assertShiftAssignmentValid: vi.fn(async () => ({ ok: true, blockingErrors: [], warnings: [] })),
  hasNonInfoWarnings: vi.fn(() => false),
  validateShiftAssignment: vi.fn(async () => ({ ok: true, blockingErrors: [], warnings: [] })),
}));

const scopeMocks = vi.hoisted(() => ({
  getStaffRestaurantIds: vi.fn(async () => ["rest-1"]),
  staffBelongsToRestaurantByMembership: vi.fn(async () => true),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn() } }));
vi.mock("../../src/services/staffPerformance/staffPerformance.service.js", () => ({ recalculateStaffPerformanceSnapshots: vi.fn(), upsertStaffPerformanceReview: vi.fn() }));
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => ({ startSchedulingOperations: vi.fn(), updateSchedulingPolicy: vi.fn() }));
vi.mock("../../src/services/scheduling/shiftAssignmentValidation.service.js", () => validationMocks);
vi.mock("../../src/services/attendance/attendanceCorrectionWorkflow.service.js", () => ({ approveAttendanceCorrectionRequest: vi.fn(), cancelAttendanceCorrectionRequest: vi.fn(), createAttendanceCorrectionRequest: vi.fn(), rejectAttendanceCorrectionRequest: vi.fn() }));
vi.mock("../../src/services/overtime/overtimeRequest.service.js", () => ({ approveOvertimeRequest: vi.fn(), cancelOvertimeRequest: vi.fn(), completeOvertimeRequest: vi.fn(), confirmOvertimeRequest: vi.fn(), createOvertimeRequest: vi.fn(), rejectOvertimeRequest: vi.fn() }));
vi.mock("../../src/services/payroll/payrollRuntime.service.js", () => ({ getPayrollSettings: vi.fn(), getPeriodDetail: vi.fn(), mapPayrollDocToGql: vi.fn(), toEndOfDay: vi.fn(), toObjectId: vi.fn(), toStartOfDay: vi.fn(), upsertPeriodItems: vi.fn() }));
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => ({ assertNoLockedPayrollPeriodOverlap: vi.fn() }));
vi.mock("../../src/services/payroll/payrollValidation.service.js", () => ({ validatePayrollPeriod: vi.fn(), hasBlockingPayrollIssues: vi.fn() }));
vi.mock("../../src/services/payroll/payrollPermission.service.js", () => ({ assertPayrollPermission: vi.fn() }));
vi.mock("../../src/services/payroll/payrollEventLog.service.js", () => ({ logPayrollEvent: vi.fn() }));
vi.mock("../../src/config/payrollPolicy.vn.js", () => ({ getPayrollPolicyForDate: vi.fn() }));
vi.mock("../../src/services/scheduling/scheduleLifecycle.service.js", () => scheduleLifecycleMocks);
vi.mock("../../graphql/guards.js", () => ({ requireAuth: vi.fn(), requireRestaurantAccess: vi.fn(), requireRoles: vi.fn(), requireRestaurantScope: vi.fn() }));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({ ATTENDANCE_REVIEW_ROLES: [], ATTENDANCE_OPERATION_ROLES: [], ATTENDANCE_SELF_ROLES: [], SCHEDULE_WRITE_ROLES: ["manager"], SHIFT_ACK_ADMIN_ROLES: [], resolveUserRoles: vi.fn(), userCanAccessRestaurant: vi.fn() }));
vi.mock("../../src/services/auth/restaurantScope.service.js", () => scopeMocks);
vi.mock("../../src/services/performance/performanceIncident.service.js", () => ({ createPerformanceIncidentOnce: vi.fn(), applyPerformanceIncidentScore: vi.fn(), markPerformanceIncidentEligible: vi.fn(), reviewPerformanceIncident: vi.fn(), waivePerformanceIncident: vi.fn() }));
vi.mock("../../src/services/performance/performanceAppeal.service.js", () => ({ createPerformanceIncidentAppeal: vi.fn(), cancelPerformanceIncidentAppeal: vi.fn(), reviewPerformanceIncidentAppeal: vi.fn(), reverseScoreForAcceptedAppeal: vi.fn() }));
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function ObjectId(value) { return value; } } } }));

const lean = (value) => ({ lean: vi.fn(async () => value) });
const query = (value) => ({ select: vi.fn(() => lean(value)) });

const baseInput = {
  employeeId: "staff-1",
  restaurantId: "rest-1",
  shiftType: "MORNING",
  startTime: "2026-05-11T06:00:00.000Z",
  endTime: "2026-05-11T14:00:00.000Z",
};

function mockPublicationStatus(status) {
  if (!status) {
    modelMocks.SchedulePublication.findOne.mockReturnValue(lean(null));
    return;
  }
  const publication = {
    _id: "pub-1",
    restaurantId: "rest-1",
    periodStart: new Date("2026-05-11T00:00:00.000Z"),
    periodEnd: new Date("2026-05-17T23:59:59.999Z"),
    status,
    effectiveStatus: status,
  };
  modelMocks.SchedulePublication.findOne.mockReturnValue(lean(publication));
  scheduleLifecycleMocks.resolveScheduleLifecycleStatus.mockReturnValue(status);
}

describe("createStaffShift lifecycle guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMocks.getStaffRestaurantIds.mockResolvedValue(["rest-1"]);
    scopeMocks.staffBelongsToRestaurantByMembership.mockResolvedValue(true);
    modelMocks.Staff.findById.mockReturnValue(query({ _id: "staff-1", userType: "STAFF", fullName: "A" }));
    modelMocks.Shift.create.mockResolvedValue({ _id: "shift-1", employeeId: "staff-1", restaurantId: "rest-1", shiftType: "morning", startTime: new Date(baseInput.startTime), endTime: new Date(baseInput.endTime), status: "scheduled", notes: "" });
  });

  it("allows createStaffShift when no publication exists", async () => {
    mockPublicationStatus(null);
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.createStaffShift(null, { input: baseInput }, { user: { id: "m1", roles: ["manager"] } })).resolves.toBeTruthy();
    expect(modelMocks.Shift.create).toHaveBeenCalledTimes(1);
    expect(validationMocks.assertShiftAssignmentValid).toHaveBeenCalledTimes(1);
  });

  it("allows createStaffShift when effectiveStatus is draft", async () => {
    mockPublicationStatus("draft");
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.createStaffShift(null, { input: baseInput }, { user: { id: "m1", roles: ["manager"] } })).resolves.toBeTruthy();
  });

  it.each(["published", "active", "locked", "closed"])("rejects createStaffShift when effectiveStatus is %s", async (status) => {
    mockPublicationStatus(status);
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.createStaffShift(null, { input: baseInput }, { user: { id: "m1", roles: ["manager"] } })).rejects.toThrow("Không thể tạo ca trực tiếp khi lịch không còn ở trạng thái bản nháp.");
  });

  it("createStaffShifts returns partial success and error index for blocked lifecycle rows", async () => {
    modelMocks.SchedulePublication.findOne
      .mockReturnValueOnce(lean({ _id: "pub-draft", periodStart: new Date("2026-05-11T00:00:00.000Z"), periodEnd: new Date("2026-05-17T23:59:59.999Z"), status: "draft", effectiveStatus: "draft" }))
      .mockReturnValueOnce(lean({ _id: "pub-pub", periodStart: new Date("2026-05-18T00:00:00.000Z"), periodEnd: new Date("2026-05-24T23:59:59.999Z"), status: "published", effectiveStatus: "published" }));
    scheduleLifecycleMocks.resolveScheduleLifecycleStatus
      .mockReturnValueOnce("draft")
      .mockReturnValueOnce("published");

    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    const result = await mutation.createStaffShifts(
      null,
      {
        inputs: [
          baseInput,
          { ...baseInput, startTime: "2026-05-18T06:00:00.000Z", endTime: "2026-05-18T14:00:00.000Z" },
        ],
      },
      { user: { id: "m1", roles: ["manager"] } },
    );

    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.errors[0]).toEqual(expect.objectContaining({ index: 1, employeeId: "staff-1" }));
    expect(validationMocks.assertShiftAssignmentValid).toHaveBeenCalledTimes(1);
  });

  it("createStaffShifts calls assertShiftAssignmentValid for each lifecycle-valid input", async () => {
    mockPublicationStatus(null);
    modelMocks.SchedulePublication.findOne.mockReturnValue(lean(null));

    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await mutation.createStaffShifts(
      null,
      {
        inputs: [
          baseInput,
          { ...baseInput, employeeId: "staff-2", startTime: "2026-05-12T06:00:00.000Z", endTime: "2026-05-12T14:00:00.000Z" },
        ],
      },
      { user: { id: "m1", roles: ["manager"] } },
    );

    expect(validationMocks.assertShiftAssignmentValid).toHaveBeenCalledTimes(2);
  });

  it("rejects createStaffShift when non-info warnings require override", async () => {
    mockPublicationStatus(null);
    validationMocks.hasNonInfoWarnings.mockReturnValueOnce(true);
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.createStaffShift(null, { input: baseInput }, { user: { id: "m1", roles: ["manager"] } })).rejects.toThrow("Cần override có lý do");
  });

  it("rejects createStaffShift when override enabled without reason", async () => {
    mockPublicationStatus(null);
    validationMocks.hasNonInfoWarnings.mockReturnValueOnce(true);
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.createStaffShift(null, { input: { ...baseInput, allowOverride: true, overrideReason: "" } }, { user: { id: "m1", roles: ["manager"] } })).rejects.toThrow("Cần nhập lý do override");
  });

  it("allows createStaffShift when warning override has reason", async () => {
    mockPublicationStatus(null);
    validationMocks.hasNonInfoWarnings.mockReturnValueOnce(true);
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.createStaffShift(null, { input: { ...baseInput, allowOverride: true, overrideReason: "manager approved" } }, { user: { id: "m1", roles: ["manager"] } })).resolves.toBeTruthy();
  });

  it("allows createStaffShift with allowOverride true and empty reason when no warnings", async () => {
    mockPublicationStatus(null);
    validationMocks.hasNonInfoWarnings.mockReturnValueOnce(false);
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(
      mutation.createStaffShift(
        null,
        { input: { ...baseInput, allowOverride: true, overrideReason: "" } },
        { user: { id: "m1", roles: ["manager"] } },
      ),
    ).resolves.toBeTruthy();
  });
});