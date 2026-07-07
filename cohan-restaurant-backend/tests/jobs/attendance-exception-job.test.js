import { beforeEach, describe, expect, it, vi } from "vitest";

const restaurantScopeMocks = vi.hoisted(() => ({
  canAccessRestaurant: vi.fn(async () => true),
}));
const serviceMocks = vi.hoisted(() => ({
  detectAttendanceExceptionsForRange: vi.fn(),
}));

const modelMocks = vi.hoisted(() => ({
  EventLog: { log: vi.fn() },
  Restaurant: { find: vi.fn(), exists: vi.fn() },
  Staff: {},
  Role: {},
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
  ShiftAcknowledgement: {},
  ScheduleAcknowledgement: {},
  AttendanceCorrectionRequest: {},
  OvertimeRequest: {},
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", async (importOriginal) => ({
  ...(await importOriginal()),
  canAccessRestaurant: restaurantScopeMocks.canAccessRestaurant,
}));
vi.mock("../../src/services/attendance/attendanceExceptionDetection.service.js", () => ({
  DEFAULT_MISSED_CHECKOUT_GRACE_MINUTES: 30,
  DEFAULT_NO_SHOW_GRACE_MINUTES: 15,
  detectAttendanceExceptionsForRange: serviceMocks.detectAttendanceExceptionsForRange,
}));
vi.mock("../../lib/mailer.js", () => ({ mailer: {} }));
vi.mock("../../src/services/staffPerformance/staffPerformance.service.js", () => ({
  recalculateStaffPerformanceSnapshots: vi.fn(),
  upsertStaffPerformanceReview: vi.fn(),
}));
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => ({
  startSchedulingOperations: vi.fn(),
  updateSchedulingPolicy: vi.fn(),
}));
vi.mock("../../src/services/scheduling/shiftAssignmentValidation.service.js", () => ({
  assertShiftAssignmentValid: vi.fn(),
  validateShiftAssignment: vi.fn(),
}));
vi.mock("../../src/services/scheduling/autoSchedule.service.js", () => ({
  assertAutoSchedulePeriodCanEdit: vi.fn(),
  buildAutoScheduleCreateInputs: vi.fn(),
  buildAutoSchedulePreviewBackend: vi.fn(),
}));
vi.mock("../../src/services/scheduling/schedulePublishValidation.service.js", () => ({
  hasBlockingSchedulePublishIssues: vi.fn(),
  validateScheduleBeforePublish: vi.fn(),
}));
vi.mock("../../src/services/attendance/attendanceCorrectionWorkflow.service.js", () => ({
  approveAttendanceCorrectionRequest: vi.fn(),
  cancelAttendanceCorrectionRequest: vi.fn(),
  createAttendanceCorrectionRequest: vi.fn(),
  rejectAttendanceCorrectionRequest: vi.fn(),
}));
vi.mock("../../src/services/attendance/offScheduleAttendance.service.js", () => ({
  approveOffScheduleAttendance: vi.fn(),
  rejectOffScheduleAttendance: vi.fn(),
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
  toObjectId: vi.fn((value) => value),
  toStartOfDay: vi.fn(),
  upsertPeriodItems: vi.fn(),
}));
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => ({
  assertNoLockedPayrollPeriodOverlap: vi.fn(),
}));
vi.mock("../../src/services/payroll/payrollValidation.service.js", () => ({
  hasBlockingPayrollIssues: vi.fn(),
  validatePayrollPeriod: vi.fn(),
}));
vi.mock("../../src/services/payroll/payrollPermission.service.js", () => ({
  assertPayrollPermission: vi.fn(),
}));
vi.mock("../../src/services/payroll/payrollEventLog.service.js", () => ({
  logPayrollEvent: vi.fn(),
}));
vi.mock("../../src/config/payrollPolicy.vn.js", () => ({ getPayrollPolicyForDate: vi.fn() }));
vi.mock("../../src/services/scheduling/scheduleLifecycle.service.js", () => ({
  mapSchedulePublicationOutput: vi.fn(),
  resolveScheduleLifecycleStatus: vi.fn(),
}));
vi.mock("../../src/services/performance/attendancePerformanceIntegration.service.js", () => ({
  syncAttendancePerformanceIncidents: vi.fn(),
}));
vi.mock("../../src/services/performance/performanceIncident.service.js", () => ({
  applyPerformanceIncidentScore: vi.fn(),
  createPerformanceIncidentOnce: vi.fn(),
  getPerformanceIncidentById: vi.fn(),
  markPerformanceIncidentEligible: vi.fn(),
  reviewPerformanceIncident: vi.fn(),
  waivePerformanceIncident: vi.fn(),
}));
vi.mock("../../src/services/performance/performanceAppeal.service.js", () => ({
  cancelPerformanceIncidentAppeal: vi.fn(),
  createPerformanceIncidentAppeal: vi.fn(),
  getPerformanceIncidentAppealById: vi.fn(),
  reviewPerformanceIncidentAppeal: vi.fn(),
  reverseScoreForAcceptedAppeal: vi.fn(),
}));

const restaurantId = "507f1f77bcf86cd799439011";
const actorId = "507f1f77bcf86cd799439012";

function restaurantFindQuery(rows) {
  return {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn(async () => rows),
  };
}

async function loadJob() {
  return import("../../src/jobs/attendanceException.job.js");
}

async function loadMutation() {
  return import("../../graphql/resolvers/staff/mutation.js");
}

describe("attendance exception detection job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restaurantScopeMocks.canAccessRestaurant.mockResolvedValue(true);
    serviceMocks.detectAttendanceExceptionsForRange.mockResolvedValue({
      scannedShifts: 1,
      noShowCreated: 1,
      noShowUpdated: 0,
      missedCheckoutUpdated: 0,
      skippedLockedPayroll: 0,
    });
    modelMocks.EventLog.log.mockResolvedValue({ _id: "event-1" });
    modelMocks.Restaurant.find.mockReturnValue(restaurantFindQuery([{ _id: restaurantId }]));
    modelMocks.Restaurant.exists.mockResolvedValue(true);
  });

  it("calls detectAttendanceExceptionsForRange with the requested restaurant and range", async () => {
    const { runAttendanceExceptionDetectionJob } = await loadJob();

    await runAttendanceExceptionDetectionJob({
      restaurantId,
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      now: "2026-05-11T12:00:00.000Z",
    });

    expect(serviceMocks.detectAttendanceExceptionsForRange).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId,
        startDate: new Date("2026-05-11T00:00:00.000Z"),
        endDate: new Date("2026-05-11T23:59:59.999Z"),
        now: new Date("2026-05-11T12:00:00.000Z"),
      }),
    );
  });

  it("writes an EventLog success entry with the summary", async () => {
    const { runAttendanceExceptionDetectionJob } = await loadJob();

    await runAttendanceExceptionDetectionJob({ restaurantId, triggeredBy: "manual", actorId });

    expect(modelMocks.EventLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId,
        actorUserId: actorId,
        verb: "job.attendance_exception_detection",
        source: "cron",
        status: "success",
        meta: expect.objectContaining({
          jobName: "attendance_exception_detection",
          triggeredBy: "manual",
          status: "success",
          summary: expect.objectContaining({ noShowCreated: 1 }),
        }),
      }),
    );
  });

  it("keeps all-restaurants runner alive and returns partial_failed when one restaurant fails", async () => {
    const otherRestaurantId = "507f1f77bcf86cd799439013";
    modelMocks.Restaurant.find.mockReturnValue(
      restaurantFindQuery([{ _id: restaurantId }, { _id: otherRestaurantId }]),
    );
    serviceMocks.detectAttendanceExceptionsForRange
      .mockResolvedValueOnce({
        scannedShifts: 2,
        noShowCreated: 1,
        noShowUpdated: 0,
        missedCheckoutUpdated: 1,
        skippedLockedPayroll: 0,
      })
      .mockRejectedValueOnce(new Error("boom"));

    const { runAttendanceExceptionDetectionForAllRestaurants } = await loadJob();
    const result = await runAttendanceExceptionDetectionForAllRestaurants({
      now: "2026-05-11T12:00:00.000Z",
    });

    expect(result.status).toBe("partial_failed");
    expect(result.failedCount).toBe(1);
    expect(result.summary).toMatchObject({ scannedShifts: 2, missedCheckoutUpdated: 1 });
  });

  it("returns skippedLockedPayroll from the service so locked payroll ranges are visible to callers", async () => {
    serviceMocks.detectAttendanceExceptionsForRange.mockResolvedValueOnce({
      scannedShifts: 1,
      noShowCreated: 0,
      noShowUpdated: 0,
      missedCheckoutUpdated: 0,
      skippedLockedPayroll: 1,
    });

    const { runAttendanceExceptionDetectionJob } = await loadJob();
    const result = await runAttendanceExceptionDetectionJob({ restaurantId });

    expect(result).toMatchObject({
      scannedShifts: 1,
      skippedLockedPayroll: 1,
      noShowCreated: 0,
      missedCheckoutUpdated: 0,
    });
  });

  it.each(["ADMIN", "MANAGER", "HR"])("allows %s to trigger the manual mutation", async (role) => {
    const { default: Mutation } = await loadMutation();

    const result = await Mutation.runAttendanceExceptionDetection(
      {},
      {
        input: {
          restaurantId,
          startDate: "2026-05-11T00:00:00.000Z",
          endDate: "2026-05-11T23:59:59.999Z",
        },
      },
      {
        user:
          role === "ADMIN"
            ? { id: actorId, userType: role }
            : role === "MANAGER"
              ? { id: actorId, userType: role }
              : { id: actorId, userType: role, restaurantForStaff: restaurantId },
      },
    );

    expect(result.noShowCreated).toBe(1);
  });

  it.each(["STAFF", "ACCOUNTANT"])("rejects %s manual trigger", async (role) => {
    const { default: Mutation } = await loadMutation();

    await expect(
      Mutation.runAttendanceExceptionDetection(
        {},
        {
          input: {
            restaurantId,
            startDate: "2026-05-11T00:00:00.000Z",
            endDate: "2026-05-11T23:59:59.999Z",
          },
        },
        {
          user:
            role === "ADMIN"
              ? { id: actorId, userType: role }
              : role === "MANAGER"
                ? { id: actorId, userType: role }
                : { id: actorId, userType: role, restaurantForStaff: restaurantId },
        },
      ),
    ).rejects.toThrow("FORBIDDEN");
  });
});
