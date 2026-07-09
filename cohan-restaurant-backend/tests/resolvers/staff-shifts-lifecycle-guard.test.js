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
  AttendanceCorrectionRequest: {},
  OvertimeRequest: {},
}));

const scopeMocks = vi.hoisted(() => ({
  staffBelongsToRestaurantByMembership: vi.fn(),
}));

const scheduleLifecycleMocks = vi.hoisted(() => ({
  mapSchedulePublicationOutput: vi.fn((value) => value),
  resolveScheduleLifecycleStatus: vi.fn(),
}));

const validationMocks = vi.hoisted(() => ({
  assertShiftAssignmentValid: vi.fn(async () => ({})),
  validateShiftAssignment: vi.fn(async () => ({ ok: true, blockingErrors: [], warnings: [] })), hasNonInfoWarnings: vi.fn(() => false),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", () => scopeMocks);
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn() } }));
vi.mock("../../src/services/staffPerformance/staffPerformance.service.js", () => ({
  recalculateStaffPerformanceSnapshots: vi.fn(),
  upsertStaffPerformanceReview: vi.fn(),
}));
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => ({
  startSchedulingOperations: vi.fn(),
  updateSchedulingPolicy: vi.fn(),
}));
vi.mock("../../src/services/scheduling/shiftAssignmentValidation.service.js", () => validationMocks);
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
vi.mock("../../src/services/scheduling/scheduleLifecycle.service.js", () => scheduleLifecycleMocks);
vi.mock("../../graphql/guards.js", () => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(),
  requireRoles: vi.fn(),
  requireRestaurantScope: vi.fn(),
}));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  ATTENDANCE_REVIEW_ROLES: [],
  ATTENDANCE_OPERATION_ROLES: [],
  ATTENDANCE_SELF_ROLES: [],
  SCHEDULE_WRITE_ROLES: ["manager"],
  SHIFT_ACK_ADMIN_ROLES: [],
  resolveUserRoles: vi.fn(),
  userCanAccessRestaurant: vi.fn(),
}));
vi.mock("../../src/services/performance/performanceIncident.service.js", () => ({
  createPerformanceIncidentOnce: vi.fn(),
  applyPerformanceIncidentScore: vi.fn(),
  getPerformanceIncidentById: vi.fn(),
  markPerformanceIncidentEligible: vi.fn(),
  reviewPerformanceIncident: vi.fn(),
  waivePerformanceIncident: vi.fn(),
}));
vi.mock("../../src/services/performance/performanceAppeal.service.js", () => ({
  createPerformanceIncidentAppeal: vi.fn(),
  cancelPerformanceIncidentAppeal: vi.fn(),
  getPerformanceIncidentAppealById: vi.fn(),
  reviewPerformanceIncidentAppeal: vi.fn(),
  reverseScoreForAcceptedAppeal: vi.fn(),
}));
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: { ObjectId: function ObjectId(value) { return value; } },
  },
}));

const lean = (value) => ({ lean: vi.fn(async () => value) });
const query = (value) => ({ select: vi.fn(() => lean(value)) });

const baseInput = {
  employeeId: "staff-1",
  restaurantId: "rest-1",
  shiftType: "MORNING",
  startTime: "2026-05-11T06:00:00.000Z",
  endTime: "2026-05-11T14:00:00.000Z",
};

const managerCtx = { user: { id: "manager-1", roles: ["manager"] } };

function buildPublication(status, offsetDays = 0) {
  const start = new Date("2026-05-11T00:00:00.000Z");
  start.setUTCDate(start.getUTCDate() + offsetDays);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return {
    _id: `publication-${status}`,
    restaurantId: "rest-1",
    periodStart: start,
    periodEnd: end,
    status,
    effectiveStatus: status,
  };
}

function mockPublicationStatus(status) {
  if (!status) {
    modelMocks.SchedulePublication.findOne.mockReturnValue(lean(null));
    return;
  }
  modelMocks.SchedulePublication.findOne.mockReturnValue(lean(buildPublication(status)));
  scheduleLifecycleMocks.resolveScheduleLifecycleStatus.mockReturnValue(status);
}

async function getMutation() {
  return (await import("../../graphql/resolvers/staff/mutation.js")).default;
}

describe("createStaffShift lifecycle guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMocks.staffBelongsToRestaurantByMembership.mockResolvedValue(true);
    modelMocks.Staff.findById.mockReturnValue(
      query({
        _id: "staff-1",
        userType: "STAFF",
        fullName: "Lifecycle Staff",
      }),
    );
    modelMocks.Shift.create.mockImplementation(async (input) => ({
      _id: `shift-${String(input.employeeId)}`,
      ...input,
    }));
  });

  it("allows direct creation when SchedulePublication effectiveStatus is revision_draft", async () => {
    mockPublicationStatus("revision_draft");
    const mutation = await getMutation();

    await expect(
      mutation.createStaffShift(null, { input: baseInput }, managerCtx),
    ).resolves.toEqual(
      expect.objectContaining({
        employeeId: "staff-1",
        restaurantId: "rest-1",
        status: "scheduled",
      }),
    );

    expect(validationMocks.assertShiftAssignmentValid).toHaveBeenCalledTimes(1);
    expect(modelMocks.Shift.create).toHaveBeenCalledTimes(1);
  });

  it("rejects direct creation when SchedulePublication effectiveStatus is an unknown non-draft value", async () => {
    mockPublicationStatus("archived_review");
    const mutation = await getMutation();

    await expect(
      mutation.createStaffShift(null, { input: baseInput }, managerCtx),
    ).rejects.toThrow("Không thể tạo ca trực tiếp khi lịch không còn ở trạng thái bản nháp.");

    expect(validationMocks.assertShiftAssignmentValid).not.toHaveBeenCalled();
    expect(modelMocks.Shift.create).not.toHaveBeenCalled();
  });

  it("createStaffShifts keeps partial success when one lifecycle row is allowed and one is blocked", async () => {
    modelMocks.SchedulePublication.findOne
      .mockReturnValueOnce(lean(buildPublication("revision_draft")))
      .mockReturnValueOnce(lean(buildPublication("published", 7)));
    scheduleLifecycleMocks.resolveScheduleLifecycleStatus
      .mockReturnValueOnce("revision_draft")
      .mockReturnValueOnce("published");
    const mutation = await getMutation();

    const result = await mutation.createStaffShifts(
      null,
      {
        inputs: [
          baseInput,
          {
            ...baseInput,
            employeeId: "staff-2",
            startTime: "2026-05-18T06:00:00.000Z",
            endTime: "2026-05-18T14:00:00.000Z",
          },
        ],
      },
      managerCtx,
    );

    expect(result).toEqual(
      expect.objectContaining({
        successCount: 1,
        failedCount: 1,
      }),
    );
    expect(result.shifts).toHaveLength(1);
    expect(result.errors).toEqual([
      expect.objectContaining({
        index: 1,
        employeeId: "staff-2",
        message: expect.stringContaining("Không thể tạo ca trực tiếp khi lịch không còn ở trạng thái bản nháp."),
      }),
    ]);
    expect(validationMocks.assertShiftAssignmentValid).toHaveBeenCalledTimes(1);
    expect(modelMocks.Shift.create).toHaveBeenCalledTimes(1);
  });
});
