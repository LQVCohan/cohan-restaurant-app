import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const requireRestaurantAccess = vi.fn();
const requireRoles = vi.fn();
const userHasAnyRole = vi.fn();
const getSchedulingPolicy = vi.fn();
const resolveAvailabilityWindowEffectiveStatus = vi.fn();
const isAvailabilityRegistrationWindowOpen = vi.fn();

const models = vi.hoisted(() => ({
  AvailabilityRegistrationWindow: { findById: vi.fn() },
  StaffAvailabilitySubmission: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  Staff: { findById: vi.fn() },
}));

vi.mock("../../models/index.js", () => models);
vi.mock("../../graphql/guards.js", () => ({
  requireAuth,
  requireRestaurantAccess,
  requireRoles,
}));
vi.mock(
  "../../src/services/scheduling/schedulingPermission.service.js",
  () => ({
    AVAILABILITY_WINDOW_ADMIN_ROLES: ["ADMIN", "MANAGER"],
    AVAILABILITY_REVIEW_ROLES: ["ADMIN", "MANAGER", "HR"],
    userHasAnyRole,
  }),
);
vi.mock(
  "../../src/services/scheduling/schedulingPolicy.service.js",
  () => ({ getSchedulingPolicy }),
);
vi.mock(
  "../../src/services/availability/availabilityRegistrationWindow.service.js",
  () => ({
    createOrGetAvailabilityRegistrationWindow: vi.fn(),
    lockSubmissionsForClosedWindow: vi.fn(),
    isAvailabilityRegistrationWindowOpen,
  }),
);
vi.mock(
  "../../src/services/availability/availabilityRegistrationSchedule.service.js",
  () => ({
    buildAvailabilityRegistrationSchedule: vi.fn(),
    resolveAvailabilityWindowEffectiveStatus,
  }),
);

const staffQuery = (staff) => ({
  select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(staff) }),
});

const slot = (overrides = {}) => ({
  date: "2026-07-06T05:00:00.000Z",
  shiftType: "morning",
  status: "available",
  ...overrides,
});

const submitInput = (overrides = {}) => ({
  availabilityWindowId: "w1",
  employeeId: "e1",
  employmentType: "full_time",
  submissionType: "weekly_availability",
  slots: [slot(), slot({ shiftType: "afternoon" })],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockReturnValue(true);
  requireRestaurantAccess.mockResolvedValue(true);
  requireRoles.mockReturnValue(true);
  userHasAnyRole.mockReturnValue(false);
  resolveAvailabilityWindowEffectiveStatus.mockReturnValue("open");
  isAvailabilityRegistrationWindowOpen.mockReturnValue(true);
  models.AvailabilityRegistrationWindow.findById.mockResolvedValue({
    _id: "w1",
    restaurantId: "r1",
    periodStart: "2026-07-06T00:00:00.000+07:00",
    periodEnd: "2026-07-12T23:59:59.999+07:00",
    status: "open",
    openAt: new Date(Date.now() - 1_000),
    closeAt: new Date(Date.now() + 100_000),
    targetEmploymentTypes: ["part_time"],
    allowFullTimeUnavailableException: true,
    lateChangeRequiresApproval: true,
  });
  models.Staff.findById.mockReturnValue(
    staffQuery({
      _id: "e1",
      restaurantForStaff: "r1",
      employmentType: "part_time",
    }),
  );
  models.StaffAvailabilitySubmission.findOneAndUpdate.mockResolvedValue({
    status: "submitted",
  });
  getSchedulingPolicy.mockResolvedValue({
    shiftTemplates: [
      {
        key: "morning",
        startTime: "07:00",
        endTime: "11:00",
        enabled: true,
      },
      {
        key: "afternoon",
        startTime: "11:00",
        endTime: "15:00",
        enabled: true,
      },
    ],
    employmentTypePolicy: {
      part_time: { requireAvailability: true, minWeeklyHours: 8 },
      full_time: { requireAvailability: false, minWeeklyHours: 0 },
    },
    availabilityRegistrationPolicy: {
      targetEmploymentTypes: ["part_time"],
    },
  });
});

describe("availability employment validation", () => {
  it("stores the canonical staff employment type and ignores client status", async () => {
    const mutation = (
      await import("../../graphql/resolvers/availability/mutation.js")
    ).default;

    await mutation.submitStaffAvailability(
      null,
      { input: submitInput({ status: "approved" }) },
      { user: { id: "e1" } },
    );

    const update =
      models.StaffAvailabilitySubmission.findOneAndUpdate.mock.calls[0][1].$set;
    expect(update.employmentType).toBe("part_time");
    expect(update.submissionType).toBe("weekly_availability");
    expect(update.status).toBe("submitted");
  });

  it.each([
    [
      "wrong submission type",
      submitInput({ submissionType: "unavailable_exception" }),
      "AVAILABILITY_SUBMISSION_TYPE_MISMATCH",
    ],
    [
      "wrong slot status",
      submitInput({ slots: [slot({ status: "unavailable" })] }),
      "AVAILABILITY_SLOT_STATUS_MISMATCH",
    ],
    [
      "slot outside period",
      submitInput({ slots: [slot({ date: "2026-07-20T05:00:00.000Z" })] }),
      "AVAILABILITY_SLOT_OUTSIDE_PERIOD",
    ],
    [
      "duplicate slot",
      submitInput({ slots: [slot(), slot()] }),
      "AVAILABILITY_DUPLICATE_SLOT",
    ],
    [
      "minimum hours not met",
      submitInput({ slots: [slot()] }),
      "AVAILABILITY_MIN_WEEKLY_HOURS_NOT_MET",
    ],
  ])("rejects %s", async (_label, input, errorCode) => {
    const mutation = (
      await import("../../graphql/resolvers/availability/mutation.js")
    ).default;

    await expect(
      mutation.submitStaffAvailability(
        null,
        { input },
        { user: { id: "e1" } },
      ),
    ).rejects.toThrow(errorCode);
    expect(
      models.StaffAvailabilitySubmission.findOneAndUpdate,
    ).not.toHaveBeenCalled();
  });

  it("blocks unavailable exceptions when the window disables them", async () => {
    const mutation = (
      await import("../../graphql/resolvers/availability/mutation.js")
    ).default;
    models.Staff.findById.mockReturnValueOnce(
      staffQuery({
        _id: "e1",
        restaurantForStaff: "r1",
        employmentType: "full_time",
      }),
    );
    models.AvailabilityRegistrationWindow.findById.mockResolvedValueOnce({
      _id: "w1",
      restaurantId: "r1",
      periodStart: "2026-07-06T00:00:00.000+07:00",
      periodEnd: "2026-07-12T23:59:59.999+07:00",
      status: "open",
      openAt: new Date(Date.now() - 1_000),
      closeAt: new Date(Date.now() + 100_000),
      targetEmploymentTypes: ["part_time"],
      allowFullTimeUnavailableException: false,
      lateChangeRequiresApproval: true,
    });

    await expect(
      mutation.submitStaffAvailability(
        null,
        {
          input: submitInput({
            employmentType: "part_time",
            submissionType: "unavailable_exception",
            slots: [slot({ status: "unavailable" })],
          }),
        },
        { user: { id: "e1" } },
      ),
    ).rejects.toThrow("AVAILABILITY_UNAVAILABLE_EXCEPTION_DISABLED");
  });
});
