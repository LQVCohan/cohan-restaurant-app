import { GraphQLError } from "graphql";

const requireRoleMock = vi.hoisted(() => vi.fn());

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
  return ctor;
});

const modelMocks = vi.hoisted(() => ({
  User: {
    find: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  Role: { findById: vi.fn() },
  Customer: CustomerMock,
  CustomerRankSetting: {},
  WalletTransaction: {},
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../utils/authz.js", () => ({ requireRole: requireRoleMock }));
vi.mock("../../src/services/customerRankSetting.service.js", () => ({
  getEffectiveCustomerRankSetting: vi.fn(async () => ({ ranks: [], isDefault: true })),
}));
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((id) => /^valid-/.test(String(id))),
    Types: { ObjectId: vi.fn((id) => ({ _mockObjectId: String(id) })) },
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

  it("createGuestUser rejects manager before Customer save", async () => {
    requireRoleMock.mockImplementation(() => {
      throw new GraphQLError("FORBIDDEN");
    });
    const { UserMutation } = await import("../../graphql/resolvers/user/mutation.js");

    await expect(
      UserMutation.createGuestUser(null, { fullName: "G", phone: "090" }, ctxFor("manager")),
    ).rejects.toThrow("FORBIDDEN");

    expect(requireRoleMock).toHaveBeenCalledWith(expect.anything(), ["admin"]);
    expect(CustomerMock).not.toHaveBeenCalled();
  });

  it("createGuestUser allows admin", async () => {
    modelMocks.User.findById.mockReturnValueOnce({
      populate: () => ({ lean: async () => ({ _id: "valid-guest-1", isGuest: true }) }),
    });
    const { UserMutation } = await import("../../graphql/resolvers/user/mutation.js");

    const result = await UserMutation.createGuestUser(
      null,
      { fullName: "Guest", phone: "090" },
      ctxFor("admin"),
    );

    expect(requireRoleMock).toHaveBeenCalledWith(expect.anything(), ["admin"]);
    expect(CustomerMock).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ isGuest: true }));
  });
});
