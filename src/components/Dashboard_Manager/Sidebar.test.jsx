import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import Sidebar from "./Sidebar";

const managerUser = {
  fullName: "Quản lý ca",
  roleName: "manager",
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
    expect(screen.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Đơn hàng" })).toBeInTheDocument();
    expect(screen.getByText("Quản lý ca")).toBeInTheDocument();
  });

  it("keeps existing navigation callbacks when selecting an item", () => {
    const { onPageChange } = renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Đơn hàng" }));

    expect(onPageChange).toHaveBeenCalledWith("orders");
  });
});
