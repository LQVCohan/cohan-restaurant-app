import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import NotificationBell from "./NotificationBell";

const gsapMocks = vi.hoisted(() => {
  const timeline = { fromTo: vi.fn() };
  timeline.fromTo.mockReturnValue(timeline);

  const contextRevert = vi.fn();
  const mediaRevert = vi.fn();
  const matchMediaAdd = vi.fn((_query, callback) => callback());
  const gsap = {
    matchMedia: vi.fn(() => ({ add: matchMediaAdd, revert: mediaRevert })),
    context: vi.fn((callback) => {
      callback();
      return { revert: contextRevert };
    }),
    set: vi.fn(),
    timeline: vi.fn(() => timeline),
  };
  const loadGsapRuntime = vi.fn(() => Promise.resolve(gsap));

  return {
    contextRevert,
    gsap,
    loadGsapRuntime,
    matchMediaAdd,
    mediaRevert,
    timeline,
  };
});

const markNotificationRead = vi.fn();
const markAllNotificationsRead = vi.fn();
const refetchNotifications = vi.fn();
const useCommunicationMock = vi.fn();

vi.mock("@/hooks/useCommunication", () => ({
  default: (...args) => useCommunicationMock(...args),
}));

vi.mock("@/utils/gsapRuntime", () => ({
  default: gsapMocks.loadGsapRuntime,
  loadGsapRuntime: gsapMocks.loadGsapRuntime,
}));

const hookPayload = {
  notifications: [
    { id: "n1", type: "review.reported", payload: { message: "Có báo cáo mới", reason: "spam" }, readAt: null, createdAt: "2026-05-30T10:00:00.000Z" },
    { id: "n2", type: "review.published", payload: { message: "Review đã duyệt" }, readAt: "2026-05-30T11:00:00.000Z", createdAt: "2026-05-30T09:00:00.000Z" },
  ],
  unreadCount: 1,
  markNotificationRead,
  markAllNotificationsRead,
  refetchNotifications,
};

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCommunicationMock.mockReturnValue(hookPayload);
  });

  it("renders unread count/list and marks notification read", async () => {
    markNotificationRead.mockResolvedValue({});
    refetchNotifications.mockResolvedValue({});
    render(<NotificationBell restaurantId="res1" title="Thông báo review" />);
    expect(useCommunicationMock).toHaveBeenCalledWith({ restaurantId: "res1", notificationsEnabled: true });
    expect(screen.getByText("1")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Mở thông báo"));
    expect(screen.getByText("Có báo cáo mới")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Có báo cáo mới"));
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith({ variables: { id: "n1" } }));
  });

  it("animates the opened panel and rows with a scoped GSAP timeline", async () => {
    render(<NotificationBell restaurantId="res1" title="Thông báo review" />);
    await waitFor(() => expect(gsapMocks.loadGsapRuntime).toHaveBeenCalled());
    await Promise.resolve();

    fireEvent.click(screen.getByLabelText("Mở thông báo"));

    await waitFor(() => expect(gsapMocks.gsap.timeline).toHaveBeenCalled());
    expect(gsapMocks.matchMediaAdd).toHaveBeenCalledWith(
      "(prefers-reduced-motion: no-preference)",
      expect.any(Function),
    );
    expect(gsapMocks.gsap.context).toHaveBeenCalled();
    expect(gsapMocks.timeline.fromTo).toHaveBeenCalledTimes(2);
  });

  it("uses injected customer state without enabling another notification query", async () => {
    const markAsRead = vi.fn().mockResolvedValue({});
    const notificationState = {
      notifications: [
        {
          id: "customer-n1",
          type: "chat_message",
          text: "Nhân viên vừa phản hồi",
          time: "10:30 02/07",
          isRead: false,
          link: "/help-center/me?threadId=thread-1",
          raw: { id: "customer-n1", type: "chat_message" },
        },
      ],
      unreadCount: 1,
      markAsRead,
      markAllAsRead: vi.fn(),
    };

    render(<NotificationBell title="Thông báo của tôi" notificationState={notificationState} />);
    expect(useCommunicationMock).toHaveBeenCalledWith({ restaurantId: null, notificationsEnabled: false });
    fireEvent.click(screen.getByLabelText("Mở thông báo"));
    fireEvent.click(screen.getByText("Nhân viên vừa phản hồi"));
    await waitFor(() => expect(markAsRead).toHaveBeenCalledWith("customer-n1"));
    expect(markNotificationRead).not.toHaveBeenCalled();
  });

  it("passes disabled notification mode to the communication hook", () => {
    render(<NotificationBell restaurantId={null} title="Thông báo của tôi" enabled={false} />);
    expect(useCommunicationMock).toHaveBeenCalledWith({ restaurantId: null, notificationsEnabled: false });
    expect(screen.getByLabelText("Mở thông báo")).toBeDisabled();
  });
});
