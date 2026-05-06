import { GraphQLError } from "graphql";

const requireRoleMock = vi.hoisted(() => vi.fn());
const requireRestaurantAccessMock = vi.hoisted(() => vi.fn());

const modelMocks = vi.hoisted(() => ({
  User: { findById: vi.fn() },
  Role: {},
  Customer: { find: vi.fn() },
  Order: { find: vi.fn() },
  CustomerRankSetting: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
    create: vi.fn(),
  },
  WalletTransaction: {},
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => ({
  requireRestaurantAccess: requireRestaurantAccessMock,
}));
vi.mock("../../utils/authz.js", () => ({ requireRole: requireRoleMock }));
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((id) => /^valid-/.test(String(id))),
    Types: {
      ObjectId: vi.fn((id) => ({ _mockObjectId: String(id) })),
    },
  },
}));
vi.mock("../../lib/recaptcha.js", () => ({ verifyRecaptcha: vi.fn(async () => ({ ok: true })) }));
vi.mock("../../graphql/resolvers/auth/emailVerification.mutation.js", () => ({
  default: {},
  issueAndSendVerificationForUser: vi.fn(),
}));

const ctxFor = (roleName = "manager") => ({ user: { id: "valid-user", roleName } });

describe("user/customer restaurant access guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireRoleMock.mockImplementation(() => {});
  });

  it("customerAnalytics denied does not call Order.find or Customer.find", async () => {
    requireRestaurantAccessMock.mockRejectedValue(new GraphQLError("FORBIDDEN_SCOPE"));
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");

    await expect(
      UserQuery.customerAnalytics(null, { restaurantId: "valid-r1" }, ctxFor()),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Order.find).not.toHaveBeenCalled();
    expect(modelMocks.Customer.find).not.toHaveBeenCalled();
  });

  it("customerAnalytics allowed calls requireRestaurantAccess before queries", async () => {
    const calls = [];
    requireRestaurantAccessMock.mockImplementation(async () => {
      calls.push("guard");
    });
    modelMocks.Order.find.mockImplementation(() => {
      calls.push("order");
      return { lean: async () => [] };
    });
    modelMocks.Customer.find.mockImplementation(() => {
      calls.push("customer");
      return { lean: async () => [] };
    });

    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    const result = await UserQuery.customerAnalytics(
      null,
      { restaurantId: "valid-r1" },
      ctxFor(),
    );

    expect(requireRestaurantAccessMock).toHaveBeenCalled();
    expect(calls).toEqual(["guard", "order", "customer"]);
    expect(result).toEqual(
      expect.objectContaining({
        restaurantId: "valid-r1",
        mostPopularDishes: expect.any(Array),
        busiestDays: expect.any(Array),
        averageMembershipDays: expect.any(Number),
        activeCustomerCount: expect.any(Number),
        returningCustomerCount: expect.any(Number),
      }),
    );
  });

  it("customerRankSettings denied does not call CustomerRankSetting.findOne", async () => {
    requireRestaurantAccessMock.mockRejectedValue(new GraphQLError("FORBIDDEN_SCOPE"));
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");

    await expect(
      UserQuery.customerRankSettings(null, { restaurantId: "valid-r1" }, ctxFor()),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.CustomerRankSetting.findOne).not.toHaveBeenCalled();
  });

  it("customerRankSettings allowed returns default ranks when no doc", async () => {
    requireRestaurantAccessMock.mockResolvedValue(undefined);
    modelMocks.CustomerRankSetting.findOne.mockReturnValue({ lean: async () => null });
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");

    const result = await UserQuery.customerRankSettings(
      null,
      { restaurantId: "valid-r1" },
      ctxFor(),
    );

    expect(result.restaurantId).toBe("valid-r1");
    expect(result.ranks).toHaveLength(3);
  });

  it("customerDetailAnalytics with restaurantId denied does not call Order.find or User.findById", async () => {
    requireRestaurantAccessMock.mockRejectedValue(new GraphQLError("FORBIDDEN_SCOPE"));
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");

    await expect(
      UserQuery.customerDetailAnalytics(
        null,
        { userId: "valid-u1", restaurantId: "valid-r1" },
        ctxFor(),
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Order.find).not.toHaveBeenCalled();
    expect(modelMocks.User.findById).not.toHaveBeenCalled();
  });

  it("customerDetailAnalytics with restaurantId allowed calls requireRestaurantAccess and scopes Order.find", async () => {
    requireRestaurantAccessMock.mockResolvedValue(undefined);
    modelMocks.Order.find.mockReturnValue({
      sort: () => ({ limit: () => ({ lean: async () => [] }) }),
    });
    modelMocks.User.findById.mockReturnValue({ lean: async () => ({ createdAt: new Date(), totalSpending: 0 }) });

    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    await UserQuery.customerDetailAnalytics(
      null,
      { userId: "valid-u1", restaurantId: "valid-r1" },
      ctxFor(),
    );

    expect(requireRestaurantAccessMock).toHaveBeenCalled();
    expect(modelMocks.Order.find).toHaveBeenCalledWith({
      userId: { _mockObjectId: "valid-u1" },
      restaurantId: { _mockObjectId: "valid-r1" },
    });
  });

  it("customerDetailAnalytics without restaurantId rejects for manager/staff", async () => {
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    await expect(
      UserQuery.customerDetailAnalytics(null, { userId: "valid-u1" }, ctxFor("manager")),
    ).rejects.toThrow("restaurantId is required");
    expect(modelMocks.Order.find).not.toHaveBeenCalled();
  });

  it("customerDetailAnalytics without restaurantId allowed for admin", async () => {
    modelMocks.Order.find.mockReturnValue({
      sort: () => ({ limit: () => ({ lean: async () => [] }) }),
    });
    modelMocks.User.findById.mockReturnValue({ lean: async () => ({ createdAt: new Date(), totalSpending: 0 }) });
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");

    await UserQuery.customerDetailAnalytics(null, { userId: "valid-u1" }, ctxFor("ADMIN"));
    expect(modelMocks.Order.find).toHaveBeenCalledWith({ userId: { _mockObjectId: "valid-u1" } });
  });

  it("upsertCustomerRankSettings denied does not call writes", async () => {
    requireRestaurantAccessMock.mockRejectedValue(new GraphQLError("FORBIDDEN_SCOPE"));
    const { UserMutation } = await import("../../graphql/resolvers/user/mutation.js");

    await expect(
      UserMutation.upsertCustomerRankSettings(
        null,
        { restaurantId: "valid-r1", ranks: [{ name: "VIP", minPoints: 1, benefits: "x" }] },
        ctxFor(),
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(modelMocks.CustomerRankSetting.findOneAndUpdate).not.toHaveBeenCalled();
    expect(modelMocks.CustomerRankSetting.updateOne).not.toHaveBeenCalled();
    expect(modelMocks.CustomerRankSetting.create).not.toHaveBeenCalled();
  });

  it("upsertCustomerRankSettings allowed calls requireRestaurantAccess before write", async () => {
    const calls = [];
    requireRestaurantAccessMock.mockImplementation(async () => calls.push("guard"));
    modelMocks.CustomerRankSetting.findOneAndUpdate.mockImplementation(() => {
      calls.push("write");
      return { lean: async () => ({ restaurantId: "valid-r1", ranks: [] }) };
    });

    const { UserMutation } = await import("../../graphql/resolvers/user/mutation.js");
    await UserMutation.upsertCustomerRankSettings(
      null,
      { restaurantId: "valid-r1", ranks: [{ name: "VIP", minPoints: 10, benefits: "prio" }] },
      ctxFor(),
    );

    expect(calls).toEqual(["guard", "write"]);
    expect(requireRestaurantAccessMock).toHaveBeenCalled();
  });
});
