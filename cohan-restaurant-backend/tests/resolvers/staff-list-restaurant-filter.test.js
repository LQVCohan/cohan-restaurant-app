import { beforeEach, describe, expect, it, vi } from "vitest";

const scopeMocks = vi.hoisted(() => ({
  getStaffMembershipRestaurantFilter: vi.fn(),
  getStaffRestaurantIds: vi.fn(),
  isSystemAdmin: vi.fn(() => false),
}));

const modelMocks = vi.hoisted(() => ({
  Staff: {
    find: vi.fn(),
  },
  Shift: {},
  Timesheet: {},
  LeaveRequest: {},
  LeaveBalance: {},
  Order: {},
  Table: {},
  Category: {},
  Promotion: {},
  Restaurant: {},
  PayrollPeriod: {},
  PayrollItem: {},
  SchedulePublication: {},
  EventLog: {},
  ShiftAcknowledgement: {},
  ScheduleAcknowledgement: {},
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", () => scopeMocks);
vi.mock("../../graphql/guards.js", () => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(),
  requireRoles: vi.fn(),
  requireRestaurantScope: vi.fn(),
}));
vi.mock("../../src/services/ai/staffSchedulingAssistant.service.js", () => ({
  buildStaffSchedulingAssistant: vi.fn(),
}));
vi.mock("../../src/services/scheduling/aiSchedulePlanner.service.js", () => ({
  buildAiSchedulePlannerPreview: vi.fn(),
}));
vi.mock("../../src/services/payroll/payrollCalculator.service.js", () => ({
  buildStaffSchedulingAssistant: vi.fn(),
  buildPayrollItem: vi.fn(),
  calculatePeriodCalendarDays: vi.fn(),
  normalizeRegionCode: vi.fn(),
}));
vi.mock("../../src/services/payroll/payrollRuntime.service.js", () => ({
  buildPayrollItemsForRange: vi.fn(),
  getPayrollSettings: vi.fn(),
  getPeriodDetail: vi.fn(),
  mapPayrollDocToGql: vi.fn(),
  summarize: vi.fn(),
  toObjectId: vi.fn((value) => value),
}));
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: {
      ObjectId: function ObjectId(value) {
        return { __oid: value };
      },
    },
  },
}));

const createFindChain = () => ({
  populate: vi.fn(function populate() {
    return this;
  }),
  sort: vi.fn().mockResolvedValue([]),
});

describe("staffList restaurant filter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    scopeMocks.getStaffMembershipRestaurantFilter.mockResolvedValue({ _id: { $in: ["staff-1"] } });
  });

  it("filters by BrandMembership when filtering by restaurant", async () => {
    const findChain = createFindChain();
    modelMocks.Staff.find.mockReturnValue(findChain);

    const { default: StaffQuery } = await import("../../graphql/resolvers/staff/query.js");
    await StaffQuery.staffList(null, { restaurantId: "restaurant-1" }, { user: { id: "u1" } });

    expect(modelMocks.Staff.find).toHaveBeenCalledWith({
      userType: "STAFF",
      deletedAt: null,
      $and: [
        { _id: { $in: ["staff-1"] } },
      ],
    });
    expect(findChain.populate).toHaveBeenCalledWith("role");
    expect(findChain.populate).toHaveBeenCalledWith("refRestaurants");
    expect(findChain.sort).toHaveBeenCalledWith({ fullName: 1 });
  });

  it("keeps restaurant and search filters together", async () => {
    const findChain = createFindChain();
    modelMocks.Staff.find.mockReturnValue(findChain);

    const { default: StaffQuery } = await import("../../graphql/resolvers/staff/query.js");
    await StaffQuery.staffList(null, {
      restaurantId: "restaurant-1",
      search: "Lan",
    }, { user: { id: "u1" } });

    const filter = modelMocks.Staff.find.mock.calls[0][0];
    expect(filter.$or).toBeUndefined();
    expect(filter.$and).toHaveLength(2);
    expect(filter.$and[0]).toEqual({ _id: { $in: ["staff-1"] } });
    expect(filter.$and[1].$or).toEqual(
      expect.arrayContaining([
        { fullName: expect.any(RegExp) },
        { employeeCode: expect.any(RegExp) },
      ]),
    );
  });
});
