import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  ChatThread: { find: vi.fn(), findById: vi.fn(), findOne: vi.fn(), create: vi.fn() },
  Notification: { find: vi.fn(), countDocuments: vi.fn(), updateMany: vi.fn() },
  Restaurant: { findById: vi.fn() },
  User: { find: vi.fn() },
}));
const guardMocks = vi.hoisted(() => ({ requireRestaurantAccess: vi.fn() }));
const mongooseMocks = vi.hoisted(() => ({
  isValidObjectId: vi.fn((v) => String(v).startsWith("valid-")),
  Types: { ObjectId: vi.fn((v) => v) },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("mongoose", () => ({ default: mongooseMocks }));

const findChain = (rows) => ({
  sort: vi.fn(() => ({ limit: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(rows) })) })),
});
const restaurantChain = (doc) => ({ select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(doc) })) });

describe("communication resolver restaurant access hardening", () => {
  const ctx = { user: { id: "valid-u1", roleName: "manager" } };

  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue();
    modelMocks.ChatThread.find.mockReturnValue(findChain([]));
    modelMocks.Notification.find.mockReturnValue(findChain([]));
    modelMocks.Notification.countDocuments.mockResolvedValue(0);
    modelMocks.Notification.updateMany.mockResolvedValue({ modifiedCount: 1 });
    modelMocks.Restaurant.findById.mockReturnValue(restaurantChain({ managerId: "valid-u2" }));
    modelMocks.ChatThread.findOne.mockResolvedValue(null);
    modelMocks.ChatThread.create.mockResolvedValue({ toObject: () => ({ _id: "valid-t1", participants: [] }) });
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

  it("unreadNotificationCount denied scope blocks count", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(resolver.Query.unreadNotificationCount(null, { restaurantId: "valid-r1" }, ctx)).rejects.toThrow();
    expect(modelMocks.Notification.countDocuments).not.toHaveBeenCalled();
  });

  it("unreadNotificationCount without restaurantId skips guard", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    await resolver.Query.unreadNotificationCount(null, {}, ctx);
    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
  });

  it("openChatThread denied by scope blocks Restaurant/findOne/create", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(resolver.Mutation.openChatThread(null, { input: { restaurantId: "valid-r1", channel: "support" } }, ctx)).rejects.toThrow();
    expect(modelMocks.Restaurant.findById).not.toHaveBeenCalled();
    expect(modelMocks.ChatThread.findOne).not.toHaveBeenCalled();
    expect(modelMocks.ChatThread.create).not.toHaveBeenCalled();
  });

  it("openChatThread allowed calls guard before db operations", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    await resolver.Mutation.openChatThread(null, { input: { restaurantId: "valid-r1", channel: "support" } }, ctx);
    expect(modelMocks.ChatThread.create).toHaveBeenCalled();
    expect(guardMocks.requireRestaurantAccess.mock.invocationCallOrder[0]).toBeLessThan(modelMocks.Restaurant.findById.mock.invocationCallOrder[0]);
  });

  it("markAllNotificationsRead denied scope blocks updateMany", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    await expect(resolver.Mutation.markAllNotificationsRead(null, { restaurantId: "valid-r1" }, ctx)).rejects.toThrow();
    expect(modelMocks.Notification.updateMany).not.toHaveBeenCalled();
  });

  it("markAllNotificationsRead without restaurantId skips guard and updates own", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;
    await resolver.Mutation.markAllNotificationsRead(null, {}, ctx);
    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
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
});
