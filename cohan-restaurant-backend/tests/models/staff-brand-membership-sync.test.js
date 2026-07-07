import { beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ preSave: null, postSave: null }));
const restaurantMock = vi.hoisted(() => ({ findById: vi.fn() }));
const membershipMock = vi.hoisted(() => ({ findOneAndUpdate: vi.fn() }));
const userMock = vi.hoisted(() => ({ discriminator: vi.fn(() => ({ modelName: "Staff" })) }));

vi.mock("mongoose", () => {
  class Schema {
    pre(name, handler) {
      if (name === "save") hooks.preSave = handler;
    }

    post(name, handler) {
      if (name === "save") hooks.postSave = handler;
    }
  }

  return {
    default: {
      Schema,
      models: {},
    },
  };
});

vi.mock("../../models/user.model.js", () => ({ default: userMock }));
vi.mock("../../models/restaurant.model.js", () => ({ default: restaurantMock }));
vi.mock("../../models/brandMembership.model.js", () => ({ default: membershipMock }));

import { syncCreatedStaffBrandMembership } from "../../models/staff.model.js";

function mockRestaurant(result) {
  const lean = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ lean }));
  restaurantMock.findById.mockReturnValue({ select });
  return { select, lean };
}

describe("new Staff BrandMembership synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an active staff membership for the selected restaurant Brand", async () => {
    mockRestaurant({ _id: "restaurant-1", brandId: "brand-1" });
    membershipMock.findOneAndUpdate.mockResolvedValue({ _id: "membership-1" });

    await syncCreatedStaffBrandMembership({
      _id: "staff-1",
      restaurantForStaff: "restaurant-1",
    });

    expect(membershipMock.findOneAndUpdate).toHaveBeenCalledWith(
      { brandId: "brand-1", userId: "staff-1" },
      {
        $set: {
          role: "staff",
          restaurantIds: ["restaurant-1"],
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

  it("rejects creation when the restaurant has no Brand", async () => {
    mockRestaurant({ _id: "restaurant-1", brandId: null });

    await expect(
      syncCreatedStaffBrandMembership({
        _id: "staff-1",
        restaurantForStaff: "restaurant-1",
      }),
    ).rejects.toThrow("Nhà hàng phải thuộc Brand trước khi thêm nhân viên");

    expect(membershipMock.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("removes the new Staff document when membership synchronization fails", async () => {
    const syncError = new Error("MEMBERSHIP_WRITE_FAILED");
    mockRestaurant({ _id: "restaurant-1", brandId: "brand-1" });
    membershipMock.findOneAndUpdate.mockRejectedValue(syncError);

    const staff = {
      _id: "staff-1",
      restaurantForStaff: "restaurant-1",
      isNew: true,
      $locals: {},
      deleteOne: vi.fn().mockResolvedValue(undefined),
    };

    hooks.preSave.call(staff);

    await expect(hooks.postSave(staff)).rejects.toThrow(
      "MEMBERSHIP_WRITE_FAILED",
    );
    expect(staff.deleteOne).toHaveBeenCalledTimes(1);
  });
});
