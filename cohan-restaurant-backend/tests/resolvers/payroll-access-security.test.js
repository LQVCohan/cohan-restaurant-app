import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Staff: { findById: vi.fn(), find: vi.fn() },
  Shift: { find: vi.fn(), countDocuments: vi.fn() },
  Timesheet: { find: vi.fn(), aggregate: vi.fn() },
  LeaveRequest: { find: vi.fn() },
  LeaveBalance: { find: vi.fn(), findOne: vi.fn() },
  PayrollPeriod: { findById: vi.fn(), find: vi.fn() },
  PayrollItem: { find: vi.fn(), findOne: vi.fn() },
  Table: { find: vi.fn() },
  Category: { countDocuments: vi.fn() },
  Promotion: { countDocuments: vi.fn() },
  Order: { countDocuments: vi.fn() },
  Restaurant: {}, SchedulePublication: {}, EventLog: {}, ShiftAcknowledgement: {}, ScheduleAcknowledgement: {},
}));

const guardMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(),
  requireRoles: vi.fn(),
  requireRestaurantScope: vi.fn(),
}));

const scopeMocks = vi.hoisted(() => ({
  getStaffRestaurantIds: vi.fn(),
  staffBelongsToRestaurantByMembership: vi.fn(),
  getStaffMembershipRestaurantFilter: vi.fn(),
}));
const permissionMocks = vi.hoisted(() => ({ assertPayrollPermission: vi.fn() }));
const runtimeMocks = vi.hoisted(() => ({
  buildPayrollItemsForRange: vi.fn(async () => []),
  getPayrollSettings: vi.fn(async (restaurantId) => ({ restaurantId })),
  getPeriodDetail: vi.fn(async () => ({ id: "period-a" })),
  mapPayrollDocToGql: vi.fn((v) => v),
  summarize: vi.fn(() => ({ totalPayroll: 0, paidAmount: 0, remaining: 0, progress: 0 })),
  toObjectId: vi.fn((v) => v),
}));
const paymentMocks = vi.hoisted(() => ({
  getPayrollPayslip: vi.fn(async () => ({ item: { id: "item-a" }, breakdown: {}, payments: [], remainingAmount: 0 })),
  listPayrollPayments: vi.fn(async () => []),
  buildPayrollExportRows: vi.fn(async () => []),
}));
const validationMocks = vi.hoisted(() => ({ validatePayrollPeriod: vi.fn(async () => ({ ok: true })) }));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", () => scopeMocks);
vi.mock("../../src/services/payroll/payrollPermission.service.js", () => permissionMocks);
vi.mock("../../src/services/payroll/payrollRuntime.service.js", () => runtimeMocks);
vi.mock("../../src/services/payroll/payrollPayment.service.js", () => paymentMocks);
vi.mock("../../src/services/payroll/payrollValidation.service.js", () => validationMocks);
vi.mock("../../src/services/payroll/payrollEventLog.service.js", () => ({ logPayrollEvent: vi.fn() }));
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => ({ getSchedulingPolicy: vi.fn() }));
vi.mock("../../src/services/payroll/payrollCalculator.service.js", () => ({ buildPayrollItem: vi.fn(() => ({})) }));
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
vi.mock("../../src/services/scheduling/scheduleLifecycle.service.js", () => ({ mapSchedulePublicationOutput: vi.fn((v) => v) }));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  ATTENDANCE_READ_ROLES: ["ADMIN", "MANAGER", "HR", "ACCOUNTANT"],
  ATTENDANCE_SELF_ROLES: ["STAFF"],
  SHIFT_ACK_READ_ROLES: [],
  SCHEDULE_READ_ROLES: [],
  SCHEDULE_WRITE_ROLES: [],
  normalizeRole: (v) => String(v || "").trim().toUpperCase(),
  resolveUserRoles: (user = {}) => [user.userType, user.roleName, user.role?.slug].map((v) => String(v || "").trim().toUpperCase()).filter(Boolean),
  userCanAccessRestaurant: vi.fn(() => false),
}));
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function ObjectId(v){ this.value = v; this.toString = () => String(v); } } } }));

const lean = (value) => ({ lean: vi.fn(async () => value) });
const selectLean = (value) => ({ select: vi.fn(() => lean(value)) });
const queryChain = (value) => ({
  sort: vi.fn(function () { return this; }),
  limit: vi.fn(function () { return this; }),
  select: vi.fn(function () { return this; }),
  populate: vi.fn(function () { return this; }),
  lean: vi.fn(async () => value),
});
const findSortLimit = queryChain;
const populateLean = queryChain;

const resolveStaffDocChain = (value) => ({ populate: vi.fn(async () => value) });

function installStaffSalarySummaryMocks({ staffId = "staff-a", restaurantId = "restaurant-a" } = {}) {
  modelMocks.Staff.findById.mockReturnValue(resolveStaffDocChain({
    _id: staffId,
    userType: "STAFF",
    baseSalary: 1000,
  }));
  modelMocks.Shift.find.mockReturnValue(queryChain([]));
}

function user(overrides = {}) {
  return { id: "manager-a", userType: "MANAGER", restaurantIds: ["restaurant-a"], ...overrides };
}

function installAccessMocks() {
  guardMocks.requireAuth.mockImplementation((ctx) => {
    if (!ctx?.user?.id && !ctx?.user?._id) throw new Error("UNAUTHENTICATED");
  });
  guardMocks.requireRestaurantAccess.mockImplementation(async (ctx, restaurantId) => {
    if (String(ctx?.user?.userType || "").toUpperCase() === "ADMIN") return true;
    const allowed = [ctx?.user?.restaurantId, ...(ctx?.user?.restaurantIds || [])]
      .filter(Boolean)
      .map(String);
    if (!allowed.includes(String(restaurantId))) throw new Error("FORBIDDEN_SCOPE");
    return true;
  });
  guardMocks.requireRoles.mockImplementation((ctx, allowed) => {
    const actual = String(ctx?.user?.userType || ctx?.user?.roleName || "").toUpperCase();
    if (!allowed.map((r) => String(r).toUpperCase()).includes(actual)) throw new Error("FORBIDDEN");
  });
  permissionMocks.assertPayrollPermission.mockImplementation((ctx, action) => {
    const role = String(ctx?.user?.userType || ctx?.user?.roleName || "").toUpperCase();
    const rules = {
      "payroll.view": ["ADMIN", "ACCOUNTANT", "HR", "MANAGER"],
      "payroll.export": ["ADMIN", "ACCOUNTANT", "HR", "MANAGER"],
      "payroll.validate": ["ADMIN", "ACCOUNTANT", "HR", "MANAGER"],
      "payroll.payslip.self": ["STAFF", "ADMIN", "ACCOUNTANT", "HR", "MANAGER"],
    };
    if (!(rules[action] || ["ADMIN"]).includes(role)) throw new Error("FORBIDDEN");
  });
}

function installDbMocks({ restaurantId = "restaurant-a", employeeId = "staff-a", status = "finalized" } = {}) {
  modelMocks.PayrollPeriod.findById.mockReturnValue(queryChain({ _id: "period-a", restaurantId, status }));
  modelMocks.PayrollPeriod.find.mockReturnValue(findSortLimit([{ _id: "period-a", restaurantId, status }]));
  modelMocks.PayrollItem.find.mockReturnValue(queryChain([{ _id: "item-a", periodId: "period-a", restaurantId, employeeId }]));
  modelMocks.PayrollItem.findOne.mockReturnValue(queryChain({ _id: "item-a" }));
  modelMocks.Staff.findById.mockReturnValue(selectLean({ _id: employeeId, userType: "STAFF" }));
  modelMocks.Staff.find.mockReturnValue({ select: vi.fn(() => lean([{ _id: employeeId, employmentStatus: "active", createdAt: new Date("2026-01-01") }])) });
  scopeMocks.getStaffRestaurantIds.mockImplementation(async (userId) => {
    if (String(userId) === String(employeeId)) return [restaurantId];
    if (String(userId).includes("staff-b")) return ["restaurant-b"];
    return ["restaurant-a"];
  });
  scopeMocks.staffBelongsToRestaurantByMembership.mockImplementation(async (userId, rid) => {
    const [scopedRestaurantId] = await scopeMocks.getStaffRestaurantIds(userId);
    return String(scopedRestaurantId) === String(rid);
  });
  scopeMocks.getStaffMembershipRestaurantFilter.mockResolvedValue({ _id: { $in: [employeeId] } });
  modelMocks.LeaveBalance.findOne.mockReturnValue(lean({ _id: "lb-a", employeeId, year: 2026, annualEntitledDays: 12, annualRemainingDays: 10 }));
  modelMocks.LeaveBalance.find.mockReturnValue(lean([]));
  modelMocks.Timesheet.find.mockReturnValue(populateLean([]));
  modelMocks.LeaveRequest.find.mockReturnValue(populateLean([]));
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  installAccessMocks();
  installDbMocks();
});

describe("sensitive payroll and staff report access", () => {
  it("rejects anonymous callers before sensitive payroll/report service calls", async () => {
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    const anon = {};

    await expect(query.staffPayrollOverview(null, { periodId: "period-a" }, anon)).rejects.toThrow("UNAUTHENTICATED");
    await expect(query.payrollPeriods(null, { restaurantId: "restaurant-a" }, anon)).rejects.toThrow("UNAUTHENTICATED");
    await expect(query.payrollPeriodDetail(null, { periodId: "period-a" }, anon)).rejects.toThrow("UNAUTHENTICATED");
    await expect(query.payrollPayslip(null, { periodId: "period-a", employeeId: "staff-a" }, anon)).rejects.toThrow("UNAUTHENTICATED");
    await expect(query.payrollPayments(null, { periodId: "period-a", employeeId: "staff-a" }, anon)).rejects.toThrow("UNAUTHENTICATED");
    await expect(query.payrollExportRows(null, { periodId: "period-a" }, anon)).rejects.toThrow("UNAUTHENTICATED");
    await expect(query.validatePayrollPeriod(null, { periodId: "period-a" }, anon)).rejects.toThrow("UNAUTHENTICATED");
    await expect(query.leaveBalance(null, { employeeId: "staff-a", year: 2026 }, anon)).rejects.toThrow("UNAUTHENTICATED");
    await expect(query.staffReportsOverview(null, { input: { restaurantId: "restaurant-a", startDate: "2026-01-01", endDate: "2026-01-31" } }, anon)).rejects.toThrow("UNAUTHENTICATED");

    expect(runtimeMocks.getPeriodDetail).not.toHaveBeenCalled();
    expect(paymentMocks.getPayrollPayslip).not.toHaveBeenCalled();
  });

  it("denies STAFF aggregate payroll/report data and other staff leave balances", async () => {
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    const staffCtx = { user: user({ id: "staff-self", userType: "STAFF", restaurantIds: ["restaurant-a"] }) };

    await expect(query.staffPayrollOverview(null, { restaurantId: "restaurant-a", startDate: "2026-01-01", endDate: "2026-01-31" }, staffCtx)).rejects.toThrow("FORBIDDEN");
    await expect(query.payrollPeriods(null, { restaurantId: "restaurant-a" }, staffCtx)).rejects.toThrow("FORBIDDEN");
    await expect(query.payrollPeriodDetail(null, { periodId: "period-a" }, staffCtx)).rejects.toThrow("FORBIDDEN");
    await expect(query.payrollSettings(null, { restaurantId: "restaurant-a" }, staffCtx)).rejects.toThrow("FORBIDDEN");
    await expect(query.staffReportsOverview(null, { input: { restaurantId: "restaurant-a", startDate: "2026-01-01", endDate: "2026-01-31" } }, staffCtx)).rejects.toThrow("FORBIDDEN");
    await expect(query.payrollPayslip(null, { periodId: "period-a", employeeId: "other-staff" }, staffCtx)).rejects.toThrow("FORBIDDEN");
    await expect(query.leaveBalance(null, { employeeId: "other-staff", year: 2026 }, staffCtx)).rejects.toThrow("FORBIDDEN");
  });


  it("allows MANAGER to view staffSalarySummary for staff in their own restaurant", async () => {
    installStaffSalarySummaryMocks({ staffId: "staff-a", restaurantId: "restaurant-a" });
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    const managerCtx = { user: user() };

    await expect(query.staffSalarySummary(null, { staffId: "staff-a" }, managerCtx)).resolves.toMatchObject({ staffId: "staff-a" });
    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(managerCtx, "restaurant-a");
    expect(permissionMocks.assertPayrollPermission).toHaveBeenCalledWith(managerCtx, "payroll.view");
  });

  it("denies MANAGER staffSalarySummary for staff in another restaurant", async () => {
    installStaffSalarySummaryMocks({ staffId: "staff-b", restaurantId: "restaurant-b" });
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    const managerCtx = { user: user() };

    await expect(query.staffSalarySummary(null, { staffId: "staff-b" }, managerCtx)).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("allows STAFF to view their own staffSalarySummary", async () => {
    installStaffSalarySummaryMocks({ staffId: "staff-a", restaurantId: "restaurant-a" });
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    const staffCtx = { user: user({ id: "staff-a", userType: "STAFF", restaurantIds: ["restaurant-a"] }) };

    await expect(query.staffSalarySummary(null, { staffId: "staff-a" }, staffCtx)).resolves.toMatchObject({ staffId: "staff-a" });
    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(permissionMocks.assertPayrollPermission).not.toHaveBeenCalledWith(staffCtx, "payroll.view");
  });

  it("denies STAFF staffSalarySummary for another staff member", async () => {
    installStaffSalarySummaryMocks({ staffId: "staff-b", restaurantId: "restaurant-b" });
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    const staffCtx = { user: user({ id: "staff-a", userType: "STAFF", restaurantIds: ["restaurant-a"] }) };

    await expect(query.staffSalarySummary(null, { staffId: "staff-b" }, staffCtx)).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("allows STAFF self-service only through finalized self payslip and own leave balance", async () => {
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    const staffCtx = { user: user({ id: "staff-a", userType: "STAFF", restaurantIds: ["restaurant-a"] }) };

    await expect(query.myPayslips(null, { limit: 5 }, staffCtx)).resolves.toEqual(expect.any(Array));
    await expect(query.myPayslip(null, { periodId: "period-a" }, staffCtx)).resolves.toBeTruthy();
    await expect(query.payrollPayslip(null, { periodId: "period-a", employeeId: "staff-a" }, staffCtx)).resolves.toBeTruthy();
    await expect(query.leaveBalance(null, { employeeId: "staff-a", year: 2026 }, staffCtx)).resolves.toMatchObject({ employeeId: "staff-a" });
  });

  it("lists staff payslips after filtering out unpublished periods", async () => {
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    const staffCtx = { user: user({ id: "staff-a", userType: "STAFF", restaurantIds: ["restaurant-a"] }) };
    modelMocks.PayrollItem.find.mockReturnValueOnce(queryChain([
      { _id: "draft-item", periodId: "draft-period", employeeId: "staff-a", netSalary: 1000 },
      { _id: "final-item", periodId: "final-period", employeeId: "staff-a", netSalary: 2000 },
    ]));
    modelMocks.PayrollPeriod.find.mockReturnValueOnce(queryChain([
      {
        _id: "final-period",
        name: "Finalized period",
        startDate: new Date("2026-05-01T00:00:00.000Z"),
        endDate: new Date("2026-05-31T00:00:00.000Z"),
        status: "finalized",
        finalizedAt: new Date("2026-06-01T00:00:00.000Z"),
        paidAt: null,
      },
    ]));

    const result = await query.myPayslips(null, { limit: 1 }, staffCtx);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      _id: "final-item",
      periodId: "final-period",
      periodName: "Finalized period",
      periodStatus: "finalized",
    });
    expect(modelMocks.PayrollPeriod.find).toHaveBeenCalledWith({
      _id: { $in: ["draft-period", "final-period"] },
      status: { $in: ["finalized", "paying", "locked", "paid"] },
    });
  });


  it("allows MANAGER to view payroll/report data only for their own restaurant", async () => {
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    const managerCtx = { user: user() };

    await expect(query.staffPayrollOverview(null, { restaurantId: "restaurant-a", startDate: "2026-01-01", endDate: "2026-01-31" }, managerCtx)).resolves.toBeTruthy();
    await expect(query.payrollPeriods(null, { restaurantId: "restaurant-a" }, managerCtx)).resolves.toHaveLength(1);
    await expect(query.payrollPeriodDetail(null, { periodId: "period-a" }, managerCtx)).resolves.toBeTruthy();
    await expect(query.payrollPayslip(null, { periodId: "period-a", employeeId: "staff-a" }, managerCtx)).resolves.toBeTruthy();
    await expect(query.payrollPayments(null, { periodId: "period-a", employeeId: "staff-a" }, managerCtx)).resolves.toEqual([]);
    await expect(query.payrollExportRows(null, { periodId: "period-a" }, managerCtx)).resolves.toEqual([]);
    await expect(query.validatePayrollPeriod(null, { periodId: "period-a" }, managerCtx)).resolves.toEqual({ ok: true });
    await expect(query.leaveBalance(null, { employeeId: "staff-a", year: 2026 }, managerCtx)).resolves.toMatchObject({ employeeId: "staff-a" });
    await expect(query.staffReportsOverview(null, { input: { restaurantId: "restaurant-a", startDate: "2026-01-01", endDate: "2026-01-31" } }, managerCtx)).resolves.toBeTruthy();
  });

  it("denies MANAGER access to another restaurant's payroll/report records", async () => {
    installDbMocks({ restaurantId: "restaurant-b", employeeId: "staff-b" });
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    const managerCtx = { user: user() };

    await expect(query.staffPayrollOverview(null, { restaurantId: "restaurant-b", startDate: "2026-01-01", endDate: "2026-01-31" }, managerCtx)).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(query.payrollPeriods(null, { restaurantId: "restaurant-b" }, managerCtx)).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(query.payrollPeriodDetail(null, { periodId: "period-b" }, managerCtx)).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(query.payrollPayslip(null, { periodId: "period-b", employeeId: "staff-b" }, managerCtx)).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(query.payrollPayments(null, { periodId: "period-b", employeeId: "staff-b" }, managerCtx)).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(query.payrollExportRows(null, { periodId: "period-b" }, managerCtx)).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(query.validatePayrollPeriod(null, { periodId: "period-b" }, managerCtx)).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(query.leaveBalance(null, { employeeId: "staff-b", year: 2026 }, managerCtx)).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(query.staffReportsOverview(null, { input: { restaurantId: "restaurant-b", startDate: "2026-01-01", endDate: "2026-01-31" } }, managerCtx)).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("keeps ACCOUNTANT and HR restaurant-scoped while ADMIN remains global", async () => {
    installDbMocks({ restaurantId: "restaurant-b", employeeId: "staff-b" });
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;

    await expect(query.payrollPeriodDetail(null, { periodId: "period-b" }, { user: user({ id: "acct-a", userType: "ACCOUNTANT", restaurantIds: ["restaurant-a"] }) })).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(query.staffReportsOverview(null, { input: { restaurantId: "restaurant-b", startDate: "2026-01-01", endDate: "2026-01-31" } }, { user: user({ id: "hr-a", userType: "HR", restaurantIds: ["restaurant-a"] }) })).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(query.payrollPeriodDetail(null, { periodId: "period-b" }, { user: user({ id: "admin", userType: "ADMIN", restaurantIds: [] }) })).resolves.toBeTruthy();
  });
});
