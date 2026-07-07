import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  User: { findById: vi.fn() },
  BrandMembership: { findById: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);

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
});
