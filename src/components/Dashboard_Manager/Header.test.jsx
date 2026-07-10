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

vi.mock("./RestaurantSetup/RestaurantCuisineOnboarding", () => ({
  default: ({ openRequest }) => (
    <div data-testid="cuisine-onboarding" data-open-request={openRequest} />
  ),
}));

const pendingBrand = {
  id: "b1",
  name: "COHAN",
  restaurants: [
    {
      id: "r1",
      name: "Chi nhánh mới",
      initialSetup: { status: "pending" },
    },
  ],
};

const renderHeader = (avatarOrOptions = "/uploads/admin.png") => {
  const options = typeof avatarOrOptions === "object"
    ? avatarOrOptions
    : { avatar: avatarOrOptions };
  const {
    avatar = "/uploads/admin.png",
    user: userOverride = {},
    activeBrand = null,
  } = options;
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
            ...userOverride,
          },
          logout,
        }}
      >
        <Header activeBrand={activeBrand} />
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

  it("does not auto-show cuisine onboarding for system admin", () => {
    localStorage.setItem("manager.selectedRestaurantId", "r1");

    renderHeader({ activeBrand: pendingBrand });

    expect(screen.queryByTestId("cuisine-onboarding")).not.toBeInTheDocument();
  });

  it("still shows cuisine onboarding for a manager scoped to a pending branch", () => {
    localStorage.setItem("manager.selectedRestaurantId", "r1");

    renderHeader({
      activeBrand: pendingBrand,
      user: { fullName: "Manager User", roleName: "manager" },
    });

    expect(screen.getByTestId("cuisine-onboarding")).toBeInTheDocument();
  });

  it("offers a persistent account-menu action to reopen pending cuisine setup", () => {
    localStorage.setItem("manager.selectedRestaurantId", "r1");

    renderHeader({
      activeBrand: pendingBrand,
      user: { fullName: "Manager User", roleName: "manager" },
    });

    expect(screen.getByTestId("cuisine-onboarding")).toHaveAttribute("data-open-request", "0");
    openUserMenu();
    fireEvent.click(screen.getByRole("button", { name: "Chọn mẫu thiết lập nhà hàng" }));
    expect(screen.getByTestId("cuisine-onboarding")).toHaveAttribute("data-open-request", "1");
    expect(screen.queryByRole("button", { name: "Chọn mẫu thiết lập nhà hàng" })).not.toBeInTheDocument();
  });
});
