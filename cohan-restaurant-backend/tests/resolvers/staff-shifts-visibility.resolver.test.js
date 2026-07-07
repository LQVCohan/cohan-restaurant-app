import { beforeEach, describe, expect, it, vi } from "vitest";

const restaurantScopeMocks = vi.hoisted(() => ({
  canAccessRestaurant: vi.fn(async () => true),
}));
const modelMocks = vi.hoisted(() => ({
  Staff: {}, Shift: { find: vi.fn() }, Timesheet: {}, LeaveRequest: {}, LeaveBalance: {}, Order: {}, Table: {}, Category: {}, Promotion: {}, Restaurant: { exists: vi.fn() }, PayrollPeriod: {}, PayrollItem: {},
  SchedulePublication: { find: vi.fn() }, EventLog: {}, ShiftAcknowledgement: {}, ScheduleAcknowledgement: {},
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", async (importOriginal) => ({
  ...(await importOriginal()),
  canAccessRestaurant: restaurantScopeMocks.canAccessRestaurant,
}));
vi.mock("../../src/services/staffPerformance/staffPerformance.service.js", () => ({ listStaffPerformanceSnapshots: vi.fn() }));
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => ({ getSchedulingPolicy: vi.fn() }));
vi.mock("../../src/services/scheduling/shiftAssignmentValidation.service.js", () => ({ validateShiftAssignment: vi.fn() }));
vi.mock("../../src/services/overtime/overtimeRequest.service.js", () => ({ getOvertimeRequest: vi.fn(), listOvertimeRequests: vi.fn() }));
vi.mock("../../src/services/attendance/attendanceCorrectionWorkflow.service.js", () => ({ getAttendanceCorrectionRequest: vi.fn(), listAttendanceCorrectionRequests: vi.fn() }));
vi.mock("../../src/services/ai/staffSchedulingAssistant.service.js", () => ({ buildStaffSchedulingAssistant: vi.fn() }));
vi.mock("../../src/services/payroll/payrollCalculator.service.js", () => ({ buildPayrollItem: vi.fn() }));
vi.mock("../../src/services/payroll/payrollRuntime.service.js", () => ({ buildPayrollItemsForRange: vi.fn(), getPayrollSettings: vi.fn(), getPeriodDetail: vi.fn(), mapPayrollDocToGql: vi.fn(), summarize: vi.fn(), toObjectId: vi.fn() }));
vi.mock("../../src/services/payroll/payrollValidation.service.js", () => ({ validatePayrollPeriod: vi.fn() }));
vi.mock("../../src/services/payroll/payrollPermission.service.js", () => ({ assertPayrollPermission: vi.fn() }));
vi.mock("../../src/services/payroll/payrollEventLog.service.js", () => ({ logPayrollEvent: vi.fn() }));
vi.mock("../../src/services/scheduling/scheduleLifecycle.service.js", () => ({ mapSchedulePublicationOutput: vi.fn() }));
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function ObjectId(value) { return { __oid: value, value, toString: () => value }; } } } }));

describe("staffShifts publication visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restaurantScopeMocks.canAccessRestaurant.mockResolvedValue(true);
    modelMocks.Restaurant.exists.mockResolvedValue(true);
    modelMocks.SchedulePublication.find.mockReturnValue({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) });
    modelMocks.Shift.find.mockReturnValue({ sort: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), populate: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) });
  });

  it("limits staff self query to published/active publication windows and hides cancelled by default", async () => {
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;
    modelMocks.SchedulePublication.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([{ periodStart: new Date("2026-05-05T00:00:00.000Z"), periodEnd: new Date("2026-05-11T23:59:59.999Z") }]),
    });

    await query.staffShifts(null, { restaurantId: "r1", employeeId: "e1", startDate: "2026-05-04", endDate: "2026-05-10" }, { user: { id: "e1", roles: ["staff"] } });

    expect(modelMocks.SchedulePublication.find).toHaveBeenCalled();
    expect(modelMocks.Shift.find).toHaveBeenCalledWith(expect.objectContaining({
      restaurantId: expect.objectContaining({ __oid: "r1", value: "r1" }),
      employeeId: expect.objectContaining({ __oid: "e1", value: "e1" }),
      startTime: expect.any(Object),
      status: { $ne: "cancelled" },
      $and: expect.arrayContaining([expect.objectContaining({ $or: [expect.objectContaining({ startTime: expect.any(Object) })] })]),
    }));
  });

  it("allows manager query without publication gating", async () => {
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;

    await query.staffShifts(null, { restaurantId: "r1", employeeId: "e2", startDate: "2026-05-04", endDate: "2026-05-10" }, { user: { id: "m1", roles: ["manager"] } });

    expect(modelMocks.SchedulePublication.find).not.toHaveBeenCalled();
    expect(modelMocks.Shift.find).toHaveBeenCalledWith(expect.objectContaining({
      restaurantId: expect.objectContaining({ __oid: "r1", value: "r1" }),
      employeeId: expect.objectContaining({ __oid: "e2", value: "e2" }),
      startTime: expect.any(Object),
    }));
  });
});
