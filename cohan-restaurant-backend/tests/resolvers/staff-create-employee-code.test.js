const modelMocks = vi.hoisted(() => ({
  Staff: vi.fn(),
  Role: {
    findById: vi.fn(),
    findOne: vi.fn(),
  },
  EventLog: {
    create: vi.fn(async () => ({})),
  },
  Shift: {},
  Timesheet: {},
  LeaveRequest: {},
  LeaveBalance: {},
  PayrollSetting: {},
  PayrollPeriod: {},
  PayrollItem: {},
  PayrollAdjustment: {},
  EmployeeCodeCounter: {
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(async () => true),
  requireRoles: vi.fn(),
  requireRestaurantScope: vi.fn(),
}));
vi.mock("../../lib/mailer.js", () => ({
  mailer: {
    sendMail: vi.fn(async () => ({})),
  },
}));
vi.mock("../../src/services/payroll/payrollRuntime.service.js", () => ({
  getPayrollSettings: vi.fn(),
  getPeriodDetail: vi.fn(),
  mapPayrollDocToGql: vi.fn(),
  toEndOfDay: vi.fn(),
  toObjectId: vi.fn(),
  toStartOfDay: vi.fn(),
  upsertPeriodItems: vi.fn(),
}));
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: {
      ObjectId: function ObjectId(value) {
        return value;
      },
    },
  },
}));

const roleDoc = {
  _id: "role-staff",
  slug: "staff",
  parentRole: null,
};

const createStaffInstance = (data, saveImpl) => ({
  ...data,
  _id: `staff-${Math.random().toString(36).slice(2, 8)}`,
  userType: "STAFF",
  setPassword: vi.fn(async () => {}),
  save: vi.fn(saveImpl || (async function save() {
    return this;
  })),
  populate: vi.fn(async function populate() {
    return this;
  }),
});

describe("createStaff employeeCode generation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    modelMocks.Role.findOne.mockReturnValue({
      populate: vi.fn().mockResolvedValue(roleDoc),
    });
    modelMocks.Staff.mockImplementation(function Staff(data) {
      return createStaffInstance(data);
    });
  });

  it("generates NV codes per restaurant and ignores any employeeCode from the client", async () => {
    modelMocks.EmployeeCodeCounter.findOneAndUpdate
      .mockResolvedValueOnce({ seq: 1 })
      .mockResolvedValueOnce({ seq: 2 })
      .mockResolvedValueOnce({ seq: 1 });

    const mutation = (await import("../../graphql/resolvers/staff/mutation.js"))
      .default;

    const restaurantA = "507f1f77bcf86cd799439011";
    const restaurantB = "507f1f77bcf86cd799439012";

    const first = await mutation.createStaff(
      null,
      {
        input: {
          fullName: "Alice",
          employeeCode: "HACKED",
          businessRestaurantId: restaurantA,
        },
      },
      { user: { id: "manager-1" } },
    );
    const second = await mutation.createStaff(
      null,
      {
        input: {
          fullName: "Bob",
          businessRestaurantId: restaurantA,
        },
      },
      { user: { id: "manager-1" } },
    );
    const third = await mutation.createStaff(
      null,
      {
        input: {
          fullName: "Carol",
          businessRestaurantId: restaurantB,
        },
      },
      { user: { id: "manager-1" } },
    );

    expect(modelMocks.Staff.mock.calls[0][0].employeeCode).toBe("NV0001");
    expect(modelMocks.Staff.mock.calls[0][0].employeeCode).not.toBe("HACKED");
    expect(modelMocks.Staff.mock.calls[0][0].restaurantForStaff).toBeUndefined();
    expect(first.employeeCode).toBe("NV0001");
    expect(second.employeeCode).toBe("NV0002");
    expect(third.employeeCode).toBe("NV0001");
  });

  it("retries employee code counter allocation when the first upsert collides", async () => {
    let called = 0;
    modelMocks.EmployeeCodeCounter.findOneAndUpdate.mockImplementation(
      async () => {
        called += 1;
        if (called === 1) throw { code: 11000 };
        return { seq: 1 };
      },
    );

    const { __testables } = await import(
      "../../graphql/resolvers/staff/mutation.js"
    );

    const code = await __testables.getNextEmployeeCode(
      "507f1f77bcf86cd799439011",
    );

    expect(code).toBe("NV0001");
    expect(modelMocks.EmployeeCodeCounter.findOneAndUpdate).toHaveBeenCalledTimes(
      2,
    );
  });
});
