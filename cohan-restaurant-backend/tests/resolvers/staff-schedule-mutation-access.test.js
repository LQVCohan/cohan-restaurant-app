import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Staff: { findById: vi.fn() }, Role: {}, EventLog: { create: vi.fn() },
  Shift: { findById: vi.fn(), create: vi.fn(), findByIdAndUpdate: vi.fn(), deleteOne: vi.fn(), find: vi.fn(), countDocuments: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
  Timesheet: { findOne: vi.fn() }, LeaveRequest: {}, LeaveBalance: {}, PayrollSetting: {}, PayrollPeriod: {}, PayrollItem: {}, PayrollAdjustment: {}, EmployeeCodeCounter: {},
  Notification: { insertMany: vi.fn(), create: vi.fn() },
  SchedulePublication: { findOne: vi.fn(), findOneAndUpdate: vi.fn(), updateOne: vi.fn() },
  ShiftAcknowledgement: { findOneAndUpdate: vi.fn() }, ScheduleAcknowledgement: {},
}));
const guards = vi.hoisted(() => ({ requireAuth: vi.fn(), requireRestaurantAccess: vi.fn(), requireRoles: vi.fn(), requireRestaurantScope: vi.fn() }));
const validation = vi.hoisted(() => ({ assertShiftAssignmentValid: vi.fn(async () => ({})), validateShiftAssignment: vi.fn(async () => ({ ok: true, warnings: [], blockingErrors: [] })) }));
const lifecycle = vi.hoisted(() => ({ resolveScheduleLifecycleStatus: vi.fn(() => "draft"), mapSchedulePublicationOutput: vi.fn((v) => v) }));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guards);
vi.mock("../../src/services/scheduling/shiftAssignmentValidation.service.js", () => validation);
vi.mock("../../src/services/scheduling/scheduleLifecycle.service.js", () => lifecycle);
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({ ATTENDANCE_REVIEW_ROLES: [], ATTENDANCE_OPERATION_ROLES: [], ATTENDANCE_SELF_ROLES: [], SCHEDULE_WRITE_ROLES: ["manager"], SHIFT_ACK_ADMIN_ROLES: [], resolveUserRoles: vi.fn(), userCanAccessRestaurant: vi.fn() }));
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn() } }));
vi.mock("../../src/services/staffPerformance/staffPerformance.service.js", () => ({ recalculateStaffPerformanceSnapshots: vi.fn(), upsertStaffPerformanceReview: vi.fn() }));
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => ({ startSchedulingOperations: vi.fn(), updateSchedulingPolicy: vi.fn() }));
vi.mock("../../src/services/attendance/attendanceCorrectionWorkflow.service.js", () => ({ approveAttendanceCorrectionRequest: vi.fn(), cancelAttendanceCorrectionRequest: vi.fn(), createAttendanceCorrectionRequest: vi.fn(), rejectAttendanceCorrectionRequest: vi.fn() }));
vi.mock("../../src/services/overtime/overtimeRequest.service.js", () => ({ approveOvertimeRequest: vi.fn(), cancelOvertimeRequest: vi.fn(), completeOvertimeRequest: vi.fn(), confirmOvertimeRequest: vi.fn(), createOvertimeRequest: vi.fn(), rejectOvertimeRequest: vi.fn() }));
vi.mock("../../src/services/payroll/payrollRuntime.service.js", () => ({ getPayrollSettings: vi.fn(), getPeriodDetail: vi.fn(), mapPayrollDocToGql: vi.fn(), toEndOfDay: vi.fn((d) => new Date(d)), toObjectId: vi.fn((v) => v), toStartOfDay: vi.fn((d) => new Date(d)), upsertPeriodItems: vi.fn() }));
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => ({ assertNoLockedPayrollPeriodOverlap: vi.fn() }));
vi.mock("../../src/services/payroll/payrollValidation.service.js", () => ({ validatePayrollPeriod: vi.fn(), hasBlockingPayrollIssues: vi.fn() }));
vi.mock("../../src/services/payroll/payrollPermission.service.js", () => ({ assertPayrollPermission: vi.fn() }));
vi.mock("../../src/services/payroll/payrollEventLog.service.js", () => ({ logPayrollEvent: vi.fn() }));
vi.mock("../../src/config/payrollPolicy.vn.js", () => ({ getPayrollPolicyForDate: vi.fn() }));
vi.mock("../../src/services/performance/performanceIncident.service.js", () => ({ createPerformanceIncidentOnce: vi.fn(), applyPerformanceIncidentScore: vi.fn(), markPerformanceIncidentEligible: vi.fn(), reviewPerformanceIncident: vi.fn(), waivePerformanceIncident: vi.fn() }));
vi.mock("../../src/services/performance/performanceAppeal.service.js", () => ({ createPerformanceIncidentAppeal: vi.fn(), cancelPerformanceIncidentAppeal: vi.fn(), reviewPerformanceIncidentAppeal: vi.fn(), reverseScoreForAcceptedAppeal: vi.fn() }));
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function ObjectId(v) { return v; } } } }));

const lean = (value) => ({ lean: vi.fn(async () => value) });
const query = (value) => ({ select: vi.fn(() => lean(value)) });

beforeEach(() => { vi.clearAllMocks(); });

describe("staff schedule mutation access hardening", () => {
  it("createStaffShift denied by restaurant access before reads/writes", async () => {
    guards.requireRestaurantAccess.mockRejectedValueOnce(new Error("forbidden"));
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.createStaffShift(null, { input: { employeeId: "e1", restaurantId: "r1", shiftType: "MORNING", startTime: "2026-05-11T06:00:00.000Z", endTime: "2026-05-11T14:00:00.000Z" } }, { user: { id: "u1" } })).rejects.toThrow("forbidden");
    expect(modelMocks.SchedulePublication.findOne).not.toHaveBeenCalled();
    expect(modelMocks.Staff.findById).not.toHaveBeenCalled();
    expect(modelMocks.Shift.create).not.toHaveBeenCalled();
    expect(validation.assertShiftAssignmentValid).not.toHaveBeenCalled();
  });

  it("createStaffShift rejects employee from another restaurant", async () => {
    modelMocks.SchedulePublication.findOne.mockReturnValue(lean(null));
    modelMocks.Staff.findById.mockReturnValue(query({ _id: "e1", userType: "STAFF", primaryRestaurant: "r2" }));
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.createStaffShift(null, { input: { employeeId: "e1", restaurantId: "r1", shiftType: "MORNING", startTime: "2026-05-11T06:00:00.000Z", endTime: "2026-05-11T14:00:00.000Z" } }, { user: { id: "u1" } })).rejects.toThrow("Staff does not belong to this restaurant");
  });
});
