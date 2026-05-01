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

describe("Payroll runtime correctness", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    modelMocks.Staff.find.mockReturnValue({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([{ _id: "s1", fullName: "A", employeeCode: "E1", baseSalary: 10000000 }]) });
    modelMocks.Shift.find.mockReturnValue({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) });
    modelMocks.LeaveRequest.aggregate.mockResolvedValue([]);
    modelMocks.PayrollAdjustment.find.mockResolvedValue([]);
    modelMocks.Restaurant.findById.mockReturnValue({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue({ address: { city: "Ha Noi" } }) });
    modelMocks.PayrollSetting.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
  });

  it("builds pipeline to use approved overtime minutes and explicit off-schedule include gating", async () => {
    modelMocks.Timesheet.aggregate.mockResolvedValue([{ _id: "s1", totalHours: 8, totalAmount: 100, overtimeNormalMinutes: 60, overtimeWeekendMinutes: 60, overtimeHolidayMinutes: 0, nightMinutes: 0, overtimeNightMinutes: 0, workedDateKeys: ["2026-04-06"] }]);

    const { buildPayrollItemsForRange } = await import("../../src/services/payroll/payrollRuntime.service.js");
    const items = await buildPayrollItemsForRange({ start: new Date("2026-04-01"), end: new Date("2026-04-30"), restaurantId: "507f1f77bcf86cd799439011" });

    const pipeline = modelMocks.Timesheet.aggregate.mock.calls[0][0];
    const pipelineString = JSON.stringify(pipeline);

    expect(pipelineString).toContain("approvedOvertimePayableMinutes");
    expect(pipelineString).toContain("$approvedOvertimeMinutes");
    expect(pipelineString).not.toContain("$overtimeMinutes");
    expect(pipelineString).toContain("includeInPayroll");
    expect(pipelineString).toContain("$isOffSchedule");
    expect(pipelineString).toContain("$approved");
    expect(items[0].breakdown.actualWorkDays).toBe(1);
  });

});

describe("Payroll validation correctness", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.PayrollPeriod.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "p1", restaurantId: "507f1f77bcf86cd799439011", startDate: new Date("2026-04-01"), endDate: new Date("2026-04-30") }) });
    modelMocks.OvertimeRequest.find.mockReturnValue({ populate: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) });
    modelMocks.PayrollSetting.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    modelMocks.PayrollItem.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: "i1", employeeId: "s1", breakdown: { baseSalary: 1, workDays: 26 } }]) });
    modelMocks.Staff.find.mockReturnValue({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) });
    modelMocks.Shift.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    modelMocks.LeaveRequest.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    modelMocks.PayrollAdjustment.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    modelMocks.AttendanceCorrectionRequest.find.mockReturnValue({ populate: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([{ _id: "c1", employeeId: { _id: "s1", fullName: "A" } }]) });
  });

  it("adds blocking issues for pending off-schedule attendance and unapproved overtime", async () => {
    let call = 0;
    modelMocks.Timesheet.find.mockImplementation(() => ({ populate: vi.fn().mockReturnThis(), lean: vi.fn().mockImplementation(async () => {
      call += 1;
      if (call === 1) return [{ _id: "t-ot", employeeId: { _id: "s1", fullName: "A" } }];
      if (call === 2) return [{ _id: "t-off", employeeId: { _id: "s1", fullName: "A" }, isOffSchedule: true, approved: false }];
      return [];
    }) }));

    const { validatePayrollPeriod } = await import("../../src/services/payroll/payrollValidation.service.js");
    const result = await validatePayrollPeriod("p1");
    const codes = result.issues.map((i) => i.code);

    expect(codes).toContain("UNAPPROVED_OVERTIME");
    expect(codes).toContain("OFF_SCHEDULE_ATTENDANCE_PENDING_APPROVAL");
    expect(codes).toContain("ATTENDANCE_CORRECTION_PENDING");
  });

  it("does not create issues for approved overtime and approved off-schedule timesheet", async () => {
    modelMocks.Timesheet.find.mockImplementation(() => ({ populate: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) }));

    const { validatePayrollPeriod } = await import("../../src/services/payroll/payrollValidation.service.js");
    const result = await validatePayrollPeriod("p1");
    const codes = result.issues.map((i) => i.code);

    expect(codes).not.toContain("UNAPPROVED_OVERTIME");
    expect(codes).not.toContain("OFF_SCHEDULE_ATTENDANCE_PENDING_APPROVAL");
    expect(codes).toContain("ATTENDANCE_CORRECTION_PENDING");
  });
});
