import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  AttendanceCorrectionRequest: {
    findOne: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
  },
  EventLog: { create: vi.fn() },
  Shift: { findById: vi.fn() },
  Staff: { findById: vi.fn() },
  Timesheet: { findById: vi.fn(), findOne: vi.fn(), create: vi.fn() },
}));

const payrollGuardMock = vi.hoisted(() => ({
  assertNoLockedPayrollPeriodOverlap: vi.fn().mockResolvedValue(undefined),
}));

const attendanceCalculationMock = vi.hoisted(() => ({
  calculateAttendanceMetrics: vi.fn().mockReturnValue({
    workedMinutes: 480,
    latenessMinutes: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    hours: 8,
  }),
  deriveAttendanceStatus: vi.fn().mockReturnValue("present"),
}));

const notificationMock = vi.hoisted(() => ({
  notifyReviewers: vi.fn().mockResolvedValue(undefined),
  notifyUser: vi.fn().mockResolvedValue(undefined),
}));

const performanceMock = vi.hoisted(() => ({
  createPerformanceIncidentOnce: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => payrollGuardMock);
vi.mock("../../src/services/attendance/attendanceCalculation.service.js", () => attendanceCalculationMock);
vi.mock("../../src/services/notification/notificationWorkflow.service.js", () => notificationMock);
vi.mock("../../src/services/performance/performanceIncident.service.js", () => performanceMock);
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  ATTENDANCE_READ_ROLES: ["ADMIN", "MANAGER", "HR", "ACCOUNTANT"],
  ATTENDANCE_REVIEW_ROLES: ["ADMIN", "MANAGER", "HR"],
  userCanAccessRestaurant: vi.fn().mockReturnValue(true),
  userHasAnyRole: vi.fn((user, roles) =>
    roles
      .map((r) => String(r).toLowerCase())
      .includes(String(user?.roleName || user?.userType || "").toLowerCase()),
  ),
}));

const ctxStaff = {
  user: { id: "507f1f77bcf86cd799439012", roleName: "STAFF" },
};
const ctxManager = {
  user: { id: "507f1f77bcf86cd799439001", roleName: "MANAGER" },
};

function createRequestDoc(overrides = {}) {
  return {
    _id: "r1",
    employeeId: "507f1f77bcf86cd799439012",
    restaurantId: "507f1f77bcf86cd799439011",
    timesheetId: "507f1f77bcf86cd799439099",
    shiftId: "507f1f77bcf86cd799439077",
    workDate: new Date("2026-04-10T00:00:00.000Z"),
    correctionType: "wrong_check_in_out",
    requestedBy: "507f1f77bcf86cd799439013",
    requestedCheckInAt: new Date("2026-04-10T09:00:00.000Z"),
    requestedCheckOutAt: new Date("2026-04-10T17:00:00.000Z"),
    reason: "Sửa giờ chấm công",
    status: "pending",
    auditLogs: [],
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("attendance correction workflow guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    modelMocks.Staff.findById.mockReturnValue({ populate: vi.fn().mockReturnThis() });
    modelMocks.Timesheet.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(null) });
    modelMocks.Timesheet.findOne.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockResolvedValue(null),
    });
    modelMocks.AttendanceCorrectionRequest.findById.mockResolvedValue(null);
    modelMocks.AttendanceCorrectionRequest.findOne.mockResolvedValue(null);
    modelMocks.AttendanceCorrectionRequest.create.mockImplementation(async (payload) => payload);
    modelMocks.Shift.findById.mockResolvedValue(null);
    modelMocks.Timesheet.create.mockResolvedValue({
      _id: "new-timesheet",
      actualCheckInAt: new Date("2026-04-10T09:00:00.000Z"),
      actualCheckOutAt: new Date("2026-04-10T17:00:00.000Z"),
      workedMinutes: 480,
      latenessMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      hours: 8,
      isOffSchedule: true,
      source: "manual_correction",
      offScheduleApprovalStatus: "approved",
    });
  });

  it("rejects duplicate pending with explicit code", async () => {
    const { createAttendanceCorrectionRequest } = await import(
      "../../src/services/attendance/attendanceCorrectionWorkflow.service.js"
    );

    const staffDoc = {
      _id: "507f1f77bcf86cd799439012",
      userType: "STAFF",
      restaurantForStaff: "507f1f77bcf86cd799439011",
    };
    modelMocks.Staff.findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      then: (resolve) => Promise.resolve(resolve(staffDoc)),
    });
    modelMocks.AttendanceCorrectionRequest.findOne.mockResolvedValue({ _id: "dup" });

    await expect(
      createAttendanceCorrectionRequest({
        input: {
          employeeId: "507f1f77bcf86cd799439012",
          restaurantId: "507f1f77bcf86cd799439011",
          workDate: "2026-04-10",
          correctionType: "wrong_check_in",
          requestedCheckInAt: "2026-04-10T09:00:00.000Z",
          reason: "Sửa giờ vào ca",
        },
        ctx: ctxStaff,
      }),
    ).rejects.toThrow("ATTENDANCE_CORRECTION_PENDING_EXISTS");
  });

  it("requires check-out for wrong_check_out", async () => {
    const { createAttendanceCorrectionRequest } = await import(
      "../../src/services/attendance/attendanceCorrectionWorkflow.service.js"
    );

    await expect(
      createAttendanceCorrectionRequest({
        input: {
          employeeId: "507f1f77bcf86cd799439012",
          restaurantId: "507f1f77bcf86cd799439011",
          workDate: "2026-04-10",
          correctionType: "wrong_check_out",
          requestedCheckInAt: "2026-04-10T09:00:00.000Z",
          reason: "Sửa giờ ra ca",
        },
        ctx: ctxStaff,
      }),
    ).rejects.toThrow("yêu cầu giờ check-out đề xuất");
  });

  it("blocks re-approve when request already applied", async () => {
    const { approveAttendanceCorrectionRequest } = await import(
      "../../src/services/attendance/attendanceCorrectionWorkflow.service.js"
    );

    modelMocks.AttendanceCorrectionRequest.findById.mockResolvedValue({
      _id: "r1",
      restaurantId: "507f1f77bcf86cd799439011",
      status: "applied",
    });

    await expect(
      approveAttendanceCorrectionRequest({
        input: { requestId: "r1", note: "ok" },
        ctx: ctxManager,
      }),
    ).rejects.toThrow("ATTENDANCE_CORRECTION_ALREADY_APPLIED");
  });

  it("requires restaurant scope when listing requests", async () => {
    const { listAttendanceCorrectionRequests } = await import(
      "../../src/services/attendance/attendanceCorrectionWorkflow.service.js"
    );

    await expect(
      listAttendanceCorrectionRequests({
        filter: {},
        ctx: ctxManager,
      }),
    ).rejects.toThrow("restaurantId không hợp lệ.");
  });

  it("rejects mismatched timesheet scope during create", async () => {
    const { createAttendanceCorrectionRequest } = await import(
      "../../src/services/attendance/attendanceCorrectionWorkflow.service.js"
    );

    const staffDoc = {
      _id: "507f1f77bcf86cd799439012",
      userType: "STAFF",
      restaurantForStaff: "507f1f77bcf86cd799439011",
    };
    modelMocks.Staff.findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      then: (resolve) => Promise.resolve(resolve(staffDoc)),
    });
    modelMocks.Timesheet.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue({
        _id: "507f1f77bcf86cd799439099",
        employeeId: "507f1f77bcf86cd799439888",
        restaurantId: "507f1f77bcf86cd799439011",
        workDate: new Date("2026-04-10T00:00:00.000Z"),
      }),
    });

    await expect(
      createAttendanceCorrectionRequest({
        input: {
          employeeId: "507f1f77bcf86cd799439012",
          restaurantId: "507f1f77bcf86cd799439011",
          timesheetId: "507f1f77bcf86cd799439099",
          workDate: "2026-04-10",
          correctionType: "wrong_check_in",
          requestedCheckInAt: "2026-04-10T09:00:00.000Z",
          reason: "Sửa giờ vào ca",
        },
        ctx: ctxStaff,
      }),
    ).rejects.toThrow("Bảng công không thuộc nhân viên đã chọn.");
  });

  it("keeps request pending when apply to timesheet fails", async () => {
    const { approveAttendanceCorrectionRequest } = await import(
      "../../src/services/attendance/attendanceCorrectionWorkflow.service.js"
    );

    const requestDoc = createRequestDoc();
    modelMocks.AttendanceCorrectionRequest.findById.mockResolvedValue(requestDoc);
    modelMocks.Timesheet.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(null),
    });

    await expect(
      approveAttendanceCorrectionRequest({
        input: { requestId: "r1", note: "ok" },
        ctx: ctxManager,
      }),
    ).rejects.toThrow("Không tìm thấy bảng công để áp dụng chỉnh công.");

    expect(requestDoc.status).toBe("pending");
    expect(requestDoc.save).not.toHaveBeenCalled();
    expect(performanceMock.createPerformanceIncidentOnce).not.toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ATTENDANCE_CORRECTION_APPLIED",
      }),
    );
  });

  it("approves off-schedule correction by creating approved off-schedule timesheet", async () => {
    const { approveAttendanceCorrectionRequest } = await import(
      "../../src/services/attendance/attendanceCorrectionWorkflow.service.js"
    );

    const requestDoc = createRequestDoc({
      correctionType: "off_schedule_work",
      timesheetId: null,
      shiftId: null,
      save: vi.fn().mockResolvedValue(undefined),
    });
    const populatedRequest = {
      ...requestDoc,
      employeeId: { _id: requestDoc.employeeId, fullName: "NV A" },
      requestedBy: null,
      reviewedBy: { _id: ctxManager.user.id, fullName: "QL" },
      appliedBy: { _id: ctxManager.user.id, fullName: "QL" },
    };

    modelMocks.AttendanceCorrectionRequest.findById
      .mockResolvedValueOnce(requestDoc)
      .mockResolvedValueOnce(populatedRequest);

    await approveAttendanceCorrectionRequest({
      input: { requestId: "r1", note: "Đủ bằng chứng" },
      ctx: ctxManager,
    });

    expect(modelMocks.Timesheet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        isOffSchedule: true,
        approved: true,
        offScheduleApprovalStatus: "approved",
        source: "manual_correction",
      }),
    );
    expect(requestDoc.status).toBe("applied");
    expect(requestDoc.save).toHaveBeenCalledTimes(1);
  });
});
