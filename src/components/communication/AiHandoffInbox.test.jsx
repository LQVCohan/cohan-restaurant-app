import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AiHandoffInbox from "./AiHandoffInbox";
import { AuthContext } from "@/context/AuthContext";

const { useCommunicationMock } = vi.hoisted(() => ({
  useCommunicationMock: vi.fn(),
}));

vi.mock("@/hooks/useCommunication", () => ({
  default: (...args) => useCommunicationMock(...args),
}));

const renderWithUser = (ui, user = { restaurantForStaff: "r1" }) =>
  render(<AuthContext.Provider value={{ user }}>{ui}</AuthContext.Provider>);

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

describe("AiHandoffInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders missing restaurant state", () => {
    useCommunicationMock.mockReturnValue(baseHook);
    renderWithUser(<AiHandoffInbox />, {});
    expect(screen.getByText("Chưa xác định được nhà hàng để tải yêu cầu handoff.")).toBeInTheDocument();
  });

  it("renders empty state when no handoff items", () => {
    useCommunicationMock.mockReturnValue(baseHook);
    renderWithUser(<AiHandoffInbox />);
    expect(screen.getByText("Chưa có yêu cầu hỗ trợ từ chatbot.")).toBeInTheDocument();
  });

  it("renders AI handoff notification item and handles missing threadId warning", async () => {
    useCommunicationMock.mockReturnValue({
      ...baseHook,
      notifications: [{ id: "n1", type: "ai_chatbot_handoff", payload: {}, createdAt: new Date().toISOString() }],
    });
    renderWithUser(<AiHandoffInbox />);
    fireEvent.click(screen.getByRole("button", { name: /yêu cầu hỗ trợ từ chatbot/i }));
    expect(await screen.findByText(/chưa có threadId/i)).toBeInTheDocument();
  });

  it("clicking notification loads thread and marks read best-effort", async () => {
    const loadThread = vi.fn().mockResolvedValue({ data: { chatThread: { id: "t1", messages: [] } } });
    const markThreadRead = vi.fn().mockRejectedValue(new Error("deny"));
    const markNotificationRead = vi.fn().mockRejectedValue(new Error("role-based"));
    useCommunicationMock.mockReturnValue({
      ...baseHook,
      notifications: [{ id: "n1", type: "ai_chatbot_handoff", readAt: null, payload: { threadId: "t1", messagePreview: "preview" }, createdAt: new Date().toISOString() }],
      loadThread,
      markThreadRead,
      markNotificationRead,
    });
    renderWithUser(<AiHandoffInbox />);
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => expect(loadThread).toHaveBeenCalledWith({ variables: { id: "t1" } }));
    expect(markThreadRead).toHaveBeenCalledWith({ variables: { threadId: "t1" } });
    expect(markNotificationRead).toHaveBeenCalledWith({ variables: { id: "n1" } });
  });


  it("renders guest senderRole as Khách hàng", async () => {
    const loadThread = vi.fn().mockResolvedValue({ data: { chatThread: { id: "t1", messages: [] } } });
    useCommunicationMock.mockReturnValue({
      ...baseHook,
      thread: {
        id: "t1",
        subject: "AI handoff - Khách cần hỗ trợ",
        messages: [{ senderRole: "guest", content: "Em cần giúp", createdAt: new Date().toISOString() }],
      },
      notifications: [{ id: "n1", type: "ai_chatbot_handoff", payload: { threadId: "t1", messagePreview: "preview" }, createdAt: new Date().toISOString() }],
      loadThread,
    });
    renderWithUser(<AiHandoffInbox />);
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => expect(loadThread).toHaveBeenCalled());
    expect(screen.getByText("Khách hàng")).toBeInTheDocument();
  });
  it("send reply calls sendChatMessage with selected thread", async () => {
    const loadThread = vi.fn().mockResolvedValue({ data: { chatThread: { id: "t1", messages: [] } } });
    const sendMessage = vi.fn().mockResolvedValue({});
    useCommunicationMock.mockReturnValue({
      ...baseHook,
      notifications: [{ id: "n1", type: "ai_chatbot_handoff", payload: { threadId: "t1", messagePreview: "preview" }, createdAt: new Date().toISOString() }],
      thread: { id: "t1", subject: "AI handoff - Khách cần hỗ trợ", messages: [{ content: "[AI HANDOFF]" }] },
      loadThread,
      sendMessage,
    });
    renderWithUser(<AiHandoffInbox />);
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    fireEvent.change(screen.getByPlaceholderText(/nhập phản hồi/i), { target: { value: "Xin chào" } });
    fireEvent.click(screen.getByRole("button", { name: /gửi phản hồi/i }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ variables: { input: { threadId: "t1", content: "Xin chào" } } }));
  });

  it("renders resolve button and calls resolve mutation", async () => {
    const loadThread = vi.fn().mockResolvedValue({ data: { chatThread: { id: "t1", status: "open", messages: [] } } });
    useCommunicationMock.mockReturnValue({
      ...baseHook,
      notifications: [{ id: "n1", type: "ai_chatbot_handoff", payload: { threadId: "t1", messagePreview: "preview" }, createdAt: new Date().toISOString() }],
      thread: { id: "t1", status: "open", subject: "AI handoff - Khách cần hỗ trợ", messages: [] },
      loadThread,
    });
    resolveMutationSpy.mockResolvedValue({ data: { resolveAiChatbotHandoff: { ok: true } } });
    renderWithUser(<AiHandoffInbox />);
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    fireEvent.click(screen.getByRole("button", { name: /đánh dấu đã xử lý/i }));
    await waitFor(() => expect(resolveMutationSpy).toHaveBeenCalled());
  });
});
