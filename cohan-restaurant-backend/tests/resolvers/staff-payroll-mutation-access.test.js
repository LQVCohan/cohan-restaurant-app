import { describe, it, expect, vi, beforeEach } from "vitest";

const guards = vi.hoisted(() => ({ requireAuth: vi.fn(), requireRestaurantAccess: vi.fn(async () => true), requireRoles: vi.fn(), requireRestaurantScope: vi.fn() }));
const services = vi.hoisted(() => ({ assertPayrollPermission: vi.fn(), getPayrollSettings: vi.fn(async () => ({})), upsertPeriodItems: vi.fn(async () => ({ stats: {} })), getPeriodDetail: vi.fn(async () => ({ period: { id: "p1" }, items: [] })), logPayrollEvent: vi.fn(async () => true) }));
const modelMocks = vi.hoisted(() => ({
  Staff: { findById: vi.fn() }, PayrollPeriod: { findById: vi.fn(), findOne: vi.fn(), create: vi.fn(), findByIdAndUpdate: vi.fn() }, PayrollItem: { updateMany: vi.fn(), countDocuments: vi.fn(async () => 0) }, PayrollSetting: { findOne: vi.fn(), findOneAndUpdate: vi.fn() }, PayrollAdjustment: { create: vi.fn(), deleteOne: vi.fn() },
  Role: {}, EventLog: {}, Shift: {}, Timesheet: {}, LeaveRequest: {}, LeaveBalance: {}, PayrollAdjustmentLog: {}, EmployeeCodeCounter: {}, Notification: {}, SchedulePublication: {}, ShiftAcknowledgement: {}, ScheduleAcknowledgement: {}, AttendanceCorrectionRequest: {}, OvertimeRequest: {}
}));

vi.mock("../../graphql/guards.js", () => guards);
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn() } }));
vi.mock("../../src/services/payroll/payrollPermission.service.js", () => ({ assertPayrollPermission: services.assertPayrollPermission }));
vi.mock("../../src/services/payroll/payrollRuntime.service.js", () => ({ getPayrollSettings: services.getPayrollSettings, getPeriodDetail: services.getPeriodDetail, upsertPeriodItems: services.upsertPeriodItems, mapPayrollDocToGql: vi.fn((x) => x), toEndOfDay: vi.fn((d) => new Date(d)), toStartOfDay: vi.fn((d) => new Date(d)), toObjectId: vi.fn((x) => x) }));
vi.mock("../../src/services/payroll/payrollEventLog.service.js", () => ({ logPayrollEvent: services.logPayrollEvent }));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({ ATTENDANCE_REVIEW_ROLES: [], ATTENDANCE_OPERATION_ROLES: [], ATTENDANCE_SELF_ROLES: [], SCHEDULE_WRITE_ROLES: [], SHIFT_ACK_ADMIN_ROLES: [], resolveUserRoles: vi.fn(() => []), userCanAccessRestaurant: vi.fn(() => true) }));
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function ObjectId(v) { this.toString = () => String(v); } } } }));

const q = (v) => ({ select: vi.fn(() => q(v)), lean: vi.fn(async () => v) });

describe("staff payroll mutation access", () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    modelMocks.PayrollSetting.findOne.mockResolvedValue(null);
    modelMocks.PayrollPeriod.findOne.mockResolvedValue(null);
    modelMocks.PayrollPeriod.create.mockResolvedValue({ _id: "p1", restaurantId: "r1", name: "p", startDate: new Date("2026-05-01"), endDate: new Date("2026-05-31"), status: "draft" });
    modelMocks.PayrollPeriod.findById.mockResolvedValue({ _id: "p1", restaurantId: "r1", status: "draft", endDate: new Date(), save: vi.fn() });
    modelMocks.PayrollSetting.findOneAndUpdate.mockResolvedValue({ toObject: () => ({ restaurantId: "r1" }), restaurantId: "r1" });
    modelMocks.Staff.findById.mockReturnValue(q({ _id: "e1", userType: "STAFF", primaryRestaurant: "r1", restaurantForStaff: "r1", refRestaurants: [] }));
  });

  it("createPayrollPeriod denied by restaurant access before writes", async () => {
    guards.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    const m = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(m.createPayrollPeriod(null, { input: { restaurantId: "r1", startDate: "2026-05-01", endDate: "2026-05-31" } }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.PayrollPeriod.create).not.toHaveBeenCalled();
    expect(services.upsertPeriodItems).not.toHaveBeenCalled();
  });

  it("finalizePayrollPeriod denied by restaurant access before updates", async () => {
    guards.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    const m = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(m.finalizePayrollPeriod(null, { periodId: "p1" }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.PayrollItem.updateMany).not.toHaveBeenCalled();
  });

  it("upsertPayrollAdjustment rejects employee from another restaurant", async () => {
    modelMocks.Staff.findById.mockReturnValueOnce(q({ _id: "e1", userType: "STAFF", primaryRestaurant: "r2", refRestaurants: [] }));
    const m = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(m.upsertPayrollAdjustment(null, { input: { periodId: "p1", employeeId: "e1", type: "bonus", amount: 100 } }, { user: { id: "u1" } })).rejects.toThrow("Staff does not belong to this restaurant");
    expect(modelMocks.PayrollAdjustment.create).not.toHaveBeenCalled();
  });
});
