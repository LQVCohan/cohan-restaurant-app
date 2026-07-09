import { describe, it, expect, vi, beforeEach } from "vitest";

const guards = vi.hoisted(() => ({ requireAuth: vi.fn(), requireRestaurantAccess: vi.fn(async () => true), requireRoles: vi.fn(), requireRestaurantScope: vi.fn() }));
const scopeMocks = vi.hoisted(() => ({
  staffBelongsToRestaurantByMembership: vi.fn(),
}));
const services = vi.hoisted(() => ({ createOvertimeRequestService: vi.fn(async () => ({ id: "ot1" })), confirmOvertimeRequestService: vi.fn(async () => ({ id: "ot1" })), approveOvertimeRequestService: vi.fn(async () => ({ id: "ot1" })), rejectOvertimeRequestService: vi.fn(async () => ({ id: "ot1" })), cancelOvertimeRequestService: vi.fn(async () => ({ id: "ot1" })), completeOvertimeRequestService: vi.fn(async () => ({ id: "ot1" })) }));
const modelMocks = vi.hoisted(() => ({
  Staff: { findById: vi.fn() }, Shift: { findById: vi.fn() }, Timesheet: { findById: vi.fn() }, OvertimeRequest: { findById: vi.fn() },
  Role: {}, EventLog: {}, LeaveRequest: {}, LeaveBalance: {}, PayrollSetting: {}, PayrollPeriod: {}, PayrollItem: {}, PayrollAdjustment: {}, EmployeeCodeCounter: {}, Notification: {}, SchedulePublication: {}, ShiftAcknowledgement: {}, ScheduleAcknowledgement: {}, AttendanceCorrectionRequest: { findById: vi.fn() }
}));

vi.mock("../../graphql/guards.js", () => guards);
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", () => scopeMocks);
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn() } }));
vi.mock("../../src/services/overtime/overtimeRequest.service.js", () => ({
  createOvertimeRequest: services.createOvertimeRequestService,
  confirmOvertimeRequest: services.confirmOvertimeRequestService,
  approveOvertimeRequest: services.approveOvertimeRequestService,
  rejectOvertimeRequest: services.rejectOvertimeRequestService,
  cancelOvertimeRequest: services.cancelOvertimeRequestService,
  completeOvertimeRequest: services.completeOvertimeRequestService,
}));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  ATTENDANCE_REVIEW_ROLES: ["ADMIN"], ATTENDANCE_OPERATION_ROLES: ["MANAGER"], ATTENDANCE_SELF_ROLES: ["STAFF"],
  SCHEDULE_WRITE_ROLES: [], SHIFT_ACK_ADMIN_ROLES: [], normalizeRole: vi.fn((r) => String(r || "").toUpperCase()), resolveUserRoles: vi.fn(() => []), userCanAccessRestaurant: vi.fn(() => true),
}));
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function ObjectId(v) { return v; } } } }));

const findChain = (value) => ({ select: vi.fn(() => ({ lean: vi.fn(async () => value) })) });
const findDoc = (value) => ({ select: vi.fn(async () => value) });

describe("staff overtime mutation access", () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    scopeMocks.staffBelongsToRestaurantByMembership.mockResolvedValue(true);
    modelMocks.Staff.findById.mockReturnValue(findChain({ _id: "e1", userType: "STAFF" }));
    modelMocks.Shift.findById.mockReturnValue(findChain({ _id: "s1", employeeId: "e1", restaurantId: "r1" }));
    modelMocks.Timesheet.findById.mockReturnValue(findChain({ _id: "t1", employeeId: "e1", restaurantId: "r1", shiftId: "s1" }));
    modelMocks.OvertimeRequest.findById.mockReturnValue(findDoc({ _id: "ot1", employeeId: "e2", restaurantId: "r1", status: "pending_approval" }));
  });

  it("createOvertimeRequest self with own shift calls service", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await mutation.createOvertimeRequest(null, { input: { employeeId: "e1", restaurantId: "r1", shiftId: "s1" } }, { user: { id: "e1" } });
    expect(services.createOvertimeRequestService).toHaveBeenCalled();
  });

  it("createOvertimeRequest manager denied by restaurant access before service", async () => {
    guards.requireRoles.mockImplementation(() => {});
    guards.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.createOvertimeRequest(null, { input: { employeeId: "e1", restaurantId: "r1", shiftId: "s1" } }, { user: { id: "m1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(services.createOvertimeRequestService).not.toHaveBeenCalled();
  });

  it("confirmOvertimeRequest non-owner denied before service", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.confirmOvertimeRequest(null, { input: { requestId: "ot1" } }, { user: { id: "e1" } })).rejects.toThrow("FORBIDDEN");
    expect(services.confirmOvertimeRequestService).not.toHaveBeenCalled();
  });

  it("approveOvertimeRequest denied by restaurant access before service", async () => {
    guards.requireRoles.mockImplementation(() => {});
    guards.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.approveOvertimeRequest(null, { input: { requestId: "ot1" } }, { user: { id: "admin-1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(services.approveOvertimeRequestService).not.toHaveBeenCalled();
  });
});
