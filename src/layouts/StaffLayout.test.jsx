import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import StaffLayout from "./StaffLayout";

const { useCommunicationMock } = vi.hoisted(() => ({
  useCommunicationMock: vi.fn(),
}));

vi.mock("@/hooks/useCommunication", () => ({
  default: (...args) => useCommunicationMock(...args),
}));

vi.mock("@/components/Staff/components/ContactsView", () => ({
  default: ({ restaurantId, focusThreadId, onClose }) => (
    <div
      role="dialog"
      aria-label="Tin nhắn nhân viên"
      data-restaurant-id={restaurantId || ""}
      data-thread-id={focusThreadId || ""}
    >
      <button type="button" onClick={onClose}>
        Đóng messenger test
      </button>
    </div>
  ),
}));

const baseUser = {
  id: "staff-1",
  fullName: "Nhân viên Test",
  roleSlug: "server",
};
const activeRestaurant = { id: "r1", name: "Cohan Test" };

const renderStaffLayout = ({
  user = baseUser,
  route = "/staff/dashboard",
  restaurant = activeRestaurant,
  activeRestaurantId = restaurant?.id,
  children = <p>Nội dung nhân viên</p>,
} = {}) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider
        value={{
          user,
          activeRestaurant: restaurant,
          activeRestaurantId,
          restaurants: restaurant ? [restaurant] : [],
        }}
      >
        <StaffLayout>{children}</StaffLayout>
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe("StaffLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCommunicationMock.mockReturnValue({ notifications: [] });
  });

  it("renders the shell header, scoped restaurant, shared navigation, and active route", () => {
    renderStaffLayout({ route: "/staff/schedule" });

    expect(
      screen.getByRole("heading", { name: "Vận hành ca làm" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cohan Test/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tổng quan" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lịch cá nhân" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Hồ sơ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Thông báo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Liên lạc" })).not.toBeInTheDocument();
  });

  it("opens the messenger from the header action without a nav or floating duplicate", () => {
    const { container } = renderStaffLayout();
    const messengerButton = screen.getByRole("button", {
      name: "Mở tin nhắn nhân viên",
    });

    expect(messengerButton).toHaveClass("staff-shell__messenger-button");
    expect(messengerButton).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector(".staff-shell__messenger-launcher")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Liên lạc" })).not.toBeInTheDocument();

    fireEvent.click(messengerButton);

    expect(
      screen.getByRole("dialog", { name: "Tin nhắn nhân viên" }),
    ).toHaveAttribute("data-restaurant-id", "r1");
    expect(messengerButton).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Đóng messenger test" }));
    expect(
      screen.queryByRole("dialog", { name: "Tin nhắn nhân viên" }),
    ).not.toBeInTheDocument();
    expect(messengerButton).toHaveAttribute("aria-expanded", "false");
  });

  it("opens a notification thread from legacy router state without changing workspace", async () => {
    renderStaffLayout({
      route: {
        pathname: "/staff/dashboard",
        state: { openStaffMessenger: true, threadId: "thread-9" },
      },
    });

    const dialog = await screen.findByRole("dialog", {
      name: "Tin nhắn nhân viên",
    });
    expect(dialog).toHaveAttribute("data-thread-id", "thread-9");
    expect(
      screen.getByRole("heading", { name: "Trung tâm ca làm" }),
    ).toBeInTheDocument();
  });

  it("puts the role workspace first in the visible navigation", () => {
    const { container, unmount } = renderStaffLayout({
      user: { ...baseUser, roleSlug: "server" },
    });

    const navigation = container.querySelector("#staff-shell-navigation");
    expect(navigation?.querySelector("a")).toHaveTextContent("Order nội bộ");
    expect(navigation?.querySelector("a")).toHaveClass("is-primary");
    unmount();

    const kitchenRender = renderStaffLayout({
      user: { ...baseUser, roleSlug: "chef" },
    });
    const kitchenNavigation = kitchenRender.container.querySelector(
      "#staff-shell-navigation",
    );
    expect(kitchenNavigation?.querySelector("a")).toHaveTextContent(
      "Bếp / Quầy bar",
    );
    expect(kitchenNavigation?.querySelector("a")).toHaveClass("is-primary");
  });

  it("shows staff ordering navigation only for order-capable roles", () => {
    renderStaffLayout({ user: { ...baseUser, roleSlug: "cashier" } });

    expect(screen.getByRole("link", { name: "Order nội bộ" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Bếp / Quầy bar" }),
    ).not.toBeInTheDocument();
  });

  it("shows reservation review navigation only with the matching role and reservation.read", () => {
    const firstRender = renderStaffLayout();

    expect(
      screen.queryByRole("link", { name: "Đổi đặt bàn" }),
    ).not.toBeInTheDocument();
    firstRender.unmount();

    const kitchenRender = renderStaffLayout({
      user: {
        ...baseUser,
        roleSlug: "bartender",
        effectivePermissionCodes: ["reservation.read"],
      },
    });

    expect(
      screen.queryByRole("link", { name: "Đổi đặt bàn" }),
    ).not.toBeInTheDocument();
    kitchenRender.unmount();

    renderStaffLayout({
      user: {
        ...baseUser,
        roleSlug: "host",
        effectivePermissionCodes: ["reservation.read", "reservation.update"],
      },
    });

    expect(screen.getByRole("link", { name: "Đổi đặt bàn" })).toBeInTheDocument();
  });

  it("shows kitchen navigation only for kitchen-capable roles", () => {
    renderStaffLayout({
      user: { ...baseUser, roleSlug: "chef" },
      route: "/staff/kitchen",
    });

    expect(screen.getByRole("link", { name: "Bếp / Quầy bar" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.queryByRole("link", { name: "Order nội bộ" }),
    ).not.toBeInTheDocument();
  });

  it("hides AI handoff navigation without handoff permissions", () => {
    renderStaffLayout();

    expect(
      screen.queryByRole("link", { name: /Bàn giao hỗ trợ/i }),
    ).not.toBeInTheDocument();
    expect(useCommunicationMock).toHaveBeenCalledTimes(1);
  });

  it("shows realtime unread AI handoff count for the effective restaurant", () => {
    useCommunicationMock.mockReturnValue({
      notifications: [
        { id: "n1", type: "ai_chatbot_handoff", readAt: null },
        { id: "n2", type: "ai_chatbot_handoff", readAt: null },
        {
          id: "n3",
          type: "ai_chatbot_handoff",
          readAt: "2026-07-05T00:00:00.000Z",
        },
      ],
    });

    renderStaffLayout({
      activeRestaurantId: "active-r2",
      restaurant: { id: "active-r2", name: "Cohan Active" },
      user: {
        ...baseUser,
        restaurantForStaff: "legacy-r1",
        permissions: ["ai.chatbot.handoff"],
      },
    });

    expect(
      screen.getByRole("link", { name: /Bàn giao hỗ trợ/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("2 yêu cầu hỗ trợ chưa đọc")).toHaveTextContent(
      "2",
    );
    expect(useCommunicationMock).toHaveBeenCalledTimes(2);
    expect(useCommunicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "active-r2",
        notificationsEnabled: true,
      }),
    );
  });

  it("injects the active restaurant into the staff handoff page", () => {
    const HandoffProbe = ({ restaurantId }) => (
      <div data-testid="handoff-probe" data-restaurant-id={restaurantId} />
    );

    renderStaffLayout({
      route: "/staff/ai-handoff",
      activeRestaurantId: "active-r2",
      restaurant: { id: "active-r2", name: "Cohan Active" },
      user: {
        ...baseUser,
        restaurantForStaff: "legacy-r1",
        permissions: ["ai.chatbot.handoff"],
      },
      children: <HandoffProbe />,
    });

    expect(screen.getByTestId("handoff-probe")).toHaveAttribute(
      "data-restaurant-id",
      "active-r2",
    );
  });

  it("creates one staff main landmark", () => {
    const { container } = renderStaffLayout();

    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelector("main#staff-main-content")).toBeInTheDocument();
  });
});
