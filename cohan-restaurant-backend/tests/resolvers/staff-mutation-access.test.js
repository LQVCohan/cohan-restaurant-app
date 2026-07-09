import { describe, it, expect, vi, beforeEach } from "vitest";

const guards = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(async () => true),
  requireRoles: vi.fn(),
  requireRestaurantScope: vi.fn(),
}));

const scopeMocks = vi.hoisted(() => ({
  getStaffRestaurantIds: vi.fn(),
  staffBelongsToRestaurantByMembership: vi.fn(async () => true),
}));

const modelMocks = vi.hoisted(() => ({
  Staff: vi.fn(),
  Role: { findById: vi.fn(), findOne: vi.fn() },
  EventLog: { create: vi.fn(async () => ({})) },
  EmployeeCodeCounter: { findOneAndUpdate: vi.fn(async () => ({ seq: 1 })) },
  Notification: { insertMany: vi.fn(async () => []) },
  Shift: {}, Timesheet: {}, LeaveRequest: {}, LeaveBalance: {}, PayrollSetting: {}, PayrollPeriod: {}, PayrollItem: {}, PayrollAdjustment: {}, SchedulePublication: {}, ShiftAcknowledgement: {}, ScheduleAcknowledgement: {},
}));

vi.mock("../../graphql/guards.js", () => guards);
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", () => scopeMocks);
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn(async () => ({})) } }));
vi.mock("../../src/services/payroll/payrollPermission.service.js", () => ({ assertPayrollPermission: vi.fn() }));
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => ({ assertNoLockedPayrollPeriodOverlap: vi.fn(async () => {}) }));
vi.mock("../../src/services/eventLog.service.js", () => ({ logEvent: vi.fn(async () => ({})), logObjectEvent: vi.fn(async () => ({})) }));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({ ATTENDANCE_REVIEW_ROLES: [], ATTENDANCE_OPERATION_ROLES: [], ATTENDANCE_SELF_ROLES: [], SCHEDULE_WRITE_ROLES: [], SHIFT_ACK_ADMIN_ROLES: [], resolveUserRoles: vi.fn(() => []), userCanAccessRestaurant: vi.fn(() => true) }));
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function ObjectId(v){ return v; } } } }));

function makeStaffDoc(data = {}) {
  return {
    _id: data._id || "staff-1",
    userType: "STAFF",
    deletedAt: null,
    setPassword: vi.fn(async () => {}),
    save: vi.fn(async function save() { return this; }),
    populate: vi.fn(async function populate() { return this; }),
    toObject: vi.fn(() => ({ ...data, userType: "STAFF" })),
    ...data,
  };
}

describe("staff mutation access hardening", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guards.requireRestaurantAccess.mockResolvedValue(true);
    scopeMocks.getStaffRestaurantIds.mockResolvedValue(["r1"]);
    scopeMocks.staffBelongsToRestaurantByMembership.mockResolvedValue(true);
    modelMocks.Role.findOne.mockReturnValue({ populate: vi.fn().mockResolvedValue({ _id: "role-staff", slug: "staff" }) });
    modelMocks.Staff.findById = vi.fn(async () => null);
    modelMocks.Staff.mockImplementation(function Staff(data) { return makeStaffDoc(data); });
  });

  it("createStaff denies before writes when restaurant scope forbidden", async () => {
    guards.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.createStaff(null, { input: { fullName: "A", businessRestaurantId: "r1" } }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Role.findById).not.toHaveBeenCalled();
    expect(modelMocks.EmployeeCodeCounter.findOneAndUpdate).not.toHaveBeenCalled();
    expect(modelMocks.Staff).not.toHaveBeenCalled();
  });

  it("createStaff with roleId requires admin", async () => {
    guards.requireRoles.mockImplementationOnce(() => { throw new Error("FORBIDDEN"); });
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.createStaff(null, { input: { fullName: "A", businessRestaurantId: "r1", roleId: "role-1" } }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN");
    expect(guards.requireRoles).toHaveBeenCalledWith({ user: { id: "u1" } }, ["ADMIN"]);
    expect(modelMocks.Staff).not.toHaveBeenCalled();
  });

  it("createStaff creates staff without restaurantForStaff", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await mutation.createStaff(null, { input: { fullName: "A", businessRestaurantId: "r1" } }, { user: { id: "u1" } });
    const createdInput = modelMocks.Staff.mock.calls[0][0];
    expect(createdInput.restaurantForStaff).toBeUndefined();
  });

  it("createStaff rejects primaryRestaurantId legacy input", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(
      mutation.createStaff(null, { input: { fullName: "A", primaryRestaurantId: "r1" } }, { user: { id: "u1" } }),
    ).rejects.toThrow("primaryRestaurantId has been removed; use staffBusinessContext");
  });

  it("updateStaff rejects restaurantForStaff assignment input", async () => {
    const scoped = { _id: "staff-1", userType: "STAFF", deletedAt: null };
    modelMocks.Staff.findById = vi
      .fn()
      .mockReturnValueOnce({ select: vi.fn(() => ({ lean: vi.fn(async () => scoped) })) })
      .mockResolvedValueOnce(makeStaffDoc({ _id: "staff-1" }));
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.updateStaff(null, { userId: "staff-1", input: { restaurantForStaff: "r2" } }, { user: { id: "u1" } })).rejects.toThrow("restaurantForStaff has been removed; use BrandMembership staff assignment");
    expect(modelMocks.Staff.findById).toHaveBeenCalledTimes(1);
  });

  it("updateStaff strips userType and enforces baseSalary admin-only", async () => {
    const scoped = { _id: "staff-1", userType: "STAFF", deletedAt: null };
    const doc = makeStaffDoc({ _id: "staff-1" });
    modelMocks.Staff.findById = vi
      .fn()
      .mockReturnValueOnce({ select: vi.fn(() => ({ lean: vi.fn(async () => scoped) })) })
      .mockResolvedValueOnce(doc);
    guards.requireRoles.mockImplementationOnce(() => { throw new Error("FORBIDDEN"); });
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.updateStaff(null, { userId: "staff-1", input: { userType: "ADMIN", baseSalary: 100 } }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN");
    expect(doc.save).not.toHaveBeenCalled();
  });

  it("updateStaff rejects primaryRestaurantId legacy input", async () => {
    const scoped = { _id: "staff-1", userType: "STAFF", deletedAt: null };
    modelMocks.Staff.findById = vi
      .fn()
      .mockReturnValueOnce({ select: vi.fn(() => ({ lean: vi.fn(async () => scoped) })) })
      .mockResolvedValueOnce(makeStaffDoc({ _id: "staff-1" }));
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(
      mutation.updateStaff(null, { userId: "staff-1", input: { primaryRestaurantId: "r2" } }, { user: { id: "u1" } }),
    ).rejects.toThrow("primaryRestaurantId has been removed; use staffBusinessContext");
  });

  it("setStaffEmploymentStatus returns a sanitized StaffPrivateProfile", async () => {
    const scoped = { _id: "staff-1", userType: "STAFF", deletedAt: null };
    const doc = makeStaffDoc({
      _id: "staff-1",
      fullName: "Staff One",
      baseSalary: 500,
      passwordHash: "hidden",
    });
    modelMocks.Staff.findById = vi
      .fn()
      .mockReturnValueOnce({ select: vi.fn(() => ({ lean: vi.fn(async () => scoped) })) })
      .mockResolvedValueOnce(doc);
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;

    const result = await mutation.setStaffEmploymentStatus(
      null,
      { userId: "staff-1", employmentStatus: "ON_LEAVE" },
      { user: { id: "u1" } },
    );

    expect(result).toMatchObject({
      id: "staff-1",
      fullName: "Staff One",
      baseSalary: 500,
    });
    expect(result.passwordHash).toBeUndefined();
    expect(doc.save).toHaveBeenCalled();
  });

  it("deleteStaff denied before save when scope forbidden", async () => {
    const scoped = { _id: "staff-1", userType: "STAFF", deletedAt: null };
    const doc = makeStaffDoc({ _id: "staff-1" });
    modelMocks.Staff.findById = vi
      .fn()
      .mockReturnValueOnce({ select: vi.fn(() => ({ lean: vi.fn(async () => scoped) })) })
      .mockResolvedValueOnce(doc);
    guards.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN"));
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
    await expect(mutation.deleteStaff(null, { userId: "staff-1" }, { user: { id: "u1" } })).rejects.toThrow("FORBIDDEN");
    expect(doc.save).not.toHaveBeenCalled();
  });

  it("setStaffEmploymentStatus is blocked by locked payroll guard before save", async () => {
    const { assertNoLockedPayrollPeriodOverlap } = await import("../../src/services/payroll/payrollLockGuard.service.js");
    assertNoLockedPayrollPeriodOverlap.mockRejectedValueOnce(new Error("PAYROLL_PERIOD_LOCKED"));
    const scoped = { _id: "staff-1", userType: "STAFF", deletedAt: null };
    const doc = makeStaffDoc({ _id: "staff-1", dateJoined: new Date("2026-01-01") });
    modelMocks.Staff.findById = vi
      .fn()
      .mockReturnValueOnce({ select: vi.fn(() => ({ lean: vi.fn(async () => scoped) })) })
      .mockResolvedValueOnce(doc);
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;

    await expect(mutation.setStaffEmploymentStatus(null, { userId: "staff-1", employmentStatus: "RESIGNED" }, { user: { id: "u1" } })).rejects.toThrow("PAYROLL_PERIOD_LOCKED");
    expect(doc.save).not.toHaveBeenCalled();
    expect(assertNoLockedPayrollPeriodOverlap).toHaveBeenCalledWith(expect.objectContaining({ action: "set_staff_employment_status" }));
  });

  it("deleteStaff is blocked by locked payroll guard before save", async () => {
    const { assertNoLockedPayrollPeriodOverlap } = await import("../../src/services/payroll/payrollLockGuard.service.js");
    assertNoLockedPayrollPeriodOverlap.mockRejectedValueOnce(new Error("PAYROLL_PERIOD_LOCKED"));
    const scoped = { _id: "staff-1", userType: "STAFF", deletedAt: null };
    const doc = makeStaffDoc({ _id: "staff-1", dateJoined: new Date("2026-01-01") });
    modelMocks.Staff.findById = vi
      .fn()
      .mockReturnValueOnce({ select: vi.fn(() => ({ lean: vi.fn(async () => scoped) })) })
      .mockResolvedValueOnce(doc);
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;

    await expect(mutation.deleteStaff(null, { userId: "staff-1" }, { user: { id: "u1" } })).rejects.toThrow("PAYROLL_PERIOD_LOCKED");
    expect(doc.save).not.toHaveBeenCalled();
    expect(assertNoLockedPayrollPeriodOverlap).toHaveBeenCalledWith(expect.objectContaining({ action: "delete_staff" }));
  });
});
