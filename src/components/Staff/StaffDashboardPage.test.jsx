import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import StaffLayout from "@/layouts/StaffLayout";
import StaffDashboardPage from "./StaffDashboardPage";

const user = {
  id: "staff-1",
  fullName: "Nhân viên Test",
  roleSlug: "server",
  restaurantForStaff: { id: "r1", name: "Cơ sở 1" },
};

const renderDashboard = () =>
  render(
    <MemoryRouter initialEntries={["/staff/dashboard"]}>
      <AuthContext.Provider value={{ user }}>
        <StaffLayout>
          <StaffDashboardPage />
        </StaffLayout>
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe("StaffDashboardPage", () => {
  it("prioritizes shift actions without repeating the shell identity", () => {
    renderDashboard();

    expect(
      screen.getByRole("heading", { level: 1, name: "Trung tâm ca làm" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Xin chào,/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Kiểm tra lịch trước khi bắt đầu" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Mở lịch cá nhân/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Xem ca và phản hồi lịch/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Chấm công & chỉnh công/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tạo và theo dõi đơn/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Xem nhắc việc mới/i })).toBeInTheDocument();
  });

  it("keeps role tools visible and secondary utilities collapsed", () => {
    const { container } = renderDashboard();

    expect(
      container.querySelector('.staff-dashboard-role-grid a[href="/staff/orders"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.staff-dashboard-role-grid a[href="/staff/kitchen"]'),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Tiện ích khác")).toBeInTheDocument();
    expect(container.querySelector("details.staff-dashboard-more")).not.toHaveAttribute("open");
    expect(
      container.querySelector('.staff-dashboard-more a[href="/staff/profile"]'),
    ).toBeInTheDocument();
  });

  it("does not add another main landmark inside StaffLayout", () => {
    const { container } = renderDashboard();

    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelector("main#staff-main-content")).toBeInTheDocument();
  });
});
