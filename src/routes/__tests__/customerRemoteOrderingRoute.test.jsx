import React from "react";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import { hasAllowedRole } from "../routeGuard";
import { canAccessRoute, getDefaultPathForRole } from "@/utils/frontendRoleAccess";

const CustomerCheckoutGuard = ({ authState }) => {
  const { token, role, isAuthenticated } = authState || {};
  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }
  if (!hasAllowedRole(["customer"], role) || !canAccessRoute(role, "/checkout")) {
    return <Navigate to={getDefaultPathForRole(role)} replace />;
  }
  return <div>customer-checkout</div>;
};

const renderCustomerRoutes = (initialPath, checkoutAuthState) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/cus-menu" element={<div>public-menu</div>} />
        <Route path="/food/:foodId" element={<div>public-food-detail</div>} />
        <Route
          path="/checkout"
          element={<CustomerCheckoutGuard authState={checkoutAuthState} />}
        />
        <Route path="/login" element={<div>login-page</div>} />
        <Route path="/manager" element={<div>manager-home</div>} />
        <Route path="/admin/dashboard" element={<div>admin-home</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("customer remote ordering routes", () => {
  it("keeps AppRouter contract public for menu/detail and private for customer checkout", () => {
    const src = fs.readFileSync("src/routes/AppRouter.jsx", "utf8");

    expect(src).toMatch(/<Route path="\/cus-menu" element=\{<RestaurantMenu \/>\} \/>/);
    expect(src).toMatch(/<Route path="\/food\/:foodId" element=\{<FoodDetail \/>\} \/>/);
    expect(src).toMatch(
      /<Route path="\/checkout" element=\{withPrivateRoute\(<CheckoutPage \/>, \["customer"\]\)\} \/>/,
    );
  });

  it("keeps /cus-menu public", () => {
    renderCustomerRoutes("/cus-menu");
    expect(screen.getByText("public-menu")).toBeInTheDocument();
  });

  it("keeps /food/:foodId public", () => {
    renderCustomerRoutes("/food/food-1");
    expect(screen.getByText("public-food-detail")).toBeInTheDocument();
  });

  it("redirects guest checkout access to login", () => {
    renderCustomerRoutes("/checkout", {
      token: null,
      role: null,
      accountVerified: false,
      loading: false,
      isAuthenticated: false,
    });
    expect(screen.getByText("login-page")).toBeInTheDocument();
  });

  it("allows customer checkout access", () => {
    renderCustomerRoutes("/checkout", {
      token: "token",
      role: "customer",
      accountVerified: true,
      loading: false,
      isAuthenticated: true,
    });
    expect(screen.getByText("customer-checkout")).toBeInTheDocument();
  });

  it.each([
    ["manager", "manager-home"],
    ["admin", "admin-home"],
  ])("redirects %s away from customer checkout", (role, expectedHome) => {
    renderCustomerRoutes("/checkout", {
      token: "token",
      role,
      accountVerified: true,
      loading: false,
      isAuthenticated: true,
    });
    expect(screen.getByText(expectedHome)).toBeInTheDocument();
    expect(screen.queryByText("customer-checkout")).not.toBeInTheDocument();
  });
});
