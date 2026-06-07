import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../ProtectedRoute";
import { AuthContext } from "../../context/AuthContext";

const renderProtectedRoute = (authValue) =>
  render(
    <MemoryRouter initialEntries={["/manager"]}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/manager" element={<div>manager content</div>} />
          </Route>
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe("ProtectedRoute", () => {
  it("does not redirect when token exists and sessionState is restoring", () => {
    renderProtectedRoute({
      loading: false,
      token: "restoring-token",
      sessionState: "restoring",
      isAuthenticated: true,
      user: null,
    });

    expect(screen.getByText("Đang xác minh phiên...")).toBeInTheDocument();
    expect(screen.queryByText("login page")).not.toBeInTheDocument();
  });

  it("does not redirect when token exists but user is temporarily null", () => {
    renderProtectedRoute({
      loading: false,
      token: "token-without-user-yet",
      sessionState: "authenticated",
      isAuthenticated: true,
      user: null,
    });

    expect(screen.getByText("Đang xác minh phiên...")).toBeInTheDocument();
    expect(screen.queryByText("login page")).not.toBeInTheDocument();
  });

  it("redirects only when no token and sessionState is anonymous", () => {
    renderProtectedRoute({
      loading: false,
      token: null,
      sessionState: "anonymous",
      isAuthenticated: false,
      user: null,
    });

    expect(screen.getByText("login page")).toBeInTheDocument();
  });
});
