import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  EventLog: { create: vi.fn() },
  PayrollPeriod: { findOne: vi.fn() },
  Staff: { findById: vi.fn() },
  SystemSetting: { findOne: vi.fn() },
  Timesheet: { findById: vi.fn() },
}));

const permissionMocks = vi.hoisted(() => ({
  ATTENDANCE_REVIEW_ROLES: ["ADMIN", "MANAGER", "HR"],
  userCanAccessRestaurant: vi.fn(() => true),
  userHasAnyRole: vi.fn((user, roles) =>
    roles
      .map((role) => String(role).toUpperCase())
      .includes(String(user?.roleName || user?.userType || "").toUpperCase()),
  ),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock(
  "../../src/services/scheduling/schedulingPermission.service.js",
  () => permissionMocks,
);

const managerCtx = {
  user: {
    id: "507f1f77bcf86cd799439001",
    roleName: "MANAGER",
    restaurantForStaff: "507f1f77bcf86cd799439099",
  },
};

const staffCtx = {
  user: {
    id: "507f1f77bcf86cd799439002",
    roleName: "STAFF",
    restaurantForStaff: "507f1f77bcf86cd799439099",
  },
};

function createTimesheet(overrides = {}) {
  return {
    _id: "507f1f77bcf86cd799439010",
    employeeId: "507f1f77bcf86cd799439011",
    restaurantId: "507f1f77bcf86cd799439099",
    workDate: new Date("2026-05-10T00:00:00.000Z"),
    plannedStartTime: new Date("2026-05-10T09:00:00.000Z"),
    plannedEndTime: new Date("2026-05-10T17:00:00.000Z"),
    actualCheckInAt: new Date("2026-05-10T09:02:00.000Z"),
    actualCheckOutAt: new Date("2026-05-10T18:15:00.000Z"),
    workedMinutes: 553,
    hours: 9.22,
    latenessMinutes: 2,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 75,
    approvedOvertimeMinutes: 0,
    overtimeApprovalStatus: "pending",
    overtimeReviewNote: "",
    overtimeReviewedBy: null,
    overtimeReviewedAt: null,
    isOffSchedule: false,
    offScheduleApprovalStatus: "not_required",
    offScheduleReasonCategory: "other",
    offScheduleReason: "",
    offScheduleReviewedBy: null,
    offScheduleReviewedAt: null,
    offScheduleReviewNote: "",
    source: "quick",
    note: "",
    approved: false,
    shiftId: {
      _id: "507f1f77bcf86cd799439020",
      shiftType: "evening",
      startTime: new Date("2026-05-10T09:00:00.000Z"),
      endTime: new Date("2026-05-10T17:00:00.000Z"),
    },
    createdAt: new Date("2026-05-10T18:16:00.000Z"),
    updatedAt: new Date("2026-05-10T18:16:00.000Z"),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createPayrollPeriod(status) {
  return {
    _id: `507f1f77bcf86cd7994390${status.length}`,
    restaurantId: "507f1f77bcf86cd799439099",
    startDate: new Date("2026-05-01T00:00:00.000Z"),
    endDate: new Date("2026-05-31T23:59:59.999Z"),
    status,
  };
}

function mockPayrollPeriodLookup(period = null) {
  const lean = vi.fn().mockResolvedValue(period);
  const sort = vi.fn().mockReturnValue({ lean });
  modelMocks.PayrollPeriod.findOne.mockReturnValue({ sort });
  return { sort, lean };
}

function mockSystemSettingLookup(setting = null) {
  const lean = vi.fn().mockResolvedValue(setting);
  const select = vi.fn().mockReturnValue({ lean });
  modelMocks.SystemSetting.findOne.mockReturnValue({ select });
  return { select, lean };
}

describe("attendance overtime approval", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    permissionMocks.userCanAccessRestaurant.mockReturnValue(true);
    permissionMocks.userHasAnyRole.mockImplementation((user, roles) =>
      roles
        .map((role) => String(role).toUpperCase())
        .includes(String(user?.roleName || user?.userType || "").toUpperCase()),
    );
    modelMocks.Staff.findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        fullName: "Nguyen Van A",
        employeeCode: "NV0001",
        positionTitle: "Phuc vu",
        roleName: "STAFF",
        avatarUrl: null,
        avatar: null,
      }),
    });
    mockPayrollPeriodLookup(null);
    mockSystemSettingLookup(null);
  });

  it("checkout sau plannedEndTime set overtimeMinutes", async () => {
    const { calculateAttendanceMetrics } = await import(
      "../../src/services/attendance/attendanceCalculation.service.js"
    );

    const result = calculateAttendanceMetrics({
      plannedStartTime: "2026-05-10T09:00:00.000Z",
      plannedEndTime: "2026-05-10T17:00:00.000Z",
      actualCheckInAt: "2026-05-10T09:00:00.000Z",
      actualCheckOutAt: "2026-05-10T18:30:00.000Z",
    });

    expect(result.overtimeMinutes).toBe(90);
  });

  it("checkout đúng/trước plannedEndTime set overtimeMinutes = 0", async () => {
    const { calculateAttendanceMetrics } = await import(
      "../../src/services/attendance/attendanceCalculation.service.js"
    );

    const exactEnd = calculateAttendanceMetrics({
      plannedStartTime: "2026-05-10T09:00:00.000Z",
      plannedEndTime: "2026-05-10T17:00:00.000Z",
      actualCheckInAt: "2026-05-10T09:00:00.000Z",
      actualCheckOutAt: "2026-05-10T17:00:00.000Z",
    });
    const earlyEnd = calculateAttendanceMetrics({
      plannedStartTime: "2026-05-10T09:00:00.000Z",
      plannedEndTime: "2026-05-10T17:00:00.000Z",
      actualCheckInAt: "2026-05-10T09:00:00.000Z",
      actualCheckOutAt: "2026-05-10T16:45:00.000Z",
    });

    expect(exactEnd.overtimeMinutes).toBe(0);
    expect(earlyEnd.overtimeMinutes).toBe(0);
  });

  it("approve overtime thành approved", async () => {
    const timesheet = createTimesheet();
    modelMocks.Timesheet.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(timesheet),
    });

    const { approveAttendanceOvertime } = await import(
      "../../src/services/attendance/attendanceOvertimeApproval.service.js"
    );

    const result = await approveAttendanceOvertime({
      input: {
        timesheetId: timesheet._id,
        approvedOvertimeMinutes: 60,
        reviewNote: "Đã xác nhận tăng ca.",
      },
      ctx: managerCtx,
    });

    expect(timesheet.overtimeApprovalStatus).toBe("approved");
    expect(timesheet.approvedOvertimeMinutes).toBe(60);
    expect(timesheet.save).toHaveBeenCalledTimes(1);
    expect(result.overtimeApprovalStatus).toBe("approved");
    expect(result.status).toBe("late");
  });

  it("reject overtime thành rejected + approvedOvertimeMinutes = 0", async () => {
    const timesheet = createTimesheet({ approvedOvertimeMinutes: 45 });
    modelMocks.Timesheet.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(timesheet),
    });

    const { rejectAttendanceOvertime } = await import(
      "../../src/services/attendance/attendanceOvertimeApproval.service.js"
    );

    const result = await rejectAttendanceOvertime({
      input: {
        timesheetId: timesheet._id,
        reviewNote: "Không đủ căn cứ vận hành.",
      },
      ctx: managerCtx,
    });

    expect(timesheet.overtimeApprovalStatus).toBe("rejected");
    expect(timesheet.approvedOvertimeMinutes).toBe(0);
    expect(result.overtimeApprovalStatus).toBe("rejected");
    expect(result.approvedOvertimeMinutes).toBe(0);
  });

  it.each(["finalized", "locked", "paid"])(
    "approve bị block khi payroll period %s",
    async (status) => {
      const timesheet = createTimesheet();
      modelMocks.Timesheet.findById.mockReturnValue({
        populate: vi.fn().mockResolvedValue(timesheet),
      });
      mockPayrollPeriodLookup(createPayrollPeriod(status));

      const { approveAttendanceOvertime } = await import(
        "../../src/services/attendance/attendanceOvertimeApproval.service.js"
      );

      await expect(
        approveAttendanceOvertime({
          input: { timesheetId: timesheet._id },
          ctx: managerCtx,
        }),
      ).rejects.toThrow("ATTENDANCE_OVERTIME_PAYROLL_PERIOD_LOCKED");
      expect(timesheet.save).not.toHaveBeenCalled();
    },
  );

  it.each(["finalized", "locked", "paid"])(
    "reject bị block khi payroll period %s",
    async (status) => {
      const timesheet = createTimesheet();
      modelMocks.Timesheet.findById.mockReturnValue({
        populate: vi.fn().mockResolvedValue(timesheet),
      });
      mockPayrollPeriodLookup(createPayrollPeriod(status));

      const { rejectAttendanceOvertime } = await import(
        "../../src/services/attendance/attendanceOvertimeApproval.service.js"
      );

      await expect(
        rejectAttendanceOvertime({
          input: {
            timesheetId: timesheet._id,
            reviewNote: "Kỳ lương đã khóa.",
          },
          ctx: managerCtx,
        }),
      ).rejects.toThrow("ATTENDANCE_OVERTIME_PAYROLL_PERIOD_LOCKED");
      expect(timesheet.save).not.toHaveBeenCalled();
    },
  );

  it("approve vẫn được nếu không có PayrollPeriod chứa workDate", async () => {
    const timesheet = createTimesheet();
    modelMocks.Timesheet.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(timesheet),
    });
    mockPayrollPeriodLookup(null);

    const { approveAttendanceOvertime } = await import(
      "../../src/services/attendance/attendanceOvertimeApproval.service.js"
    );

    const result = await approveAttendanceOvertime({
      input: {
        timesheetId: timesheet._id,
        approvedOvertimeMinutes: 30,
      },
      ctx: managerCtx,
    });

    expect(result.approvedOvertimeMinutes).toBe(30);
    expect(timesheet.save).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["approve", "approved"],
    ["approve", "rejected"],
    ["reject", "approved"],
    ["reject", "rejected"],
  ])(
    "%s bị block nếu overtimeApprovalStatus đã %s",
    async (action, currentStatus) => {
      const timesheet = createTimesheet({ overtimeApprovalStatus: currentStatus });
      modelMocks.Timesheet.findById.mockReturnValue({
        populate: vi.fn().mockResolvedValue(timesheet),
      });

      const service = await import(
        "../../src/services/attendance/attendanceOvertimeApproval.service.js"
      );

      const run =
        action === "approve"
          ? service.approveAttendanceOvertime({
              input: { timesheetId: timesheet._id },
              ctx: managerCtx,
            })
          : service.rejectAttendanceOvertime({
              input: {
                timesheetId: timesheet._id,
                reviewNote: "Đã review trước đó.",
              },
              ctx: managerCtx,
            });

      await expect(run).rejects.toThrow("ATTENDANCE_OVERTIME_ALREADY_REVIEWED");
      expect(timesheet.save).not.toHaveBeenCalled();
    },
  );

  it("pending vẫn approve được", async () => {
    const timesheet = createTimesheet({ overtimeApprovalStatus: "pending" });
    modelMocks.Timesheet.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(timesheet),
    });

    const { approveAttendanceOvertime } = await import(
      "../../src/services/attendance/attendanceOvertimeApproval.service.js"
    );

    const result = await approveAttendanceOvertime({
      input: { timesheetId: timesheet._id },
      ctx: managerCtx,
    });

    expect(result.overtimeApprovalStatus).toBe("approved");
    expect(result.approvedOvertimeMinutes).toBe(75);
  });

  it("pending vẫn reject được", async () => {
    const timesheet = createTimesheet({ overtimeApprovalStatus: "pending" });
    modelMocks.Timesheet.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(timesheet),
    });

    const { rejectAttendanceOvertime } = await import(
      "../../src/services/attendance/attendanceOvertimeApproval.service.js"
    );

    const result = await rejectAttendanceOvertime({
      input: {
        timesheetId: timesheet._id,
        reviewNote: "Không phù hợp để duyệt.",
      },
      ctx: managerCtx,
    });

    expect(result.overtimeApprovalStatus).toBe("rejected");
    expect(result.approvedOvertimeMinutes).toBe(0);
  });

  it("reject nếu approvedOvertimeMinutes > overtimeMinutes", async () => {
    const timesheet = createTimesheet({ overtimeMinutes: 30 });
    modelMocks.Timesheet.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(timesheet),
    });

    const { rejectAttendanceOvertime } = await import(
      "../../src/services/attendance/attendanceOvertimeApproval.service.js"
    );

    await expect(
      rejectAttendanceOvertime({
        input: {
          timesheetId: timesheet._id,
          approvedOvertimeMinutes: 45,
          reviewNote: "Sai số phút.",
        },
        ctx: managerCtx,
      }),
    ).rejects.toThrow("ATTENDANCE_OVERTIME_APPROVED_EXCEEDS_RAW");
  });

  it("reject nếu approvedOvertimeMinutes âm", async () => {
    const timesheet = createTimesheet();
    modelMocks.Timesheet.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(timesheet),
    });

    const { rejectAttendanceOvertime } = await import(
      "../../src/services/attendance/attendanceOvertimeApproval.service.js"
    );

    await expect(
      rejectAttendanceOvertime({
        input: {
          timesheetId: timesheet._id,
          approvedOvertimeMinutes: -1,
          reviewNote: "Sai số phút.",
        },
        ctx: managerCtx,
      }),
    ).rejects.toThrow("ATTENDANCE_OVERTIME_NEGATIVE_APPROVED_MINUTES");
  });

  it("reject no-show/scheduled_absent", async () => {
    const timesheet = createTimesheet({
      actualCheckInAt: null,
      actualCheckOutAt: null,
      overtimeMinutes: 40,
    });
    modelMocks.Timesheet.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(timesheet),
    });

    const { rejectAttendanceOvertime } = await import(
      "../../src/services/attendance/attendanceOvertimeApproval.service.js"
    );

    await expect(
      rejectAttendanceOvertime({
        input: {
          timesheetId: timesheet._id,
          reviewNote: "No-show không được duyệt.",
        },
        ctx: managerCtx,
      }),
    ).rejects.toThrow("ATTENDANCE_OVERTIME_NO_SHOW_NOT_REVIEWABLE");
  });

  it("reject missed_checkout", async () => {
    const timesheet = createTimesheet({
      actualCheckOutAt: null,
      overtimeMinutes: 40,
    });
    modelMocks.Timesheet.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(timesheet),
    });

    const { rejectAttendanceOvertime } = await import(
      "../../src/services/attendance/attendanceOvertimeApproval.service.js"
    );

    await expect(
      rejectAttendanceOvertime({
        input: {
          timesheetId: timesheet._id,
          reviewNote: "Thiếu checkout.",
        },
        ctx: managerCtx,
      }),
    ).rejects.toThrow("ATTENDANCE_OVERTIME_MISSED_CHECKOUT_NOT_REVIEWABLE");
  });

  it("non-review role bị chặn", async () => {
    const timesheet = createTimesheet();
    modelMocks.Timesheet.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(timesheet),
    });

    const { approveAttendanceOvertime } = await import(
      "../../src/services/attendance/attendanceOvertimeApproval.service.js"
    );

    await expect(
      approveAttendanceOvertime({
        input: { timesheetId: timesheet._id },
        ctx: staffCtx,
      }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("cross-restaurant bị chặn", async () => {
    const timesheet = createTimesheet();
    modelMocks.Timesheet.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(timesheet),
    });
    permissionMocks.userCanAccessRestaurant.mockReturnValue(false);

    const { approveAttendanceOvertime } = await import(
      "../../src/services/attendance/attendanceOvertimeApproval.service.js"
    );

    await expect(
      approveAttendanceOvertime({
        input: { timesheetId: timesheet._id },
        ctx: managerCtx,
      }),
    ).rejects.toThrow("RESTAURANT_SCOPE_FORBIDDEN");
  });

  it("correction approval recalculate overtime", async () => {
    const { buildAttendanceOvertimeState } = await import(
      "../../src/services/attendance/attendanceOvertimeApproval.service.js"
    );

    const result = buildAttendanceOvertimeState({
      overtimeMinutes: 30,
      previousOvertimeMinutes: 75,
      currentStatus: "approved",
      approvedOvertimeMinutes: 60,
      reviewNote: "Đã duyệt trước đó",
      reviewedBy: "507f1f77bcf86cd799439001",
      reviewedAt: new Date("2026-05-10T18:30:00.000Z"),
      preserveApproved: true,
    });

    expect(result.overtimeApprovalStatus).toBe("pending");
    expect(result.approvedOvertimeMinutes).toBe(0);
    expect(result.overtimeReviewNote).toBe("");
  });

  it("staffAttendanceRecords expose overtime fields", async () => {
    modelMocks.Timesheet.findById.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        overtimeMinutes: 45,
        approvedOvertimeMinutes: 30,
        overtimeApprovalStatus: "approved",
        overtimeReviewNote: "Đã xác minh",
        overtimeReviewedBy: "507f1f77bcf86cd799439001",
        overtimeReviewedAt: new Date("2026-05-10T18:45:00.000Z"),
      }),
    });

    const overtimeResolvers = (
      await import("../../graphql/resolvers/attendance_overtime/index.js")
    ).default;

    const source = {
      id: "507f1f77bcf86cd799439010",
      overtimeMinutes: 45,
    };

    await expect(
      overtimeResolvers.StaffAttendanceRecord.approvedOvertimeMinutes(source),
    ).resolves.toBe(30);
    await expect(
      overtimeResolvers.StaffAttendanceRecord.overtimeApprovalStatus(source),
    ).resolves.toBe("approved");
    await expect(
      overtimeResolvers.StaffAttendanceRecord.overtimeReviewNote(source),
    ).resolves.toBe("Đã xác minh");
    await expect(
      overtimeResolvers.StaffAttendanceRecord.overtimeReviewedAt(source),
    ).resolves.toEqual(new Date("2026-05-10T18:45:00.000Z"));
  });
});
