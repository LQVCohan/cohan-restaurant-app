import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRestaurantAccess = vi.fn();
const findLean = vi.fn();
const countDocuments = vi.fn();
const findOne = vi.fn();
const updateMany = vi.fn();

vi.mock("../../graphql/guards.js", () => ({ requireRestaurantAccess }));
vi.mock("../../src/services/auth/authorization.service.js", () => ({
  hasAnyPermission: vi.fn(),
  hasPermission: vi.fn(),
}));
vi.mock("../../src/services/ai/restaurantChatbotRealtime.service.js", () => ({ emitAiChatbotStaffReplyIfLinked: vi.fn() }));
vi.mock("../../models/index.js", () => ({
  BrandMembership: {},
  ChatThread: {},
  Restaurant: {},
  User: {},
  Notification: {
    find: vi.fn(() => ({ sort: vi.fn(() => ({ skip: vi.fn(() => ({ limit: vi.fn(() => ({ lean: findLean })) })), limit: vi.fn(() => ({ lean: findLean })) })) })),
    countDocuments,
    findOne,
    updateMany,
  },
}));

const { default: communication } = await import("../../graphql/resolvers/communication/index.js");

describe("notification resolvers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findLean.mockResolvedValue([{ _id: "507f1f77bcf86cd799439011", type: "review.reported", readAt: null }]);
    countDocuments.mockResolvedValue(1);
  });

  it("returns direct/role scoped notifications for current manager restaurant", async () => {
    const rows = await communication.Query.myNotifications(null, { restaurantId: "507f1f77bcf86cd799439012", unreadOnly: true, limit: 10, skip: 0 }, {
      user: { id: "507f1f77bcf86cd799439013", userType: "MANAGER", restaurantForStaff: "507f1f77bcf86cd799439012" },
    });
    expect(requireRestaurantAccess).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
    expect(rows[0].id).toBe("507f1f77bcf86cd799439011");
  });

  it("marks only accessible notifications read", async () => {
    const save = vi.fn();
    findOne.mockResolvedValue({ readAt: null, save });
    const ok = await communication.Mutation.markNotificationRead(null, { id: "507f1f77bcf86cd799439011" }, {
      user: { id: "507f1f77bcf86cd799439013", userType: "CUSTOMER" },
    });
    expect(ok).toBe(true);
    expect(save).toHaveBeenCalled();
  });
});
