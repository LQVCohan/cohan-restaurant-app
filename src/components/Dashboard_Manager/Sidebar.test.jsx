import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import Sidebar from "./Sidebar";

const managerUser = {
  fullName: "Quản lý ca",
  id: "u1",
  roleName: "manager",
  avatarUrl: "/uploads/avatars/manager.webp",
};

const renderSidebar = (props = {}) => {
  const onPageChange = vi.fn();
  const onClose = vi.fn();

  render(
    <AuthContext.Provider value={{ user: managerUser }}>
      <Sidebar
        isOpen
        activeItem="dashboard"
        onClose={onClose}
        onPageChange={onPageChange}
        {...props}
      />
    </AuthContext.Provider>,
  );

  return { onPageChange, onClose };
};

describe("Manager Sidebar", () => {
  it("renders the manager navigation and marks the active item", () => {
    renderSidebar();

    expect(screen.getByRole("navigation", { name: "Điều hướng quản lý nhà hàng" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tổng quan" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Đơn hàng" })).toBeInTheDocument();
    expect(screen.getByText("Quản lý ca")).toBeInTheDocument();
  });

  it("renders user avatar image from relative backend path", () => {
    renderSidebar();

    const avatar = document.querySelector(".user-avatar-small img");
    expect(avatar).toHaveAttribute("src", expect.stringContaining("/uploads/avatars/manager.webp"));
  });

  it("falls back to initials when the sidebar avatar image fails", () => {
    renderSidebar();

    fireEvent.error(document.querySelector(".user-avatar-small img"));
    expect(screen.getByText("QL")).toBeInTheDocument();
  });

  it("prefers brand role over system role in the footer", () => {
    renderSidebar({ activeBrand: { id: "b1", membershipRole: "admin" } });

    expect(screen.getByText(/Quản trị Brand/)).toBeInTheDocument();
    expect(screen.getByTitle(/Vai trò trong thương hiệu: Quản trị Brand .* Phạm vi phụ trách: Toàn bộ Brand/)).toBeInTheDocument();
  });

  it("falls back to system role when no brand role exists", () => {
    renderSidebar({ activeBrand: { id: "b1" } });

    expect(screen.getByText(/Quản lý hệ thống/)).toBeInTheDocument();
  });

  it("keeps existing navigation callbacks when selecting an item", () => {
    const { onPageChange } = renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Đơn hàng" }));

    expect(onPageChange).toHaveBeenCalledWith("orders");
  });
});
