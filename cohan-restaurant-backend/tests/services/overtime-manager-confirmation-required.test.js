import { beforeEach, describe, expect, it, vi } from "vitest";

const EMPLOYEE_ID = "507f1f77bcf86cd799439011";
const MANAGER_ID = "507f1f77bcf86cd799439020";
const RESTAURANT_ID = "507f1f77bcf86cd799439012";

const modelMocks = vi.hoisted(() => ({
  EventLog: { create: vi.fn() },
  OvertimeRequest: { findOne: vi.fn(), create: vi.fn() },
  Shift: {},
  Staff: { findById: vi.fn() },
  Timesheet: {},
}));
const notificationMocks = vi.hoisted(() => ({
  notifyReviewers: vi.fn(),
  notifyUser: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => ({
  assertNoLockedPayrollPeriodOverlap: vi.fn(),
}));
vi.mock("../../src/services/performance/performanceIncident.service.js", () => ({
  createPerformanceIncidentOnce: vi.fn(),
}));
vi.mock("../../src/services/notification/notificationWorkflow.service.js", () => notificationMocks);
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  ATTENDANCE_READ_ROLES: ["ADMIN", "MANAGER", "HR", "ACCOUNTANT"],
  ATTENDANCE_REVIEW_ROLES: ["ADMIN", "MANAGER", "HR"],
  userCanAccessRestaurant: vi.fn(() => true),
  userHasAnyRole: vi.fn((user, roles) => {
    const actual = [user?.userType, user?.roleName]
      .filter(Boolean)
      .map((value) => String(value).toUpperCase());
    return roles.some((role) => actual.includes(String(role).toUpperCase()));
  }),
}));

describe("manager-created overtime confirmation boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.Staff.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: EMPLOYEE_ID,
        userType: "STAFF",
        restaurantForStaff: RESTAURANT_ID,
        deletedAt: null,
      }),
    });
    modelMocks.OvertimeRequest.findOne.mockResolvedValue(null);
    modelMocks.OvertimeRequest.create.mockImplementation(async (input) => ({
      _id: "507f1f77bcf86cd799439099",
      ...input,
      auditLogs: input.auditLogs || [],
    }));
  });

  it("forces employee confirmation and notifies the target employee", async () => {
    const { createOvertimeRequest } = await import(
      "../../src/services/overtime/overtimeRequest.service.js"
    );

    const result = await createOvertimeRequest({
      input: {
        employeeId: EMPLOYEE_ID,
        restaurantId: RESTAURANT_ID,
        workDate: "2026-07-06",
        plannedStartTime: "2026-07-06T20:00:00.000+07:00",
        plannedEndTime: "2026-07-06T21:00:00.000+07:00",
        reason: "Hỗ trợ đóng ca",
        employeeConfirmationRequired: false,
      },
      ctx: {
        user: {
          id: MANAGER_ID,
          roleName: "manager",
          userType: "MANAGER",
          fullName: "Demo Manager",
        },
      },
    });

    expect(result.status).toBe("pending_employee_confirmation");
    expect(modelMocks.OvertimeRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeConfirmationRequired: true,
        status: "pending_employee_confirmation",
      }),
    );
    expect(notificationMocks.notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: EMPLOYEE_ID,
        type: "overtime_employee_confirmation_required",
        actionUrl: "/staff/attendance",
      }),
    );
  });
});
