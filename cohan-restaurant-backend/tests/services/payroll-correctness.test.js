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

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", () => ({
  getStaffMembershipRestaurantFilter: vi.fn(async () => ({})),
}));

describe("Payroll runtime correctness", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    modelMocks.Staff.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          _id: "s1",
          fullName: "A",
          employeeCode: "E1",
          baseSalary: 10000000,
        },
      ]),
    });
    modelMocks.Shift.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });

    modelMocks.Timesheet.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });

    modelMocks.LeaveRequest.aggregate.mockResolvedValue([]);

    modelMocks.PayrollAdjustment.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });
    modelMocks.Restaurant.findById.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ address: { city: "Ha Noi" } }),
    });
    modelMocks.PayrollSetting.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });
  });

  it("counts paid leave as paid work days before calculating salary when enabled", async () => {
    modelMocks.Staff.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([{ _id: "s1", fullName: "A", employeeCode: "E1", baseSalary: 26000000 }]),
    });
    modelMocks.PayrollSetting.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        restaurantId: "507f1f77bcf86cd799439011",
        standardWorkDaysPerMonth: 26,
        standardHoursPerDay: 8,
        allowPaidLeaveInWorkDays: true,
        enablePersonalIncomeTax: false,
      }),
    });
    modelMocks.Timesheet.aggregate.mockResolvedValue([{ _id: "s1", totalHours: 80, totalWage: 0, totalAmount: 0, workedDateKeys: Array.from({ length: 10 }, (_, i) => `2026-04-${String(i + 1).padStart(2, "0")}`) }]);
    modelMocks.LeaveRequest.aggregate.mockResolvedValue([{ _id: "s1", paidLeaveDays: 2, unpaidLeaveDays: 0 }]);

    const { buildPayrollItemsForRange } = await import("../../src/services/payroll/payrollRuntime.service.js");
    const [item] = await buildPayrollItemsForRange({ start: new Date("2026-04-01"), end: new Date("2026-04-30"), restaurantId: "507f1f77bcf86cd799439011" });

    expect(item.breakdown.actualWorkDays).toBe(12);
    expect(item.breakdown.grossIncome).toBe(12000000);
    expect(item.breakdown.totalIncome).toBe(12000000);
    expect(item.breakdown.netSalary).toBe(12000000);
  });

  it("does not count paid leave as paid work days when disabled", async () => {
    modelMocks.Staff.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([{ _id: "s1", fullName: "A", employeeCode: "E1", baseSalary: 26000000 }]),
    });
    modelMocks.PayrollSetting.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        restaurantId: "507f1f77bcf86cd799439011",
        standardWorkDaysPerMonth: 26,
        standardHoursPerDay: 8,
        allowPaidLeaveInWorkDays: false,
        enablePersonalIncomeTax: false,
      }),
    });
    modelMocks.Timesheet.aggregate.mockResolvedValue([{ _id: "s1", totalHours: 80, totalWage: 0, totalAmount: 0, workedDateKeys: Array.from({ length: 10 }, (_, i) => `2026-04-${String(i + 1).padStart(2, "0")}`) }]);
    modelMocks.LeaveRequest.aggregate.mockResolvedValue([{ _id: "s1", paidLeaveDays: 2, unpaidLeaveDays: 0 }]);

    const { buildPayrollItemsForRange } = await import("../../src/services/payroll/payrollRuntime.service.js");
    const [item] = await buildPayrollItemsForRange({ start: new Date("2026-04-01"), end: new Date("2026-04-30"), restaurantId: "507f1f77bcf86cd799439011" });

    expect(item.breakdown.actualWorkDays).toBe(10);
    expect(item.breakdown.grossIncome).toBe(10000000);
    expect(item.breakdown.totalIncome).toBe(10000000);
    expect(item.breakdown.netSalary).toBe(10000000);
  });

  it("classifies approved overtime as holiday, weekend, normal and night work from settings", async () => {
    modelMocks.PayrollSetting.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        restaurantId: "507f1f77bcf86cd799439011",
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
      }),
    });

    modelMocks.Timesheet.aggregate.mockResolvedValue([
      {
        _id: "s1",
        totalHours: 24,
        totalWage: 100,
        totalAmount: 100,
        totalLatenessMinutes: 0,
        totalEarlyLeaveMinutes: 0,
        workedDateKeys: ["2026-04-10", "2026-04-11", "2026-04-30"],
      },
    ]);

    modelMocks.Timesheet.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          employeeId: "s1",
          workDate: new Date("2026-04-10T12:00:00+07:00"),
          actualCheckInAt: new Date("2026-04-10T22:00:00+07:00"),
          actualCheckOutAt: new Date("2026-04-11T06:00:00+07:00"),
          isOffSchedule: false,
          overtimeApprovalStatus: "approved",
          approvedOvertimeMinutes: 60,
        },
        {
          employeeId: "s1",
          workDate: new Date("2026-04-11T12:00:00+07:00"),
          actualCheckInAt: new Date("2026-04-11T09:00:00+07:00"),
          actualCheckOutAt: new Date("2026-04-11T18:00:00+07:00"),
          isOffSchedule: false,
          overtimeApprovalStatus: "approved",
          approvedOvertimeMinutes: 120,
        },
        {
          employeeId: "s1",
          workDate: new Date("2026-04-30T00:00:00.000Z"),
          actualCheckInAt: new Date("2026-04-30T09:00:00+07:00"),
          actualCheckOutAt: new Date("2026-04-30T18:00:00+07:00"),
          isOffSchedule: false,
          overtimeApprovalStatus: "approved",
          approvedOvertimeMinutes: 180,
        },
      ]),
    });

    const { buildPayrollItemsForRange } =
      await import("../../src/services/payroll/payrollRuntime.service.js");

    const items = await buildPayrollItemsForRange({
      start: new Date("2026-04-01"),
      end: new Date("2026-04-30"),
      restaurantId: "507f1f77bcf86cd799439011",
    });

    const breakdown = items[0].breakdown;

    expect(breakdown.overtimeNormalHours).toBe(1);
    expect(breakdown.overtimeWeekendHours).toBe(2);
    expect(breakdown.overtimeHolidayHours).toBe(3);
    expect(breakdown.nightHours).toBe(8);
    expect(breakdown.overtimeNightHours).toBe(1);
  });
  it("excludes pending or rejected off-schedule rows from overtime and night breakdown", async () => {
    modelMocks.Timesheet.aggregate.mockResolvedValue([
      {
        _id: "s1",
        totalHours: 0,
        totalWage: 0,
        totalAmount: 0,
        totalLatenessMinutes: 0,
        totalEarlyLeaveMinutes: 0,
        workedDateKeys: [],
      },
    ]);

    modelMocks.Timesheet.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          employeeId: "s1",
          workDate: new Date("2026-04-10T00:00:00.000Z"),
          actualCheckInAt: new Date("2026-04-10T22:00:00+07:00"),
          actualCheckOutAt: new Date("2026-04-11T06:00:00+07:00"),
          isOffSchedule: true,
          approved: false,
          offScheduleApprovalStatus: "rejected",
          overtimeApprovalStatus: "approved",
          approvedOvertimeMinutes: 120,
        },
      ]),
    });

    const { buildPayrollItemsForRange } =
      await import("../../src/services/payroll/payrollRuntime.service.js");

    const items = await buildPayrollItemsForRange({
      start: new Date("2026-04-01"),
      end: new Date("2026-04-30"),
      restaurantId: "507f1f77bcf86cd799439011",
    });

    const breakdown = items[0].breakdown;

    expect(breakdown.overtimeNormalHours).toBe(0);
    expect(breakdown.overtimeWeekendHours).toBe(0);
    expect(breakdown.overtimeHolidayHours).toBe(0);
    expect(breakdown.nightHours).toBe(0);
    expect(breakdown.overtimeNightHours).toBe(0);
  });
  it("builds pipeline to use approved overtime minutes and explicit off-schedule include gating", async () => {
    modelMocks.Timesheet.aggregate.mockResolvedValue([
      {
        _id: "s1",
        totalHours: 8,
        totalAmount: 100,
        overtimeNormalMinutes: 60,
        overtimeWeekendMinutes: 60,
        overtimeHolidayMinutes: 0,
        nightMinutes: 0,
        overtimeNightMinutes: 0,
        workedDateKeys: ["2026-04-06"],
      },
    ]);

    const { buildPayrollItemsForRange } =
      await import("../../src/services/payroll/payrollRuntime.service.js");
    const items = await buildPayrollItemsForRange({
      start: new Date("2026-04-01"),
      end: new Date("2026-04-30"),
      restaurantId: "507f1f77bcf86cd799439011",
    });

    const pipeline = modelMocks.Timesheet.aggregate.mock.calls[0][0];
    const pipelineString = JSON.stringify(pipeline);

    expect(pipelineString).toContain("approvedOvertimePayableMinutes");
    expect(pipelineString).toContain("$approvedOvertimeMinutes");
    expect(pipelineString).not.toContain("$overtimeMinutes");
    expect(pipelineString).toContain("includeInPayroll");
    expect(pipelineString).toContain("$isOffSchedule");
    expect(pipelineString).toContain("$approved");
    expect(pipelineString).toContain("$offScheduleApprovalStatus");
    expect(pipelineString).toContain("approved");
    expect(items[0].breakdown.actualWorkDays).toBe(1);
  });

  it("builds off-schedule payroll gating that excludes pending and rejected but includes approved", async () => {
    modelMocks.Timesheet.aggregate.mockResolvedValue([]);

    const { buildPayrollItemsForRange } =
      await import("../../src/services/payroll/payrollRuntime.service.js");
    await buildPayrollItemsForRange({
      start: new Date("2026-04-01"),
      end: new Date("2026-04-30"),
      restaurantId: "507f1f77bcf86cd799439011",
    });

    const addFields = modelMocks.Timesheet.aggregate.mock.calls[0][0].find(
      (stage) => stage.$addFields,
    );
    expect(addFields.$addFields.includeInPayroll).toEqual({
      $or: [
        { $ne: ["$isOffSchedule", true] },
        { $eq: ["$approved", true] },
        { $eq: ["$offScheduleApprovalStatus", "approved"] },
      ],
    });
  });

  it("gates late and early leave minutes by payroll inclusion", async () => {
    modelMocks.Timesheet.aggregate.mockResolvedValue([]);

    const { buildPayrollItemsForRange } =
      await import("../../src/services/payroll/payrollRuntime.service.js");
    await buildPayrollItemsForRange({
      start: new Date("2026-04-01"),
      end: new Date("2026-04-30"),
      restaurantId: "507f1f77bcf86cd799439011",
    });

    const group = modelMocks.Timesheet.aggregate.mock.calls[0][0].find(
      (stage) => stage.$group,
    );
    expect(group.$group.totalLatenessMinutes).toEqual({
      $sum: {
        $cond: ["$includeInPayroll", { $ifNull: ["$latenessMinutes", 0] }, 0],
      },
    });
    expect(group.$group.totalEarlyLeaveMinutes).toEqual({
      $sum: {
        $cond: ["$includeInPayroll", { $ifNull: ["$earlyLeaveMinutes", 0] }, 0],
      },
    });
  });
  it("calculates hourly, shift, and commission payroll using configured rates", async () => {
    const { buildPayrollItemsForRange } =
      await import("../../src/services/payroll/payrollRuntime.service.js");
    const range = {
      start: new Date("2026-04-01"),
      end: new Date("2026-04-30"),
      restaurantId: "507f1f77bcf86cd799439011",
    };
    const staffQuery = (staff) => ({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([staff]),
    });
    const aggregate = (overrides = {}) => ({
      _id: "s1",
      totalHours: 8,
      totalWage: 0,
      totalAmount: 0,
      workedDateKeys: ["2026-04-01"],
      ...overrides,
    });

    modelMocks.Staff.find.mockReturnValue(
      staffQuery({
        _id: "s1",
        fullName: "Hourly",
        employeeCode: "H1",
        baseSalary: 0,
        salaryType: "hourly",
        hourlyRate: 50000,
      }),
    );
    modelMocks.Timesheet.aggregate.mockResolvedValue([aggregate()]);
    let [item] = await buildPayrollItemsForRange(range);
    expect(item.breakdown.salaryType).toBe("hourly");
    expect(item.breakdown.regularHours).toBe(8);
    expect(item.breakdown.grossIncome).toBe(400000);

    modelMocks.Staff.find.mockReturnValue(
      staffQuery({
        _id: "s1",
        fullName: "Shift",
        employeeCode: "S1",
        baseSalary: 0,
        salaryType: "shift",
        hourlyRate: 250000,
      }),
    );
    modelMocks.Shift.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        { employeeId: "s1", startTime: new Date("2026-04-01T01:00:00Z") },
        { employeeId: "s1", startTime: new Date("2026-04-02T01:00:00Z") },
      ]),
    });
    modelMocks.Timesheet.aggregate.mockResolvedValue([aggregate({ totalHours: 0 })]);
    [item] = await buildPayrollItemsForRange(range);
    expect(item.breakdown.salaryType).toBe("shift");
    expect(item.breakdown.scheduleShiftCount).toBe(2);
    expect(item.breakdown.grossIncome).toBe(500000);

    modelMocks.Staff.find.mockReturnValue(
      staffQuery({
        _id: "s1",
        fullName: "Commission",
        employeeCode: "C1",
        baseSalary: 0,
        salaryType: "commission",
        commissionRate: 5,
      }),
    );
    modelMocks.Timesheet.aggregate.mockResolvedValue([
      aggregate({ totalHours: 0, totalAmount: 10000000 }),
    ]);
    [item] = await buildPayrollItemsForRange(range);
    expect(item.breakdown.salaryType).toBe("commission");
    expect(item.breakdown.commissionableAmount).toBe(10000000);
    expect(item.breakdown.grossIncome).toBe(500000);

    modelMocks.Staff.find.mockReturnValue(
      staffQuery({
        _id: "s1",
        fullName: "Missing commission rate",
        employeeCode: "C2",
        baseSalary: 0,
        salaryType: "commission",
      }),
    );
    [item] = await buildPayrollItemsForRange(range);
    expect(item.breakdown.salaryConfigurationIssue).toBe(
      "COMMISSION_RATE_REQUIRED",
    );
    expect(item.breakdown.grossIncome).toBe(0);
  });
});

describe("Payroll validation correctness", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.PayrollPeriod.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: "p1",
        restaurantId: "507f1f77bcf86cd799439011",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-04-30"),
      }),
    });
    modelMocks.OvertimeRequest.find.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });
    modelMocks.PayrollSetting.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });
    modelMocks.PayrollItem.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          _id: "i1",
          employeeId: "s1",
          breakdown: { baseSalary: 1, workDays: 26 },
        },
      ]),
    });
    modelMocks.Staff.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });
    modelMocks.Shift.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });
    modelMocks.Timesheet.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });
    modelMocks.LeaveRequest.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });
    modelMocks.PayrollAdjustment.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });
    modelMocks.AttendanceCorrectionRequest.find.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: vi
        .fn()
        .mockResolvedValue([
          { _id: "c1", employeeId: { _id: "s1", fullName: "A" } },
        ]),
    });
  });

  it("adds blocking issues for pending off-schedule attendance and unapproved overtime", async () => {
    let call = 0;
    modelMocks.Timesheet.find.mockImplementation(() => ({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockImplementation(async () => {
        call += 1;
        if (call === 1)
          return [{ _id: "t-ot", employeeId: { _id: "s1", fullName: "A" } }];
        if (call === 2)
          return [
            {
              _id: "t-off",
              employeeId: { _id: "s1", fullName: "A" },
              isOffSchedule: true,
              approved: false,
            },
          ];
        return [];
      }),
    }));

    const { validatePayrollPeriod } =
      await import("../../src/services/payroll/payrollValidation.service.js");
    const result = await validatePayrollPeriod("p1");
    const codes = result.issues.map((i) => i.code);

    expect(codes).toContain("UNAPPROVED_OVERTIME");
    expect(codes).toContain("OFF_SCHEDULE_ATTENDANCE_PENDING_APPROVAL");
    expect(codes).toContain("ATTENDANCE_CORRECTION_PENDING");
  });

  it("does not create issues for approved overtime and approved off-schedule timesheet", async () => {
    const approvedTimesheets = [
      {
        _id: "t-ot-approved",
        employeeId: { _id: "s1", fullName: "A" },
        overtimeMinutes: 90,
        approvedOvertimeMinutes: 90,
        overtimeApprovalStatus: "approved",
      },
      {
        _id: "t-off-approved",
        employeeId: { _id: "s1", fullName: "A" },
        isOffSchedule: true,
        approved: true,
        offScheduleApprovalStatus: "approved",
        workedMinutes: 480,
      },
      {
        _id: "t-off-approved-status",
        employeeId: { _id: "s1", fullName: "A" },
        isOffSchedule: true,
        approved: false,
        offScheduleApprovalStatus: "approved",
        workedMinutes: 480,
      },
      {
        _id: "t-off-rejected",
        employeeId: { _id: "s1", fullName: "A" },
        isOffSchedule: true,
        approved: false,
        offScheduleApprovalStatus: "rejected",
        workedMinutes: 480,
      },
    ];

    modelMocks.Timesheet.find.mockImplementation((query = {}) => ({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockImplementation(async () => {
        if (query.overtimeMinutes) {
          return approvedTimesheets.filter(
            (timesheet) =>
              Number(timesheet.overtimeMinutes || 0) > 0 &&
              (timesheet.approvedOvertimeMinutes == null ||
                Number(timesheet.approvedOvertimeMinutes) <= 0 ||
                timesheet.overtimeApprovalStatus !== "approved"),
          );
        }

        if (query.isOffSchedule) {
          return approvedTimesheets.filter(
            (timesheet) =>
              timesheet.isOffSchedule === true &&
              timesheet.approved !== true &&
              !["approved", "rejected"].includes(
                timesheet.offScheduleApprovalStatus,
              ) &&
              (Number(timesheet.workedMinutes || 0) > 0 ||
                Number(timesheet.hours || 0) > 0 ||
                Number(timesheet.amount || 0) > 0 ||
                Boolean(timesheet.actualCheckInAt) ||
                Boolean(timesheet.actualCheckOutAt)),
          );
        }

        return [];
      }),
    }));

    const { validatePayrollPeriod } =
      await import("../../src/services/payroll/payrollValidation.service.js");
    const result = await validatePayrollPeriod("p1");
    const codes = result.issues.map((i) => i.code);

    expect(codes).not.toContain("UNAPPROVED_OVERTIME");
    expect(codes).not.toContain("OFF_SCHEDULE_ATTENDANCE_PENDING_APPROVAL");
    expect(codes).toContain("ATTENDANCE_CORRECTION_PENDING");
  });
});
