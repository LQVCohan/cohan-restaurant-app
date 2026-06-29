import { describe, it, expect, vi, beforeEach } from "vitest";

const guards = vi.hoisted(() => ({ requireAuth: vi.fn(), requireRestaurantAccess: vi.fn(async () => true), requireRoles: vi.fn(), requireRestaurantScope: vi.fn() }));
const modelMocks = vi.hoisted(() => ({
  Staff: { findById: vi.fn() }, LeaveRequest: { findById: vi.fn(), create: vi.fn(), findByIdAndUpdate: vi.fn() }, LeaveBalance: { findOne: vi.fn(), create: vi.fn() }, EventLog: {}, Notification: {},
  Role: {}, Shift: {}, Timesheet: {}, PayrollSetting: {}, PayrollPeriod: {}, PayrollItem: {}, PayrollAdjustment: {}, EmployeeCodeCounter: {}, SchedulePublication: {}, ShiftAcknowledgement: {}, ScheduleAcknowledgement: {}, AttendanceCorrectionRequest: {}, OvertimeRequest: {}
}));

vi.mock("../../graphql/guards.js", () => guards);
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn(async () => ({})) } }));
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => ({ assertNoLockedPayrollPeriodOverlap: vi.fn(async () => true) }));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({ ATTENDANCE_REVIEW_ROLES: ["ADMIN", "MANAGER"], ATTENDANCE_OPERATION_ROLES: [], ATTENDANCE_SELF_ROLES: [], SCHEDULE_WRITE_ROLES: [], SHIFT_ACK_ADMIN_ROLES: [], resolveUserRoles: vi.fn(() => []), userCanAccessRestaurant: vi.fn(() => true) }));
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function ObjectId(v) { this.value=v; this.toString=()=>String(v); } } } }));

const q = (v) => ({ populate: vi.fn(() => q(v)), select: vi.fn(() => q(v)), lean: vi.fn(async () => v), then: (resolve, reject) => Promise.resolve(v).then(resolve, reject) });
const d = (v) => ({ ...v, save: vi.fn(async () => v), toObject: () => v, auditLogs: [] });

describe("staff leave mutation access", () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    modelMocks.Staff.findById.mockReturnValue(q({ _id: "e1", userType: "STAFF", primaryRestaurant: { _id: "r1" }, restaurantForStaff: "r1", refRestaurants: [], department: "ops", positionTitle: "staff", roleName: "staff" }));
    modelMocks.LeaveRequest.create.mockResolvedValue({ _id: "lr1" });
    modelMocks.LeaveRequest.findById.mockReturnValue(q({ _id: "lr1", employeeId: "e1", restaurantId: "r1", status: "pending", replacementStatus: "not_required", startDate: new Date(), endDate: new Date(), quotaImpact: {}, auditLogs: [] }));
  });

  it("createLeaveRequest self allowed", async () => {
    const m = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await m.createLeaveRequest(null, { input: { employeeId: "e1", restaurantId: "r1", leaveType: "ANNUAL", startDate: "2026-05-10", endDate: "2026-05-10", startSession: "FULL_DAY", endSession: "FULL_DAY" } }, { user: { id: "e1" } });
    expect(modelMocks.LeaveRequest.create).toHaveBeenCalled();
    expect(guards.requireRestaurantAccess).not.toHaveBeenCalled();
  });

  it("createLeaveRequest manager denied by restaurant access before write", async () => {
    guards.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    const m = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(m.createLeaveRequest(null, { input: { employeeId: "e1", restaurantId: "r1", leaveType: "ANNUAL", startDate: "2026-05-10", endDate: "2026-05-10", startSession: "FULL_DAY", endSession: "FULL_DAY" } }, { user: { id: "m1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.LeaveRequest.create).not.toHaveBeenCalled();
  });

  it("createLeaveRequest rejects staff not in restaurant", async () => {
    modelMocks.Staff.findById.mockReturnValueOnce(q({ _id: "e1", userType: "STAFF", primaryRestaurant: "r2", refRestaurants: [] }));
    const m = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(m.createLeaveRequest(null, { input: { employeeId: "e1", restaurantId: "r1", leaveType: "ANNUAL", startDate: "2026-05-10", endDate: "2026-05-10", startSession: "FULL_DAY", endSession: "FULL_DAY" } }, { user: { id: "e1" } })).rejects.toThrow("Staff does not belong to restaurant");
    expect(modelMocks.LeaveRequest.create).not.toHaveBeenCalled();
  });

  it("createLeaveRequest accepts replacementEmployeeId as legacy manager replacement", async () => {
    modelMocks.Staff.findById
      .mockReturnValueOnce(q({ _id: "e1", userType: "STAFF", restaurantForStaff: "r1", refRestaurants: [], department: "management", positionTitle: "Manager", roleName: "manager" }))
      .mockReturnValueOnce(q({ _id: "m2", department: "management", positionTitle: "Manager", roleName: "manager" }));
    const m = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await m.createLeaveRequest(null, { input: { employeeId: "e1", restaurantId: "r1", replacementEmployeeId: "m2", leaveType: "ANNUAL", startDate: "2026-05-10", endDate: "2026-05-10", startSession: "FULL_DAY", endSession: "FULL_DAY" } }, { user: { id: "e1" } });

    expect(modelMocks.LeaveRequest.create.mock.calls[0][0].replacementManagerId.toString()).toBe("m2");
  });

  it("rejectLeaveRequest blocks approved request before balance changes", async () => {
    const request = d({ _id: "lr1", employeeId: "e1", restaurantId: "r1", status: "approved", quotaImpact: { annual: 1 }, startDate: new Date(), endDate: new Date() });
    modelMocks.LeaveRequest.findById.mockReturnValueOnce(q(request));
    const m = (await import("../../graphql/resolvers/staff/mutation.js")).default;

    await expect(m.rejectLeaveRequest(null, { requestId: "lr1", reason: "no" }, { user: { id: "m1" } })).rejects.toThrow("Đơn nghỉ đã duyệt không thể từ chối");
    expect(request.save).not.toHaveBeenCalled();
    expect(modelMocks.LeaveBalance.findOne).not.toHaveBeenCalled();
  });
});
