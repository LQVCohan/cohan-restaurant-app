import { beforeEach, describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(async () => true),
  requireRoles: vi.fn(),
  requireRestaurantScope: vi.fn(),
}));

const serviceMocks = vi.hoisted(() => ({
  assignStaffRoleWithinRestaurant: vi.fn(),
}));

const modelMocks = vi.hoisted(() => ({
  Staff: vi.fn(),
  Role: { findById: vi.fn(), findOne: vi.fn() },
  EventLog: { create: vi.fn(async () => ({})) },
  EmployeeCodeCounter: { findOneAndUpdate: vi.fn(async () => ({ seq: 1 })) },
  Notification: { insertMany: vi.fn(async () => []) },
  Shift: {},
  Timesheet: {},
  LeaveRequest: {},
  LeaveBalance: {},
  PayrollSetting: {},
  PayrollPeriod: {},
  PayrollItem: {},
  PayrollAdjustment: {},
  SchedulePublication: {},
  ShiftAcknowledgement: {},
  ScheduleAcknowledgement: {},
  AttendanceCorrectionRequest: {},
  OvertimeRequest: {},
}));

vi.mock("../../graphql/guards.js", () => guards);
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/staffRoleAssignment.service.js", () => serviceMocks);
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn(async () => ({})) } }));
vi.mock("../../src/services/payroll/payrollPermission.service.js", () => ({ assertPayrollPermission: vi.fn() }));
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => ({ assertNoLockedPayrollPeriodOverlap: vi.fn(async () => {}) }));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  ATTENDANCE_REVIEW_ROLES: [],
  ATTENDANCE_OPERATION_ROLES: [],
  ATTENDANCE_SELF_ROLES: [],
  SCHEDULE_WRITE_ROLES: [],
  SHIFT_ACK_ADMIN_ROLES: [],
  resolveUserRoles: vi.fn(() => []),
  userCanAccessRestaurant: vi.fn(() => true),
}));
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function ObjectId(v) { return v; } } } }));

describe("staff role assignment mutation resolver", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("delegates assignStaffRole input to the RBAC service with the context actor", async () => {
    const assignedStaff = { id: "staff-1", role: { id: "role-server", slug: "server" } };
    serviceMocks.assignStaffRoleWithinRestaurant.mockResolvedValue(assignedStaff);
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;

    const result = await mutation.assignStaffRole(
      null,
      { input: { staffUserId: "staff-1", roleId: "role-server", restaurantId: "restaurant-1" } },
      { user: { id: "manager-1", roleName: "manager" } },
    );

    expect(result).toBe(assignedStaff);
    expect(guards.requireAuth).toHaveBeenCalledWith({ user: { id: "manager-1", roleName: "manager" } });
    expect(serviceMocks.assignStaffRoleWithinRestaurant).toHaveBeenCalledWith({
      actor: { id: "manager-1", roleName: "manager" },
      staffUserId: "staff-1",
      roleId: "role-server",
      restaurantId: "restaurant-1",
    });
  });

  it("keeps legacy assignStaffRoleWithinRestaurant arguments available and lets service enforce FORBIDDEN", async () => {
    const forbidden = new Error("FORBIDDEN");
    forbidden.extensions = { code: "FORBIDDEN" };
    serviceMocks.assignStaffRoleWithinRestaurant.mockRejectedValue(forbidden);
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;

    await expect(mutation.assignStaffRoleWithinRestaurant(
      null,
      { staffUserId: "staff-2", roleId: "role-admin", restaurantId: "restaurant-2" },
      { user: { id: "staff-user", roleName: "staff" } },
    )).rejects.toThrow("FORBIDDEN");

    expect(serviceMocks.assignStaffRoleWithinRestaurant).toHaveBeenCalledWith({
      actor: { id: "staff-user", roleName: "staff" },
      staffUserId: "staff-2",
      roleId: "role-admin",
      restaurantId: "restaurant-2",
    });
  });
});
