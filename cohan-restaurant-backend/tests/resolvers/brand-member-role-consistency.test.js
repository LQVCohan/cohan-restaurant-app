import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  User: { findById: vi.fn() },
  BrandMembership: { findById: vi.fn() },
}));

const scopeMocks = vi.hoisted(() => ({
  canManageBrand: vi.fn().mockResolvedValue(true),
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

describe("brand member role consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMocks.canManageBrand.mockResolvedValue(true);
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

  it("does not block deactivation of an incompatible legacy membership", async () => {
    modelMocks.BrandMembership.findById.mockReturnValue(
      membershipQuery({
        brandId: "brand-1",
        userId: "user-1",
        role: "manager",
        status: "active",
      }),
    );
    const updateBrandMember = vi.fn().mockResolvedValue({ id: "membership-1" });
    const { guardBrandMemberRoleMutations } = await import(
      "../../graphql/resolvers/brand/memberRoleConsistency.js"
    );
    const guarded = guardBrandMemberRoleMutations({
      addBrandMember: vi.fn(),
      updateBrandMember,
    });

    await expect(
      guarded.updateBrandMember(
        null,
        { input: { id: "membership-1", status: "inactive" } },
        { user: { id: "owner-1" } },
      ),
    ).resolves.toEqual({ id: "membership-1" });
    expect(modelMocks.User.findById).not.toHaveBeenCalled();
    expect(updateBrandMember).toHaveBeenCalledTimes(1);
  });

  it("rejects suspending the active Brand owner", async () => {
    modelMocks.BrandMembership.findById.mockReturnValue(
      membershipQuery({
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
    });

    await expect(
      guarded.updateBrandMember(
        null,
        { input: { id: "membership-owner", status: "inactive" } },
        { user: { id: "owner-1" } },
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining("Không thể tạm ngưng Chủ chuỗi"),
      extensions: { code: "FORBIDDEN" },
    });
    expect(updateBrandMember).not.toHaveBeenCalled();
  });
});
