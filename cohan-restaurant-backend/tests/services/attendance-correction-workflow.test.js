import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  AttendanceCorrectionRequest: { findOne: vi.fn(), create: vi.fn(), findById: vi.fn() },
  EventLog: { create: vi.fn() },
  Shift: { findById: vi.fn() },
  Staff: { findById: vi.fn() },
  Timesheet: { findById: vi.fn(), findOne: vi.fn(), create: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => ({
  assertNoLockedPayrollPeriodOverlap: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/services/attendance/attendanceCalculation.service.js", () => ({
  calculateAttendanceMetrics: vi.fn().mockReturnValue({ workedMinutes: 480, latenessMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0, hours: 8 }),
  deriveAttendanceStatus: vi.fn().mockReturnValue("present"),
}));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  ATTENDANCE_READ_ROLES: ["ADMIN", "MANAGER", "HR", "ACCOUNTANT"],
  ATTENDANCE_REVIEW_ROLES: ["ADMIN", "MANAGER", "HR"],
  userCanAccessRestaurant: vi.fn().mockReturnValue(true),
  userHasAnyRole: vi.fn((user, roles) => roles.map((r) => String(r).toLowerCase()).includes(String(user?.roleName || user?.userType || "").toLowerCase())),
}));

describe("attendance correction workflow guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.Staff.findById.mockReturnValue({ populate: vi.fn().mockReturnThis() });
  });

  it("rejects duplicate pending with explicit code", async () => {
    const { createAttendanceCorrectionRequest } = await import("../../src/services/attendance/attendanceCorrectionWorkflow.service.js");

    const staffDoc = { _id: "507f1f77bcf86cd799439012", userType: "STAFF", primaryRestaurant: "507f1f77bcf86cd799439011" };
    modelMocks.Staff.findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      then: (resolve) => Promise.resolve(resolve(staffDoc)),
    });
    modelMocks.AttendanceCorrectionRequest.findOne.mockResolvedValue({ _id: "dup" });
    modelMocks.Timesheet.findOne.mockReturnValue({ populate: vi.fn().mockReturnThis(), sort: vi.fn().mockResolvedValue(null) });

    await expect(createAttendanceCorrectionRequest({
      input: {
        employeeId: "507f1f77bcf86cd799439012",
        restaurantId: "507f1f77bcf86cd799439011",
        workDate: "2026-04-10",
        correctionType: "wrong_check_in",
        requestedCheckInAt: "2026-04-10T09:00:00.000Z",
        reason: "Sửa giờ vào ca",
      },
      ctx: { user: { id: "507f1f77bcf86cd799439012", roleName: "STAFF" } },
    })).rejects.toThrow("ATTENDANCE_CORRECTION_PENDING_EXISTS");
  });

  it("requires check-out for wrong_check_out", async () => {
    const { createAttendanceCorrectionRequest } = await import("../../src/services/attendance/attendanceCorrectionWorkflow.service.js");

    await expect(createAttendanceCorrectionRequest({
      input: {
        employeeId: "507f1f77bcf86cd799439012",
        restaurantId: "507f1f77bcf86cd799439011",
        workDate: "2026-04-10",
        correctionType: "wrong_check_out",
        requestedCheckInAt: "2026-04-10T09:00:00.000Z",
        reason: "Sửa giờ ra ca",
      },
      ctx: { user: { id: "507f1f77bcf86cd799439012", roleName: "STAFF" } },
    })).rejects.toThrow("yêu cầu giờ check-out đề xuất");
  });

  it("blocks re-approve when request already applied", async () => {
    const { approveAttendanceCorrectionRequest } = await import("../../src/services/attendance/attendanceCorrectionWorkflow.service.js");

    modelMocks.AttendanceCorrectionRequest.findById.mockResolvedValue({ _id: "r1", restaurantId: "507f1f77bcf86cd799439011", status: "applied" });

    await expect(approveAttendanceCorrectionRequest({
      input: { requestId: "r1", note: "ok" },
      ctx: { user: { id: "507f1f77bcf86cd799439001", roleName: "MANAGER" } },
    })).rejects.toThrow("ATTENDANCE_CORRECTION_ALREADY_APPLIED");
  });
});
