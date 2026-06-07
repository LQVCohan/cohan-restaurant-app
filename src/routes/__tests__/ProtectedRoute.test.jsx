import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ProtectedRoute from "../ProtectedRoute";
import { AuthContext } from "../../context/AuthContext";

function LocationLabel() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderProtected(authValue) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={["/manager/#payroll"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route
              path="/manager/"
              element={<div>Protected manager page</div>}
            />
          </Route>
          <Route path="/login" element={<LocationLabel />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("ProtectedRoute", () => {
  it("does not redirect when token exists and sessionState is restoring", () => {
    renderProtected({
      loading: false,
      token: "restored-token",
      sessionState: "restoring",
      sessionWarning: "",
      isAuthenticated: true,
      user: null,
    });

    expect(screen.getByText("Đang xác minh phiên...")).toBeInTheDocument();
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
  });

  it("does not redirect when token exists and user is temporarily null", () => {
    renderProtected({
      loading: false,
      token: "authorized-token",
      sessionState: "authenticated",
      sessionWarning: "",
      isAuthenticated: true,
      user: null,
    });

    expect(screen.getByText("Đang xác minh phiên...")).toBeInTheDocument();
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
  });

  it("redirects only when no token and sessionState is anonymous", () => {
    renderProtected({
      loading: false,
      token: null,
      sessionState: "anonymous",
      sessionWarning: "",
      isAuthenticated: false,
      user: null,
    });

    expect(screen.getByTestId("location")).toHaveTextContent("/login");
  });
});
