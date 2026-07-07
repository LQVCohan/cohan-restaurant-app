import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  BrandMembership: {
    find: vi.fn(() => ({ select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })) })),
  },
  ChatThread: { find: vi.fn(), findById: vi.fn(), findOne: vi.fn(), create: vi.fn() },
  Notification: {
    find: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
    updateMany: vi.fn(),
    updateOne: vi.fn(),
    insertMany: vi.fn(),
  },
  Restaurant: {
    findById: vi.fn(),
    exists: vi.fn(),
    distinct: vi.fn(),
  },
}));
const guardMocks = vi.hoisted(() => ({ requireRestaurantAccess: vi.fn() }));
const authMocks = vi.hoisted(() => ({
  hasAnyPermission: vi.fn(),
  hasPermission: vi.fn(),
}));
const scopeMocks = vi.hoisted(() => ({
  getScopedRestaurantFilter: vi.fn(),
  isSystemAdmin: vi.fn(),
}));
const mongooseMocks = vi.hoisted(() => ({
  isValidObjectId: vi.fn((v) => String(v).startsWith("valid-")),
  Types: { ObjectId: function ObjectId(v) { this.value = v; this.toString = () => String(v); } },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", () => scopeMocks);
vi.mock("mongoose", () => ({ default: mongooseMocks }));

const findChain = (rows) => ({
  sort: vi.fn(() => ({
    skip: vi.fn(() => ({ limit: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(rows) })) })),
    limit: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(rows) })),
  })),
});
const restaurantChain = (doc) => ({
  select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(doc) })),
});

const handoffThread = (overrides = {}) => ({
  _id: "valid-t1",
  status: "open",
  restaurantId: "valid-r1",
  channel: "support",
  targetRole: null,
  subject: "AI handoff - guest",
  participants: [],
  messages: [],
  unreadBy: [],
  ...overrides,
});

const threadDocument = (data, save = vi.fn().mockResolvedValue(true)) => ({
  ...data,
  save,
  toObject: () => ({ ...data }),
});

describe("communication resolver restaurant access hardening", () => {
  const ctx = { user: { id: "valid-u1", roleName: "manager" } };

  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue();
    authMocks.hasAnyPermission.mockResolvedValue(false);
    authMocks.hasPermission.mockResolvedValue(false);
    scopeMocks.getScopedRestaurantFilter.mockResolvedValue({ _id: { $in: ["valid-r1"] } });
    scopeMocks.isSystemAdmin.mockReturnValue(false);
    modelMocks.BrandMembership.find.mockReturnValue({
      select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })),
    });
    modelMocks.ChatThread.find.mockReturnValue(findChain([]));
    modelMocks.Notification.find.mockReturnValue(findChain([]));
    modelMocks.Notification.countDocuments.mockResolvedValue(0);
    modelMocks.Notification.updateMany.mockResolvedValue({ modifiedCount: 1 });
    modelMocks.Notification.updateOne.mockResolvedValue({ modifiedCount: 1 });
    modelMocks.Notification.insertMany.mockResolvedValue([]);
    modelMocks.Restaurant.findById.mockReturnValue(restaurantChain({ brandId: "valid-b1" }));
    modelMocks.Restaurant.exists.mockResolvedValue(true);
    modelMocks.Restaurant.distinct.mockResolvedValue(["valid-r1"]);
    modelMocks.ChatThread.findOne.mockResolvedValue(null);
    modelMocks.ChatThread.create.mockResolvedValue({
      toObject: () => ({ _id: "valid-t1", participants: [] }),
    });
  });

  it("chatThreads denied scope blocks ChatThread.find", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(resolver.Query.chatThreads(null, { restaurantId: "valid-r1" }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.ChatThread.find).not.toHaveBeenCalled();
  });

  it("chatThreads allowed scope calls guard before find", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    await resolver.Query.chatThreads(null, { restaurantId: "valid-r1" }, ctx);
    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(ctx, expect.anything());
    expect(modelMocks.ChatThread.find).toHaveBeenCalledWith(expect.objectContaining({ restaurantId: expect.anything() }));
    expect(guardMocks.requireRestaurantAccess.mock.invocationCallOrder[0]).toBeLessThan(modelMocks.ChatThread.find.mock.invocationCallOrder[0]);
  });

  it("chatThreads without restaurantId keeps own/role query and skips scope guard", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    await resolver.Query.chatThreads(null, { channel: "support" }, ctx);
    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(modelMocks.ChatThread.find).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.any(Array), channel: "support" }));
  });

  it("chatThreads without status defaults to open", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    await resolver.Query.chatThreads(null, { restaurantId: "valid-r1" }, ctx);
    expect(modelMocks.ChatThread.find).toHaveBeenCalledWith(expect.objectContaining({ status: "open" }));
  });

  it("chatThreads supports explicit open/closed status", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    await resolver.Query.chatThreads(null, { restaurantId: "valid-r1", status: "open" }, ctx);
    expect(modelMocks.ChatThread.find).toHaveBeenLastCalledWith(expect.objectContaining({ status: "open" }));
    await resolver.Query.chatThreads(null, { restaurantId: "valid-r1", status: "closed" }, ctx);
    expect(modelMocks.ChatThread.find).toHaveBeenLastCalledWith(expect.objectContaining({ status: "closed" }));
  });

  it("chatThreads rejects invalid status", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    await expect(resolver.Query.chatThreads(null, { restaurantId: "valid-r1", status: "archived" }, ctx)).rejects.toMatchObject({
      extensions: { code: "BAD_USER_INPUT" },
    });
    expect(modelMocks.ChatThread.find).not.toHaveBeenCalled();
  });

  it("allows moderation-only users to view scoped handoff threads", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    authMocks.hasAnyPermission.mockResolvedValue(true);
    modelMocks.ChatThread.find.mockReturnValue(findChain([handoffThread()]));

    const rows = await resolver.Query.chatThreads(null, { restaurantId: "valid-r1" }, ctx);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("valid-t1");
  });

  it("does not trust stale handoff participants after view permission is removed", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    modelMocks.ChatThread.find.mockReturnValue(findChain([
      handoffThread({ participants: ["valid-u1"] }),
    ]));

    const rows = await resolver.Query.chatThreads(null, { restaurantId: "valid-r1" }, ctx);

    expect(rows).toEqual([]);
  });

  it("notifications denied scope blocks Notification.find", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(resolver.Query.notifications(null, { restaurantId: "valid-r1" }, ctx)).rejects.toThrow();
    expect(modelMocks.Notification.find).not.toHaveBeenCalled();
  });

  it("notifications allowed scope calls guard and Notification.find", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    await resolver.Query.notifications(null, { restaurantId: "valid-r1" }, ctx);
    expect(modelMocks.Notification.find).toHaveBeenCalledWith(expect.objectContaining({ restaurantId: expect.anything(), $or: expect.any(Array) }));
  });

  it("notifications without restaurantId scope role notifications from BrandMembership", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    await resolver.Query.notifications(null, {}, ctx);

    expect(scopeMocks.getScopedRestaurantFilter).toHaveBeenCalledWith(ctx.user);
    expect(modelMocks.Restaurant.distinct).toHaveBeenCalledWith(
      "_id",
      { _id: { $in: ["valid-r1"] } },
    );
    expect(modelMocks.Notification.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          expect.objectContaining({
            toRole: "manager",
            restaurantId: { $in: ["valid-r1"] },
          }),
        ]),
      }),
    );
  });

  it("unreadNotificationCount denied scope blocks count", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(resolver.Query.unreadNotificationCount(null, { restaurantId: "valid-r1" }, ctx)).rejects.toThrow();
    expect(modelMocks.Notification.countDocuments).not.toHaveBeenCalled();
  });

  it("openChatThread denied by scope blocks Restaurant/findOne/create", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(resolver.Mutation.openChatThread(null, { input: { restaurantId: "valid-r1", channel: "support" } }, ctx)).rejects.toThrow();
    expect(modelMocks.Restaurant.findById).not.toHaveBeenCalled();
    expect(modelMocks.ChatThread.findOne).not.toHaveBeenCalled();
    expect(modelMocks.ChatThread.create).not.toHaveBeenCalled();
  });

  it("openChatThread allowed calls guard before database operations", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    await resolver.Mutation.openChatThread(null, { input: { restaurantId: "valid-r1", channel: "support" } }, ctx);
    expect(modelMocks.ChatThread.create).toHaveBeenCalled();
    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalled();
  });

  it("openChatThread adds the current BrandMembership manager", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    modelMocks.BrandMembership.find.mockReturnValueOnce({
      select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([{ userId: "valid-membership-manager" }]) })),
    });

    await resolver.Mutation.openChatThread(null, { input: { restaurantId: "valid-r1", channel: "support" } }, ctx);

    expect(modelMocks.Restaurant.findById).toHaveBeenCalled();
    expect(modelMocks.BrandMembership.find).toHaveBeenCalledWith({
      brandId: "valid-b1",
      role: "manager",
      status: "active",
      restaurantIds: expect.anything(),
    });
    expect(modelMocks.ChatThread.create).toHaveBeenCalledWith(
      expect.objectContaining({
        participants: expect.arrayContaining([
          expect.objectContaining({ value: "valid-membership-manager" }),
        ]),
      }),
    );
  });

  it("openChatThread does not add a legacy restaurant manager without membership", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    modelMocks.Restaurant.findById.mockReturnValueOnce(
      restaurantChain({ brandId: "valid-b1", managerId: "valid-legacy-manager" }),
    );

    await resolver.Mutation.openChatThread(null, { input: { restaurantId: "valid-r1", channel: "support" } }, ctx);

    const payload = modelMocks.ChatThread.create.mock.calls[0][0];
    expect(payload.participants.map(String)).toEqual(["valid-u1"]);
  });

  it("markAllNotificationsRead denied scope blocks updateMany", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(resolver.Mutation.markAllNotificationsRead(null, { restaurantId: "valid-r1" }, ctx)).rejects.toThrow();
    expect(modelMocks.Notification.updateMany).not.toHaveBeenCalled();
  });

  it("markAllNotificationsRead without restaurantId scopes role notifications", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    await resolver.Mutation.markAllNotificationsRead(null, {}, ctx);
    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(scopeMocks.getScopedRestaurantFilter).toHaveBeenCalled();
    expect(modelMocks.Notification.updateMany).toHaveBeenCalled();
  });

  it("invalid restaurantId throws BAD_USER_INPUT before guard/db", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    await expect(resolver.Query.chatThreads(null, { restaurantId: "bad-r1" }, ctx)).rejects.toMatchObject({ extensions: { code: "BAD_USER_INPUT" } });
    await expect(resolver.Mutation.openChatThread(null, { input: { restaurantId: "bad-r1", channel: "support" } }, ctx)).rejects.toMatchObject({ extensions: { code: "BAD_USER_INPUT" } });
    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(modelMocks.ChatThread.find).not.toHaveBeenCalled();
    expect(modelMocks.ChatThread.create).not.toHaveBeenCalled();
  });

  it("sendChatMessage rejects closed thread", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    modelMocks.ChatThread.findById.mockResolvedValue({
      _id: "valid-t1",
      status: "closed",
      participants: ["valid-u1"],
      toObject: () => ({ _id: "valid-t1", status: "closed", participants: ["valid-u1"] }),
    });

    await expect(
      resolver.Mutation.sendChatMessage(null, { input: { threadId: "valid-t1", content: "x" } }, ctx),
    ).rejects.toMatchObject({ extensions: { code: "CHAT_THREAD_CLOSED" } });
  });

  it("moderators can view but cannot reply to handoff threads", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    authMocks.hasAnyPermission.mockResolvedValue(true);
    modelMocks.ChatThread.findById.mockResolvedValue(threadDocument(handoffThread()));

    await expect(
      resolver.Mutation.sendChatMessage(
        null,
        { input: { threadId: "valid-t1", content: "reply" } },
        ctx,
      ),
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
  });

  it("handoff permission allows replying to a scoped handoff thread", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    const save = vi.fn().mockResolvedValue(true);
    authMocks.hasAnyPermission.mockResolvedValue(true);
    authMocks.hasPermission.mockResolvedValue(true);
    modelMocks.ChatThread.findById.mockResolvedValue(threadDocument(handoffThread(), save));

    const out = await resolver.Mutation.sendChatMessage(
      null,
      { input: { threadId: "valid-t1", content: "reply" } },
      { ...ctx, io: null },
    );

    expect(out.id).toBe("valid-t1");
    expect(save).toHaveBeenCalled();
  });

  it("sendChatMessage still works for an open participant thread", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    const save = vi.fn().mockResolvedValue(true);
    modelMocks.ChatThread.findById.mockResolvedValue({
      _id: "valid-t1",
      status: "open",
      restaurantId: "valid-r1",
      channel: "support",
      targetRole: "support",
      participants: ["valid-u1"],
      messages: [],
      unreadBy: [],
      save,
      toObject: () => ({ _id: "valid-t1", status: "open", restaurantId: "valid-r1", targetRole: "support", participants: ["valid-u1"], unreadBy: [] }),
    });

    const out = await resolver.Mutation.sendChatMessage(
      null,
      { input: { threadId: "valid-t1", content: "xin chao" } },
      { ...ctx, io: null },
    );
    expect(out.id).toBe("valid-t1");
    expect(save).toHaveBeenCalled();
  });
});
