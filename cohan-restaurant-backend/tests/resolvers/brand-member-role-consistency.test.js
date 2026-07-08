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

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", () => scopeMocks);

const userQuery = (value) => ({
  populate: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue(value),
  }),
});

const membershipQuery = (value) => ({
  select: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue(value),
  }),
});

const leanQuery = (value) => ({
  lean: vi.fn().mockResolvedValue(value),
});

describe("brand member role consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMocks.canManageBrand.mockResolvedValue(true);
    scopeMocks.getUserId.mockImplementation((user) => user?.id);
    modelMocks.BrandMembership.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it("rejects system admin as a branch manager", async () => {
    modelMocks.User.findById.mockReturnValue(
      userQuery({ role: { slug: "admin" } }),
    );
    const { assertBrandMembershipAccountCompatibility } = await import(
      "../../graphql/resolvers/brand/memberRoleConsistency.js"
    );

    await expect(
      assertBrandMembershipAccountCompatibility({
        userId: "user-1",
        membershipRole: "manager",
      }),
    ).rejects.toMatchObject({ extensions: { code: "BAD_USER_INPUT" } });
  });

  it("allows a manager account to receive one-branch manager membership", async () => {
    modelMocks.User.findById.mockReturnValue(
      userQuery({ role: { slug: "manager" } }),
    );
    const { assertBrandMembershipAccountCompatibility } = await import(
      "../../graphql/resolvers/brand/memberRoleConsistency.js"
    );

    await expect(
      assertBrandMembershipAccountCompatibility({
        userId: "user-1",
        membershipRole: "manager",
      }),
    ).resolves.toMatchObject({ role: { slug: "manager" } });
  });

  it("soft-revokes an active membership without changing the User account", async () => {
    const membership = {
      _id: "membership-1",
      brandId: "brand-1",
      userId: "user-1",
      role: "manager",
      status: "active",
      revokedFromStatus: null,
    };
    const revokedMembership = {
      ...membership,
      status: "inactive",
      revokedFromStatus: "active",
      revokedReason: "Tháo quyền từ trang quản lý chuỗi",
      inviteTokenHash: null,
      inviteTokenExp: null,
    };
    modelMocks.BrandMembership.findById.mockReturnValue(
      membershipQuery(membership),
    );
    modelMocks.BrandMembership.findByIdAndUpdate.mockReturnValue(
      leanQuery(revokedMembership),
    );
    const updateBrandMember = vi.fn();
    const { guardBrandMemberRoleMutations } = await import(
      "../../graphql/resolvers/brand/memberRoleConsistency.js"
    );
    const guarded = guardBrandMemberRoleMutations({
      addBrandMember: vi.fn(),
      updateBrandMember,
      removeBrandMember: vi.fn(),
    });

    await expect(
      guarded.updateBrandMember(
        null,
        { input: { id: "membership-1", status: "inactive" } },
        { user: { id: "owner-1" } },
      ),
    ).resolves.toEqual(revokedMembership);

    expect(modelMocks.User.findById).not.toHaveBeenCalled();
    expect(modelMocks.User.updateOne).not.toHaveBeenCalled();
    expect(updateBrandMember).not.toHaveBeenCalled();
    expect(modelMocks.BrandMembership.findByIdAndUpdate).toHaveBeenCalledWith(
      "membership-1",
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "inactive",
          revokedAt: expect.any(Date),
          revokedBy: "owner-1",
          revokedFromStatus: "active",
          inviteTokenHash: null,
          inviteTokenExp: null,
        }),
      }),
      { new: true },
    );
  });

  it("rejects revoking the active Brand owner", async () => {
    modelMocks.BrandMembership.findById.mockReturnValue(
      membershipQuery({
        _id: "membership-owner",
        brandId: "brand-1",
        userId: "owner-1",
        role: "owner",
        status: "active",
      }),
    );
    const updateBrandMember = vi.fn();
    const { guardBrandMemberRoleMutations } = await import(
      "../../graphql/resolvers/brand/memberRoleConsistency.js"
    );
    const guarded = guardBrandMemberRoleMutations({
      addBrandMember: vi.fn(),
      updateBrandMember,
      removeBrandMember: vi.fn(),
    });

    await expect(
      guarded.updateBrandMember(
        null,
        { input: { id: "membership-owner", status: "inactive" } },
        { user: { id: "owner-1" } },
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining("Không thể tháo quyền Chủ chuỗi"),
      extensions: { code: "FORBIDDEN" },
    });
    expect(updateBrandMember).not.toHaveBeenCalled();
  });

  it("rejects an administrator removing their own membership", async () => {
    modelMocks.BrandMembership.findById.mockReturnValue(
      membershipQuery({
        _id: "membership-admin",
        brandId: "brand-1",
        userId: "admin-1",
        role: "admin",
        status: "active",
      }),
    );
    const removeBrandMember = vi.fn();
    const { guardBrandMemberRoleMutations } = await import(
      "../../graphql/resolvers/brand/memberRoleConsistency.js"
    );
    const guarded = guardBrandMemberRoleMutations({
      addBrandMember: vi.fn(),
      updateBrandMember: vi.fn(),
      removeBrandMember,
    });

    await expect(
      guarded.removeBrandMember(
        null,
        { id: "membership-admin" },
        { user: { id: "admin-1" } },
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining("không thể tự tháo quyền"),
      extensions: { code: "FORBIDDEN" },
    });
    expect(removeBrandMember).not.toHaveBeenCalled();
  });

  it("requires the Brand owner to revoke another Brand administrator", async () => {
    modelMocks.BrandMembership.findById.mockReturnValue(
      membershipQuery({
        _id: "membership-admin-2",
        brandId: "brand-1",
        userId: "admin-2",
        role: "admin",
        status: "active",
      }),
    );
    modelMocks.BrandMembership.findOne.mockReturnValue(leanQuery(null));
    const { guardBrandMemberRoleMutations } = await import(
      "../../graphql/resolvers/brand/memberRoleConsistency.js"
    );
    const removeBrandMember = vi.fn();
    const guarded = guardBrandMemberRoleMutations({
      addBrandMember: vi.fn(),
      updateBrandMember: vi.fn(),
      removeBrandMember,
    });

    await expect(
      guarded.removeBrandMember(
        null,
        { id: "membership-admin-2" },
        { user: { id: "admin-1" } },
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining("Chỉ Chủ chuỗi"),
      extensions: { code: "FORBIDDEN" },
    });
    expect(removeBrandMember).not.toHaveBeenCalled();
  });

  it("rejects direct activation of a cancelled invitation", async () => {
    modelMocks.BrandMembership.findById.mockReturnValue(
      membershipQuery({
        _id: "membership-invite",
        brandId: "brand-1",
        userId: "user-1",
        role: "manager",
        status: "inactive",
        revokedFromStatus: "invited",
      }),
    );
    const updateBrandMember = vi.fn();
    const { guardBrandMemberRoleMutations } = await import(
      "../../graphql/resolvers/brand/memberRoleConsistency.js"
    );
    const guarded = guardBrandMemberRoleMutations({
      addBrandMember: vi.fn(),
      updateBrandMember,
      removeBrandMember: vi.fn(),
    });

    await expect(
      guarded.updateBrandMember(
        null,
        { input: { id: "membership-invite", status: "active" } },
        { user: { id: "owner-1" } },
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining("phải được gửi lại"),
      extensions: { code: "BAD_USER_INPUT" },
    });
    expect(updateBrandMember).not.toHaveBeenCalled();
  });
});
