import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Staff: { findById: vi.fn(), find: vi.fn() },
  Shift: { find: vi.fn(), countDocuments: vi.fn() },
  Timesheet: { aggregate: vi.fn() },
  Table: { find: vi.fn() },
  Category: { countDocuments: vi.fn() },
  Promotion: { countDocuments: vi.fn() },
  Order: { countDocuments: vi.fn() },
  PayrollPeriod: { findById: vi.fn(), find: vi.fn() },
  PayrollItem: { find: vi.fn() },
  LeaveRequest: {}, LeaveBalance: {}, Restaurant: {}, SchedulePublication: {}, EventLog: {}, ShiftAcknowledgement: {}, ScheduleAcknowledgement: {},
}));

const guardMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(),
  requireRoles: vi.fn(),
  requireRestaurantScope: vi.fn(),
}));

const scopeMocks = vi.hoisted(() => ({
  getStaffRestaurantIds: vi.fn(async () => ["r1"]),
  getStaffMembershipRestaurantFilter: vi.fn(async () => ({ _id: { $in: ["s1", "s2"] } })),
  isSystemAdmin: vi.fn(() => false),
}));

const runtimeMocks = vi.hoisted(() => ({
  buildPayrollItemsForRange: vi.fn(), getPayrollSettings: vi.fn(), getPeriodDetail: vi.fn(), mapPayrollDocToGql: vi.fn((v) => v), summarize: vi.fn(() => ({})), toObjectId: vi.fn((v) => v),
}));
const scheduleMocks = vi.hoisted(() => ({ getSchedulingPolicy: vi.fn() }));
const calcMocks = vi.hoisted(() => ({ buildPayrollItem: vi.fn(() => ({})) }));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", () => scopeMocks);
vi.mock("../../src/services/payroll/payrollRuntime.service.js", () => runtimeMocks);
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => scheduleMocks);
vi.mock("../../src/services/payroll/payrollCalculator.service.js", () => calcMocks);
vi.mock("../../src/services/payroll/payrollPermission.service.js", () => ({ assertPayrollPermission: vi.fn() }));
vi.mock("../../src/services/scheduling/shiftAssignmentValidation.service.js", () => ({ validateShiftAssignment: vi.fn() }));
vi.mock("../../src/services/overtime/overtimeRequest.service.js", () => ({ getOvertimeRequest: vi.fn(), listOvertimeRequests: vi.fn() }));
vi.mock("../../src/services/attendance/attendanceCorrectionWorkflow.service.js", () => ({ getAttendanceCorrectionRequest: vi.fn(), listAttendanceCorrectionRequests: vi.fn() }));
vi.mock("../../src/services/staffPerformance/staffPerformance.service.js", () => ({ listStaffPerformanceSnapshots: vi.fn() }));
vi.mock("../../src/services/performance/performanceIncident.service.js", () => ({ listPerformanceIncidents: vi.fn() }));
vi.mock("../../src/services/performance/performanceIncidentQueue.service.js", () => ({ listManagerIncidentReviewQueue: vi.fn(), getManagerIncidentReviewQueueSummary: vi.fn() }));
vi.mock("../../src/services/performance/staffPerformanceReporting.service.js", () => ({ getStaffPerformanceSummary: vi.fn(), listStaffPerformanceSummaries: vi.fn(), listStaffPerformanceScoreAdjustments: vi.fn(), getStaffPerformanceScoreTimeline: vi.fn() }));
vi.mock("../../src/services/performance/managerPerformanceDashboard.service.js", () => ({ getManagerPerformanceDashboard: vi.fn() }));
vi.mock("../../src/services/performance/performanceAppeal.service.js", () => ({ listPerformanceIncidentAppeals: vi.fn() }));
vi.mock("../../src/services/ai/staffSchedulingAssistant.service.js", () => ({ buildStaffSchedulingAssistant: vi.fn() }));
vi.mock("../../src/services/payroll/payrollValidation.service.js", () => ({ validatePayrollPeriod: vi.fn() }));
vi.mock("../../src/services/payroll/payrollEventLog.service.js", () => ({ logPayrollEvent: vi.fn() }));
vi.mock("../../src/services/scheduling/scheduleLifecycle.service.js", () => ({ mapSchedulePublicationOutput: vi.fn((v) => v) }));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({ ATTENDANCE_READ_ROLES: [], ATTENDANCE_SELF_ROLES: [], SHIFT_ACK_READ_ROLES: [], SCHEDULE_READ_ROLES: [], resolveUserRoles: vi.fn(() => []), userCanAccessRestaurant: vi.fn(() => false) }));
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function O(v){return v;} } } }));

const lean = (v) => ({ lean: vi.fn(async () => v) });

beforeEach(() => {
  vi.clearAllMocks();
  guardMocks.requireAuth.mockReturnValue(undefined);
  scopeMocks.getStaffRestaurantIds.mockResolvedValue(["r1"]);
  scopeMocks.getStaffMembershipRestaurantFilter.mockResolvedValue({ _id: { $in: ["s1", "s2"] } });
  scopeMocks.isSystemAdmin.mockReturnValue(false);
});

describe("staff query access guards", () => {
  it("staff self allowed without requireRestaurantAccess", async () => {
    modelMocks.Staff.findById
      .mockReturnValueOnce({ select: vi.fn(() => lean({ _id: "s1", userType: "STAFF", deletedAt: null })) })
      .mockReturnValueOnce({ populate: vi.fn().mockReturnThis() });
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    await query.staff(null, { id: "s1" }, { user: { id: "s1" } });
    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(modelMocks.Staff.findById).toHaveBeenCalledTimes(2);
  });

  it("staff non-self denied before full populate", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValueOnce(new Error("denied"));
    const populateSpy = vi.fn().mockReturnThis();
    modelMocks.Staff.findById
      .mockReturnValueOnce({ select: vi.fn(() => lean({ _id: "s2", userType: "STAFF", deletedAt: null })) })
      .mockReturnValueOnce({ populate: populateSpy });
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    await expect(query.staff(null, { id: "s2" }, { user: { id: "me" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(populateSpy).not.toHaveBeenCalled();
  });

  it("staffList with restaurantId denied before Staff.find", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValueOnce(new Error("denied"));
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    await expect(query.staffList(null, { restaurantId: "r1" }, { user: { id: "x" } })).rejects.toThrow("denied");
    expect(modelMocks.Staff.find).not.toHaveBeenCalled();
  });

  it("staffList without restaurantId requires ADMIN", async () => {
    guardMocks.requireRoles.mockImplementationOnce(() => { throw new Error("forbidden"); });
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    await expect(query.staffList(null, {}, { user: { id: "x" } })).rejects.toThrow("forbidden");
    expect(guardMocks.requireRoles).toHaveBeenCalledWith(expect.anything(), ["ADMIN"]);
    expect(modelMocks.Staff.find).not.toHaveBeenCalled();
  });

  it("account/salary/shift non-self denied before reads", async () => {
    modelMocks.Staff.findById.mockReset();
    guardMocks.requireRestaurantAccess.mockReset();

    const staffDoc = {
      _id: "s2",
      userType: "STAFF",
    };

    modelMocks.Staff.findById.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue(staffDoc),
      }),
    });
    scopeMocks.getStaffRestaurantIds.mockResolvedValue(["r1"]);
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("denied"));

    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    await expect(query.staffAccountOverview(null, { staffId: "s2" }, { user: { id: "me" } })).resolves.toBeNull();
    await expect(query.staffSalarySummary(null, { staffId: "s2" }, { user: { id: "me" } })).resolves.toBeNull();
    await expect(query.staffShiftHistory(null, { staffId: "s2" }, { user: { id: "me" } })).resolves.toEqual([]);
    expect(modelMocks.Table.find).not.toHaveBeenCalled();
    expect(modelMocks.Shift.find).not.toHaveBeenCalled();
    expect(modelMocks.Timesheet.aggregate).not.toHaveBeenCalled();
  });

  it("payroll/scheduling denied before db or service", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("denied"));
    modelMocks.PayrollPeriod.findById.mockReturnValue({ select: vi.fn(() => lean({ restaurantId: "r1" })) });
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    await expect(query.staffPayrollOverview(null, { periodId: "p1" }, { user: { id: "x" } })).rejects.toThrow();
    await expect(query.staffPayrollOverview(null, { startDate: "2026-01-01", endDate: "2026-01-31", restaurantId: "r1" }, { user: { id: "x" } })).rejects.toThrow();
    await expect(query.payrollPeriods(null, { restaurantId: "r1" }, { user: { id: "x" } })).rejects.toThrow();
    await expect(query.payrollPeriodDetail(null, { periodId: "p1" }, { user: { id: "x" } })).rejects.toThrow();
    await expect(query.payrollSettings(null, { restaurantId: "r1" }, { user: { id: "x" } })).rejects.toThrow();
    await expect(query.schedulingPolicy(null, { restaurantId: "r1" }, { user: { id: "x" } })).rejects.toThrow();
    expect(modelMocks.PayrollItem.find).not.toHaveBeenCalled();
    expect(runtimeMocks.buildPayrollItemsForRange).not.toHaveBeenCalled();
    expect(runtimeMocks.getPeriodDetail).not.toHaveBeenCalled();
    expect(runtimeMocks.getPayrollSettings).not.toHaveBeenCalled();
    expect(scheduleMocks.getSchedulingPolicy).not.toHaveBeenCalled();
  });

  it("allowed smoke payrollPeriods + schedulingPolicy", async () => {
    guardMocks.requireRestaurantAccess.mockResolvedValue(undefined);
    modelMocks.PayrollPeriod.find.mockReturnValue({ sort: vi.fn(() => ({ limit: vi.fn(() => lean([])) })) });
    scheduleMocks.getSchedulingPolicy.mockResolvedValue({});
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    await query.payrollPeriods(null, { restaurantId: "r1" }, { user: { id: "x" } });
    await query.schedulingPolicy(null, { restaurantId: "r1" }, { user: { id: "x" } });
    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalled();
    expect(modelMocks.PayrollPeriod.find).toHaveBeenCalled();
    expect(scheduleMocks.getSchedulingPolicy).toHaveBeenCalled();
  });
});