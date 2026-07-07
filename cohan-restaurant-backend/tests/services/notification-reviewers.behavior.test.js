import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Notification: {},
  Restaurant: { findById: vi.fn() },
  BrandMembership: { find: vi.fn() },
  User: { find: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);

const chain = (value) => ({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(value) });

describe("notification reviewer lookup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("uses active BrandMembership restaurant scope and includes system admin", async () => {
    modelMocks.Restaurant.findById.mockReturnValue(chain({ _id: "r1", brandId: "b1" }));
    modelMocks.BrandMembership.find.mockReturnValue(chain([{ userId: "manager-1" }, { userId: "inactive-would-not-be-returned" }]));
    modelMocks.User.find.mockReturnValue(chain([{ _id: "manager-1" }, { _id: "sys-admin" }]));

    const { reviewerIds } = await import("../../src/services/notification/notificationWorkflow.service.js");
    const ids = await reviewerIds("r1");

    expect(modelMocks.BrandMembership.find).toHaveBeenCalledWith(expect.objectContaining({
      brandId: "b1",
      status: "active",
      $or: expect.arrayContaining([
        { role: { $in: ["owner", "admin"] } },
        { role: { $in: ["manager", "staff"] }, restaurantIds: "r1" },
      ]),
    }));
    expect(modelMocks.User.find.mock.calls[0][0]).toMatchObject({
      $or: expect.arrayContaining([
        expect.objectContaining({ status: "active", deletedAt: null }),
        { userType: "ADMIN", status: "active", deletedAt: null },
      ]),
    });
    expect(JSON.stringify(modelMocks.User.find.mock.calls[0][0])).not.toContain("refRestaurants");
    expect(ids).toEqual(["manager-1", "sys-admin"]);
  });
});
