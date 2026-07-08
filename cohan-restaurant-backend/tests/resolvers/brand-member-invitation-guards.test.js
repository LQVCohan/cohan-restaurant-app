import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  BrandMembership: {
    findById: vi.fn(),
  },
  User: {
    findById: vi.fn(),
  },
}));

const scopeMocks = vi.hoisted(() => ({
  canManageBrand: vi.fn(),
  getUserId: vi.fn((user) => user?.id),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", () => scopeMocks);

const selectedLean = (value) => ({
  select: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue(value),
  }),
});

describe("Brand invitation mutation guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMocks.canManageBrand.mockResolvedValue(true);
  });

  it("requires an invited member to accept the email link before activation", async () => {
    modelMocks.BrandMembership.findById.mockReturnValue(selectedLean({
      brandId: "brand-1",
      userId: "user-1",
      role: "manager",
      status: "invited",
    }));
    const updateBrandMember = vi.fn();
    const { guardBrandMemberRoleMutations } = await import(
      "../../graphql/resolvers/brand/memberRoleConsistency.js"
    );
    const guarded = guardBrandMemberRoleMutations({ updateBrandMember });

    await expect(
      guarded.updateBrandMember(
        null,
        { input: { id: "membership-1", status: "active" } },
        { user: { id: "owner-1" } },
        {},
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });

    expect(updateBrandMember).not.toHaveBeenCalled();
  });

  it("lets the invitation resolver create a new account from a synthetic email candidate", async () => {
    const addBrandMember = vi.fn().mockResolvedValue({ status: "invited" });
    const { guardBrandMemberRoleMutations } = await import(
      "../../graphql/resolvers/brand/memberRoleConsistency.js"
    );
    const guarded = guardBrandMemberRoleMutations({ addBrandMember });
    const input = {
      brandId: "brand-1",
      userId: "invite:manager@example.com",
      role: "manager",
      restaurantIds: ["restaurant-1"],
    };

    await expect(
      guarded.addBrandMember(null, { input }, { user: { id: "owner-1" } }, {}),
    ).resolves.toEqual({ status: "invited" });

    expect(modelMocks.User.findById).not.toHaveBeenCalled();
    expect(addBrandMember).toHaveBeenCalledWith(
      null,
      { input },
      { user: { id: "owner-1" } },
      {},
    );
  });
});
