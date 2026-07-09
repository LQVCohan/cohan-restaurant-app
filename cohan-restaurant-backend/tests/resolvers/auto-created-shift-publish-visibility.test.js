import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  publications: [],
  shifts: [],
  staff: [],
  shiftAcknowledgements: [],
  nextShift: 1,
  nextShiftAck: 1,
}));

const modelMocks = vi.hoisted(() => ({
  Staff: { findById: vi.fn() },
  Role: {},
  EventLog: { create: vi.fn() },
  Shift: { create: vi.fn(), find: vi.fn(), countDocuments: vi.fn() },
  Timesheet: {},
  LeaveRequest: {},
  LeaveBalance: {},
  PayrollSetting: {},
  PayrollPeriod: {},
  PayrollItem: {},
  PayrollAdjustment: {},
  EmployeeCodeCounter: {},
  Notification: { insertMany: vi.fn() },
  SchedulePublication: { findOne: vi.fn(), findOneAndUpdate: vi.fn(), findById: vi.fn() },
  ShiftAcknowledgement: { findOneAndUpdate: vi.fn() },
  ScheduleAcknowledgement: {},
  AvailabilityRegistrationWindow: { updateOne: vi.fn() },
  AttendanceCorrectionRequest: {},
  OvertimeRequest: {},
  EmployeeBankAccount: {},
  PayrollPayout: {},
  RestaurantPayoutAccount: {},
}));

const validationMocks = vi.hoisted(() => ({
  assertShiftAssignmentValid: vi.fn(async () => ({ ok: true, blockingErrors: [], warnings: [] })),
  validateShiftAssignment: vi.fn(async () => ({ ok: true, blockingErrors: [], warnings: [] })),
  hasNonInfoWarnings: vi.fn(() => false),
}));

const scopeMocks = vi.hoisted(() => ({
  getStaffRestaurantIds: vi.fn(async () => ["rest-1"]),
  staffBelongsToRestaurantByMembership: vi.fn(async () => true),
}));

const scheduleLifecycleMocks = vi.hoisted(() => ({
  resolveScheduleLifecycleStatus: vi.fn(({ publication }) => publication?.effectiveStatus || publication?.status || "draft"),
  mapSchedulePublicationOutput: vi.fn((publication) => ({
    id: String(publication?._id),
    restaurantId: String(publication?.restaurantId),
    status: publication?.status,
    effectiveStatus: publication?.effectiveStatus || publication?.status,
  })),
}));

const publishValidationMocks = vi.hoisted(() => ({
  validateScheduleBeforePublish: vi.fn(async () => ({ issues: [] })),
  hasBlockingSchedulePublishIssues: vi.fn(() => false),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn() } }));
vi.mock("../../graphql/guards.js", () => ({
  requireAuth: vi.fn((ctx) => { if (!ctx?.user) throw new Error("UNAUTHENTICATED"); }),
  requireRestaurantAccess: vi.fn(async () => true),
  requireRoles: vi.fn(() => true),
}));
vi.mock("../../src/security/userDtos.js", () => ({ sanitizeStaffPrivateProfile: vi.fn((staff) => staff) }));
vi.mock("../../src/services/auth/accountVerification.service.js", () => ({ issueVerificationForUser: vi.fn() }));
vi.mock("../../src/services/auth/restaurantScope.service.js", () => scopeMocks);
vi.mock("../../src/services/auth/staffRoleAssignment.service.js", () => ({ assignStaffRoleWithinRestaurant: vi.fn() }));
vi.mock("../../src/services/staffPerformance/staffPerformance.service.js", () => ({ recalculateStaffPerformanceSnapshots: vi.fn(), upsertStaffPerformanceReview: vi.fn() }));
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => ({ startSchedulingOperations: vi.fn(), updateSchedulingPolicy: vi.fn() }));
vi.mock("../../src/services/scheduling/shiftAssignmentValidation.service.js", () => validationMocks);
vi.mock("../../src/services/scheduling/autoSchedule.service.js", () => ({ assertAutoSchedulePeriodCanEdit: vi.fn(), buildAutoScheduleCreateInputs: vi.fn(), buildAutoSchedulePreviewBackend: vi.fn() }));
vi.mock("../../src/services/scheduling/schedulePublishValidation.service.js", () => publishValidationMocks);
vi.mock("../../src/services/scheduling/scheduleLifecycle.service.js", () => scheduleLifecycleMocks);
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  ATTENDANCE_REVIEW_ROLES: [],
  ATTENDANCE_OPERATION_ROLES: [],
  ATTENDANCE_SELF_ROLES: ["staff"],
  SCHEDULE_WRITE_ROLES: ["manager"],
  SHIFT_ACK_ADMIN_ROLES: ["manager"],
  resolveUserRoles: vi.fn((user) => user?.roles || []),
  userCanAccessRestaurant: vi.fn(() => true),
}));
vi.mock("../../src/services/attendance/attendanceCorrectionWorkflow.service.js", () => ({ approveAttendanceCorrectionRequest: vi.fn(), cancelAttendanceCorrectionRequest: vi.fn(), createAttendanceCorrectionRequest: vi.fn(), rejectAttendanceCorrectionRequest: vi.fn() }));
vi.mock("../../src/services/attendance/offScheduleAttendance.service.js", () => ({ approveOffScheduleAttendance: vi.fn(), rejectOffScheduleAttendance: vi.fn() }));
vi.mock("../../src/services/overtime/overtimeRequest.service.js", () => ({ approveOvertimeRequest: vi.fn(), cancelOvertimeRequest: vi.fn(), completeOvertimeRequest: vi.fn(), confirmOvertimeRequest: vi.fn(), createOvertimeRequest: vi.fn(), rejectOvertimeRequest: vi.fn() }));
vi.mock("../../src/services/payroll/payrollRuntime.service.js", () => ({ getPayrollSettings: vi.fn(), getPeriodDetail: vi.fn(), mapPayrollDocToGql: vi.fn(), toEndOfDay: vi.fn(), toObjectId: vi.fn((v) => v), toStartOfDay: vi.fn(), upsertPeriodItems: vi.fn() }));
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => ({ assertNoLockedPayrollPeriodOverlap: vi.fn() }));
vi.mock("../../src/services/payroll/payrollValidation.service.js", () => ({ validatePayrollPeriod: vi.fn(), hasBlockingPayrollIssues: vi.fn() }));
vi.mock("../../src/services/payroll/payrollPermission.service.js", () => ({ assertPayrollPermission: vi.fn() }));
vi.mock("../../src/services/payroll/payrollPayout.service.js", () => ({ applyPayrollPayoutResult: vi.fn(), cancelPayrollPayout: vi.fn(), createPayrollBatchPayout: vi.fn(), createPayrollPayout: vi.fn(), retryPayrollPayout: vi.fn(), upsertEmployeeBankAccount: vi.fn(), upsertRestaurantPayoutAccount: vi.fn(), verifyEmployeeBankAccount: vi.fn() }));
vi.mock("../../src/services/payroll/payrollPayment.service.js", () => ({ batchMarkPayrollPaid: vi.fn(), markPayrollItemPaid: vi.fn() }));
vi.mock("../../src/services/payroll/payrollEventLog.service.js", () => ({ logPayrollEvent: vi.fn() }));
vi.mock("../../src/config/payrollPolicy.vn.js", () => ({ getPayrollPolicyForDate: vi.fn() }));
vi.mock("../../src/services/performance/attendancePerformanceIntegration.service.js", () => ({ syncAttendancePerformanceIncidents: vi.fn() }));
vi.mock("../../src/services/kitchen/kitchenShiftRosterSnapshot.service.js", () => ({ syncKitchenShiftRosterSnapshotsForPublication: vi.fn(async () => ({ createdCount: 0, supersededCount: 0 })) }));
vi.mock("../../src/jobs/attendanceException.job.js", () => ({ runAttendanceExceptionDetectionJob: vi.fn() }));
vi.mock("../../src/services/performance/performanceIncident.service.js", () => ({ createPerformanceIncidentOnce: vi.fn(), applyPerformanceIncidentScore: vi.fn(), getPerformanceIncidentById: vi.fn(), markPerformanceIncidentEligible: vi.fn(), reviewPerformanceIncident: vi.fn(), waivePerformanceIncident: vi.fn() }));
vi.mock("../../src/services/performance/performanceAppeal.service.js", () => ({ createPerformanceIncidentAppeal: vi.fn(), cancelPerformanceIncidentAppeal: vi.fn(), getPerformanceIncidentAppealById: vi.fn(), reviewPerformanceIncidentAppeal: vi.fn(), reverseScoreForAcceptedAppeal: vi.fn() }));
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function ObjectId(value) { return value; } } } }));

const queryResult = (value) => ({
  select: vi.fn().mockReturnThis(),
  lean: vi.fn(async () => value),
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
});

const idOf = (value) => String(value?.value || value?._id || value || "");
const dayStart = new Date("2026-06-01T00:00:00.000Z");
const dayEnd = new Date("2026-06-07T23:59:59.999Z");
const managerCtx = { user: { id: "manager-1", roles: ["manager"] } };

const inRange = (date, filter = {}) => {
  const time = new Date(date).getTime();
  return (!filter.$gte || time >= new Date(filter.$gte).getTime()) && (!filter.$lte || time <= new Date(filter.$lte).getTime());
};

const matchesShift = (shift, filter = {}) => {
  if (filter.restaurantId && idOf(shift.restaurantId) !== idOf(filter.restaurantId)) return false;
  if (filter.startTime && !inRange(shift.startTime, filter.startTime)) return false;
  if (filter.status?.$ne && shift.status === filter.status.$ne) return false;
  return true;
};

describe("auto-created shift publish and staff visibility regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.publications = [{ _id: "pub-1", restaurantId: "rest-1", periodStart: dayStart, periodEnd: dayEnd, status: "draft", effectiveStatus: "draft" }];
    db.shifts = [];
    db.staff = [
      { _id: "staff-1", userType: "STAFF", fullName: "Auto Staff One" },
      { _id: "staff-2", userType: "STAFF", fullName: "Auto Staff Two" },
    ];
    db.shiftAcknowledgements = [];
    db.nextShift = 1;
    db.nextShiftAck = 1;

    scopeMocks.getStaffRestaurantIds.mockResolvedValue(["rest-1"]);
    scopeMocks.staffBelongsToRestaurantByMembership.mockResolvedValue(true);
    modelMocks.Staff.findById.mockImplementation((id) => queryResult(db.staff.find((row) => idOf(row._id) === idOf(id)) || null));
    modelMocks.Shift.create.mockImplementation(async (input) => {
      const shift = { _id: `shift-${db.nextShift++}`, status: "scheduled", ...input };
      db.shifts.push(shift);
      return shift;
    });
    modelMocks.Shift.countDocuments.mockImplementation(async (filter = {}) => db.shifts.filter((shift) => matchesShift(shift, filter)).length);
    modelMocks.Shift.find.mockImplementation((filter = {}) => queryResult(db.shifts.filter((shift) => matchesShift(shift, filter))));
    modelMocks.SchedulePublication.findOne.mockReturnValue(queryResult(db.publications[0]));
    modelMocks.SchedulePublication.findOneAndUpdate.mockImplementation((_filter, update = {}) => {
      Object.assign(db.publications[0], update.$set || {});
      db.publications[0].effectiveStatus = db.publications[0].status;
      return queryResult(db.publications[0]);
    });
    modelMocks.ShiftAcknowledgement.findOneAndUpdate.mockImplementation((filter, update = {}) => {
      const ack = { _id: `ack-${db.nextShiftAck++}`, ...filter, ...(update.$setOnInsert || {}) };
      db.shiftAcknowledgements.push(ack);
      return queryResult(ack);
    });
    modelMocks.AvailabilityRegistrationWindow.updateOne.mockResolvedValue({ modifiedCount: 1 });
    modelMocks.Notification.insertMany.mockResolvedValue([]);
    modelMocks.EventLog.create.mockResolvedValue({ _id: "event-1" });
  });

  it("publishes auto-created draft shifts and creates acknowledgements", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;

    const batch = await mutation.createStaffShifts(
      null,
      {
        inputs: [
          { employeeId: "staff-1", restaurantId: "rest-1", shiftType: "MORNING", startTime: "2026-06-02T06:00:00.000Z", endTime: "2026-06-02T14:00:00.000Z" },
          { employeeId: "staff-2", restaurantId: "rest-1", shiftType: "AFTERNOON", startTime: "2026-06-03T14:00:00.000Z", endTime: "2026-06-03T22:00:00.000Z" },
        ],
      },
      managerCtx,
    );

    expect(batch.successCount).toBe(2);
    expect(batch.failedCount).toBe(0);
    expect(db.shifts).toHaveLength(2);

    const publication = await mutation.publishSchedule(
      null,
      { input: { restaurantId: "rest-1", periodStart: "2026-06-01", periodEnd: "2026-06-07" } },
      managerCtx,
    );

    expect(publication.effectiveStatus || publication.status).toBe("published");
    expect(db.shiftAcknowledgements).toHaveLength(2);
    expect(modelMocks.Notification.insertMany).toHaveBeenCalledTimes(1);
    expect(modelMocks.EventLog.create).toHaveBeenCalledWith(expect.objectContaining({ verb: "schedule.publish" }));
  });
});