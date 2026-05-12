import { beforeEach, describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => ({ requireAuth: vi.fn(), requireRestaurantAccess: vi.fn(async () => true), requireRoles: vi.fn() }));
const autoMocks = vi.hoisted(() => ({
  assertAutoSchedulePeriodCanEdit: vi.fn(async () => true),
  buildAutoScheduleCreateInputs: vi.fn(async () => []),
  buildAutoSchedulePreviewBackend: vi.fn(async () => ({ items: [], summary: { totalDemand: 0, recommendedAssignments: 0, warningAssignments: 0, blockedAssignments: 0, existingShiftCount: 0 }, plannedAssignments: [], blockedCandidates: [], unfilledRoles: [], unresolvedCount: 0, canApply: false, warnings: [], validationIssues: [] })),
}));
const publishMocks = vi.hoisted(() => ({ validateScheduleBeforePublish: vi.fn(), hasBlockingSchedulePublishIssues: vi.fn(() => false) }));
const modelMocks = vi.hoisted(() => ({
  Staff: {}, Role: {}, EventLog: { create: vi.fn() }, Shift: { countDocuments: vi.fn(), find: vi.fn() }, Timesheet: {}, LeaveRequest: {}, LeaveBalance: {}, PayrollSetting: {}, PayrollPeriod: {}, PayrollItem: {}, PayrollAdjustment: {}, EmployeeCodeCounter: {}, Notification: { insertMany: vi.fn() }, SchedulePublication: { findOne: vi.fn(), findOneAndUpdate: vi.fn() }, ShiftAcknowledgement: { findOneAndUpdate: vi.fn() }, ScheduleAcknowledgement: {}, AttendanceCorrectionRequest: {}, OvertimeRequest: {},
}));

vi.mock("../../graphql/guards.js", () => guards);
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/scheduling/autoSchedule.service.js", () => autoMocks);
vi.mock("../../src/services/scheduling/schedulePublishValidation.service.js", () => publishMocks);
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({ ATTENDANCE_REVIEW_ROLES: [], ATTENDANCE_OPERATION_ROLES: [], ATTENDANCE_SELF_ROLES: [], SCHEDULE_WRITE_ROLES: ["ADMIN", "MANAGER", "HR"], SHIFT_ACK_ADMIN_ROLES: [], resolveUserRoles: vi.fn(() => []), userCanAccessRestaurant: vi.fn(() => true) }));
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => ({ assertNoLockedPayrollPeriodOverlap: vi.fn(async () => true) }));
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn() } }));
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function ObjectId(v) { this.value = v; this.toString = () => String(v); } } } }));

const q = (value) => ({ lean: vi.fn(async () => value), populate: vi.fn(() => q(value)) });

describe("auto schedule resolver access", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.Shift.countDocuments.mockResolvedValue(1);
    modelMocks.Shift.find.mockReturnValue(q([{ _id: "s1", employeeId: "e1", restaurantId: "r1", startTime: new Date("2026-05-18T08:00:00Z"), endTime: new Date("2026-05-18T12:00:00Z") }]));
    modelMocks.SchedulePublication.findOne.mockReturnValue(q(null));
    modelMocks.SchedulePublication.findOneAndUpdate.mockResolvedValue({ _id: "pub1", restaurantId: "r1", periodStart: new Date("2026-05-18"), periodEnd: new Date("2026-05-24"), status: "published" });
    publishMocks.validateScheduleBeforePublish.mockResolvedValue({ ok: true, issues: [] });
  });

  it("apply only allows users with schedule write roles in restaurant scope", async () => {
    guards.requireRoles.mockImplementationOnce(() => { throw new Error("FORBIDDEN"); });
    const m = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(m.applyAutoSchedule(null, { input: { restaurantId: "r1", periodStart: "2026-05-18", periodEnd: "2026-05-24" } }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN");
    expect(autoMocks.buildAutoScheduleCreateInputs).not.toHaveBeenCalled();
  });

  it("publish is blocked when server-side validation finds missing staff/mandatory role", async () => {
    publishMocks.validateScheduleBeforePublish.mockResolvedValueOnce({ ok: false, issues: [{ code: "MANDATORY_ROLE_UNFILLED", severity: "error", message: "Thiếu role bắt buộc kitchen." }] });
    publishMocks.hasBlockingSchedulePublishIssues.mockReturnValueOnce(true);
    const m = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(m.publishSchedule(null, { input: { restaurantId: "r1", periodStart: "2026-05-18", periodEnd: "2026-05-24", mandatoryShiftRoles: { morning: ["kitchen"] } } }, { user: { id: "u1" } })).rejects.toThrow("Thiếu role bắt buộc kitchen.");
    expect(modelMocks.SchedulePublication.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
