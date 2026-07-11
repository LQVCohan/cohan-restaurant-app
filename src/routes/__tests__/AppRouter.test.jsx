import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { PrivateRoute } from "../AppRouter";

const authenticatedState = (overrides = {}) => ({
  token: "token",
  role: "staff",
  accountVerified: true,
  loading: false,
  sessionState: "authenticated",
  sessionWarning: null,
  isAuthenticated: true,
  ...overrides,
});

describe("PrivateRoute guard", () => {
  const renderRoute = (authState, options = {}) =>
    render(
      <MemoryRouter initialEntries={[options.path || "/private"]}>
        <Routes>
          <Route
            path="/private"
            element={
              <PrivateRoute
                allowedRoles={options.allowedRoles}
                requireVerifiedEmail={options.requireVerifiedEmail}
                authState={authState}
              >
                <div>private-content</div>
              </PrivateRoute>
            }
          />
          <Route path="/" element={<div>customer-home</div>} />
          <Route path="/staff/dashboard" element={<div>staff-home</div>} />
          <Route path="/login" element={<div>login-page</div>} />
          <Route path="/verify-email" element={<div>verify-email-page</div>} />
        </Routes>
      </MemoryRouter>,
    );

  it("redirects unauthenticated users to /login", () => {
    renderRoute(
      authenticatedState({
        token: null,
        role: null,
        accountVerified: false,
        sessionState: "anonymous",
        isAuthenticated: false,
      }),
    );

    expect(screen.getByText("login-page")).toBeInTheDocument();
  });

  it("redirects an unauthorized role to its default workspace", () => {
    renderRoute(authenticatedState({ role: "customer" }), {
      allowedRoles: ["staff"],
    });

    expect(screen.getByText("customer-home")).toBeInTheDocument();
  });

  it("redirects staff to verify email when verification is required", () => {
    renderRoute(authenticatedState({ accountVerified: false }), {
      allowedRoles: ["staff"],
      requireVerifiedEmail: true,
    });

    expect(screen.getByText("verify-email-page")).toBeInTheDocument();
  });

  it("renders children when authentication, role, route, and verification pass", () => {
    renderRoute(authenticatedState(), {
      allowedRoles: ["staff"],
      requireVerifiedEmail: true,
    });

    expect(screen.getByText("private-content")).toBeInTheDocument();
  });

  it("keeps the page pending while the session is restoring", () => {
    const { container } = renderRoute(
      authenticatedState({ sessionState: "restoring" }),
      { allowedRoles: ["staff"] },
    );

    expect(container).toBeEmptyDOMElement();
  });
});
