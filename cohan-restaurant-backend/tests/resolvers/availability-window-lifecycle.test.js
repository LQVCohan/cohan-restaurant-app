import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  AvailabilityRegistrationWindow: {
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  SchedulePublication: {
    exists: vi.fn(),
  },
}));
const guardMocks = vi.hoisted(() => ({
  requireRoles: vi.fn(),
  requireRestaurantAccess: vi.fn(),
}));
const policyMocks = vi.hoisted(() => ({
  getSchedulingPolicy: vi.fn(),
}));
const windowServiceMocks = vi.hoisted(() => ({
  createOrGetAvailabilityRegistrationWindow: vi.fn(),
  lockSubmissionsForClosedWindow: vi.fn(),
}));
const scheduleMocks = vi.hoisted(() => ({
  buildAvailabilityRegistrationSchedule: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => policyMocks);
vi.mock(
  "../../src/services/availability/availabilityRegistrationWindow.service.js",
  () => windowServiceMocks,
);
vi.mock(
  "../../src/services/availability/availabilityRegistrationSchedule.service.js",
  () => scheduleMocks,
);

const ctx = {
  user: { id: "manager-1", roleName: "manager" },
};
const periodStart = new Date("2026-07-12T17:00:00.000Z");
const periodEnd = new Date("2026-07-19T16:59:59.999Z");

const loadMutation = async () =>
  (await import("../../graphql/resolvers/availability/windowLifecycle.mutation.js"))
    .default;

describe("availability window lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue();
    policyMocks.getSchedulingPolicy.mockResolvedValue({
      availabilityRegistrationPolicy: {
        targetEmploymentTypes: ["part_time"],
        lateChangeRequiresApproval: true,
      },
    });
    scheduleMocks.buildAvailabilityRegistrationSchedule.mockReturnValue({
      periodStart,
      periodEnd,
      openAt: new Date("2026-07-05T17:00:00.000Z"),
      closeAt: new Date("2026-07-08T16:59:00.000Z"),
      mode: "manual",
    });
    modelMocks.SchedulePublication.exists.mockResolvedValue(false);
    windowServiceMocks.createOrGetAvailabilityRegistrationWindow.mockResolvedValue({
      _id: "window-1",
      status: "open",
    });
  });

  it("creates a manual window already open using canonical boundaries", async () => {
    const mutation = await loadMutation();
    const result = await mutation.createAvailabilityWindow(
      null,
      {
        input: {
          restaurantId: "restaurant-1",
          periodStart: "raw-start",
          periodEnd: "raw-end",
        },
      },
      ctx,
    );

    expect(result.status).toBe("open");
    expect(
      windowServiceMocks.createOrGetAvailabilityRegistrationWindow.mock.calls[0][0],
    ).toMatchObject({
      restaurantId: "restaurant-1",
      periodStart,
      periodEnd,
      status: "open",
      registrationModeSnapshot: "manual",
    });
  });

  it("blocks creating a registration window over a published schedule", async () => {
    const mutation = await loadMutation();
    modelMocks.SchedulePublication.exists.mockResolvedValue(true);

    await expect(
      mutation.createAvailabilityWindow(
        null,
        {
          input: {
            restaurantId: "restaurant-1",
            periodStart: "raw-start",
            periodEnd: "raw-end",
          },
        },
        ctx,
      ),
    ).rejects.toThrow("AVAILABILITY_WINDOW_SCHEDULE_ALREADY_PUBLISHED");
    expect(
      windowServiceMocks.createOrGetAvailabilityRegistrationWindow,
    ).not.toHaveBeenCalled();
  });

  it("reopens only draft or closed windows and clears close metadata atomically", async () => {
    const mutation = await loadMutation();
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({
      _id: "window-1",
      restaurantId: "restaurant-1",
      periodStart,
      periodEnd,
      status: "closed",
    });
    modelMocks.AvailabilityRegistrationWindow.findOneAndUpdate.mockResolvedValue({
      _id: "window-1",
      status: "open",
    });

    await mutation.openAvailabilityWindow(null, { id: "window-1" }, ctx);

    expect(
      modelMocks.AvailabilityRegistrationWindow.findOneAndUpdate,
    ).toHaveBeenCalledWith(
      { _id: "window-1", status: { $in: ["draft", "closed"] } },
      {
        $set: { status: "open" },
        $unset: { closedAt: "", closedBy: "" },
      },
      { new: true },
    );
  });

  it("rejects reopening a window already used for scheduling", async () => {
    const mutation = await loadMutation();
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({
      _id: "window-1",
      restaurantId: "restaurant-1",
      periodStart,
      periodEnd,
      status: "used_for_schedule",
    });

    await expect(
      mutation.openAvailabilityWindow(null, { id: "window-1" }, ctx),
    ).rejects.toThrow("AVAILABILITY_WINDOW_INVALID_OPEN_TRANSITION");
  });

  it("closes only an open window and locks its submissions", async () => {
    const mutation = await loadMutation();
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({
      _id: "window-1",
      restaurantId: "restaurant-1",
      periodStart,
      periodEnd,
      status: "open",
    });
    modelMocks.AvailabilityRegistrationWindow.findOneAndUpdate.mockResolvedValue({
      _id: "window-1",
      status: "closed",
    });

    await mutation.closeAvailabilityWindow(null, { id: "window-1" }, ctx);

    expect(
      windowServiceMocks.lockSubmissionsForClosedWindow,
    ).toHaveBeenCalledWith("window-1", expect.any(Date));
  });
});
