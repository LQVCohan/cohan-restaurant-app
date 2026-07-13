import { GraphQLError } from "graphql";

const requireRoleMock = vi.hoisted(() => vi.fn());
const requireRestaurantAccessMock = vi.hoisted(() => vi.fn(async () => true));
const requireRestaurantPermissionMock = vi.hoisted(() => vi.fn(async () => true));

const createChain = (result) => ({
  populate: vi.fn(() => ({
    sort: vi.fn(() => ({ lean: vi.fn(async () => result) })),
    lean: vi.fn(async () => result),
  })),
  sort: vi.fn(() => ({ lean: vi.fn(async () => result) })),
  lean: vi.fn(async () => result),
});

const CustomerMock = vi.hoisted(() => {
  const ctor = vi.fn(function Customer(data) {
    this.data = data;
    this.save = vi.fn(async () => {
      this._id = "valid-guest-1";
      return this;
    });
  });
  ctor.findOne = vi.fn(() => ({ lean: vi.fn(async () => null) }));
  return ctor;
});

const modelMocks = vi.hoisted(() => ({
  User: {
    find: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  Role: { find: vi.fn(), findById: vi.fn() },
  Customer: CustomerMock,
  CustomerRankSetting: {},
  WalletTransaction: {},
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../utils/authz.js", () => ({ requireRole: requireRoleMock }));
vi.mock("../../graphql/guards.js", () => ({
  requireRestaurantAccess: requireRestaurantAccessMock,
}));
vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requirePermission: vi.fn(async () => true),
  requireRestaurantPermission: requireRestaurantPermissionMock,
}));
vi.mock("../../src/services/customerRankSetting.service.js", () => ({
  getEffectiveCustomerRankSetting: vi.fn(async () => ({ ranks: [], isDefault: true })),
}));
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((id) => /^valid-/.test(String(id))),
    Types: {
    ObjectId: function ObjectId(id) {
      return { _mockObjectId: String(id), toString: () => String(id) };
    },
  },
  },
}));
vi.mock("../../lib/recaptcha.js", () => ({ verifyRecaptcha: vi.fn(async () => ({ ok: true })) }));
vi.mock("../../lib/passwordPolicy.js", () => ({ validatePasswordStrong: vi.fn(() => ({ ok: true })) }));
vi.mock("../../src/security/loginSecurity.js", () => ({
  getLoginAttemptState: vi.fn(),
  recordFailedLoginAttempt: vi.fn(),
  resetLoginAttempts: vi.fn(),
  logAuthAuditEvent: vi.fn(),
}));
vi.mock("../../graphql/resolvers/auth/emailVerification.mutation.js", () => ({
  default: {},
  issueAndSendVerificationForUser: vi.fn(),
}));

const ctxFor = (roleName) => ({ user: { id: "valid-user", roleName } });

describe("user admin management access hardening", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireRoleMock.mockImplementation(() => {});
    requireRestaurantAccessMock.mockResolvedValue(true);
    CustomerMock.findOne.mockReturnValue({ lean: vi.fn(async () => null) });
  });

  it("roleList authorizes through the active restaurant for Brand Admin managers", async () => {
    modelMocks.Role.find.mockReturnValue(createChain([
      { _id: "role-server", slug: "server", name: "Server" },
    ]));
    const ctx = ctxFor("manager");
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");

    const result = await UserQuery.roleList(
      null,
      { restaurantId: "valid-restaurant" },
      ctx,
    );

    expect(result).toHaveLength(1);
    expect(requireRestaurantPermissionMock).toHaveBeenCalledWith(
      ctx,
      "valid-restaurant",
      "staff.write",
    );
    expect(requireRoleMock).not.toHaveBeenCalled();
  });

  it("users rejects manager before User.find", async () => {
    requireRoleMock.mockImplementation(() => {
      throw new GraphQLError("FORBIDDEN");
    });
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");

    await expect(UserQuery.users(null, {}, ctxFor("manager"))).rejects.toThrow("FORBIDDEN");
    expect(requireRoleMock).toHaveBeenCalledWith(expect.anything(), ["admin"]);
    expect(modelMocks.User.find).not.toHaveBeenCalled();
  });

  it("users allows admin and calls User.find", async () => {
    modelMocks.User.find.mockReturnValue(createChain([]));
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");

    const result = await UserQuery.users(null, {}, ctxFor("admin"));
    expect(result).toEqual([]);
    expect(requireRoleMock).toHaveBeenCalledWith(expect.anything(), ["admin"]);
    expect(modelMocks.User.find).toHaveBeenCalledWith({ deletedAt: null });
  });

  it("users excludes soft-deleted rows when filtering", async () => {
    modelMocks.User.find.mockReturnValue(createChain([]));
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");

    await UserQuery.users(
      null,
      { isGuest: false, search: "linh" },
      ctxFor("admin"),
    );

    expect(modelMocks.User.find).toHaveBeenCalledWith(
      expect.objectContaining({
        deletedAt: null,
        isGuest: false,
        $or: expect.any(Array),
      }),
    );
  });

  it("adminUpdateUser rejects manager before User.findById", async () => {
    requireRoleMock.mockImplementation(() => {
      throw new GraphQLError("FORBIDDEN");
    });
    const { UserMutation } = await import("../../graphql/resolvers/user/mutation.js");

    await expect(
      UserMutation.adminUpdateUser(null, { userId: "valid-u1", input: { fullName: "N" } }, ctxFor("manager")),
    ).rejects.toThrow("FORBIDDEN");

    expect(requireRoleMock).toHaveBeenCalledWith(expect.anything(), ["admin"]);
    expect(modelMocks.User.findById).not.toHaveBeenCalled();
    expect(modelMocks.User.findOne).not.toHaveBeenCalled();
  });

  it("adminUpdateUser allows admin and preserves update logic", async () => {
    const save = vi.fn(async () => {});
    const set = vi.fn();
    modelMocks.User.findById
      .mockResolvedValueOnce({ _id: "valid-u1", set, save })
      .mockReturnValueOnce({ populate: () => ({ lean: async () => ({ _id: "valid-u1", fullName: "New Name" }) }) });

    const { UserMutation } = await import("../../graphql/resolvers/user/mutation.js");

    await UserMutation.adminUpdateUser(
      null,
      { userId: "valid-u1", input: { fullName: "New Name" } },
      ctxFor("admin"),
    );

    expect(requireRoleMock).toHaveBeenCalledWith(expect.anything(), ["admin"]);
    expect(save).toHaveBeenCalled();
  });

  it("setUserStatus rejects manager before DB write", async () => {
    requireRoleMock.mockImplementation(() => {
      throw new GraphQLError("FORBIDDEN");
    });
    const { UserMutation } = await import("../../graphql/resolvers/user/mutation.js");

    await expect(
      UserMutation.setUserStatus(null, { userId: "valid-u1", status: "active" }, ctxFor("manager")),
    ).rejects.toThrow("FORBIDDEN");

    expect(modelMocks.User.findById).not.toHaveBeenCalled();
    expect(modelMocks.User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("setUserStatus allows admin", async () => {
    modelMocks.User.findByIdAndUpdate.mockReturnValueOnce({ lean: async () => ({ _id: "valid-u1" }) });
    const userDoc = { _id: "valid-u1" };
    const query = {
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(userDoc),
    };
    modelMocks.User.findById.mockReturnValueOnce(query);

    const { UserMutation } = await import("../../graphql/resolvers/user/mutation.js");
    await UserMutation.setUserStatus(null, { userId: "valid-u1", status: "active" }, ctxFor("admin"));

    expect(requireRoleMock).toHaveBeenCalledWith(expect.anything(), ["admin"]);
    expect(modelMocks.User.findByIdAndUpdate).toHaveBeenCalled();
  });

  it("createGuestUser allows a scoped manager", async () => {
    modelMocks.User.findById.mockReturnValueOnce({
      populate: () => ({ lean: async () => ({ _id: "valid-guest-1", isGuest: true }) }),
    });
    const ctx = ctxFor("manager");
    const { UserMutation } = await import("../../graphql/resolvers/user/mutation.js");

    const result = await UserMutation.createGuestUser(
      null,
      {
        fullName: "G",
        phone: "090",
        restaurantId: "valid-restaurant",
      },
      ctx,
    );

    expect(requireRoleMock).toHaveBeenCalledWith(ctx.user, ["admin", "manager"]);
    expect(requireRestaurantAccessMock).toHaveBeenCalledWith(
      ctx,
      "valid-restaurant",
    );
    expect(CustomerMock).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ isGuest: true }));
  });

  it("createGuestUser allows admin", async () => {
    modelMocks.User.findById.mockReturnValueOnce({
      populate: () => ({ lean: async () => ({ _id: "valid-guest-1", isGuest: true }) }),
    });
    const { UserMutation } = await import("../../graphql/resolvers/user/mutation.js");

    const result = await UserMutation.createGuestUser(
      null,
      {
        fullName: "Guest",
        phone: "090",
        restaurantId: "valid-restaurant",
      },
      ctxFor("admin"),
    );

    expect(requireRoleMock).toHaveBeenCalledWith(expect.anything(), [
      "admin",
      "manager",
    ]);
    expect(requireRestaurantAccessMock).toHaveBeenCalled();
    expect(CustomerMock).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ isGuest: true }));
  });
});
