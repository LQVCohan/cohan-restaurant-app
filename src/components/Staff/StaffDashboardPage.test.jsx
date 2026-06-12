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
  it("renders the redesigned staff dashboard copy and action links", () => {
    renderDashboard();

    expect(screen.getByRole("heading", { name: "Hôm nay cần làm gì?" })).toBeInTheDocument();
    expect(screen.queryByText("Bạn chưa có ca hôm nay")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kiểm tra ca hôm nay" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem lịch tuần" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Đăng ký lịch/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Xem hồ sơ/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Xem thông báo/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Xem phản hồi/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Check-in\/out/ })).toBeInTheDocument();
    expect(screen.getByText("Sẵn sàng phục vụ")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hồ sơ trong khu vực nhân viên" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nhắc việc trong ca" })).toBeInTheDocument();
  });

  it("does not add another main landmark inside StaffLayout", () => {
    const { container } = renderDashboard();

    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelector("main#staff-main-content")).toBeInTheDocument();
  });
});
