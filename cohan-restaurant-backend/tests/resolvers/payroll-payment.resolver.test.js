import { beforeEach, describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(async () => true),
  requireRoles: vi.fn(),
  requireRestaurantScope: vi.fn(),
}));
const permissions = vi.hoisted(() => ({ assertPayrollPermission: vi.fn() }));
const paymentServices = vi.hoisted(() => ({
  getPayrollPayslip: vi.fn(async () => ({ item: { id: "e1" }, breakdown: {}, payments: [], remainingAmount: 0 })),
  listPayrollPayments: vi.fn(async () => []),
  buildPayrollExportRows: vi.fn(async () => []),
  markPayrollItemPaid: vi.fn(async () => ({ id: "e1", status: "paid" })),
  batchMarkPayrollPaid: vi.fn(async () => ({ successCount: 1, failedCount: 0, items: [], errors: [] })),
}));
const modelMocks = vi.hoisted(() => ({
  PayrollPeriod: { findById: vi.fn() },
  PayrollItem: { findOne: vi.fn() },
  PayrollPayment: {},
  Staff: {},
  Role: {}, EventLog: {}, Shift: {}, Timesheet: {}, LeaveRequest: {}, LeaveBalance: {}, PayrollSetting: {}, PayrollAdjustment: {}, Restaurant: {}, Category: {}, Promotion: {}, Table: {}, Order: {}, SchedulePublication: {}, ShiftAcknowledgement: {}, ScheduleAcknowledgement: {}, AttendanceCorrectionRequest: {}, OvertimeRequest: {},
}));

vi.mock("../../graphql/guards.js", () => guards);
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/payroll/payrollPermission.service.js", () => permissions);
vi.mock("../../src/services/payroll/payrollPayment.service.js", () => paymentServices);
vi.mock("../../src/services/payroll/payrollRuntime.service.js", () => ({ buildPayrollItemsForRange: vi.fn(), getPayrollSettings: vi.fn(), getPeriodDetail: vi.fn(), mapPayrollDocToGql: vi.fn((x) => x), summarize: vi.fn(), toObjectId: vi.fn((x) => x) }));
vi.mock("../../src/services/payroll/payrollValidation.service.js", () => ({ validatePayrollPeriod: vi.fn(), hasBlockingPayrollIssues: vi.fn() }));
vi.mock("../../src/services/payroll/payrollEventLog.service.js", () => ({ logPayrollEvent: vi.fn() }));
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => ({ assertNoLockedPayrollPeriodOverlap: vi.fn() }));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({ ATTENDANCE_READ_ROLES: [], ATTENDANCE_REVIEW_ROLES: [], ATTENDANCE_OPERATION_ROLES: [], ATTENDANCE_SELF_ROLES: [], SHIFT_ACK_READ_ROLES: [], SCHEDULE_READ_ROLES: [], SCHEDULE_WRITE_ROLES: [], SHIFT_ACK_ADMIN_ROLES: [], resolveUserRoles: vi.fn(() => []), userCanAccessRestaurant: vi.fn(() => true) }));
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn() } }));
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function ObjectId(v) { this.toString = () => String(v); } } } }));

const periodChain = (value) => ({ select: vi.fn(() => ({ lean: vi.fn(async () => value) })) });
const itemChain = (value) => ({ select: vi.fn(() => ({ lean: vi.fn(async () => value) })) });

describe("payroll payment resolvers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.PayrollPeriod.findById.mockReturnValue(periodChain({ _id: "p1", restaurantId: "r1" }));
    modelMocks.PayrollItem.findOne.mockReturnValue(itemChain({ _id: "i1" }));
  });

  it("rejects payslip access outside restaurant scope", async () => {
    guards.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    await expect(query.payrollPayslip(null, { periodId: "p1", employeeId: "e1" }, { user: { id: "admin", userType: "ADMIN" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(paymentServices.getPayrollPayslip).not.toHaveBeenCalled();
  });

  it("staff cannot view another employee payslip", async () => {
    permissions.assertPayrollPermission.mockImplementationOnce(() => { throw new Error("DENIED"); });
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    await expect(query.payrollPayslip(null, { periodId: "p1", employeeId: "other" }, { user: { id: "self", userType: "STAFF" } })).rejects.toThrow("DENIED");
    expect(paymentServices.getPayrollPayslip).not.toHaveBeenCalled();
  });

  it("mark item paid requires restaurant scope then calls payment service", async () => {
    modelMocks.PayrollPeriod.findById.mockResolvedValueOnce({ _id: "p1", restaurantId: "r1" });
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    const input = { periodId: "p1", employeeId: "e1", amount: 100 };
    await mutation.markPayrollItemPaid(null, { input }, { user: { id: "admin", userType: "ADMIN" } });
    expect(guards.requireRestaurantAccess).toHaveBeenCalledWith(expect.anything(), "r1");
    expect(paymentServices.markPayrollItemPaid).toHaveBeenCalledWith(expect.objectContaining({ input }));
  });


  it("markPayrollPeriodPaid throws when underlying batch result has failedCount", async () => {
    modelMocks.PayrollPeriod.findById.mockResolvedValueOnce({
      _id: "p1",
      restaurantId: "r1",
      status: "finalized",
    });
    paymentServices.batchMarkPayrollPaid.mockResolvedValueOnce({
      successCount: 1,
      failedCount: 1,
      items: [{ id: "s1" }],
      errors: [{ employeeId: "s2", code: "ALREADY_PAID", message: "ALREADY_PAID" }],
    });
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;

    await expect(
      mutation.markPayrollPeriodPaid(
        null,
        { periodId: "p1", employeeIds: ["s1", "s2"] },
        { user: { id: "admin", userType: "ADMIN" } },
      ),
    ).rejects.toThrow("ALREADY_PAID");
  });

  it("payment history validates employee item scope", async () => {
    modelMocks.PayrollPeriod.findById.mockReturnValueOnce(periodChain({ _id: "p1", restaurantId: "r1" }));
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    await query.payrollPayments(null, { periodId: "p1", employeeId: "e1" }, { user: { id: "admin", userType: "ADMIN" } });
    expect(modelMocks.PayrollItem.findOne).toHaveBeenCalledWith(expect.objectContaining({ periodId: "p1", restaurantId: "r1", employeeId: "e1" }));
    expect(paymentServices.listPayrollPayments).toHaveBeenCalledWith({ periodId: "p1", employeeId: "e1" });
  });

  it("export rows are served through export service only", async () => {
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    await query.payrollExportRows(null, { periodId: "p1" }, { user: { id: "admin", userType: "ADMIN" } });
    expect(paymentServices.buildPayrollExportRows).toHaveBeenCalledWith({ periodId: "p1" });
  });
});
