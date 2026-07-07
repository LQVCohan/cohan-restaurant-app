import { beforeEach, describe, expect, it, vi } from "vitest";

const validRestaurantId = "507f1f77bcf86cd799439011";
const validUserId = "507f1f77bcf86cd799439012";

const modelMocks = vi.hoisted(() => ({
  BrandMembership: { find: vi.fn() },
  ChatThread: { findOne: vi.fn(), create: vi.fn() },
  Notification: {},
  Restaurant: { exists: vi.fn(), distinct: vi.fn(), findById: vi.fn() },
  Role: { find: vi.fn() },
  User: { find: vi.fn() },
}));
const guardMocks = vi.hoisted(() => ({ requireRestaurantAccess: vi.fn() }));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);

const chain = (value) => ({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(value) });

describe("communication public customer support access", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.ChatThread.findOne.mockResolvedValue(null);
    modelMocks.ChatThread.create.mockResolvedValue({
      _id: "507f1f77bcf86cd799439013",
      restaurantId: validRestaurantId,
      channel: "support",
      participants: [validUserId],
      messages: [],
      unreadBy: [],
      toObject() { return this; },
    });
    modelMocks.BrandMembership.find.mockReturnValue(chain([]));
    modelMocks.User.find.mockReturnValue(chain([]));
    modelMocks.Restaurant.findById.mockReturnValue(chain({ _id: validRestaurantId, brandId: "507f1f77bcf86cd799439014" }));
  });

  it("opens customer support thread only when restaurant matches public filter", async () => {
    modelMocks.Restaurant.exists.mockResolvedValue({ _id: validRestaurantId });
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;

    const out = await resolver.Mutation.openChatThread(null, { input: { restaurantId: validRestaurantId, channel: "support" } }, { user: { id: validUserId, userType: "CUSTOMER" } });

    expect(modelMocks.Restaurant.exists).toHaveBeenCalledWith(expect.objectContaining({ _id: expect.anything(), $or: expect.any(Array) }));
    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(out.restaurantId).toBe(validRestaurantId);
  });

  it("rejects private/inactive restaurant for customer support thread", async () => {
    modelMocks.Restaurant.exists.mockResolvedValue(null);
    const resolver = (await import("../../graphql/resolvers/communication/index.js")).default;

    await expect(
      resolver.Mutation.openChatThread(null, { input: { restaurantId: validRestaurantId, channel: "support" } }, { user: { id: validUserId, userType: "CUSTOMER" } }),
    ).rejects.toThrow("Không tìm thấy nhà hàng hoặc nhà hàng hiện không hoạt động.");
  });
});
