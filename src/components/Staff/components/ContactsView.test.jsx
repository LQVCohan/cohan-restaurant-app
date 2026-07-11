import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import ContactsView from "./ContactsView";

const {
  useCommunicationMock,
  showNotificationMock,
  loadThreadMock,
  openThreadMock,
  sendMessageMock,
  markThreadReadMock,
  refetchThreadsMock,
} = vi.hoisted(() => ({
  useCommunicationMock: vi.fn(),
  showNotificationMock: vi.fn(),
  loadThreadMock: vi.fn(),
  openThreadMock: vi.fn(),
  sendMessageMock: vi.fn(),
  markThreadReadMock: vi.fn(),
  refetchThreadsMock: vi.fn(),
}));

vi.mock("@/hooks/useCommunication", () => ({
  default: (...args) => useCommunicationMock(...args),
}));

vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: showNotificationMock }),
}));

const thread = {
  id: "thread-1",
  subject: "Ca tối",
  messages: [
    {
      senderId: "manager-1",
      senderName: "Quản lý",
      content: "Chuẩn bị khu A",
      createdAt: "2026-07-12T01:00:00.000Z",
    },
  ],
};

const renderContacts = (props = {}) =>
  render(
    <AuthContext.Provider value={{ user: { id: "staff-1" } }}>
      <ContactsView restaurantId="restaurant-1" onClose={vi.fn()} {...props} />
    </AuthContext.Provider>,
  );

describe("ContactsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadThreadMock.mockResolvedValue({ data: { chatThread: thread } });
    markThreadReadMock.mockResolvedValue({ data: { markChatThreadRead: true } });
    refetchThreadsMock.mockResolvedValue({ data: {} });
    sendMessageMock.mockResolvedValue({ data: {} });
    openThreadMock.mockResolvedValue({
      data: { openChatThread: { id: "manager-thread" } },
    });
    useCommunicationMock.mockReturnValue({
      threads: [
        {
          id: "thread-1",
          subject: "Ca tối",
          targetRole: "manager",
          channel: "other",
          lastMessagePreview: "Chuẩn bị khu A",
          unreadCount: 1,
        },
      ],
      threadsLoading: false,
      thread,
      threadLoading: false,
      threadError: null,
      loadThread: loadThreadMock,
      openThread: openThreadMock,
      sendMessage: sendMessageMock,
      sendMessageState: { loading: false },
      markThreadRead: markThreadReadMock,
      refetchThreads: refetchThreadsMock,
    });
  });

  it("opens a thread inside the same modal, marks it read, sends, then returns to the list", async () => {
    renderContacts();

    fireEvent.click(screen.getByRole("button", { name: "Mở hội thoại Ca tối" }));

    expect(
      screen.getByRole("region", { name: "Ca tối" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(loadThreadMock).toHaveBeenCalledWith({
        variables: { id: "thread-1" },
      });
      expect(markThreadReadMock).toHaveBeenCalledWith({
        variables: { threadId: "thread-1" },
      });
    });

    fireEvent.change(screen.getByRole("textbox", { name: "Nội dung tin nhắn" }), {
      target: { value: "Đã rõ" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith({
        variables: {
          input: { threadId: "thread-1", content: "Đã rõ" },
        },
      });
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Quay lại danh sách hội thoại" }),
    );
    expect(screen.getByRole("heading", { name: "Tin nhắn" })).toBeInTheDocument();
  });

  it("opens the manager shortcut with the backend manager role slug", async () => {
    renderContacts();

    fireEvent.click(
      screen.getByRole("button", { name: "Nhắn tin cho quản lý nhà hàng" }),
    );

    await waitFor(() => {
      expect(openThreadMock).toHaveBeenCalledWith({
        variables: {
          input: {
            restaurantId: "restaurant-1",
            channel: "other",
            targetRole: "manager",
            subject: "Trao đổi với quản lý",
          },
        },
      });
      expect(loadThreadMock).toHaveBeenCalledWith({
        variables: { id: "manager-thread" },
      });
    });
  });

  it("opens and marks a notification-focused thread without leaving the modal", async () => {
    const onFocusHandled = vi.fn();
    renderContacts({ focusThreadId: "thread-1", onFocusHandled });

    expect(
      await screen.findByRole("dialog", { name: "Hội thoại nhân viên" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(loadThreadMock).toHaveBeenCalledWith({
        variables: { id: "thread-1" },
      });
      expect(markThreadReadMock).toHaveBeenCalledWith({
        variables: { threadId: "thread-1" },
      });
      expect(onFocusHandled).toHaveBeenCalledTimes(1);
    });
  });
});
