import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NotificationBell from "./NotificationBell";

const markNotificationRead = vi.fn();
const markAllNotificationsRead = vi.fn();
const refetchNotifications = vi.fn();

vi.mock("@/hooks/useCommunication", () => ({
  default: () => ({
    notifications: [
      { id: "n1", type: "review.reported", payload: { message: "Có báo cáo mới", reason: "spam" }, readAt: null, createdAt: "2026-05-30T10:00:00.000Z" },
      { id: "n2", type: "review.published", payload: { message: "Review đã duyệt" }, readAt: "2026-05-30T11:00:00.000Z", createdAt: "2026-05-30T09:00:00.000Z" },
    ],
    unreadCount: 1,
    markNotificationRead,
    markAllNotificationsRead,
    refetchNotifications,
  }),
}));

describe("NotificationBell", () => {
  it("renders unread count/list and marks notification read", async () => {
    markNotificationRead.mockResolvedValue({});
    refetchNotifications.mockResolvedValue({});
    render(<NotificationBell restaurantId="res1" title="Thông báo review" />);
    expect(screen.getByText("1")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Mở thông báo"));
    expect(screen.getByText("Có báo cáo mới")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Có báo cáo mới"));
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith({ variables: { id: "n1" } }));
  });
});
