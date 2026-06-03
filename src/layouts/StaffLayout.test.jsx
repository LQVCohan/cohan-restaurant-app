import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import StaffLayout from "./StaffLayout";

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
    expect(screen.queryByRole("link", { name: "Khu vực bếp" })).not.toBeInTheDocument();
  });

  it("shows kitchen navigation only for kitchen-capable roles", () => {
    renderStaffLayout({ user: { ...baseUser, roleSlug: "chef" }, route: "/staff/kitchen" });

    expect(screen.getByRole("link", { name: "Khu vực bếp" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Order nội bộ" })).not.toBeInTheDocument();
  });

  it("creates one staff main landmark", () => {
    const { container } = renderStaffLayout();

    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelector("main#staff-main-content")).toBeInTheDocument();
  });
});
