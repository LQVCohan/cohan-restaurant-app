import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import Sidebar from "./Sidebar";

const managerUser = {
  fullName: "Quản lý ca",
  id: "u1",
  roleName: "manager",
  avatarUrl: "/uploads/avatars/manager.webp",
};

const renderSidebar = ({ user = managerUser, ...props } = {}) => {
  const onPageChange = vi.fn();
  const onClose = vi.fn();

  render(
    <AuthContext.Provider value={{ user }}>
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
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/manager?restaurantId=r1#dashboard");
  });

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

    expect(screen.getByText(/Quản trị chuỗi/)).toBeInTheDocument();
    expect(
      screen.getByTitle(
        "Cấp tài khoản: Quản lý | Quyền trong chuỗi: Quản trị chuỗi | Phạm vi phụ trách: Tất cả chi nhánh trong chuỗi",
      ),
    ).toBeInTheDocument();
  });

  it("falls back to system role when no brand role exists", () => {
    renderSidebar({ activeBrand: { id: "b1" } });

    expect(screen.getByText(/^Quản lý · Chưa tham gia chuỗi$/)).toBeInTheDocument();
  });

  it("renders Home and Staff portal shortcuts for managers", () => {
    renderSidebar();

    expect(screen.getByRole("link", { name: "Chuyển đến trang chủ" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Chuyển đến khu nhân viên" })).toHaveAttribute("href", "/staff/dashboard");
  });

  it("hides the Staff shortcut when the role cannot access the Staff portal", () => {
    renderSidebar({ user: { ...managerUser, roleName: "accountant" } });

    expect(screen.getByRole("link", { name: "Chuyển đến trang chủ" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Chuyển đến khu nhân viên" })).not.toBeInTheDocument();
  });

  it("persists the selected manager page before invoking the navigation callback", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    const { onPageChange } = renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Đơn hàng" }));

    expect(localStorage.getItem("manager.currentPage")).toBe("orders");
    expect(window.location.pathname).toBe("/manager");
    expect(window.location.search).toBe("?restaurantId=r1");
    expect(window.location.hash).toBe("#orders");
    expect(pushStateSpy).toHaveBeenCalledWith(
      { managerPage: "orders" },
      "",
      "/manager?restaurantId=r1#orders",
    );
    expect(onPageChange).toHaveBeenCalledWith("orders");
  });

  it("reveals the active destination as soon as the collapsed rail expands", () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const onPageChange = vi.fn();
    const onClose = vi.fn();
    const view = render(
      <AuthContext.Provider value={{ user: managerUser }}>
        <Sidebar
          isOpen={false}
          activeItem="payroll"
          onClose={onClose}
          onToggle={vi.fn()}
          onPageChange={onPageChange}
        />
      </AuthContext.Provider>,
    );

    expect(scrollIntoView).not.toHaveBeenCalled();
    view.rerender(
      <AuthContext.Provider value={{ user: managerUser }}>
        <Sidebar
          isOpen
          activeItem="payroll"
          onClose={onClose}
          onToggle={vi.fn()}
          onPageChange={onPageChange}
        />
      </AuthContext.Provider>,
    );

    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: "nearest", inline: "nearest" }),
    );
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });
});
