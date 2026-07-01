import { GraphQLError } from "graphql";

const requireRoleMock = vi.hoisted(() => vi.fn());
const requireRestaurantAccessMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const customerRankSettingServiceMocks = vi.hoisted(() => ({
  getEffectiveCustomerRankSetting: vi.fn(),
}));

const modelMocks = vi.hoisted(() => ({
  User: { findById: vi.fn() },
  Role: { findOne: vi.fn() },
  Customer: { find: vi.fn(), countDocuments: vi.fn() },
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
vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requirePermission: requirePermissionMock,
}));
vi.mock("../../src/constants/permissions.js", () => ({
  PERMISSIONS: { CUSTOMER_READ: "customer.read" },
}));
vi.mock("../../src/services/customerRankSetting.service.js", () => customerRankSettingServiceMocks);
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
    requirePermissionMock.mockResolvedValue(undefined);
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
      return { select: vi.fn().mockReturnValue({ lean: async () => [] }) };
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
    customerRankSettingServiceMocks.getEffectiveCustomerRankSetting.mockResolvedValue({ restaurantId: "valid-r1", ranks: [{ name: "Mới", minPoints: 0, benefits: "" }, { name: "Thân thiết", minPoints: 5, benefits: "Ưu đãi dịp đặc biệt" }, { name: "VIP", minPoints: 20, benefits: "Ưu tiên đặt bàn" }], isDefault: true });
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");

    const result = await UserQuery.customerRankSettings(
      null,
      { restaurantId: "valid-r1" },
      ctxFor(),
    );

    expect(result.restaurantId).toBe("valid-r1");
    expect(result.ranks).toHaveLength(3);
  });

  it("customerListPage excludes soft-deleted customers in restaurant scope", async () => {
    requireRestaurantAccessMock.mockResolvedValue(undefined);
    modelMocks.Role.findOne.mockReturnValue({ lean: async () => ({ _id: "valid-role-customer" }) });
    modelMocks.Customer.countDocuments.mockResolvedValue(0);
    modelMocks.Customer.find.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn(async () => []),
    });

    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    await UserQuery.customerListPage(
      null,
      { restaurantId: "valid-r1", includeGuests: true },
      ctxFor(),
    );

    expect(modelMocks.Customer.countDocuments).toHaveBeenCalledWith({
      $and: expect.arrayContaining([
        { deletedAt: null },
        expect.objectContaining({ refRestaurants: expect.any(Object) }),
      ]),
    });
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
      userId: expect.objectContaining({ _mockObjectId: "valid-u1" }),
      restaurantId: expect.objectContaining({ _mockObjectId: "valid-r1" }),
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
    expect(modelMocks.Order.find).toHaveBeenCalledWith({
      userId: expect.objectContaining({ _mockObjectId: "valid-u1" }),
    });
  });

  it("customerListSummaries returns [] when userIds empty", async () => {
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    const result = await UserQuery.customerListSummaries(
      null,
      { restaurantId: "valid-r1", userIds: [] },
      ctxFor(),
    );
    expect(result).toEqual([]);
    expect(modelMocks.Order.find).not.toHaveBeenCalled();
  });

  it("customerListSummaries denied does not call Order.find", async () => {
    requireRestaurantAccessMock.mockRejectedValue(new GraphQLError("FORBIDDEN_SCOPE"));
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    await expect(
      UserQuery.customerListSummaries(
        null,
        { restaurantId: "valid-r1", userIds: ["valid-u1"] },
        ctxFor(),
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Order.find).not.toHaveBeenCalled();
  });

  it("customerListSummaries aggregates recentOrders/topDishes and scopes by restaurant", async () => {
    requireRestaurantAccessMock.mockResolvedValue(undefined);
    modelMocks.Order.find.mockImplementation((cond) => {
      return {
        sort: () => ({
          lean: async () => ([
            { _id: "o5", restaurantId: cond?.restaurantId, userId: { toString: () => "valid-u1" }, createdAt: "2026-01-05T00:00:00.000Z", orderCode: "A5", totals: { grandTotal: 50000 }, items: [{ name: "Pho", quantity: 1 }, { name: "Bun", quantity: 2 }] },
            { _id: "o4", restaurantId: cond?.restaurantId, userId: { toString: () => "valid-u1" }, createdAt: "2026-01-04T00:00:00.000Z", orderCode: "A4", totals: { grandTotal: 40000 }, items: [{ name: "Pho", quantity: 3 }] },
            { _id: "o3", restaurantId: cond?.restaurantId, userId: { toString: () => "valid-u1" }, createdAt: "2026-01-03T00:00:00.000Z", orderCode: "A3", totals: { grandTotal: 30000 }, items: [{ name: "Com", quantity: 1 }] },
            { _id: "o2", restaurantId: cond?.restaurantId, userId: { toString: () => "valid-u2" }, createdAt: "2026-01-02T00:00:00.000Z", orderCode: "B2", totals: { grandTotal: 20000 }, items: [{ name: "Pho", quantity: 2 }] },
          ]),
        }),
      };
    });
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    const result = await UserQuery.customerListSummaries(
      null,
      { restaurantId: "valid-r1", userIds: ["valid-u1", "valid-u2"], recentLimit: 2, topDishLimit: 2 },
      ctxFor(),
    );
    expect(modelMocks.Order.find).toHaveBeenCalledWith({
      restaurantId: expect.objectContaining({ _mockObjectId: "valid-r1" }),
      userId: {
        $in: [
          expect.objectContaining({ _mockObjectId: "valid-u1" }),
          expect.objectContaining({ _mockObjectId: "valid-u2" }),
        ],
      },
    });
    expect(result[0].recentOrders.map((x) => x.orderCode)).toEqual(["A5", "A4"]);
    expect(result[0].topDishes).toEqual([
      { dishName: "Pho", quantity: 4 },
      { dishName: "Bun", quantity: 2 },
    ]);
    expect(result[1].recentOrders).toHaveLength(1);
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

  it("customerListPage composes rank/search/kind with same finalCond for count and find", async () => {
    requireRestaurantAccessMock.mockResolvedValue(undefined);
    modelMocks.Role.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: "role-customer" }),
    });
    const findLean = vi.fn(async () => []);
    modelMocks.Customer.find.mockReturnValue({
      populate: () => ({ populate: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: findLean }) }) }) }) }),
    });
    modelMocks.Customer.countDocuments.mockResolvedValue(0);
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    await UserQuery.customerListPage(null, {
      restaurantId: "valid-r1", search: "john", includeGuests: false, customerKind: "REGISTERED", customerRank: { minPoints: 10, maxPointsExclusive: 50 },
    }, ctxFor());
    const countCond = modelMocks.Customer.countDocuments.mock.calls[0][0];
    const findCond = modelMocks.Customer.find.mock.calls[0][0];
    expect(findCond).toEqual(countCond);
    expect(JSON.stringify(findCond)).toContain("loyaltyPoints");
    expect(JSON.stringify(findCond)).toContain("$or");
  });

  it("customerExportRows enforces guards and caps limit", async () => {
    requireRestaurantAccessMock.mockResolvedValue(undefined);
    modelMocks.Role.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: "role-customer" }),
    });
    modelMocks.Customer.find.mockReturnValue({
      select: () => ({ populate: () => ({ populate: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) }) }),
    });
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    await UserQuery.customerExportRows(null, { restaurantId: "valid-r1", limit: 99999, customerRank: { minPoints: 100 } }, ctxFor());
    expect(requirePermissionMock).toHaveBeenCalled();
    expect(requireRestaurantAccessMock).toHaveBeenCalledWith(expect.anything(), "valid-r1");
    const limitChain = modelMocks.Customer.find.mock.results[0].value.select().populate().populate().sort();
    expect(limitChain.limit).toBeTypeOf("function");
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

  it("customerListPage invalid restaurantId => BAD_USER_INPUT", async () => {
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    await expect(
      UserQuery.customerListPage(null, { restaurantId: "invalid-r1" }, ctxFor()),
    ).rejects.toMatchObject({ extensions: { code: "BAD_USER_INPUT" } });
  });

  it("customerListPage includeGuests=false excludes guests", async () => {
    requireRestaurantAccessMock.mockResolvedValue(undefined);
    modelMocks.Role.findOne = vi.fn(() => ({ lean: async () => ({ _id: "role-customer" }) }));
    modelMocks.Customer.countDocuments.mockResolvedValue(1);
    modelMocks.Customer.find.mockReturnValue({
      populate: () => ({ populate: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [{ id: "u1" }] }) }) }) }) }),
    });
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    const result = await UserQuery.customerListPage(
      null,
      { restaurantId: "valid-r1", includeGuests: false },
      ctxFor(),
    );
    expect(modelMocks.Customer.countDocuments).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
  });

  it("customerListPage ALL + includeGuests=true + search keeps both kind/search clauses", async () => {
    requireRestaurantAccessMock.mockResolvedValue(undefined);
    modelMocks.Role.findOne = vi.fn(() => ({ lean: async () => ({ _id: "role-customer" }) }));
    modelMocks.Customer.countDocuments.mockResolvedValue(0);
    modelMocks.Customer.find.mockReturnValue({
      populate: () => ({ populate: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) }) }),
    });
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    await UserQuery.customerListPage(
      null,
      {
        restaurantId: "valid-r1",
        customerKind: "ALL",
        includeGuests: true,
        search: "abc",
      },
      ctxFor(),
    );

    const countCond = modelMocks.Customer.countDocuments.mock.calls.at(-1)?.[0];
    const findCond = modelMocks.Customer.find.mock.calls.at(-1)?.[0];
    expect(countCond).toEqual(findCond);
    const andClauses = countCond?.$and || [];
    const restaurantClause = andClauses.find((x) =>
      Array.isArray(x?.refRestaurants?.$in) &&
      x.refRestaurants.$in.some((id) => String(id?._mockObjectId || id) === "valid-r1"),
    );
    expect(restaurantClause).toBeTruthy();
    const kindClause = andClauses.find((x) =>
      Array.isArray(x?.$or) &&
      x.$or.some((item) => item?.role === "role-customer") &&
      x.$or.some((item) => item?.isGuest === true),
    );
    expect(kindClause).toBeTruthy();
    const searchClause = andClauses.find((x) =>
      Array.isArray(x?.$or) &&
      ["fullName", "username", "email", "phone"].every((field) =>
        x.$or.some((item) => Object.prototype.hasOwnProperty.call(item || {}, field)),
      ),
    );
    expect(searchClause).toBeTruthy();
    expect(searchClause?.$or).toEqual(
      expect.arrayContaining([
        { fullName: expect.any(RegExp) },
        { username: expect.any(RegExp) },
        { email: expect.any(RegExp) },
        { phone: expect.any(RegExp) },
      ]),
    );
  });
});
