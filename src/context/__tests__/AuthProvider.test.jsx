import React, { StrictMode, useContext } from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { AuthProvider } from "../AuthProvider";
import { AuthContext } from "../AuthContext";
import { clearRefreshPromise } from "@/lib/authRefresh";

const navigateMock = vi.fn();
const useQueryMock = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async (i) => ({ ...(await i()), useNavigate: () => navigateMock }));
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
      <div data-testid="email-verified">{String(ctx?.user?.emailVerified)}</div>
      <div data-testid="restaurants-loading">{String(ctx?.restaurantsLoading)}</div>
      <div data-testid="restaurants">{(ctx?.restaurants || []).map((item) => item.name).join(",")}</div>
      <button onClick={() => ctx.login("abc", { roleName: "manager", emailVerified: true })}>login</button>
      <button onClick={() => ctx.login("admin-token", { id: "admin-1", roleName: "admin", emailVerified: true })}>login-admin</button>
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
      () => new Promise((resolve) => {
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
    resolveRefresh({ ok: true, json: async () => ({ token: "t1", user: { roleName: "customer", emailVerified: true } }) });
    await waitFor(() => expect(screen.getByTestId("is-auth")).toHaveTextContent("true"));
  });

  it("login does not write token to storage and preserves emailVerified", async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("is-auth")).toHaveTextContent("true"));
    expect(screen.getByTestId("email-verified")).toHaveTextContent("true");
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(sessionStorage.getItem("token")).toBeNull();
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
      expect(screen.getByTestId("restaurants")).toHaveTextContent("Cohan Quận 1,Cohan Quận 3"),
    );

    const managerRestaurantCalls = useQueryMock.mock.calls.filter(([query]) =>
      getQueryText(query).includes("query ManagerRestaurants"),
    );
    expect(managerRestaurantCalls.every(([, options]) => options?.skip)).toBe(true);
  });

  it("refresh timer triggers one refresh before expiry", async () => {
    vi.useFakeTimers();
    const exp = Math.floor((Date.now() + 2 * 60 * 1000) / 1000);
    const payload = btoa(JSON.stringify({ exp })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    const token = `x.${payload}.y`;

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token, user: { roleName: "customer" } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: `${token}2`, user: { roleName: "customer" } }) });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByTestId("is-auth")).toHaveTextContent("true");

    await vi.advanceTimersByTimeAsync(61_000);
    await Promise.resolve();

    const refreshCalls = global.fetch.mock.calls.filter(([url]) => String(url).includes("/api/auth/refresh"));
    expect(refreshCalls.length).toBe(2);
  }, 10000);
});
