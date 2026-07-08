import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  legacyCreateStaff: vi.fn(),
  requireRestaurantAccess: vi.fn(async () => true),
  Restaurant: { findById: vi.fn() },
  BrandMembership: { findOneAndUpdate: vi.fn() },
  Staff: { deleteOne: vi.fn() },
}));

vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((value) => Boolean(value)),
  },
}));

vi.mock("../../models/index.js", () => ({
  Restaurant: mocks.Restaurant,
  BrandMembership: mocks.BrandMembership,
  Staff: mocks.Staff,
}));

vi.mock("../../graphql/guards.js", () => ({
  requireAuth: vi.fn(),
  requireRestaurantAccess: mocks.requireRestaurantAccess,
}));

vi.mock("../../graphql/resolvers/staff/query.js", () => ({ default: {} }));
vi.mock("../../graphql/resolvers/staff/payrollReadiness.query.js", () => ({
  default: {},
}));
vi.mock("../../graphql/resolvers/staff/mutation.js", () => ({
  default: { createStaff: mocks.legacyCreateStaff },
}));
vi.mock("../../graphql/resolvers/staff/staffAvatar.mutation.js", () => ({
  default: {},
}));
vi.mock(
  "../../graphql/resolvers/staff/payrollFinalizeReadiness.mutation.js",
  () => ({ default: {} }),
);
vi.mock(
  "../../graphql/resolvers/staff/payrollProtectedAttendance.mutation.js",
  () => ({ default: {} }),
);

const mockRestaurant = (restaurant) => {
  mocks.Restaurant.findById.mockReturnValue({
    select: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue(restaurant),
    })),
  });
};

const createArgs = {
  input: {
    fullName: "Nhân viên mới",
    staffBusinessContext: {
      brandId: "brand-active",
      restaurantId: "restaurant-active",
    },
  },
};

const context = { user: { id: "manager-1" } };

describe("createStaff active business context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRestaurant({ _id: "restaurant-active", brandId: "brand-active" });
    mocks.legacyCreateStaff.mockResolvedValue({ id: "staff-1" });
    mocks.BrandMembership.findOneAndUpdate.mockResolvedValue({
      id: "membership-1",
    });
    mocks.Staff.deleteOne.mockResolvedValue({ deletedCount: 1 });
  });

  it("creates the membership from explicit business context without account restaurant data", async () => {
    const resolvers = (
      await import("../../graphql/resolvers/staff/index.js")
    ).default;

    const created = await resolvers.Mutation.createStaff(
      null,
      createArgs,
      context,
    );

    expect(created).toEqual({ id: "staff-1" });
    expect(mocks.requireRestaurantAccess).toHaveBeenCalledWith(
      context,
      "restaurant-active",
    );
    expect(mocks.legacyCreateStaff).toHaveBeenCalledWith(
      null,
      {
        input: {
          fullName: "Nhân viên mới",
          restaurantForStaff: "restaurant-active",
        },
      },
      context,
      undefined,
    );
    expect(mocks.BrandMembership.findOneAndUpdate).toHaveBeenCalledWith(
      { brandId: "brand-active", userId: "staff-1" },
      {
        $set: {
          role: "staff",
          restaurantIds: ["restaurant-active"],
          status: "active",
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
  });

  it("rejects a restaurant outside the active business before creating the account", async () => {
    mockRestaurant({ _id: "restaurant-active", brandId: "brand-other" });
    const resolvers = (
      await import("../../graphql/resolvers/staff/index.js")
    ).default;

    await expect(
      resolvers.Mutation.createStaff(null, createArgs, context),
    ).rejects.toThrow("Nhà hàng không thuộc doanh nghiệp đang hoạt động");

    expect(mocks.legacyCreateStaff).not.toHaveBeenCalled();
    expect(mocks.BrandMembership.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("removes the new account when membership synchronization fails", async () => {
    mocks.BrandMembership.findOneAndUpdate.mockRejectedValue(
      new Error("MEMBERSHIP_WRITE_FAILED"),
    );
    const resolvers = (
      await import("../../graphql/resolvers/staff/index.js")
    ).default;

    await expect(
      resolvers.Mutation.createStaff(null, createArgs, context),
    ).rejects.toThrow("MEMBERSHIP_WRITE_FAILED");

    expect(mocks.Staff.deleteOne).toHaveBeenCalledWith({ _id: "staff-1" });
  });
});
