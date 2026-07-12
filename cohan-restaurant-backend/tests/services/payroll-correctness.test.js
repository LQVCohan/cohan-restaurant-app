import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Staff: { find: vi.fn() },
  Shift: { find: vi.fn() },
  Timesheet: { aggregate: vi.fn(), find: vi.fn() },
  LeaveRequest: { aggregate: vi.fn(), find: vi.fn() },
  Restaurant: { findById: vi.fn() },
  PayrollSetting: { findOne: vi.fn() },
  PayrollPeriod: { findById: vi.fn() },
  PayrollItem: { find: vi.fn() },
  PayrollAdjustment: { find: vi.fn() },
  OvertimeRequest: { find: vi.fn() },
  AttendanceCorrectionRequest: { find: vi.fn() },
}));

const scopeMocks = vi.hoisted(() => ({
  getStaffMembershipRestaurantFilter: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", () => scopeMocks);

const queryResult = (value) => {
  const query = {
    select: vi.fn(),
    populate: vi.fn(),
    lean: vi.fn().mockResolvedValue(value),
  };
  query.select.mockReturnValue(query);
  query.populate.mockReturnValue(query);
  return query;
};

const employeeId = "507f1f77bcf86cd799439012";
const restaurantId = "507f1f77bcf86cd799439011";
const range = {
  start: new Date("2026-04-01T00:00:00.000Z"),
  end: new Date("2026-04-30T23:59:59.999Z"),
  restaurantId,
};

const staff = (patch = {}) => ({
  _id: employeeId,
  fullName: "Nhân viên A",
  employeeCode: "E1",
  baseSalary: 26_000_000,
  salaryType: "monthly",
  hourlyRate: 0,
  allowanceAmount: 0,
  employmentType: "seasonal",
  employmentStatus: "working",
  ...patch,
});

const settings = (patch = {}) => ({
  restaurantId,
  standardWorkDaysPerMonth: 26,
  standardHoursPerDay: 8,
  overtimeMultiplierWeekday: 1.5,
  overtimeMultiplierWeekend: 2,
  overtimeMultiplierHoliday: 3,
  latenessPenaltyPerMinute: 0,
  earlyLeavePenaltyPerMinute: 0,
  unpaidLeaveDeductionPerDay: 0,
  defaultAllowance: 0,
  defaultBonus: 0,
  defaultDeduction: 0,
  weekendDays: ["SAT"],
  holidayDates: ["2026-04-30"],
  nightShiftStart: "22:00",
  nightShiftEnd: "06:00",
  nightShiftAllowanceRate: 0.3,
  enablePersonalIncomeTax: false,
  personalIncomeTaxRate: 0,
  personalIncomeTaxFreeThreshold: 0,
  allowPaidLeaveInWorkDays: true,
  ...patch,
});

const aggregateRow = (patch = {}) => ({
  _id: employeeId,
  totalHours: 0,
  totalWage: 0,
  totalAmount: 0,
  totalLatenessMinutes: 0,
  totalEarlyLeaveMinutes: 0,
  workedShiftCount: 0,
  workedDateKeys: [],
  ...patch,
});

const scheduledTimesheet = (patch = {}) => ({
  employeeId,
  workDate: new Date("2026-04-10T00:00:00.000Z"),
  plannedStartTime: new Date("2026-04-10T09:00:00+07:00"),
  plannedEndTime: new Date("2026-04-10T17:00:00+07:00"),
  actualCheckInAt: new Date("2026-04-10T09:00:00+07:00"),
  actualCheckOutAt: new Date("2026-04-10T17:00:00+07:00"),
  hours: 8,
  overtimeMinutes: 0,
  isOffSchedule: false,
  overtimeApprovalStatus: "not_required",
  approvedOvertimeMinutes: 0,
  ...patch,
});

const setupRuntimeMocks = ({
  staffRows = [staff()],
  timesheetRows = [],
  timesheetAggregateRows = [],
  leaveAggregateRows = [],
  shiftRows = [],
  payrollSettings = settings(),
} = {}) => {
  scopeMocks.getStaffMembershipRestaurantFilter.mockResolvedValue({
    _id: { $in: staffRows.map((row) => row._id) },
  });
  modelMocks.Staff.find.mockReturnValue(queryResult(staffRows));
  modelMocks.Shift.find.mockReturnValue(queryResult(shiftRows));
  modelMocks.Timesheet.find.mockReturnValue(queryResult(timesheetRows));
  modelMocks.Timesheet.aggregate.mockResolvedValue(timesheetAggregateRows);
  modelMocks.LeaveRequest.aggregate.mockResolvedValue(leaveAggregateRows);
  modelMocks.PayrollAdjustment.find.mockReturnValue(queryResult([]));
  modelMocks.Restaurant.findById.mockReturnValue(
    queryResult({ address: { city: "Ha Noi" } }),
  );
  modelMocks.PayrollSetting.findOne.mockReturnValue(queryResult(payrollSettings));
};

async function calculateRuntime(options) {
  setupRuntimeMocks(options);
  const { buildPayrollItemsForRange } = await import(
    "../../src/services/payroll/payrollRuntime.service.js"
  );
  const [item] = await buildPayrollItemsForRange(range);
  return item;
}

describe("Payroll runtime correctness", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupRuntimeMocks();
  });

  it("uses the active membership roster and includes approved paid leave", async () => {
    const item = await calculateRuntime({
      timesheetAggregateRows: [
        aggregateRow({
          totalHours: 80,
          workedShiftCount: 10,
          workedDateKeys: Array.from(
            { length: 10 },
            (_, index) => `2026-04-${String(index + 1).padStart(2, "0")}`,
          ),
        }),
      ],
      leaveAggregateRows: [
        {
          _id: employeeId,
          paidLeaveDays: 2,
          unpaidLeaveDays: 0,
        },
      ],
    });

    expect(scopeMocks.getStaffMembershipRestaurantFilter).toHaveBeenCalledWith(
      expect.anything(),
    );
    expect(modelMocks.Staff.find).toHaveBeenCalledWith(
      expect.objectContaining({
        userType: "STAFF",
        deletedAt: null,
        _id: { $in: [employeeId] },
      }),
    );
    expect(item.breakdown.actualWorkDays).toBe(12);
    expect(item.breakdown.grossIncome).toBe(12_000_000);
    expect(item.breakdown.netSalary).toBe(12_000_000);
  });

  it("does not count paid leave when the payroll setting disables it", async () => {
    const item = await calculateRuntime({
      payrollSettings: settings({ allowPaidLeaveInWorkDays: false }),
      timesheetAggregateRows: [
        aggregateRow({
          totalHours: 80,
          workedShiftCount: 10,
          workedDateKeys: Array.from(
            { length: 10 },
            (_, index) => `2026-04-${String(index + 1).padStart(2, "0")}`,
          ),
        }),
      ],
      leaveAggregateRows: [
        {
          _id: employeeId,
          paidLeaveDays: 2,
          unpaidLeaveDays: 0,
        },
      ],
    });

    expect(item.breakdown.actualWorkDays).toBe(10);
    expect(item.breakdown.grossIncome).toBe(10_000_000);
  });

  it("classifies approved overtime by its actual local calendar segment", async () => {
    const item = await calculateRuntime({
      timesheetRows: [
        scheduledTimesheet({
          actualCheckOutAt: new Date("2026-04-10T18:00:00+07:00"),
          hours: 9,
          overtimeMinutes: 60,
          overtimeApprovalStatus: "approved",
          approvedOvertimeMinutes: 60,
        }),
        scheduledTimesheet({
          workDate: new Date("2026-04-11T00:00:00.000Z"),
          plannedStartTime: new Date("2026-04-11T09:00:00+07:00"),
          plannedEndTime: new Date("2026-04-11T17:00:00+07:00"),
          actualCheckInAt: new Date("2026-04-11T09:00:00+07:00"),
          actualCheckOutAt: new Date("2026-04-11T19:00:00+07:00"),
          hours: 10,
          overtimeMinutes: 120,
          overtimeApprovalStatus: "approved",
          approvedOvertimeMinutes: 120,
        }),
        scheduledTimesheet({
          workDate: new Date("2026-04-30T00:00:00.000Z"),
          plannedStartTime: new Date("2026-04-30T09:00:00+07:00"),
          plannedEndTime: new Date("2026-04-30T17:00:00+07:00"),
          actualCheckInAt: new Date("2026-04-30T09:00:00+07:00"),
          actualCheckOutAt: new Date("2026-04-30T20:00:00+07:00"),
          hours: 11,
          overtimeMinutes: 180,
          overtimeApprovalStatus: "approved",
          approvedOvertimeMinutes: 180,
        }),
        scheduledTimesheet({
          workDate: new Date("2026-04-12T00:00:00.000Z"),
          actualCheckInAt: new Date("2026-04-12T09:00:00+07:00"),
          actualCheckOutAt: new Date("2026-04-12T19:00:00+07:00"),
          isOffSchedule: true,
          approved: false,
          offScheduleApprovalStatus: "rejected",
          hours: 10,
          overtimeMinutes: 120,
          overtimeApprovalStatus: "approved",
          approvedOvertimeMinutes: 120,
        }),
      ],
      timesheetAggregateRows: [aggregateRow()],
    });

    expect(item.breakdown.overtimeNormalHours).toBe(1);
    expect(item.breakdown.overtimeWeekendHours).toBe(2);
    expect(item.breakdown.overtimeHolidayHours).toBe(3);
  });

  it("does not pay rejected overtime as regular hourly work", async () => {
    const item = await calculateRuntime({
      staffRows: [
        staff({
          salaryType: "hourly",
          baseSalary: 0,
          hourlyRate: 100_000,
        }),
      ],
      timesheetRows: [
        scheduledTimesheet({
          actualCheckOutAt: new Date("2026-04-10T19:00:00+07:00"),
          hours: 10,
          overtimeMinutes: 120,
          overtimeApprovalStatus: "rejected",
          approvedOvertimeMinutes: 0,
        }),
      ],
      timesheetAggregateRows: [aggregateRow({ totalHours: 10 })],
    });

    expect(item.breakdown.totalHours).toBe(8);
    expect(item.breakdown.overtimeHours).toBe(0);
    expect(item.breakdown.grossIncome).toBe(800_000);
  });

  it("pays only the approved part of actual overtime", async () => {
    const item = await calculateRuntime({
      staffRows: [
        staff({
          salaryType: "hourly",
          baseSalary: 0,
          hourlyRate: 100_000,
        }),
      ],
      timesheetRows: [
        scheduledTimesheet({
          actualCheckOutAt: new Date("2026-04-10T19:00:00+07:00"),
          hours: 10,
          overtimeMinutes: 120,
          overtimeApprovalStatus: "approved",
          approvedOvertimeMinutes: 60,
        }),
      ],
      timesheetAggregateRows: [aggregateRow({ totalHours: 10 })],
    });

    expect(item.breakdown.totalHours).toBe(9);
    expect(item.breakdown.overtimeNormalHours).toBe(1);
    expect(item.breakdown.grossIncome).toBe(950_000);
  });

  it("applies overtime night premium only to the overtime-night overlap", async () => {
    const item = await calculateRuntime({
      staffRows: [
        staff({
          salaryType: "hourly",
          baseSalary: 0,
          hourlyRate: 100_000,
        }),
      ],
      timesheetRows: [
        scheduledTimesheet({
          workDate: new Date("2026-04-13T00:00:00.000Z"),
          plannedStartTime: new Date("2026-04-13T22:00:00+07:00"),
          plannedEndTime: new Date("2026-04-14T06:00:00+07:00"),
          actualCheckInAt: new Date("2026-04-13T22:00:00+07:00"),
          actualCheckOutAt: new Date("2026-04-14T07:00:00+07:00"),
          hours: 9,
          overtimeMinutes: 60,
          overtimeApprovalStatus: "approved",
          approvedOvertimeMinutes: 60,
        }),
      ],
      timesheetAggregateRows: [aggregateRow({ totalHours: 9 })],
    });

    expect(item.breakdown.nightHours).toBe(8);
    expect(item.breakdown.overtimeNightHours).toBe(0);
  });

  it("splits cross-midnight overtime between weekday and weekend", async () => {
    const item = await calculateRuntime({
      timesheetRows: [
        scheduledTimesheet({
          plannedStartTime: new Date("2026-04-10T15:00:00+07:00"),
          plannedEndTime: new Date("2026-04-10T23:30:00+07:00"),
          actualCheckInAt: new Date("2026-04-10T15:00:00+07:00"),
          actualCheckOutAt: new Date("2026-04-11T00:30:00+07:00"),
          hours: 9.5,
          overtimeMinutes: 60,
          overtimeApprovalStatus: "approved",
          approvedOvertimeMinutes: 60,
        }),
      ],
      timesheetAggregateRows: [aggregateRow({ totalHours: 9.5 })],
    });

    expect(item.breakdown.overtimeNormalHours).toBe(0.5);
    expect(item.breakdown.overtimeWeekendHours).toBe(0.5);
    expect(item.breakdown.overtimeNightHours).toBe(1);
  });

  it("queries shifts by period overlap instead of start time only", async () => {
    setupRuntimeMocks();
    const { buildPayrollItemsForRange } = await import(
      "../../src/services/payroll/payrollRuntime.service.js"
    );
    await buildPayrollItemsForRange(range);

    expect(modelMocks.Shift.find).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: { $lte: range.end },
        endTime: { $gte: range.start },
        status: { $ne: "cancelled" },
      }),
    );
  });
});

describe("Payroll validation correctness", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    scopeMocks.getStaffMembershipRestaurantFilter.mockResolvedValue({
      _id: { $in: [employeeId] },
    });
    modelMocks.PayrollPeriod.findById.mockReturnValue(
      queryResult({
        _id: "507f1f77bcf86cd799439013",
        restaurantId,
        startDate: range.start,
        endDate: range.end,
        status: "draft",
      }),
    );
    modelMocks.PayrollSetting.findOne.mockReturnValue(queryResult(settings()));
    modelMocks.PayrollItem.find.mockReturnValue(
      queryResult([
        {
          _id: "507f1f77bcf86cd799439014",
          employeeId,
          breakdown: { baseSalary: 26_000_000, workDays: 26 },
        },
      ]),
    );
    modelMocks.Staff.find.mockReturnValue(
      queryResult([
        staff({
          department: "service",
          positionTitle: "Phục vụ",
        }),
      ]),
    );
    modelMocks.Shift.find.mockReturnValue(queryResult([]));
    modelMocks.LeaveRequest.find.mockReturnValue(queryResult([]));
    modelMocks.PayrollAdjustment.find.mockReturnValue(queryResult([]));
    modelMocks.OvertimeRequest.find.mockReturnValue(queryResult([]));
    modelMocks.AttendanceCorrectionRequest.find.mockReturnValue(queryResult([]));
  });

  it("blocks pending overtime, off-schedule work and attendance corrections", async () => {
    modelMocks.OvertimeRequest.find.mockReturnValue(
      queryResult([
        {
          _id: "507f1f77bcf86cd799439015",
          employeeId: {
            _id: employeeId,
            fullName: "Nhân viên A",
          },
        },
      ]),
    );
    modelMocks.AttendanceCorrectionRequest.find.mockReturnValue(
      queryResult([
        {
          _id: "507f1f77bcf86cd799439016",
          employeeId: {
            _id: employeeId,
            fullName: "Nhân viên A",
          },
        },
      ]),
    );
    modelMocks.Timesheet.find.mockImplementation((filter = {}) => {
      if (filter.overtimeMinutes) {
        return queryResult([
          {
            _id: "507f1f77bcf86cd799439017",
            employeeId: {
              _id: employeeId,
              fullName: "Nhân viên A",
            },
          },
        ]);
      }
      if (filter.isOffSchedule) {
        return queryResult([
          {
            _id: "507f1f77bcf86cd799439018",
            employeeId: {
              _id: employeeId,
              fullName: "Nhân viên A",
            },
            isOffSchedule: true,
            approved: false,
          },
        ]);
      }
      return queryResult([]);
    });

    const { validatePayrollPeriod } = await import(
      "../../src/services/payroll/payrollValidation.service.js"
    );
    const result = await validatePayrollPeriod(
      "507f1f77bcf86cd799439013",
    );
    const codes = result.issues.map((issue) => issue.code);

    expect(codes).toContain("OVERTIME_REQUEST_NOT_COMPLETED");
    expect(codes).toContain("UNAPPROVED_OVERTIME");
    expect(codes).toContain("OFF_SCHEDULE_ATTENDANCE_PENDING_APPROVAL");
    expect(codes).toContain("ATTENDANCE_CORRECTION_PENDING");
    expect(result.errorCount).toBeGreaterThanOrEqual(4);
  });

  it("uses only unresolved overtime states as a payroll blocker", async () => {
    let overtimeFilter = null;
    modelMocks.Timesheet.find.mockImplementation((filter = {}) => {
      if (filter.overtimeMinutes) overtimeFilter = filter;
      return queryResult([]);
    });

    const { validatePayrollPeriod } = await import(
      "../../src/services/payroll/payrollValidation.service.js"
    );
    const result = await validatePayrollPeriod(
      "507f1f77bcf86cd799439013",
    );

    expect(overtimeFilter.$or).toEqual(
      expect.arrayContaining([
        { overtimeApprovalStatus: "pending" },
        {
          overtimeApprovalStatus: "approved",
          approvedOvertimeMinutes: { $lte: 0 },
        },
      ]),
    );
    expect(overtimeFilter.$or).not.toContainEqual({
      overtimeApprovalStatus: { $ne: "approved" },
    });
    expect(result.issues.map((issue) => issue.code)).not.toContain(
      "UNAPPROVED_OVERTIME",
    );
  });

  it("detects salary-profile and stale payroll-item scope problems", async () => {
    modelMocks.Staff.find.mockReturnValue(
      queryResult([
        staff({
          salaryType: "hourly",
          hourlyRate: 0,
          department: "service",
          positionTitle: "Phục vụ",
        }),
      ]),
    );
    modelMocks.PayrollItem.find.mockReturnValue(
      queryResult([
        {
          _id: "507f1f77bcf86cd799439019",
          employeeId: "507f1f77bcf86cd799439099",
          breakdown: { netSalary: 1_000_000 },
        },
      ]),
    );
    modelMocks.Timesheet.find.mockReturnValue(queryResult([]));

    const { validatePayrollPeriod } = await import(
      "../../src/services/payroll/payrollValidation.service.js"
    );
    const result = await validatePayrollPeriod(
      "507f1f77bcf86cd799439013",
    );
    const codes = result.issues.map((issue) => issue.code);

    expect(codes).toContain("STAFF_MISSING_COMPENSATION_RATE");
    expect(codes).toContain("PAYROLL_ITEM_MISSING_FOR_STAFF");
    expect(codes).toContain("PAYROLL_ITEM_WRONG_RESTAURANT");
  });
});
