import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Brand: {},
  BrandMembership: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  Restaurant: {},
  User: {
    exists: vi.fn(),
  },
  Role: {},
}));

const scopeMocks = vi.hoisted(() => ({
  canManageBrand: vi.fn(),
  canReadBrand: vi.fn(),
  ensureBrandRestaurants: vi.fn(),
  getScopedRestaurantFilter: vi.fn(),
  getUserId: vi.fn((user) => user?.id),
  isSystemAdmin: vi.fn(() => false),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../models/brandMembership.model.js", () => ({
  validateBrandMembershipScope: vi.fn((input) => input.restaurantIds || []),
}));
vi.mock("../../src/security/authTokens.js", () => ({
  signAccessToken: vi.fn(),
  issueRefreshToken: vi.fn(),
}));
vi.mock("../../src/security/sanitizeUserForClient.js", () => ({
  sanitizeUserForClient: vi.fn((user) => user),
}));
vi.mock("../../src/services/auth/restaurantScope.service.js", () => scopeMocks);
vi.mock("../../graphql/resolvers/brand/transferBrandOwnership.js", () => ({
  default: vi.fn(),
}));
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: {
      ObjectId: function ObjectId(value) {
        this.value = String(value);
      },
    },
  },
}));

const selectedLean = (value) => ({
  select: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue(value),
  }),
});

describe("Brand owner mutation guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMocks.canManageBrand.mockResolvedValue(true);
    modelMocks.User.exists.mockResolvedValue(true);
  });

  it("does not let addBrandMember demote an existing owner through upsert", async () => {
    modelMocks.BrandMembership.findOne.mockReturnValue(
      selectedLean({ role: "owner" }),
    );
    const resolver = (await import("../../graphql/resolvers/brand/index.js")).default;

    await expect(
      resolver.Mutation.addBrandMember(
        null,
        {
          input: {
            brandId: "brand-1",
            userId: "owner-1",
            role: "manager",
            restaurantIds: ["restaurant-1"],
          },
        },
        { user: { id: "actor-1" } },
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });

    expect(scopeMocks.ensureBrandRestaurants).not.toHaveBeenCalled();
    expect(modelMocks.BrandMembership.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
