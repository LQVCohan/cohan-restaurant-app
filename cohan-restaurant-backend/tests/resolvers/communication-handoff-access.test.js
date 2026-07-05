import { beforeEach, describe, expect, it, vi } from "vitest";

const communication = vi.hoisted(() => ({
  Query: { chatThreads: vi.fn(), chatThread: vi.fn() },
  Mutation: { sendChatMessage: vi.fn(), markChatThreadRead: vi.fn() },
}));
const auth = vi.hoisted(() => ({ hasAnyPermission: vi.fn(), hasPermission: vi.fn() }));
const models = vi.hoisted(() => ({ ChatThread: { findById: vi.fn() } }));

vi.mock("../../graphql/resolvers/communication/index.js", () => ({ default: communication }));
vi.mock("../../src/services/auth/authorization.service.js", () => auth);
vi.mock("../../models/index.js", () => models);

const subjectQuery = (subject) => ({
  select: () => ({ lean: async () => ({ subject }) }),
});

describe("AI handoff communication access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.hasAnyPermission.mockResolvedValue(false);
    auth.hasPermission.mockResolvedValue(false);
  });

  it("filters handoff threads after view permission is removed", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/handoffAccess.js")).default;
    communication.Query.chatThreads.mockResolvedValue([
      { id: "handoff", subject: "AI handoff - guest" },
      { id: "normal", subject: "Internal chat" },
    ]);

    await expect(resolver.Query.chatThreads(null, {}, { user: { id: "u1" } }))
      .resolves.toEqual([{ id: "normal", subject: "Internal chat" }]);
  });

  it("delegates a handoff reply only after handoff permission is granted", async () => {
    const resolver = (await import("../../graphql/resolvers/communication/handoffAccess.js")).default;
    models.ChatThread.findById.mockReturnValue(subjectQuery("AI handoff - guest"));
    communication.Mutation.sendChatMessage.mockResolvedValue({ id: "handoff" });

    await expect(
      resolver.Mutation.sendChatMessage(
        null,
        { input: { threadId: "handoff", content: "reply" } },
        { user: { id: "u1" } },
      ),
    ).rejects.toBeTruthy();
    expect(communication.Mutation.sendChatMessage).not.toHaveBeenCalled();

    auth.hasPermission.mockResolvedValue(true);
    await expect(
      resolver.Mutation.sendChatMessage(
        null,
        { input: { threadId: "handoff", content: "reply" } },
        { user: { id: "u1" } },
      ),
    ).resolves.toEqual({ id: "handoff" });
  });
});
