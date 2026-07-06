import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import StaffNotificationsPage from "./StaffNotificationsPage";

const communication = vi.hoisted(() => ({
  notifications: [],
  notificationsLoading: false,
  notificationsError: null,
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  archiveNotification: vi.fn(),
  refetchNotifications: vi.fn(),
}));

vi.mock("@/hooks/useCommunication", () => ({
  default: () => communication,
}));

describe("StaffNotificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    communication.notifications = [{
      id: "notification-1",
      restaurantId: "restaurant-1",
      type: "ai_chatbot_handoff",
      readAt: null,
      createdAt: "2026-07-06T10:00:00.000Z",
      payload: {
        title: "Khách hàng cần hỗ trợ",
        message: "Khách nhắn: Tôi cần gặp nhân viên",
        actionUrl: "/staff/ai-handoff?restaurantId=restaurant-1&threadId=thread-1",
      },
    }];
    communication.markNotificationRead.mockResolvedValue({ data: { markNotificationRead: true } });
    communication.markAllNotificationsRead.mockResolvedValue({ data: { markAllNotificationsRead: true } });
    communication.archiveNotification.mockResolvedValue({ data: { archiveNotification: true } });
    communication.refetchNotifications.mockResolvedValue();
  });

  afterEach(() => cleanup());

  it("renders live notifications and persists read/archive actions", async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={{ user: { id: "staff-1", restaurantForStaff: "restaurant-1" } }}>
          <StaffNotificationsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Khách hàng cần hỗ trợ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở hỗ trợ" })).toHaveAttribute(
      "href",
      "/staff/ai-handoff?restaurantId=restaurant-1&threadId=thread-1",
    );

    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đọc" }));
    await waitFor(() => {
      expect(communication.markNotificationRead).toHaveBeenCalledWith({
        variables: { id: "notification-1" },
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Ẩn thông báo: Khách hàng cần hỗ trợ" }));
    await waitFor(() => {
      expect(communication.archiveNotification).toHaveBeenCalledWith({
        variables: { id: "notification-1" },
      });
    });
  });
});
