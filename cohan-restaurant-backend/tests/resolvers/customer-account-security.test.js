const requireRoleMock = vi.hoisted(() => vi.fn());
const clearRefreshCookieMock = vi.hoisted(() => vi.fn());
const modelMocks = vi.hoisted(() => ({
  User: {
    findById: vi.fn(),
  },
  RefreshToken: {
    updateMany: vi.fn(),
  },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../utils/authz.js", () => ({ requireRole: requireRoleMock }));
vi.mock("../../src/security/authTokens.js", () => ({
  clearRefreshCookie: clearRefreshCookieMock,
  hashRefreshToken: vi.fn((value) => `hashed:${value}`),
}));

const USER_ID = "507f1f77bcf86cd799439011";
const contextFor = (roleName) => ({
  user: { id: USER_ID, roleName },
  reply: {},
});

describe("customer account self-delete", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireRoleMock.mockImplementation(() => {});
  });

  it("rejects non-customer accounts before loading the user", async () => {
    requireRoleMock.mockImplementation(() => {
      throw new Error("FORBIDDEN");
    });
    const resolver = (
      await import("../../graphql/resolvers/user/customerAccountSecurity.js")
    ).default;

    await expect(
      resolver.Mutation.deleteMyAccount(
        null,
        { currentPassword: "password", confirmText: "XOA TAI KHOAN" },
        contextFor("manager"),
      ),
    ).rejects.toThrow("FORBIDDEN");

    expect(requireRoleMock).toHaveBeenCalledWith(
      expect.objectContaining({ roleName: "manager" }),
      ["customer"],
    );
    expect(modelMocks.User.findById).not.toHaveBeenCalled();
    expect(modelMocks.RefreshToken.updateMany).not.toHaveBeenCalled();
  });

  it("soft-deletes a customer and revokes every refresh token", async () => {
    const save = vi.fn(async () => undefined);
    const userDoc = {
      _id: USER_ID,
      passwordHash: "hash",
      checkPassword: vi.fn(async () => true),
      save,
    };
    modelMocks.User.findById.mockResolvedValue(userDoc);
    modelMocks.RefreshToken.updateMany.mockResolvedValue({ modifiedCount: 2 });
    const ctx = contextFor("customer");
    const resolver = (
      await import("../../graphql/resolvers/user/customerAccountSecurity.js")
    ).default;

    const result = await resolver.Mutation.deleteMyAccount(
      null,
      { currentPassword: "password", confirmText: "XÓA TÀI KHOẢN" },
      ctx,
    );

    expect(result).toBe(true);
    expect(requireRoleMock).toHaveBeenCalledWith(ctx.user, ["customer"]);
    expect(userDoc.checkPassword).toHaveBeenCalledWith("password");
    expect(userDoc.status).toBe("inactive");
    expect(userDoc.deletedAt).toBeInstanceOf(Date);
    expect(userDoc.deleteExpiresAt).toBeInstanceOf(Date);
    expect(userDoc.deleteExpiresAt.getTime() - userDoc.deletedAt.getTime()).toBe(
      30 * 24 * 60 * 60 * 1000,
    );
    expect(userDoc.deletedBy).toBe(USER_ID);
    expect(save).toHaveBeenCalledTimes(1);
    expect(modelMocks.RefreshToken.updateMany).toHaveBeenCalledWith(
      { userId: expect.anything(), revokedAt: null },
      { $set: { revokedAt: userDoc.deletedAt } },
    );
    expect(clearRefreshCookieMock).toHaveBeenCalledWith(ctx.reply);
  });
});
