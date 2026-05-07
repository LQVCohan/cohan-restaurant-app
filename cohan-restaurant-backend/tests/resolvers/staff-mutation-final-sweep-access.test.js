import { describe, it, expect, vi, beforeEach } from "vitest";

const guards = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(async () => true),
  requireRoles: vi.fn(),
  requireRestaurantScope: vi.fn(),
}));

const modelMocks = vi.hoisted(() => ({
  Staff: { findById: vi.fn() },
  Role: {},
  EventLog: { create: vi.fn(async () => ({})) },
  Shift: {},
  Timesheet: {},
  LeaveRequest: {},
  LeaveBalance: {},
  PayrollSetting: {},
  PayrollPeriod: {},
  PayrollItem: {},
  PayrollAdjustment: {},
  EmployeeCodeCounter: {},
  Notification: {},
  SchedulePublication: {},
  ShiftAcknowledgement: {},
  ScheduleAcknowledgement: {},
  AttendanceCorrectionRequest: {},
  OvertimeRequest: {},
}));

vi.mock("../../graphql/guards.js", () => guards);
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn(async () => ({})) } }));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({ ATTENDANCE_REVIEW_ROLES: [], ATTENDANCE_OPERATION_ROLES: [], ATTENDANCE_SELF_ROLES: [], SCHEDULE_WRITE_ROLES: [], SHIFT_ACK_ADMIN_ROLES: [], resolveUserRoles: vi.fn(() => []), userCanAccessRestaurant: vi.fn(() => true) }));
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function ObjectId(v){ return v; } } } }));

function makeStaffDoc(data = {}) {
  return {
    _id: data._id || "staff-1",
    userType: "STAFF",
    primaryRestaurant: "r1",
    restaurantForStaff: "r1",
    deletedAt: null,
    rate: 0,
    rateCount: 0,
    save: vi.fn(async function save() { return this; }),
    populate: vi.fn(async function populate() { return this; }),
    ...data,
  };
}

describe("staff mutation final sweep access", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guards.requireRestaurantAccess.mockResolvedValue(true);
  });

  it("rateStaff denies before write when restaurant access fails", async () => {
    const scoped = { _id: "staff-1", userType: "STAFF", deletedAt: null, primaryRestaurant: "r1", restaurantForStaff: "r1", refRestaurants: [] };
    const doc = makeStaffDoc();
    modelMocks.Staff.findById
      .mockReturnValueOnce({ select: vi.fn(() => ({ lean: vi.fn(async () => scoped) })) })
      .mockResolvedValueOnce(doc);
    guards.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));

    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.rateStaff(null, { userId: "staff-1", rating: 5 }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(guards.requireAuth).toHaveBeenCalledWith({ user: { id: "u1" } });
    expect(doc.save).not.toHaveBeenCalled();
    expect(modelMocks.EventLog.create).not.toHaveBeenCalled();
  });
});
