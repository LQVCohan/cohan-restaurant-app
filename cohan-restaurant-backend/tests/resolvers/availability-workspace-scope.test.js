import { beforeEach, describe, expect, it, vi } from "vitest";

const models = vi.hoisted(() => ({
  AvailabilityRegistrationWindow: {
    findById: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
  },
  Staff: { findById: vi.fn() },
}));

vi.mock("../../models/index.js", () => models);
vi.mock("../../graphql/guards.js", () => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: vi.fn(),
}));
vi.mock(
  "../../src/services/scheduling/schedulingPermission.service.js",
  () => ({
    AVAILABILITY_READ_ROLES: ["ADMIN", "MANAGER"],
    userHasAnyRole: vi.fn(() => false),
  }),
);

import {
  resolveStaffAvailabilityWorkspace,
  withAvailabilityWorkspaceMutations,
} from "../../graphql/resolvers/availability/workspaceScope.js";

const staffQuery = (staff) => ({
  select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(staff) }),
});

describe("availability workspace classification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("classifies the three schedule types independently", () => {
    expect(
      resolveStaffAvailabilityWorkspace({
        employmentType: "full_time",
        shiftType: "fixed",
      }),
    ).toBe("full_time");
    expect(
      resolveStaffAvailabilityWorkspace({
        employmentType: "part_time",
        shiftType: "fixed",
      }),
    ).toBe("part_time");
    expect(
      resolveStaffAvailabilityWorkspace({
        employmentType: "full_time",
        shiftType: "ROTATING",
      }),
    ).toBe("rotating");
  });

  it("adds workspace-specific defaults when a manager creates a window", async () => {
    const createAvailabilityWindow = vi.fn(async (_, { input }) => input);
    const wrapped = withAvailabilityWorkspaceMutations({
      createAvailabilityWindow,
      submitStaffAvailability: vi.fn(),
    });

    const result = await wrapped.createAvailabilityWindow(
      null,
      {
        input: {
          restaurantId: "r1",
          periodStart: "2026-07-20T00:00:00.000Z",
          periodEnd: "2026-07-26T23:59:59.999Z",
          workspaceType: "rotating",
        },
      },
      { user: { id: "manager-1" } },
    );

    expect(result.workspaceType).toBe("rotating");
    expect(result.targetEmploymentTypes).toEqual([
      "full_time",
      "part_time",
      "probation",
      "seasonal",
      "contract",
    ]);
    expect(result.allowFullTimeUnavailableException).toBe(false);
  });

  it("blocks a rotating employee from submitting to a full-time window", async () => {
    const submitStaffAvailability = vi.fn();
    const wrapped = withAvailabilityWorkspaceMutations({
      createAvailabilityWindow: vi.fn(),
      submitStaffAvailability,
    });

    models.AvailabilityRegistrationWindow.findById.mockResolvedValue({
      _id: "w1",
      workspaceType: "full_time",
    });
    models.Staff.findById.mockReturnValue(
      staffQuery({
        _id: "e1",
        employmentType: "full_time",
        shiftType: "rotating",
      }),
    );

    await expect(
      wrapped.submitStaffAvailability(
        null,
        { input: { availabilityWindowId: "w1", employeeId: "e1" } },
        { user: { id: "e1" } },
      ),
    ).rejects.toThrow("AVAILABILITY_WORKSPACE_MISMATCH");
    expect(submitStaffAvailability).not.toHaveBeenCalled();
  });

  it("allows an employee to submit to the matching workspace", async () => {
    const submitStaffAvailability = vi.fn(async () => ({ id: "s1" }));
    const wrapped = withAvailabilityWorkspaceMutations({
      createAvailabilityWindow: vi.fn(),
      submitStaffAvailability,
    });

    models.AvailabilityRegistrationWindow.findById.mockResolvedValue({
      _id: "w2",
      workspaceType: "part_time",
    });
    models.Staff.findById.mockReturnValue(
      staffQuery({
        _id: "e2",
        employmentType: "seasonal",
        shiftType: "fixed",
      }),
    );

    await expect(
      wrapped.submitStaffAvailability(
        null,
        { input: { availabilityWindowId: "w2", employeeId: "e2" } },
        { user: { id: "e2" } },
      ),
    ).resolves.toEqual({ id: "s1" });
    expect(submitStaffAvailability).toHaveBeenCalledTimes(1);
  });
});
