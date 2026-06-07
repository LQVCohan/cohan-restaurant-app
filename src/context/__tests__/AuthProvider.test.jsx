import React, { StrictMode, useContext } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { AuthProvider } from "../AuthProvider";
import { AuthContext } from "../AuthContext";
import { clearRefreshPromise } from "@/lib/authRefresh";
import { SESSION_ACCESS_TOKEN_KEY, clearAuth } from "@/lib/authStorage";

const navigateMock = vi.fn();
const useQueryMock = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async (i) => ({
  ...(await i()),
  useNavigate: () => navigateMock,
}));
vi.mock("@apollo/client/react", () => ({
  useQuery: useQueryMock,
}));

const getQueryText = (query) => query?.loc?.source?.body || "";
const defaultQueryResult = () => ({
  data: null,
  loading: false,
  error: null,
  refetch: vi.fn().mockResolvedValue({ data: { me: null } }),
});

function Consumer() {
  const ctx = useContext(AuthContext);
  return (
    <>
      <div data-testid="is-auth">{String(ctx?.isAuthenticated)}</div>
      <div data-testid="token">{ctx?.token || ""}</div>
      <div data-testid="session-state">{ctx?.sessionState || ""}</div>
      <div data-testid="user-role">{ctx?.user?.roleName || ""}</div>
      <div data-testid="email-verified">{String(ctx?.user?.emailVerified)}</div>
      <div data-testid="restaurants-loading">
        {String(ctx?.restaurantsLoading)}
      </div>
      <div data-testid="restaurants">
        {(ctx?.restaurants || []).map((item) => item.name).join(",")}
      </div>
      <button
        onClick={() =>
          ctx.login("abc", { roleName: "manager", emailVerified: true })
        }
      >
        login
      </button>
      <button
        onClick={() =>
          ctx.login("admin-token", {
            id: "admin-1",
            roleName: "admin",
            emailVerified: true,
          })
        }
      >
        login-admin
      </button>
      <button onClick={() => ctx.logout()}>logout</button>
    </>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    navigateMock.mockReset();
    clearRefreshPromise();
    clearAuth();
    useQueryMock.mockImplementation(() => defaultQueryResult());
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
  });

  afterEach(async () => {
    cleanup();
    clearRefreshPromise();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("startup refresh uses credentials include", async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:4000/api/auth/refresh",
        expect.objectContaining({ method: "POST", credentials: "include" }),
      ),
    );
  });

  it("StrictMode double render keeps one in-flight refresh request", async () => {
    let resolveRefresh;
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    render(
      <StrictMode>
        <AuthProvider>
          <Consumer />
        </AuthProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    resolveRefresh({
      ok: true,
      json: async () => ({
        token: "t1",
        user: { roleName: "customer", emailVerified: true },
      }),
    });
    await waitFor(() =>
      expect(screen.getByTestId("is-auth")).toHaveTextContent("true"),
    );
  });

  it("login writes the access token only to sessionStorage and preserves emailVerified", async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText("login"));
    await waitFor(() =>
      expect(screen.getByTestId("is-auth")).toHaveTextContent("true"),
    );
    expect(screen.getByTestId("email-verified")).toHaveTextContent("true");
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBe("abc");
  });

  it("applies token and user from a successful refresh response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: "refresh-token",
        user: { roleName: "admin", emailVerified: true },
      }),
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("token")).toHaveTextContent("refresh-token"),
    );
    expect(screen.getByTestId("is-auth")).toHaveTextContent("true");
    expect(screen.getByTestId("session-state")).toHaveTextContent(
      "authenticated",
    );
    expect(screen.getByTestId("user-role")).toHaveTextContent("admin");
  });

  it("does not set anonymous after successful refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: "fresh-token",
        user: { roleName: "manager" },
      }),
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("session-state")).toHaveTextContent(
        "authenticated",
      ),
    );
    expect(screen.getByTestId("session-state")).not.toHaveTextContent(
      "anonymous",
    );
  });

  it("keeps token while user is temporarily null after refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "token-without-user" }),
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("token")).toHaveTextContent(
        "token-without-user",
      ),
    );
    expect(screen.getByTestId("is-auth")).toHaveTextContent("true");
    expect(screen.getByTestId("user-role")).toHaveTextContent("");
    expect(screen.getByTestId("session-state")).toHaveTextContent(
      "authenticated",
    );
  });

  it("pageshow persisted restores token and triggers session restore", async () => {
    const refetch = vi.fn().mockResolvedValue({
      data: { me: { roleName: "admin", emailVerified: true } },
    });
    useQueryMock.mockImplementation(() => ({
      ...defaultQueryResult(),
      refetch,
    }));
    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("session-state")).toHaveTextContent(
        "anonymous",
      ),
    );

    sessionStorage.setItem(SESSION_ACCESS_TOKEN_KEY, "bfcache-token");
    const event = new Event("pageshow");
    Object.defineProperty(event, "persisted", { value: true });
    window.dispatchEvent(event);

    await waitFor(() =>
      expect(screen.getByTestId("token")).toHaveTextContent("bfcache-token"),
    );
    await waitFor(() => expect(refetch).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId("session-state")).toHaveTextContent(
        "authenticated",
      ),
    );
  });

  it("loads all restaurants for admin from the restaurants query instead of restaurantsByManager", async () => {
    const adminRestaurantsResult = {
      ...defaultQueryResult(),
      data: {
        restaurants: {
          edges: [
            { node: { id: "res-1", name: "Cohan Quận 1" } },
            { node: { id: "res-2", name: "Cohan Quận 3" } },
          ],
        },
      },
    };
    useQueryMock.mockImplementation((query, options = {}) => {
      const queryText = getQueryText(query);
      if (queryText.includes("query AdminRestaurants") && !options.skip) {
        return adminRestaurantsResult;
      }
      return defaultQueryResult();
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText("login-admin"));

    await waitFor(() =>
      expect(screen.getByTestId("restaurants")).toHaveTextContent(
        "Cohan Quận 1,Cohan Quận 3",
      ),
    );

    const managerRestaurantCalls = useQueryMock.mock.calls.filter(([query]) =>
      getQueryText(query).includes("query ManagerRestaurants"),
    );
    expect(managerRestaurantCalls.every(([, options]) => options?.skip)).toBe(
      true,
    );
  });

  it("refresh timer triggers one refresh before expiry", async () => {
    vi.useFakeTimers();
    const exp = Math.floor((Date.now() + 2 * 60 * 1000) / 1000);
    const payload = btoa(JSON.stringify({ exp }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const token = `x.${payload}.y`;

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token, user: { roleName: "customer" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: `${token}2`,
          user: { roleName: "customer" },
        }),
      });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByTestId("is-auth")).toHaveTextContent("true");

    await vi.advanceTimersByTimeAsync(61_000);
    await Promise.resolve();

    const refreshCalls = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes("/api/auth/refresh"),
    );
    expect(refreshCalls.length).toBe(2);
  }, 10000);
});
