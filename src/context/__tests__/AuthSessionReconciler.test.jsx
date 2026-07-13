import React, { useContext, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../AuthContext";
import AuthSessionReconciler from "../AuthSessionReconciler";
import {
  clearAuth,
  publishAnonymousSession,
  publishAuthenticatedSession,
  setAuth,
} from "@/lib/authStorage";

function createDeferred() {
  let resolve;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function Consumer() {
  const auth = useContext(AuthContext);
  return (
    <>
      <div data-testid="token">{auth.token || ""}</div>
      <div data-testid="user-name">{auth.user?.fullName || ""}</div>
      <div data-testid="session-state">{auth.sessionState}</div>
      <button
        type="button"
        onClick={() =>
          auth.login("login-token", {
            id: "user-login",
            fullName: "Khách đăng nhập",
            roleName: "customer",
          })
        }
      >
        login
      </button>
    </>
  );
}

function Harness({ loginImplementation, onLogout = vi.fn() }) {
  const [authState, setAuthState] = useState({
    token: null,
    user: null,
    sessionState: "anonymous",
  });

  const login = vi.fn(async (token, user) => {
    if (loginImplementation) await loginImplementation();
    setAuthState({ token, user, sessionState: "authenticated" });
  });

  const logout = vi.fn(() => {
    onLogout();
    setAuthState({ token: null, user: null, sessionState: "anonymous" });
  });

  const value = {
    ...authState,
    loading: false,
    sessionWarning: "",
    isAuthenticated: Boolean(authState.token),
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      <AuthSessionReconciler>
        <Consumer />
      </AuthSessionReconciler>
    </AuthContext.Provider>
  );
}

describe("AuthSessionReconciler", () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearAuth();
    vi.useRealTimers();
  });

  afterEach(() => {
    cleanup();
    clearAuth();
    vi.restoreAllMocks();
  });

  it("updates the visible login state before a pending parent cache reset finishes", async () => {
    const pendingReset = createDeferred();
    render(<Harness loginImplementation={() => pendingReset.promise} />);

    fireEvent.click(screen.getByText("login"));

    expect(screen.getByTestId("token")).toHaveTextContent("login-token");
    expect(screen.getByTestId("user-name")).toHaveTextContent("Khách đăng nhập");
    expect(screen.getByTestId("session-state")).toHaveTextContent("authenticated");

    await act(async () => {
      pendingReset.resolve();
      await pendingReset.promise;
    });

    await waitFor(() =>
      expect(screen.getByTestId("token")).toHaveTextContent("login-token"),
    );
  });

  it("synchronizes a token refreshed outside React into the visible auth context", async () => {
    render(<Harness />);

    act(() => {
      publishAuthenticatedSession({
        token: "refreshed-token",
        user: {
          id: "user-refresh",
          fullName: "Khách đã khôi phục",
          roleName: "customer",
        },
      });
    });

    expect(screen.getByTestId("token")).toHaveTextContent("refreshed-token");
    expect(screen.getByTestId("user-name")).toHaveTextContent("Khách đã khôi phục");
    expect(screen.getByTestId("session-state")).toHaveTextContent("authenticated");

    await waitFor(() => expect(screen.getByTestId("token")).toHaveTextContent("refreshed-token"));
  });

  it("switches the UI to anonymous only after an explicit session rejection", async () => {
    const onLogout = vi.fn();
    setAuth({ token: "existing-token" });
    render(<Harness onLogout={onLogout} />);

    act(() => {
      publishAuthenticatedSession({
        token: "existing-token",
        user: { id: "user-1", fullName: "Người dùng", roleName: "customer" },
      });
    });
    expect(screen.getByTestId("session-state")).toHaveTextContent("authenticated");

    act(() => {
      publishAnonymousSession("refresh_rejected");
    });

    expect(screen.getByTestId("token")).toHaveTextContent("");
    expect(screen.getByTestId("user-name")).toHaveTextContent("");
    expect(screen.getByTestId("session-state")).toHaveTextContent("anonymous");
    await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1));
  });
});
