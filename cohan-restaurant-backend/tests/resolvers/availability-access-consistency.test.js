import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const requireRestaurantAccess = vi.fn();
const requireRoles = vi.fn();
const userHasAnyRole = vi.fn();
const isAvailabilityRegistrationWindowOpen = vi.fn();
const getStaffEmploymentType = vi.fn();
const resolveAvailabilityWindowEffectiveStatus = vi.fn();

const AvailabilityRegistrationWindow = vi.hoisted(() => ({ findById: vi.fn(), findByIdAndUpdate: vi.fn() }));
const StaffAvailabilitySubmission = vi.hoisted(() => ({ find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), findById: vi.fn(), findByIdAndUpdate: vi.fn() }));
const Staff = vi.hoisted(() => ({ findOne: vi.fn() }));

vi.mock("../../models/index.js", () => ({ AvailabilityRegistrationWindow, StaffAvailabilitySubmission, Staff }));
vi.mock("../../graphql/guards.js", () => ({ requireAuth, requireRestaurantAccess, requireRoles }));
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  AVAILABILITY_READ_ROLES: ["MANAGER"],
  AVAILABILITY_WINDOW_ADMIN_ROLES: ["MANAGER"],
  AVAILABILITY_REVIEW_ROLES: ["MANAGER"],
  userHasAnyRole,
}));
vi.mock("../../src/services/availability/availabilityRegistrationWindow.service.js", () => ({
  isAvailabilityRegistrationWindowOpen,
  getStaffEmploymentType,
  createOrGetAvailabilityRegistrationWindow: vi.fn(),
}));
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => ({ getSchedulingPolicy: vi.fn() }));
vi.mock("../../src/services/availability/availabilityRegistrationSchedule.service.js", () => ({ buildAvailabilityRegistrationSchedule: vi.fn(), resolveAvailabilityWindowEffectiveStatus }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  requireAuth.mockReturnValue(true);
  requireRoles.mockReturnValue(true);
  requireRestaurantAccess.mockResolvedValue(true);
  userHasAnyRole.mockReturnValue(false);
  isAvailabilityRegistrationWindowOpen.mockReturnValue(true);
  getStaffEmploymentType.mockResolvedValue("part_time");
  resolveAvailabilityWindowEffectiveStatus.mockReturnValue("open");
  AvailabilityRegistrationWindow.findById.mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ restaurantId: "valid-r1" }) }) });
  StaffAvailabilitySubmission.find.mockResolvedValue([]);
  StaffAvailabilitySubmission.findOne.mockResolvedValue({});
  StaffAvailabilitySubmission.findOneAndUpdate.mockResolvedValue({});
  StaffAvailabilitySubmission.findById.mockResolvedValue({ restaurantId: "valid-r1", status: "submitted" });
  StaffAvailabilitySubmission.findByIdAndUpdate.mockResolvedValue({});
  AvailabilityRegistrationWindow.findByIdAndUpdate.mockResolvedValue({});
  Staff.findOne.mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "e2" }) }) });
});

describe("availability access consistency hardening", () => {
  it("query consistency and authorization", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    await expect(query.staffAvailabilitySubmissions(null, { windowId: "w1", restaurantId: "507f1f77bcf86cd799439011" }, { user: {} })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(StaffAvailabilitySubmission.find).not.toHaveBeenCalled();

    requireRestaurantAccess.mockResolvedValueOnce(true);
    AvailabilityRegistrationWindow.findById.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) });
    await expect(query.staffAvailabilitySubmissions(null, { windowId: "w1", restaurantId: "507f1f77bcf86cd799439011" }, { user: {} })).rejects.toThrow("AVAILABILITY_WINDOW_NOT_FOUND");

    AvailabilityRegistrationWindow.findById.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ restaurantId: "507f1f77bcf86cd799439012" }) }) });
    await expect(query.staffAvailabilitySubmissions(null, { windowId: "w1", restaurantId: "507f1f77bcf86cd799439011" }, { user: {} })).rejects.toThrow("AVAILABILITY_WINDOW_RESTAURANT_MISMATCH");

    AvailabilityRegistrationWindow.findById.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ restaurantId: "507f1f77bcf86cd799439011" }) }) });
    await query.staffAvailabilitySubmissions(null, { windowId: "w1", restaurantId: "507f1f77bcf86cd799439011", status: "submitted", employmentType: "part_time" }, { user: {} });
    expect(StaffAvailabilitySubmission.find).toHaveBeenCalledWith({ availabilityWindowId: "w1", restaurantId: "507f1f77bcf86cd799439011", status: "submitted", employmentType: "part_time" });
  });

  it("single submission owner/reader behavior", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    userHasAnyRole.mockReturnValue(false);
    await query.staffAvailabilitySubmission(null, { windowId: "w1", employeeId: "e1" }, { user: { id: "e1" } });
    expect(requireRestaurantAccess).toHaveBeenCalled();
    expect(StaffAvailabilitySubmission.findOne).toHaveBeenCalled();

    await expect(query.staffAvailabilitySubmission(null, { windowId: "w1", employeeId: "e2" }, { user: { id: "e1" } })).rejects.toThrow("FORBIDDEN");
    expect(StaffAvailabilitySubmission.findOne).toHaveBeenCalledTimes(1);
  });

  it("window mutation and review denied stop writes", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    AvailabilityRegistrationWindow.findById.mockResolvedValue({ restaurantId: "valid-r1" });
    requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(mutation.openAvailabilityWindow(null, { id: "w1" }, { user: { id: "m1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(mutation.closeAvailabilityWindow(null, { id: "w1" }, { user: { id: "m1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(mutation.cancelAvailabilityWindow(null, { id: "w1" }, { user: { id: "m1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(AvailabilityRegistrationWindow.findByIdAndUpdate).not.toHaveBeenCalled();

    requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    await expect(mutation.reviewStaffAvailabilitySubmission(null, { input: { id: "s1", status: "approved" } }, { user: { id: "m1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(StaffAvailabilitySubmission.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("submitStaffAvailability self/manager membership/scope", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    AvailabilityRegistrationWindow.findById.mockResolvedValue({
      restaurantId: "valid-r1", status: "open", periodStart: "2026-01-01", periodEnd: "2026-01-07", lateChangeRequiresApproval: true,
    });

    userHasAnyRole.mockReturnValue(false);
    await mutation.submitStaffAvailability(null, { input: { availabilityWindowId: "w1", employeeId: "e1", slots: [] } }, { user: { id: "e1" } });
    expect(getStaffEmploymentType).toHaveBeenCalled();

    userHasAnyRole.mockReturnValue(true);
    await mutation.submitStaffAvailability(null, { input: { availabilityWindowId: "w1", employeeId: "e2", slots: [] } }, { user: { id: "m1" } });
    expect(Staff.findOne).toHaveBeenCalled();

    Staff.findOne.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) });
    await expect(mutation.submitStaffAvailability(null, { input: { availabilityWindowId: "w1", employeeId: "e3", slots: [] } }, { user: { id: "m1" } })).rejects.toThrow("EMPLOYEE_NOT_IN_RESTAURANT");
    expect(StaffAvailabilitySubmission.findOneAndUpdate).toHaveBeenCalledTimes(2);

    requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));
    await expect(mutation.submitStaffAvailability(null, { input: { availabilityWindowId: "w1", employeeId: "e2", slots: [] } }, { user: { id: "m1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
  });
});
