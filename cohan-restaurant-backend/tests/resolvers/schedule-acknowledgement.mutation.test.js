import { beforeEach, describe, expect, it, vi } from "vitest";

const restaurantScopeMocks = vi.hoisted(() => ({
  canAccessRestaurant: vi.fn(),
}));
const modelMocks = vi.hoisted(() => ({
  Staff: {}, Shift: { exists: vi.fn() }, Timesheet: {}, LeaveRequest: {}, LeaveBalance: {}, Order: {}, Table: {}, Category: {}, Promotion: {},
  Restaurant: { exists: vi.fn() }, PayrollPeriod: {}, PayrollItem: {},
  SchedulePublication: { findOne: vi.fn() }, EventLog: {}, ShiftAcknowledgement: {},
  ScheduleAcknowledgement: { findOneAndUpdate: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", async (importOriginal) => ({
  ...(await importOriginal()),
  canAccessRestaurant: restaurantScopeMocks.canAccessRestaurant,
}));
vi.mock("../../src/services/staffPerformance/staffPerformance.service.js", () => ({ upsertStaffPerformanceReview: vi.fn(), recalculateStaffPerformanceSnapshots: vi.fn() }));
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => ({ updateSchedulingPolicy: vi.fn(), startSchedulingOperations: vi.fn() }));
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
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function ObjectId(value) { return { __oid: value }; } } } }));

describe("schedule acknowledgement mutation resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restaurantScopeMocks.canAccessRestaurant.mockReset();
    restaurantScopeMocks.canAccessRestaurant.mockResolvedValue(true);
    modelMocks.SchedulePublication.findOne.mockResolvedValue({
      _id: "pub-1",
      restaurantId: "rest-1",
      periodStart: new Date("2026-05-01T00:00:00.000Z"),
      periodEnd: new Date("2026-05-07T23:59:59.999Z"),
      status: "published",
      lastChangedAt: new Date("2026-05-02T00:00:00.000Z"),
    });
    modelMocks.Shift.exists.mockResolvedValue(true);
    modelMocks.ScheduleAcknowledgement.findOneAndUpdate.mockResolvedValue({ _id: "ack-1", status: "acknowledged" });
  });

  it("allows staff in BrandMembership scope to acknowledge weekly schedule", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    const user = { id: "staff-1", roles: ["staff"] };

    const result = await mutation.acknowledgeMySchedule(
      null,
      { restaurantId: "rest-1", periodStart: "2026-05-01T00:00:00.000Z", periodEnd: "2026-05-07T23:59:59.999Z" },
      { user },
    );

    expect(result).toEqual({ _id: "ack-1", status: "acknowledged" });
    expect(restaurantScopeMocks.canAccessRestaurant).toHaveBeenCalledWith(user, "rest-1");
  });

  it("blocks staff outside BrandMembership restaurant scope", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    restaurantScopeMocks.canAccessRestaurant.mockResolvedValueOnce(false);

    await expect(
      mutation.acknowledgeMySchedule(
        null,
        { restaurantId: "rest-1", periodStart: "2026-05-01T00:00:00.000Z", periodEnd: "2026-05-07T23:59:59.999Z" },
        { user: { id: "staff-1", roles: ["staff"] } },
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("allows manager in BrandMembership restaurant scope", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    const user = { id: "manager-1", roles: ["MANAGER"] };

    await mutation.acknowledgeMySchedule(
      null,
      { restaurantId: "rest-1", periodStart: "2026-05-01T00:00:00.000Z", periodEnd: "2026-05-07T23:59:59.999Z" },
      { user },
    );

    expect(restaurantScopeMocks.canAccessRestaurant).toHaveBeenCalledWith(user, "rest-1");
  });
});
