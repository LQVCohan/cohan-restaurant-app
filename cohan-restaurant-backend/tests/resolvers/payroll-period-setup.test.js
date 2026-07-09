const modelMocks = vi.hoisted(() => ({
  Staff: {},
  Role: {},
  EventLog: {},
  Shift: {},
  Timesheet: {},
  LeaveRequest: {},
  LeaveBalance: {},
  PayrollItem: {},
  PayrollAdjustment: {},
  EmployeeCodeCounter: {},
  PayrollSetting: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  PayrollPeriod: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    create: vi.fn(),
  },
}));

const scopeMocks = vi.hoisted(() => ({ getStaffRestaurantIds: vi.fn() }));

const runtimeMocks = vi.hoisted(() => ({
  getPayrollSettings: vi.fn(),
  getPeriodDetail: vi.fn(),
  mapPayrollDocToGql: vi.fn(),
  toEndOfDay: vi.fn((value) => {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }),
  toObjectId: vi.fn((value) => value),
  toStartOfDay: vi.fn((value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }),
  upsertPeriodItems: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn() } }));
vi.mock("../../src/services/payroll/payrollRuntime.service.js", () => runtimeMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", async (importOriginal) => ({
  ...(await importOriginal()),
  getStaffRestaurantIds: scopeMocks.getStaffRestaurantIds,
}));

describe("Payroll period setup semantics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    scopeMocks.getStaffRestaurantIds.mockResolvedValue(["restaurant-1"]);
  });

  it("blocks changing the applied payroll period while the current period is not fully paid", async () => {
    modelMocks.PayrollSetting.findOne.mockResolvedValue({
      currentPayrollPeriodId: "period-current",
    });
    modelMocks.PayrollPeriod.findById.mockResolvedValue({
      _id: "period-current",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-30T23:59:59.999Z"),
      status: "draft",
    });

    const { default: StaffMutation } = await import("../../graphql/resolvers/staff/mutation.js");

    let thrownError = null;
    try {
      await StaffMutation.createPayrollPeriod(
        null,
        {
          input: {
            startDate: "2026-05-01",
            endDate: "2026-05-31",
            name: "Ky moi",
          },
        },
        { user: { id: "admin-1", roleName: "admin" } },
      );
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError?.message).toBe(
      "Current payroll period must be fully paid before changing the applied payroll cycle",
    );
  });

  it("updates PayrollSetting.currentPayrollPeriodId when setting the applied payroll period", async () => {
    modelMocks.PayrollSetting.findOne.mockResolvedValue(null);
    modelMocks.PayrollPeriod.findOne.mockResolvedValue(null);

    const createdPeriod = {
      _id: "period-2",
      restaurantId: "restaurant-1",
      name: "Ky moi",
      startDate: new Date("2026-05-01T00:00:00.000Z"),
      endDate: new Date("2026-05-31T23:59:59.999Z"),
      status: "draft",
      finalizedAt: null,
      lockedAt: null,
      paidAt: null,
    };

    runtimeMocks.getPayrollSettings.mockResolvedValue({
      restaurantId: "restaurant-1",
      currentPayrollPeriodId: null,
    });
    runtimeMocks.upsertPeriodItems.mockResolvedValue({
      stats: {
        totalPayroll: 0,
        paidAmount: 0,
        remaining: 0,
        progress: 0,
      },
    });

    modelMocks.PayrollPeriod.create.mockResolvedValue(createdPeriod);
    modelMocks.PayrollPeriod.findByIdAndUpdate.mockResolvedValue(null);
    modelMocks.PayrollSetting.findOneAndUpdate.mockResolvedValue({
      restaurantId: "restaurant-1",
      currentPayrollPeriodId: "period-2",
    });

    const { default: StaffMutation } = await import("../../graphql/resolvers/staff/mutation.js");

    const result = await StaffMutation.createPayrollPeriod(
      null,
      {
        input: {
          startDate: "2026-05-01",
          endDate: "2026-05-31",
          name: "Ky moi",
        },
      },
      { user: { id: "admin-1", roleName: "admin" } },
    );

    expect(modelMocks.PayrollSetting.findOneAndUpdate).toHaveBeenCalledWith(
      { restaurantId: "restaurant-1" },
      {
        $set: {
          currentPayrollPeriodId: "period-2",
          updatedBy: "admin-1",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    expect(result.id).toBe("period-2");
  });
});
