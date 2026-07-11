import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import Header from "./Header";

vi.mock("../SearchBox/SearchBox", () => ({
  default: () => <div data-testid="manager-search" />,
}));

vi.mock("./Account/ManagerAccountCenter", () => ({
  default: ({ initialTab }) => <div data-testid="manager-account-center">{initialTab}</div>,
}));

vi.mock("./RestaurantSetup/RestaurantCuisineOnboarding", () => ({
  default: () => null,
}));

vi.mock("./Menu/ManagerMenuCatalogModal", () => ({
  default: ({ isOpen, restaurantId, restaurantName }) =>
    isOpen ? (
      <div data-testid="menu-catalog-modal">
        {restaurantId}:{restaurantName}
      </div>
    ) : null,
}));

const oldUser = {
  id: "old-user",
  fullName: "Quản lý cũ",
  email: "old@cohan.vn",
  roleName: "manager",
  avatarUrl: "/old-avatar.webp",
};

const newUser = {
  id: "new-user",
  fullName: "Quản lý mới",
  email: "new@cohan.vn",
  roleName: "manager",
  avatarUrl: "/new-avatar.webp",
};

const renderHeader = (user, props = {}) =>
  render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user, logout: vi.fn() }}>
        <Header {...props} />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe("Manager Header account isolation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("closes account UI and renders the new identity immediately after an account switch", async () => {
    const view = renderHeader(oldUser);

    fireEvent.click(screen.getByRole("button", { name: "Mở menu tài khoản" }));
    expect(screen.getAllByText("Quản lý cũ").length).toBeGreaterThan(0);
    expect(screen.getByText("old@cohan.vn")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Thông tin cá nhân/i }));
    expect(screen.getByTestId("manager-account-center")).toHaveTextContent("profile");

    view.rerender(
      <MemoryRouter>
        <AuthContext.Provider value={{ user: newUser, logout: vi.fn() }}>
          <Header />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.queryByTestId("manager-account-center")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Quản lý mới")).toBeInTheDocument();
    expect(screen.queryByText("old@cohan.vn")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mở menu tài khoản" }));
    expect(screen.getByText("new@cohan.vn")).toBeInTheDocument();
    expect(screen.queryByText("Quản lý cũ")).not.toBeInTheDocument();
  });

  it("opens the menu catalog for the selected branch only on the menu page", () => {
    localStorage.setItem("manager.selectedRestaurantId", "restaurant-1");
    renderHeader(newUser, {
      pageTitle: "Quản lý menu",
      activeBrand: {
        id: "brand-1",
        name: "Cohan",
        restaurants: [{ id: "restaurant-1", name: "Cohan Quận 1" }],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Danh sách thực đơn" }));
    expect(screen.getByTestId("menu-catalog-modal")).toHaveTextContent(
      "restaurant-1:Cohan Quận 1",
    );
  });
});
