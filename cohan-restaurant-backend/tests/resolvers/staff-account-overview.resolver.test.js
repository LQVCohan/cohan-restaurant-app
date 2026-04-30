const modelMocks = vi.hoisted(() => ({
  Staff: { findById: vi.fn() },
  Shift: { find: vi.fn(), countDocuments: vi.fn() },
  Timesheet: { aggregate: vi.fn() },
  LeaveRequest: {},
  LeaveBalance: {},
  Order: { countDocuments: vi.fn() },
  Table: { find: vi.fn() },
  Category: { countDocuments: vi.fn() },
  Promotion: { countDocuments: vi.fn() },
  Restaurant: {},
  PayrollPeriod: {},
  PayrollItem: {},
  SchedulePublication: {},
  EventLog: {},
  ShiftAcknowledgement: {},
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/staffPerformance/staffPerformance.service.js", () => ({ listStaffPerformanceSnapshots: vi.fn() }));
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => ({ getSchedulingPolicy: vi.fn() }));
vi.mock("../../src/services/scheduling/shiftAssignmentValidation.service.js", () => ({ validateShiftAssignment: vi.fn() }));
vi.mock("../../src/services/overtime/overtimeRequest.service.js", () => ({ getOvertimeRequest: vi.fn(), listOvertimeRequests: vi.fn() }));
vi.mock("../../src/services/attendance/attendanceCorrectionWorkflow.service.js", () => ({ getAttendanceCorrectionRequest: vi.fn(), listAttendanceCorrectionRequests: vi.fn() }));
vi.mock("../../src/services/ai/staffSchedulingAssistant.service.js", () => ({ buildStaffSchedulingAssistant: vi.fn() }));
vi.mock("../../src/services/payroll/payrollCalculator.service.js", () => ({ buildPayrollItem: vi.fn() }));
vi.mock("../../src/services/payroll/payrollRuntime.service.js", () => ({
  buildPayrollItemsForRange: vi.fn(),
  getPayrollSettings: vi.fn(),
  getPeriodDetail: vi.fn(),
  mapPayrollDocToGql: vi.fn(),
  summarize: vi.fn(),
  toObjectId: vi.fn(),
}));
vi.mock("../../src/services/payroll/payrollValidation.service.js", () => ({ validatePayrollPeriod: vi.fn() }));
vi.mock("../../src/services/payroll/payrollPermission.service.js", () => ({ assertPayrollPermission: vi.fn() }));
vi.mock("../../src/services/payroll/payrollEventLog.service.js", () => ({ logPayrollEvent: vi.fn() }));
vi.mock("../../src/services/scheduling/scheduleLifecycle.service.js", () => ({ mapSchedulePublicationOutput: vi.fn() }));

function makePopulateQuery(doc) {
  const query = {
    populate: vi.fn(() => query),
    then: (resolve) => Promise.resolve(resolve(doc)),
  };
  return query;
}

describe("staffAccountOverview resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.Order.countDocuments.mockResolvedValue(0);
    modelMocks.Shift.countDocuments.mockResolvedValue(0);
    modelMocks.Shift.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) }) });
  });

  it("returns employmentType as GraphQL enum value", async () => {
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    modelMocks.Staff.findById.mockReturnValue(
      makePopulateQuery({
        _id: "507f191e810c19729de860ea",
        userType: "STAFF",
        fullName: "Part Time Staff",
        employmentType: "part_time",
        employmentStatus: "working",
      }),
    );

    const result = await query.staffAccountOverview(null, { staffId: "507f191e810c19729de860ea" }, { user: { id: "507f191e810c19729de860ea" } });

    expect(result.employmentType).toBe("PART_TIME");
    expect(result.employmentStatus).toBe("WORKING");
  });
});
