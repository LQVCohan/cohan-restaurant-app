import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AiHandoffInbox from "./AiHandoffInbox";
import { AuthContext } from "@/context/AuthContext";

const { useCommunicationMock } = vi.hoisted(() => ({
  useCommunicationMock: vi.fn(),
}));

vi.mock("@/hooks/useCommunication", () => ({
  default: (...args) => useCommunicationMock(...args),
}));

const defaultUser = {
  restaurantForStaff: "r1",
  roleName: "manager",
  permissions: ["ai.chatbot.handoff", "ai.chatbot.moderate"],
  permissionCodes: ["ai.chatbot.handoff", "ai.chatbot.moderate"],
};

const renderWithContext = (
  ui,
  {
    user = defaultUser,
    route = "/staff/ai-handoff",
    contextValue = {},
  } = {},
) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider value={{ user, ...contextValue }}>
        {ui}
      </AuthContext.Provider>
    </MemoryRouter>,
  );

const renderWithUser = (ui, user = defaultUser) =>
  renderWithContext(ui, { user });

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

const resolveMutationSpy = vi.fn();

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [resolveMutationSpy, { loading: false }],
}));

const mockDualHook = (active = {}, resolved = {}) => {
  useCommunicationMock.mockImplementation(({ status }) => {
    if (status === "closed") return { ...baseHook, ...resolved };
    return { ...baseHook, ...active };
  });
};

describe("AiHandoffInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders tabs", () => {
    mockDualHook();
    renderWithUser(<AiHandoffInbox />);

    expect(
      screen.getByRole("button", { name: "Đang xử lý" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Đã xử lý" }),
    ).toBeInTheDocument();
  });

  it("renders missing restaurant state", () => {
    mockDualHook();

    renderWithUser(<AiHandoffInbox />, {
      roleName: "manager",
      permissions: ["ai.chatbot.handoff"],
      permissionCodes: ["ai.chatbot.handoff"],
    });

    expect(screen.getByText("Chưa xác định được nhà hàng")).toBeInTheDocument();
    expect(
      screen.getByText(/được gán nhà hàng để tải yêu cầu hỗ trợ/i),
    ).toBeInTheDocument();
  });

  it("uses activeRestaurantId before the legacy staff restaurant", () => {
    mockDualHook();

    renderWithContext(<AiHandoffInbox />, {
      user: { ...defaultUser, restaurantForStaff: "legacy-r1" },
      contextValue: {
        activeRestaurantId: "active-r2",
        activeRestaurant: { id: "active-r2", name: "Cohan Active" },
        restaurants: [
          { id: "legacy-r1", name: "Legacy" },
          { id: "active-r2", name: "Cohan Active" },
        ],
      },
    });

    expect(useCommunicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "active-r2",
        status: "open",
        notificationsEnabled: true,
      }),
    );
    expect(useCommunicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "active-r2",
        status: "closed",
        notificationsEnabled: false,
      }),
    );
    expect(screen.getByRole("combobox", { name: /Nhà hàng/i })).toHaveValue(
      "active-r2",
    );
  });

  it("active tab renders notification item and handles missing threadId warning", async () => {
    mockDualHook({
      notifications: [
        {
          id: "n1",
          type: "ai_chatbot_handoff",
          payload: {},
          createdAt: new Date().toISOString(),
        },
      ],
    });

    renderWithUser(<AiHandoffInbox />);

    fireEvent.click(
      screen.getByRole("button", { name: /yêu cầu cần hỗ trợ/i }),
    );

    expect(
      await screen.findByText(/thiếu thông tin hội thoại/i),
    ).toBeInTheDocument();
  });

  it("resolved tab shows closed handoffs and disables actions", async () => {
    const loadResolvedThread = vi.fn().mockResolvedValue({
      data: {
        chatThread: {
          id: "t-closed",
          status: "closed",
          messages: [
            {
              senderRole: "staff",
              content: "Đã xử lý",
              createdAt: new Date().toISOString(),
            },
          ],
        },
      },
    });

    mockDualHook(
      {},
      {
        threads: [
          {
            id: "t-closed",
            subject: "AI handoff - Closed",
            status: "closed",
            updatedAt: new Date().toISOString(),
          },
        ],
        loadThread: loadResolvedThread,
        thread: {
          id: "t-closed",
          status: "closed",
          messages: [
            {
              senderRole: "staff",
              content: "Đã xử lý",
              createdAt: new Date().toISOString(),
            },
          ],
        },
      },
    );

    renderWithUser(<AiHandoffInbox />);

    fireEvent.click(screen.getByRole("button", { name: "Đã xử lý" }));
    fireEvent.click(screen.getByRole("button", { name: /closed/i }));

    await waitFor(() => expect(loadResolvedThread).toHaveBeenCalled());

    expect(
      screen.getByRole("button", { name: "Gửi phản hồi" }),
    ).toBeDisabled();
    expect(
      screen.getAllByRole("button", { name: "Đã xử lý" }).at(-1),
    ).toBeDisabled();
    expect(
      screen.getByText("Phiên hỗ trợ này đã được đóng."),
    ).toBeInTheDocument();
  });

  it("opens a resolved deep link in the resolved tab", async () => {
    const loadResolvedThread = vi.fn().mockResolvedValue({
      data: {
        chatThread: {
          id: "closed-1",
          status: "closed",
          kind: "ai_chatbot_handoff",
          messages: [
            {
              senderRole: "staff",
              senderName: "Nhân viên A",
              content: "Phiên này đã được hỗ trợ xong.",
              createdAt: "2026-07-11T03:05:00.000Z",
            },
          ],
        },
      },
    });

    mockDualHook(
      {},
      {
        threads: [
          {
            id: "closed-1",
            restaurantId: "active-r2",
            kind: "ai_chatbot_handoff",
            subject: "AI handoff - Khách cần hỗ trợ",
            status: "closed",
            lastMessagePreview: "Đã hỗ trợ xong",
            updatedAt: "2026-07-11T03:05:00.000Z",
          },
        ],
        thread: {
          id: "closed-1",
          status: "closed",
          kind: "ai_chatbot_handoff",
          messages: [
            {
              senderRole: "staff",
              senderName: "Nhân viên A",
              content: "Phiên này đã được hỗ trợ xong.",
              createdAt: "2026-07-11T03:05:00.000Z",
            },
          ],
        },
        loadThread: loadResolvedThread,
      },
    );

    renderWithContext(<AiHandoffInbox />, {
      route: "/staff/ai-handoff?threadId=closed-1",
      contextValue: {
        activeRestaurantId: "active-r2",
        activeRestaurant: { id: "active-r2", name: "Cohan Active" },
        restaurants: [{ id: "active-r2", name: "Cohan Active" }],
      },
    });

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: "Đã xử lý" })[0],
      ).toHaveClass("active");
      expect(loadResolvedThread).toHaveBeenCalledWith({
        variables: { id: "closed-1" },
      });
    });
    expect(
      screen.getByText("Phiên này đã được hỗ trợ xong."),
    ).toBeInTheDocument();
  });

  it("active resolve flow still works", async () => {
    const loadThread = vi.fn().mockResolvedValue({
      data: {
        chatThread: {
          id: "t1",
          status: "open",
          messages: [],
        },
      },
    });

    mockDualHook({
      notifications: [
        {
          id: "n1",
          type: "ai_chatbot_handoff",
          payload: {
            threadId: "t1",
            messagePreview: "preview",
          },
          createdAt: new Date().toISOString(),
        },
      ],
      thread: {
        id: "t1",
        status: "open",
        subject: "AI handoff - Khách cần hỗ trợ",
        messages: [],
      },
      loadThread,
    });

    resolveMutationSpy.mockResolvedValue({
      data: {
        resolveAiChatbotHandoff: {
          ok: true,
        },
      },
    });

    renderWithUser(<AiHandoffInbox />);

    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /đánh dấu đã xử lý/i }),
    );

    await waitFor(() => expect(resolveMutationSpy).toHaveBeenCalled());
  });
});
