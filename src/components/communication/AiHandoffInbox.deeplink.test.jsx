import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import AiHandoffInbox from "./AiHandoffInbox";

const useCommunicationMock = vi.hoisted(() => vi.fn());
const resolveMutationMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useCommunication", () => ({
  default: (...args) => useCommunicationMock(...args),
}));

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [resolveMutationMock, { loading: false }],
}));

const baseHook = {
  threads: [],
  threadsLoading: false,
  notifications: [],
  notificationsLoading: false,
  thread: null,
  threadLoading: false,
  loadThread: vi.fn(),
  sendMessage: vi.fn(),
  sendMessageState: { loading: false },
  markThreadRead: vi.fn(),
  markNotificationRead: vi.fn(),
  refetchThreads: vi.fn(),
  refetchNotifications: vi.fn(),
};

const renderInbox = ({ user, route = "/staff/ai-handoff" }) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider value={{ user }}>
        <AiHandoffInbox />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe("AiHandoffInbox deep link access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the thread named in the notification URL", async () => {
    const loadThread = vi.fn().mockResolvedValue({
      data: { chatThread: { id: "t1", status: "open", messages: [] } },
    });
    useCommunicationMock.mockImplementation(({ status }) =>
      status === "closed"
        ? { ...baseHook }
        : {
            ...baseHook,
            loadThread,
            notifications: [{
              id: "n1",
              type: "ai_chatbot_handoff",
              payload: { threadId: "t1", messagePreview: "preview" },
              createdAt: new Date().toISOString(),
            }],
          },
    );

    renderInbox({
      user: {
        restaurantForStaff: "r1",
        roleName: "staff",
        permissions: ["ai.chatbot.handoff"],
      },
      route: "/staff/ai-handoff?restaurantId=r1&threadId=t1",
    });

    await waitFor(() =>
      expect(loadThread).toHaveBeenCalledWith({ variables: { id: "t1" } }),
    );
  });

  it("keeps moderation-only users in view-only mode", () => {
    useCommunicationMock.mockImplementation(() => ({ ...baseHook }));

    renderInbox({
      user: {
        restaurantForStaff: "r1",
        roleName: "supervisor",
        permissions: ["ai.chatbot.moderate"],
      },
    });

    expect(screen.getByLabelText("Nội dung phản hồi cho khách")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Gửi phản hồi" })).toBeDisabled();
  });
});
