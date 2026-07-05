import React from "react";
import { render, screen } from "@testing-library/react";
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

const baseUser = {
  id: "staff-1",
  fullName: "Nhân viên Test",
  roleSlug: "server",
};

const renderStaffLayout = ({ user = baseUser, route = "/staff/dashboard" } = {}) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider value={{ user }}>
        <StaffLayout>
          <p>Nội dung nhân viên</p>
        </StaffLayout>
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe("StaffLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCommunicationMock.mockReturnValue({ notifications: [] });
  });

  it("renders the shell header, shared navigation, and active route", () => {
    renderStaffLayout({ route: "/staff/schedule" });

    expect(screen.getByRole("heading", { name: "Vận hành ca làm" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tổng quan" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lịch cá nhân" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Hồ sơ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Thông báo" })).toBeInTheDocument();
  });

  it("shows staff ordering navigation only for order-capable roles", () => {
    renderStaffLayout({ user: { ...baseUser, roleSlug: "cashier" } });

    expect(screen.getByRole("link", { name: "Order nội bộ" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Bếp / Quầy bar" })).not.toBeInTheDocument();
  });

  it("shows kitchen navigation only for kitchen-capable roles", () => {
    renderStaffLayout({ user: { ...baseUser, roleSlug: "chef" }, route: "/staff/kitchen" });

    expect(screen.getByRole("link", { name: "Bếp / Quầy bar" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Order nội bộ" })).not.toBeInTheDocument();
  });

  it("hides AI handoff navigation without handoff permissions", () => {
    renderStaffLayout();

    expect(screen.queryByRole("link", { name: /Bàn giao hỗ trợ/i })).not.toBeInTheDocument();
    expect(useCommunicationMock).not.toHaveBeenCalled();
  });

  it("shows realtime unread AI handoff count for permitted staff", () => {
    useCommunicationMock.mockReturnValue({
      notifications: [
        { id: "n1", type: "ai_chatbot_handoff", readAt: null },
        { id: "n2", type: "ai_chatbot_handoff", readAt: null },
        { id: "n3", type: "ai_chatbot_handoff", readAt: "2026-07-05T00:00:00.000Z" },
      ],
    });

    renderStaffLayout({
      user: {
        ...baseUser,
        restaurantForStaff: "r1",
        permissions: ["ai.chatbot.handoff"],
      },
    });

    expect(screen.getByRole("link", { name: /Bàn giao hỗ trợ/i })).toBeInTheDocument();
    expect(screen.getByLabelText("2 yêu cầu hỗ trợ chưa đọc")).toHaveTextContent("2");
  });

  it("creates one staff main landmark", () => {
    const { container } = renderStaffLayout();

    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelector("main#staff-main-content")).toBeInTheDocument();
  });
});
