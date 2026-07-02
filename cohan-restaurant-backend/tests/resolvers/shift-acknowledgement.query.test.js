import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  findSortMock: vi.fn(),
  findMock: vi.fn(),
  Staff: {},
  Shift: {},
  Timesheet: { find: vi.fn() },
  LeaveRequest: {},
  LeaveBalance: {},
  Order: {},
  Table: {},
  Category: {},
  Promotion: {},
  Restaurant: { exists: vi.fn() },
  PayrollPeriod: {},
  PayrollItem: {},
  SchedulePublication: { findOne: vi.fn() },
  EventLog: {},
  ShiftAcknowledgement: { find: vi.fn() },
  ScheduleAcknowledgement: { find: vi.fn(), findOne: vi.fn() },
}));

modelMocks.findMock.mockImplementation(() => ({ sort: modelMocks.findSortMock }));
modelMocks.ShiftAcknowledgement.find = modelMocks.findMock;

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

describe("shift acknowledgement query resolvers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.findSortMock.mockResolvedValue([]);
    modelMocks.Restaurant.exists.mockResolvedValue(null);
    modelMocks.SchedulePublication.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    modelMocks.ScheduleAcknowledgement.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    modelMocks.ScheduleAcknowledgement.findOne.mockResolvedValue(null);
    modelMocks.Shift.find = vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) }));
    modelMocks.Timesheet.find.mockReturnValue({ select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })) });
  });

  it("allows manager to query restaurant acknowledgements with filters", async () => {
    modelMocks.Restaurant.exists.mockResolvedValue(true);
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    await query.shiftAcknowledgements(
      null,
      {
        restaurantId: "rest-1",
        periodStart: "2026-05-01T00:00:00.000Z",
        periodEnd: "2026-05-31T23:59:59.999Z",
        employeeId: "emp-1",
        status: "PENDING",
      },
      { user: { id: "manager-1", roles: ["manager"], restaurantId: "rest-1" } },
    );

    expect(modelMocks.findMock).toHaveBeenCalledWith({
      restaurantId: { __oid: "rest-1" },
      employeeId: { __oid: "emp-1" },
      status: "pending",
      $and: [
        { periodEnd: { $gte: new Date("2026-05-01T00:00:00.000Z") } },
        { periodStart: { $lte: new Date("2026-05-31T23:59:59.999Z") } },
      ],
    });
    expect(modelMocks.findSortMock).toHaveBeenCalledWith({ deadlineAt: 1, createdAt: -1 });
  });

  it("allows manager access through restaurant ownership for shiftAcknowledgements", async () => {
    modelMocks.Restaurant.exists.mockResolvedValue(true);
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    await query.shiftAcknowledgements(
      null,
      { restaurantId: "rest-1", status: "declined" },
      { user: { id: "manager-1", roles: ["manager"], restaurantIds: ["rest-1"] } },
    );

    expect(modelMocks.findMock).toHaveBeenCalledWith({
      restaurantId: { __oid: "rest-1" },
      status: "declined",
    });
  });

  it("returns empty for another week when filters do not overlap", async () => {
    modelMocks.Restaurant.exists.mockResolvedValue(true);
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    modelMocks.findSortMock.mockResolvedValue([]);

    const result = await query.shiftAcknowledgements(
      null,
      {
        restaurantId: "rest-1",
        periodStart: "2026-06-01T00:00:00.000Z",
        periodEnd: "2026-06-07T23:59:59.999Z",
        status: "declined",
      },
      { user: { id: "manager-1", roles: ["manager"], restaurantId: "rest-1" } },
    );

    expect(result).toEqual([]);
  });

  it("myShiftAcknowledgements filters by current user, restaurant, and lowercases status", async () => {
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    await query.myShiftAcknowledgements(
      null,
      { restaurantId: "rest-1", status: "ACCEPTED" },
      { user: { id: "staff-1", roles: ["staff"], restaurantForStaff: "rest-1" } },
    );

    expect(modelMocks.findMock).toHaveBeenCalledWith({
      employeeId: { __oid: "staff-1" },
      restaurantId: { __oid: "rest-1" },
      status: "accepted",
    });
    expect(modelMocks.findSortMock).toHaveBeenCalledWith({ deadlineAt: 1 });
  });

  it("applies overlap period filter for myShiftAcknowledgements", async () => {
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    await query.myShiftAcknowledgements(
      null,
      {
        periodStart: "2026-05-10T00:00:00.000Z",
        periodEnd: "2026-05-20T23:59:59.999Z",
      },
      { user: { id: "staff-2", _id: "staff-shadow" } },
    );

    expect(modelMocks.findMock).toHaveBeenCalledWith({
      employeeId: { __oid: "staff-2" },
      $and: [
        { periodEnd: { $gte: new Date("2026-05-10T00:00:00.000Z") } },
        { periodStart: { $lte: new Date("2026-05-20T23:59:59.999Z") } },
      ],
    });
  });

  it("myShiftAttendances filters current user attendance by restaurant", async () => {
    const expectedStart = new Date("2026-05-10T00:00:00.000Z");
    expectedStart.setHours(0, 0, 0, 0);
    const expectedEnd = new Date("2026-05-20T23:59:59.999Z");
    expectedEnd.setHours(23, 59, 59, 999);

    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    await query.myShiftAttendances(
      null,
      {
        restaurantId: "rest-1",
        periodStart: "2026-05-10T00:00:00.000Z",
        periodEnd: "2026-05-20T23:59:59.999Z",
      },
      { user: { id: "staff-1", roles: ["staff"], restaurantForStaff: "rest-1" } },
    );

    expect(modelMocks.Timesheet.find).toHaveBeenCalledWith({
      employeeId: { __oid: "staff-1" },
      restaurantId: { __oid: "rest-1" },
      shiftId: { $ne: null },
      isOffSchedule: { $ne: true },
      workDate: {
        $gte: expectedStart,
        $lte: expectedEnd,
      },
    });
  });

  it("blocks unauthenticated users", async () => {
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;

    await expect(
      query.shiftAcknowledgements(null, { restaurantId: "rest-1" }, { user: null }),
    ).rejects.toThrow("UNAUTHENTICATED");
  });

  it("allows manager-owned restaurant access for scheduleAcknowledgementSummary without user.restaurantId", async () => {
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    modelMocks.Restaurant.exists.mockResolvedValue(true);
    modelMocks.SchedulePublication.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const result = await query.scheduleAcknowledgementSummary(
      null,
      {
        restaurantId: "rest-1",
        periodStart: "2026-05-01T00:00:00.000Z",
        periodEnd: "2026-05-31T23:59:59.999Z",
      },
      { user: { id: "manager-1", roles: ["MANAGER"] } },
    );

    expect(result).toEqual({
      totalAssignedStaff: 0,
      acknowledgedCount: 0,
      pendingCount: 0,
      changedAfterAcknowledgementCount: 0,
      employees: [],
    });
  });

  it("blocks manager without access for scheduleAcknowledgementSummary", async () => {
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    modelMocks.Restaurant.exists.mockResolvedValue(null);

    await expect(
      query.scheduleAcknowledgementSummary(
        null,
        {
          restaurantId: "rest-2",
          periodStart: "2026-05-01T00:00:00.000Z",
          periodEnd: "2026-05-31T23:59:59.999Z",
        },
        { user: { id: "manager-1", roles: ["MANAGER"] } },
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
  });
});
