import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  User: { findById: vi.fn(), updateOne: vi.fn() },
  Role: { findOne: vi.fn() },
  BrandMembership: {
    findById: vi.fn(),
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    updateOne: vi.fn(),
  },
}));

const scopeMocks = vi.hoisted(() => ({
  canManageBrand: vi.fn().mockResolvedValue(true),
  getUserId: vi.fn((user) => user?.id),
}));

const notificationMocks = vi.hoisted(() => ({
  notifyUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", () => scopeMocks);
vi.mock(
  "../../src/services/notification/notificationWorkflow.service.js",
  () => notificationMocks,
);

const userQuery = (value) => ({
  populate: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue(value),
  }),
});

const leanQuery = (value) => ({
  lean: vi.fn().mockResolvedValue(value),
});

describe("brand invitation in-app notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMocks.canManageBrand.mockResolvedValue(true);
    scopeMocks.getUserId.mockImplementation((user) => user?.id);
    notificationMocks.notifyUser.mockResolvedValue(null);
    modelMocks.BrandMembership.updateOne.mockResolvedValue({ modifiedCount: 1 });
    modelMocks.User.findById.mockReturnValue(
      userQuery({ role: { slug: "manager" }, userType: "MANAGER" }),
    );
  });

  it("notifies the invitee after both the initial email and a resent invitation", async () => {
    const initialInvitation = {
      _id: "membership-1",
      brandId: "brand-1",
      userId: "user-1",
      role: "manager",
      status: "invited",
      restaurantIds: ["restaurant-1"],
      invitedAt: new Date("2026-07-08T08:00:00.000Z"),
    };
    const resentInvitation = {
      ...initialInvitation,
      invitedAt: new Date("2026-07-08T09:00:00.000Z"),
    };

    modelMocks.BrandMembership.findById.mockReturnValue(
      leanQuery(initialInvitation),
    );

    const addBrandMember = vi.fn().mockResolvedValue(initialInvitation);
    const resendBrandInvitation = vi.fn().mockResolvedValue(resentInvitation);
    const { guardBrandMemberRoleMutations } = await import(
      "../../graphql/resolvers/brand/memberRoleConsistency.js"
    );
    const guarded = guardBrandMemberRoleMutations({
      addBrandMember,
      resendBrandInvitation,
      updateBrandMember: vi.fn(),
      removeBrandMember: vi.fn(),
    });

    await guarded.addBrandMember(
      null,
      {
        input: {
          brandId: "brand-1",
          userId: "user-1",
          role: "manager",
          restaurantIds: ["restaurant-1"],
        },
      },
      { user: { id: "owner-1" } },
    );
    await guarded.resendBrandInvitation(
      null,
      { id: "membership-1" },
      { user: { id: "owner-1" } },
    );

    expect(addBrandMember).toHaveBeenCalledTimes(1);
    expect(resendBrandInvitation).toHaveBeenCalledTimes(1);
    expect(notificationMocks.notifyUser).toHaveBeenCalledTimes(2);
    expect(notificationMocks.notifyUser).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: "user-1",
        restaurantId: "restaurant-1",
        type: "brand_invitation",
        payload: expect.objectContaining({
          title: "Lời mời tham gia chuỗi",
          membershipId: "membership-1",
          membershipRole: "manager",
          message: expect.stringContaining("Vui lòng kiểm tra email để xác nhận"),
        }),
        sourceType: "brand_invitation",
        sourceId: `membership-1:${initialInvitation.invitedAt.getTime()}`,
      }),
    );
    expect(notificationMocks.notifyUser).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sourceId: `membership-1:${resentInvitation.invitedAt.getTime()}`,
      }),
    );
  });
});
