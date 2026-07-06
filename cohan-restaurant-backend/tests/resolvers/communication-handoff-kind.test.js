import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = [];
const hasAnyPermission = vi.fn();
const requireRestaurantAccess = vi.fn();

vi.mock("../../models/index.js", () => ({
  BrandMembership: {},
  ChatThread: {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        limit: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(rows) })),
      })),
    })),
  },
  Notification: {},
  Restaurant: {},
  User: {},
}));
vi.mock("../../graphql/guards.js", () => ({ requireRestaurantAccess }));
vi.mock("../../src/services/auth/authorization.service.js", () => ({
  hasAnyPermission,
  hasPermission: vi.fn(),
}));
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((value) => String(value).startsWith("valid-")),
    Types: { ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); } },
  },
}));

const { default: communication } = await import("../../graphql/resolvers/communication/index.js");

describe("communication handoff kind", () => {
  beforeEach(() => {
    rows.length = 0;
    vi.clearAllMocks();
    requireRestaurantAccess.mockResolvedValue();
  });

  it("applies handoff permissions when the explicit kind is present without legacy markers", async () => {
    rows.push({
      _id: "valid-thread",
      restaurantId: "valid-restaurant",
      kind: "ai_chatbot_handoff",
      subject: "Khách cần hỗ trợ",
      messages: [],
      participants: [],
      unreadBy: [],
      status: "open",
    });
    hasAnyPermission.mockResolvedValue(true);

    const result = await communication.Query.chatThreads(
      null,
      { restaurantId: "valid-restaurant" },
      { user: { id: "valid-user", roleName: "manager" } },
    );

    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("ai_chatbot_handoff");
    expect(hasAnyPermission).toHaveBeenCalled();
  });
});
