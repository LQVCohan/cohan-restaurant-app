import { describe, it, expect, vi, beforeEach } from "vitest";

const guards = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(async () => true),
  requireRoles: vi.fn(),
  requireRestaurantScope: vi.fn(),
}));

const services = vi.hoisted(() => ({
  createAttendanceCorrectionRequestService: vi.fn(async ({ input }) => ({ id: "acr-1", ...input })),
  approveAttendanceCorrectionRequestService: vi.fn(async () => ({ ok: true })),
  rejectAttendanceCorrectionRequestService: vi.fn(async () => ({ ok: true })),
  cancelAttendanceCorrectionRequestService: vi.fn(async () => ({ ok: true })),
}));

const modelMocks = vi.hoisted(() => ({
  Staff: { findById: vi.fn() },
  Role: {}, EventLog: { create: vi.fn() }, Shift: { findOne: vi.fn() },
  Timesheet: vi.fn(), LeaveRequest: {}, LeaveBalance: {}, PayrollSetting: {}, PayrollPeriod: {}, PayrollItem: {}, PayrollAdjustment: {}, EmployeeCodeCounter: {}, Notification: { insertMany: vi.fn() }, SchedulePublication: {}, ShiftAcknowledgement: {}, ScheduleAcknowledgement: {},
  AttendanceCorrectionRequest: { findById: vi.fn() },
}));

vi.mock("../../graphql/guards.js", () => guards);
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn() } }));
vi.mock("../../src/services/attendance/attendanceCorrectionWorkflow.service.js", () => ({
  createAttendanceCorrectionRequest: services.createAttendanceCorrectionRequestService,
  approveAttendanceCorrectionRequest: services.approveAttendanceCorrectionRequestService,
  rejectAttendanceCorrectionRequest: services.rejectAttendanceCorrectionRequestService,
  cancelAttendanceCorrectionRequest: services.cancelAttendanceCorrectionRequestService,
}));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  ATTENDANCE_OPERATION_ROLES: ["MANAGER"],
  ATTENDANCE_REVIEW_ROLES: ["ADMIN"],
  ATTENDANCE_SELF_ROLES: ["STAFF"],
  SCHEDULE_WRITE_ROLES: [], SHIFT_ACK_ADMIN_ROLES: [],
  normalizeRole: vi.fn((role) => String(role || "").trim().toUpperCase()),
  resolveUserRoles: vi.fn(() => []), userCanAccessRestaurant: vi.fn(() => true),
}));
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => ({ assertNoLockedPayrollPeriodOverlap: vi.fn(async () => {}) }));
vi.mock("../../src/services/performance/performanceIncident.service.js", () => ({ createPerformanceIncidentOnce: vi.fn(async () => {}) }));
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function ObjectId(v){ return v; } } } }));

describe("staff attendance mutation access hardening", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guards.requireRestaurantAccess.mockResolvedValue(true);
    modelMocks.Staff.findById.mockResolvedValue({ _id: "e1", userType: "STAFF" });
    modelMocks.Shift.findOne.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn(async () => ({ _id: "s1", employeeId: "e1", restaurantId: "r1", startTime: new Date(), endTime: new Date() })) }) });
    modelMocks.Timesheet.findOne = vi.fn(async () => null);
    modelMocks.Timesheet.findById = vi.fn();
    modelMocks.Timesheet.mockImplementation(function TS(data){ Object.assign(this, data); this.save = vi.fn(async () => this); });
  });

  it("manager manual attendance denied by restaurant access before writes", async () => {
    guards.requireRoles.mockImplementation(() => {});
    guards.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.upsertStaffAttendance(null, { input: { employeeId: "e2", restaurantId: "r1", action: "check_in" } }, { user: { id: "manager-1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Timesheet.findOne).not.toHaveBeenCalled();
  });

  it("approve off-schedule denied by restaurant access before save", async () => {
    const save = vi.fn();
    modelMocks.Timesheet.findById.mockResolvedValue({ _id: "t1", restaurantId: "r1", isOffSchedule: true, approved: false, offScheduleApprovalStatus: "pending", save });
    guards.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.approveOffScheduleAttendance(null, { timesheetId: "t1", note: "n" }, { user: { id: "admin-1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(save).not.toHaveBeenCalled();
  });

  it("create attendance correction self cannot create for another employee", async () => {
    guards.requireRoles.mockImplementation(() => { throw new Error("FORBIDDEN"); });
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.createAttendanceCorrectionRequest(null, { input: { employeeId: "other", restaurantId: "r1" } }, { user: { id: "self" } })).rejects.toThrow("FORBIDDEN");
    expect(services.createAttendanceCorrectionRequestService).not.toHaveBeenCalled();
  });

  it("approve correction denied by restaurant access before service", async () => {
    guards.requireRoles.mockImplementation(() => {});
    modelMocks.AttendanceCorrectionRequest.findById.mockReturnValue({ select: vi.fn(async () => ({ _id: "acr-1", restaurantId: "r1" })) });
    guards.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.approveAttendanceCorrectionRequest(null, { input: { requestId: "acr-1" } }, { user: { id: "admin" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(services.approveAttendanceCorrectionRequestService).not.toHaveBeenCalled();
  });
});
