import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import Header from "./Header";

vi.mock("../SearchBox/SearchBox", () => ({
  default: () => <div data-testid="search-box" />,
}));

vi.mock("./Account/ManagerAccountCenter", () => ({
  default: ({ initialTab }) => <div data-testid="manager-account-center" data-tab={initialTab} />,
}));

const renderHeader = (avatar = "/uploads/admin.png") => {
  const logout = vi.fn();
  render(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          user: {
            fullName: "Admin User",
            roleName: "admin",
            email: "admin@example.com",
            avatar,
          },
          logout,
        }}
      >
        <Header />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  return { logout };
};

const openUserMenu = () => fireEvent.click(screen.getByRole("button", { name: "Mở menu tài khoản" }));

describe("manager Header", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.classList.remove("manager-dark-mode");
  });

  it("renders slash-prefixed upload avatars as images", () => {
    renderHeader();
    expect(screen.getByRole("img", { name: "Admin User" })).toHaveAttribute(
      "src",
      "http://localhost:4000/uploads/admin.png",
    );
  });

  it("renders relative upload avatars with an image extension as images", () => {
    renderHeader("uploads/admin.webp");
    expect(screen.getByRole("img", { name: "Admin User" })).toHaveAttribute(
      "src",
      "http://localhost:4000/uploads/admin.webp",
    );
  });

  it.each([
    ["Thông tin cá nhân", "profile"],
    ["Cài đặt tài khoản", "security"],
    ["Cài đặt thông báo", "notifications"],
    ["Trợ giúp & Hỗ trợ", "support"],
  ])("opens %s inside the manager account center", (label, tab) => {
    renderHeader();
    openUserMenu();
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(screen.getByTestId("manager-account-center")).toHaveAttribute("data-tab", tab);
  });

  it("toggles manager dark mode", () => {
    renderHeader();
    openUserMenu();
    fireEvent.click(screen.getByRole("button", { name: "Chế độ tối" }));
    expect(document.body).toHaveClass("manager-dark-mode");
    expect(localStorage.getItem("manager.darkMode")).toBe("1");
  });

  it("logs out from the account menu", () => {
    const { logout } = renderHeader();
    openUserMenu();
    fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
