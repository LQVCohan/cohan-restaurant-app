import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AuthContext } from "@/context/AuthContext";
import Header from "./Header";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: {
        myCoupons: [],
        ordersByUser: { edges: [] },
        myReservations: [],
      },
    })),
  };
});

vi.mock("./HeaderSearch.jsx", () => ({
  default: () => <div data-testid="header-search" />,
}));

vi.mock("@/components/Customer/common/CustomerNotificationBell", () => ({
  default: () => <div data-testid="customer-notification-bell" />,
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const renderHeader = (authValue) =>
  render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={["/"]}>
        <Header />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

describe("Header coupon navigation", () => {
  it("opens the customer coupon wallet from the account menu", () => {
    renderHeader({
      user: { id: "user-1", username: "guest", roleName: "customer" },
      restaurants: [{ id: "restaurant-1" }],
      refRestaurant: [],
      logout: vi.fn(),
    });

    fireEvent.click(
      screen.getByRole("button", { name: /mở menu tài khoản/i }),
    );
    fireEvent.click(screen.getByText("🎟️ Kho Coupon"));

    expect(screen.getByTestId("location")).toHaveTextContent("/coupons");
  });

  it("opens coupon wallet when no coupon restaurant is available", () => {
    renderHeader({
      user: { id: "user-1", username: "guest", roleName: "customer" },
      restaurants: [],
      refRestaurant: [],
      logout: vi.fn(),
    });

    fireEvent.click(
      screen.getByRole("button", { name: /mở menu tài khoản/i }),
    );
    fireEvent.click(screen.getByText("🎟️ Kho Coupon"));

    expect(screen.getByTestId("location")).toHaveTextContent("/coupons");
  });
});
