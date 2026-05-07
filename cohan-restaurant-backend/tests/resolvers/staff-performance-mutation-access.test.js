import { describe, it, expect, vi, beforeEach } from "vitest";

const guards = vi.hoisted(() => ({ requireAuth: vi.fn(), requireRestaurantAccess: vi.fn(async () => true), requireRoles: vi.fn(), requireRestaurantScope: vi.fn() }));
const perfIncidentSvc = vi.hoisted(() => ({ getPerformanceIncidentById: vi.fn(), reviewPerformanceIncident: vi.fn(async () => ({ id: "i1" })), waivePerformanceIncident: vi.fn(), markPerformanceIncidentEligible: vi.fn(), applyPerformanceIncidentScore: vi.fn() }));
const perfAppealSvc = vi.hoisted(() => ({ getPerformanceIncidentAppealById: vi.fn(), createPerformanceIncidentAppeal: vi.fn(async () => ({ id: "a1" })), cancelPerformanceIncidentAppeal: vi.fn(), reviewPerformanceIncidentAppeal: vi.fn() }));
const staffPerfSvc = vi.hoisted(() => ({ upsertStaffPerformanceReview: vi.fn(async () => ({ id: "r1" })), recalculateStaffPerformanceSnapshots: vi.fn() }));
const modelMocks = vi.hoisted(() => ({ Staff: { findById: vi.fn() }, Role: {}, EventLog: {}, Shift: {}, Timesheet: {}, LeaveRequest: {}, LeaveBalance: {}, PayrollSetting: {}, PayrollPeriod: {}, PayrollItem: {}, PayrollAdjustment: {}, EmployeeCodeCounter: {}, Notification: {}, SchedulePublication: {}, ShiftAcknowledgement: {}, ScheduleAcknowledgement: {}, AttendanceCorrectionRequest: {}, OvertimeRequest: {} }));

vi.mock("../../graphql/guards.js", () => guards);
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn() } }));
vi.mock("../../src/services/performance/performanceIncident.service.js", () => perfIncidentSvc);
vi.mock("../../src/services/performance/performanceAppeal.service.js", () => perfAppealSvc);
vi.mock("../../src/services/staffPerformance/staffPerformance.service.js", () => staffPerfSvc);
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({ ATTENDANCE_REVIEW_ROLES: ["ADMIN"], ATTENDANCE_OPERATION_ROLES: [], ATTENDANCE_SELF_ROLES: [], SCHEDULE_WRITE_ROLES: [], SHIFT_ACK_ADMIN_ROLES: [], resolveUserRoles: vi.fn(() => []), userCanAccessRestaurant: vi.fn(() => true) }));
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function ObjectId(v) { this.toString = () => String(v); } } } }));
const q = (v) => ({ select: vi.fn(() => q(v)), lean: vi.fn(async () => v) });

describe("staff performance mutation access", () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    modelMocks.Staff.findById.mockReturnValue(q({ _id: "e1", userType: "STAFF", primaryRestaurant: "r1", restaurantForStaff: "r1", refRestaurants: [] }));
    perfIncidentSvc.getPerformanceIncidentById.mockResolvedValue({ _id: "i1", restaurantId: "r1", employeeId: "e1" });
    perfAppealSvc.getPerformanceIncidentAppealById.mockResolvedValue({ _id: "a1", restaurantId: "r1", employeeId: "e1" });
  });

  it("reviewPerformanceIncident denied by restaurant access before service", async () => {
    guards.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    const m = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(m.reviewPerformanceIncident(null, { input: { incidentId: "i1" } }, { user: { id: "m1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(perfIncidentSvc.reviewPerformanceIncident).not.toHaveBeenCalled();
  });

  it("createPerformanceIncidentAppeal rejects non-owner", async () => {
    const m = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(m.createPerformanceIncidentAppeal(null, { input: { incidentId: "i1", reason: "x" } }, { user: { id: "u2" } })).rejects.toThrow("FORBIDDEN");
    expect(perfAppealSvc.createPerformanceIncidentAppeal).not.toHaveBeenCalled();
  });

  it("reviewPerformanceIncidentAppeal rejects owner self-review", async () => {
    const m = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(m.reviewPerformanceIncidentAppeal(null, { input: { appealId: "a1", status: "accepted" } }, { user: { id: "e1" } })).rejects.toThrow("FORBIDDEN");
    expect(perfAppealSvc.reviewPerformanceIncidentAppeal).not.toHaveBeenCalled();
  });
});
