import { beforeEach, describe, expect, it, vi } from "vitest";

const EMPLOYEE_ID = "507f1f77bcf86cd799439011";
const OTHER_EMPLOYEE_ID = "507f1f77bcf86cd799439013";
const RESTAURANT_ID = "507f1f77bcf86cd799439012";

const modelMocks = vi.hoisted(() => ({
  EventLog: { create: vi.fn() },
  OvertimeRequest: {
    find: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
  Shift: { findById: vi.fn() },
  Staff: { findById: vi.fn() },
  Timesheet: { findOne: vi.fn() },
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
    const actual = [user?.userType, user?.roleName, user?.role?.slug]
      .filter(Boolean)
      .map((value) => String(value).toUpperCase());
    return roles.some((role) => actual.includes(String(role).toUpperCase()));
  }),
}));

const ctx = (id, roleName, userType) => ({
  user: { id, roleName, userType, fullName: "Demo User" },
});

const findRowsChain = (capture) => ({
  sort: vi.fn(() => ({
    limit: vi.fn(() => ({
      populate: vi.fn(function populate() {
        capture.populateCalls += 1;
        return this;
      }),
      then: (resolve) => resolve([]),
    })),
  })),
});

const requestDoc = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439099",
  employeeId: EMPLOYEE_ID,
  restaurantId: RESTAURANT_ID,
  shiftId: null,
  timesheetId: null,
  workDate: new Date("2026-07-06T00:00:00.000Z"),
  plannedStartTime: new Date("2026-07-06T13:00:00.000Z"),
  plannedEndTime: new Date("2026-07-06T14:00:00.000Z"),
  plannedOvertimeMinutes: 60,
  overtimeType: "weekday",
  reason: "Hỗ trợ đóng ca",
  status: "pending_employee_confirmation",
  employeeConfirmationRequired: true,
  requestedBy: "507f1f77bcf86cd799439020",
  requestedByRole: "manager",
  requestedAt: new Date(),
  auditLogs: [],
  save: vi.fn(),
  ...overrides,
});

describe("overtime request role adapter", () => {
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
  });

  it("allows an operational staff role to self-create", async () => {
    const doc = requestDoc({ status: "pending_approval", employeeConfirmationRequired: false });
    modelMocks.OvertimeRequest.create.mockResolvedValue(doc);
    const { createOvertimeRequest } = await import(
      "../../src/services/overtime/overtimeRequest.service.js"
    );

    await createOvertimeRequest({
      input: {
        employeeId: EMPLOYEE_ID,
        restaurantId: RESTAURANT_ID,
        workDate: "2026-07-06",
        plannedStartTime: "2026-07-06T20:00:00.000+07:00",
        plannedEndTime: "2026-07-06T21:00:00.000+07:00",
        reason: "Hỗ trợ đóng ca",
      },
      ctx: ctx(EMPLOYEE_ID, "kitchen_helper", "STAFF"),
    });

    expect(modelMocks.OvertimeRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: expect.anything(),
        status: "pending_approval",
        requestedByRole: "staff",
      }),
    );
  });

  it("forces operational staff list queries to their own employee id", async () => {
    const capture = { query: null, populateCalls: 0 };
    modelMocks.OvertimeRequest.find.mockImplementation((query) => {
      capture.query = query;
      return findRowsChain(capture);
    });
    const { listOvertimeRequests } = await import(
      "../../src/services/overtime/overtimeRequest.service.js"
    );

    await listOvertimeRequests({
      filter: { restaurantId: RESTAURANT_ID, employeeId: OTHER_EMPLOYEE_ID },
      ctx: ctx(EMPLOYEE_ID, "cashier", "STAFF"),
    });

    expect(String(capture.query.employeeId)).toBe(EMPLOYEE_ID);
  });

  it("keeps accountant read-only", async () => {
    const { createOvertimeRequest } = await import(
      "../../src/services/overtime/overtimeRequest.service.js"
    );

    await expect(
      createOvertimeRequest({
        input: {
          employeeId: EMPLOYEE_ID,
          restaurantId: RESTAURANT_ID,
          workDate: "2026-07-06",
          plannedStartTime: "2026-07-06T20:00:00.000+07:00",
          plannedEndTime: "2026-07-06T21:00:00.000+07:00",
          reason: "Hỗ trợ đóng ca",
        },
        ctx: ctx("507f1f77bcf86cd799439030", "accountant", "ACCOUNTANT"),
      }),
    ).rejects.toThrow("Bạn không có quyền tạo yêu cầu tăng ca cho nhân viên này.");
  });

  it("allows only the target operational staff account to confirm", async () => {
    const doc = requestDoc();
    modelMocks.OvertimeRequest.findById.mockResolvedValue(doc);
    const { confirmOvertimeRequest } = await import(
      "../../src/services/overtime/overtimeRequest.service.js"
    );

    await confirmOvertimeRequest({
      input: { requestId: String(doc._id) },
      ctx: ctx(EMPLOYEE_ID, "server", "STAFF"),
    });

    expect(doc.status).toBe("pending_approval");
    expect(doc.save).toHaveBeenCalled();

    await expect(
      confirmOvertimeRequest({
        input: { requestId: String(doc._id) },
        ctx: ctx("507f1f77bcf86cd799439020", "manager", "MANAGER"),
      }),
    ).rejects.toThrow("Bạn không có quyền xác nhận yêu cầu tăng ca này.");
  });
});
