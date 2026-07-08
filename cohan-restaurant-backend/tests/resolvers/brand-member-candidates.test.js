import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Brand: {},
  BrandMembership: {
    find: vi.fn(),
  },
  Restaurant: {},
  User: {
    find: vi.fn(),
  },
  Role: {},
}));

const scopeMocks = vi.hoisted(() => ({
  canManageBrand: vi.fn(),
  canReadBrand: vi.fn(),
  ensureBrandRestaurants: vi.fn(),
  getScopedRestaurantFilter: vi.fn(),
  getUserId: vi.fn((user) => user?.id),
  isBrandOwner: vi.fn(),
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
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((value) =>
      value === "brand-1" || /^[a-f\d]{24}$/i.test(String(value)),
    ),
    Types: {
      ObjectId: function ObjectId(value) {
        this.value = value;
      },
    },
  },
}));

const membershipFindChain = (rows) => ({
  select: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue(rows),
  }),
});

const userFindChain = (rows) => {
  const chain = {
    select: vi.fn(),
    sort: vi.fn(),
    limit: vi.fn(),
    lean: vi.fn().mockResolvedValue(rows),
  };
  chain.select.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
};

describe("brandMemberCandidates", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    scopeMocks.canManageBrand.mockResolvedValue(true);
  });

  it("requires brand-management permission", async () => {
    scopeMocks.canManageBrand.mockResolvedValue(false);
    const resolver = (await import("../../graphql/resolvers/brand/index.js")).default;

    await expect(
      resolver.Query.brandMemberCandidates(
        null,
        { brandId: "brand-1", search: "Lan" },
        { user: { id: "actor-1" } },
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });

    expect(modelMocks.BrandMembership.find).not.toHaveBeenCalled();
    expect(modelMocks.User.find).not.toHaveBeenCalled();
  });

  it("escapes search, excludes existing members, caps the limit and maps safe fields", async () => {
    modelMocks.BrandMembership.find.mockReturnValue(
      membershipFindChain([{ userId: "existing-1" }]),
    );
    const userChain = userFindChain([
      {
        _id: "candidate-1",
        fullName: "Lan Anh",
        username: "lan.anh",
        email: "lan@cohan.vn",
        userType: "STAFF",
        status: "active",
        phone: "0900000000",
      },
    ]);
    modelMocks.User.find.mockReturnValue(userChain);
    const resolver = (await import("../../graphql/resolvers/brand/index.js")).default;

    const result = await resolver.Query.brandMemberCandidates(
      null,
      { brandId: "brand-1", search: "Lan.*", limit: 999 },
      { user: { id: "actor-1" } },
    );

    const filter = modelMocks.User.find.mock.calls[0][0];
    expect(filter).toMatchObject({
      deletedAt: null,
      status: "active",
      userType: {
        $in: ["CUSTOMER", "STAFF", "MANAGER", "HR", "ACCOUNTANT", "ADMIN"],
      },
      _id: { $nin: ["existing-1"] },
    });
    expect(filter.$or).toHaveLength(3);
    expect(filter.$or[0].fullName.test("Lan.*")).toBe(true);
    expect(filter.$or[0].fullName.test("Lan Anh")).toBe(false);
    expect(userChain.select).toHaveBeenCalledWith(
      "_id fullName username email userType status",
    );
    expect(userChain.sort).toHaveBeenCalledWith({ fullName: 1, _id: 1 });
    expect(userChain.limit).toHaveBeenCalledWith(50);
    expect(result).toEqual([
      {
        id: "candidate-1",
        fullName: "Lan Anh",
        username: "lan.anh",
        email: "lan@cohan.vn",
        userType: "STAFF",
        status: "active",
      },
    ]);
  });
});
