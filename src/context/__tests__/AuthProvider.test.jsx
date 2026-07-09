import React, { StrictMode, useContext } from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { AuthProvider } from "../AuthProvider";
import { AuthContext } from "../AuthContext";
import { clearRefreshPromise } from "@/lib/authRefresh";
import { SESSION_ACCESS_TOKEN_KEY, setAuth } from "@/lib/authStorage";

const navigateMock = vi.fn();
const clearStoreMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const useQueryMock = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async (i) => ({ ...(await i()), useNavigate: () => navigateMock }));
vi.mock("@apollo/client/react", () => ({
  useApolloClient: () => ({
    clearStore: clearStoreMock,
  }),
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
      <div data-testid="token">{ctx?.token || ""}</div>
      <div data-testid="session-state">{ctx?.sessionState || ""}</div>
      <div data-testid="loading">{String(ctx?.loading)}</div>
      <div data-testid="user-id">{ctx?.user?.id || ""}</div>
      <div data-testid="legacy-restaurant">{ctx?.user?.restaurantForStaff || ""}</div>
      <div data-testid="memberships">{String((ctx?.brandMemberships || []).length)}</div>
      <div data-testid="active-restaurant">{ctx?.activeRestaurantId || ""}</div>
      <div data-testid="restaurants">{(ctx?.restaurants || []).map((item) => item.name).join(",")}</div>
      <div data-testid="restaurant-setup-status">{ctx?.restaurants?.[0]?.initialSetup?.status || ""}</div>
      <button
        onClick={() =>
          ctx.login("abc", {
            id: "manager-1",
            roleName: "manager",
            emailVerified: true,
            restaurantForStaff: "legacy-restaurant",
          })
        }
      >
        login
      </button>
      <button
        onClick={() =>
          ctx.login("remember-token", { id: "u2", roleName: "customer" }, null, {
            rememberIdentifier: true,
            identifier: "  tester@example.com  ",
          })
        }
      >
        login-remember
      </button>
      <button
        onClick={() =>
          ctx.login("forget-token", { id: "u3", roleName: "customer" }, null, {
            rememberIdentifier: false,
            identifier: "tester@example.com",
          })
        }
      >
        login-forget
      </button>
      <button onClick={() => ctx.login("admin-token", { id: "admin-1", roleName: "admin", emailVerified: true })}>login-admin</button>
      <button onClick={() => ctx.logout()}>logout</button>
    </>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setAuth({ token: null });
    navigateMock.mockReset();
    clearStoreMock.mockReset();
    clearStoreMock.mockResolvedValue(undefined);
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

  it("login writes only the session-restorable token and drops legacy restaurant fields", async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("is-auth")).toHaveTextContent("true"));
    expect(screen.getByTestId("email-verified")).toHaveTextContent("true");
    expect(screen.getByTestId("legacy-restaurant")).toHaveTextContent("");
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBe("abc");

    const meQueryCall = useQueryMock.mock.calls.find(([query]) =>
      getQueryText(query).includes("query Me"),
    );
    expect(getQueryText(meQueryCall?.[0])).not.toContain("restaurantForStaff");
  });

  it("login honors remembered identifier options", async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText("login-remember"));
    await waitFor(() => expect(screen.getByTestId("token")).toHaveTextContent("remember-token"));
    expect(localStorage.getItem("remembered_login_identifier")).toBe("tester@example.com");

    fireEvent.click(screen.getByText("login-forget"));
    await waitFor(() => expect(screen.getByTestId("token")).toHaveTextContent("forget-token"));
    expect(localStorage.getItem("remembered_login_identifier")).toBeNull();
    expect(sessionStorage.getItem("remembered_login_identifier")).toBeNull();
  });

  it("clears Apollo account cache on logout", async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText("login"));

    await waitFor(() =>
      expect(screen.getByTestId("is-auth")).toHaveTextContent("true"),
    );

    fireEvent.click(screen.getByText("logout"));

    await waitFor(() =>
      expect(clearStoreMock).toHaveBeenCalledTimes(1),
    );

    expect(navigateMock).toHaveBeenCalledWith("/login", {
      replace: true,
    });

    expect(sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBeNull();
  });

  it("applies token and user from a successful refresh response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "refresh-token", user: { id: "u1", roleName: "admin", emailVerified: true } }),
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("token")).toHaveTextContent("refresh-token"));
    expect(screen.getByTestId("user-id")).toHaveTextContent("u1");
    expect(screen.getByTestId("session-state")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("is-auth")).toHaveTextContent("true");
    expect(sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBe("refresh-token");
  });

  it("does not set anonymous after successful refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "refresh-token", user: { id: "u1", roleName: "manager" } }),
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("session-state")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("session-state")).not.toHaveTextContent("anonymous");
  });

  it("keeps token while user is temporarily null during restore validation", async () => {
    sessionStorage.setItem(SESSION_ACCESS_TOKEN_KEY, "stored-token");
    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("token")).toHaveTextContent("stored-token"));
    expect(screen.getByTestId("user-id")).toHaveTextContent("");
    expect(screen.getByTestId("session-state")).toHaveTextContent("restoring");
    expect(screen.getByTestId("is-auth")).toHaveTextContent("true");
  });

  it("pageshow persisted restores token and triggers session restore", async () => {
    const meRefetch = vi.fn().mockResolvedValue({ data: { me: { id: "u2", roleName: "admin" } } });
    useQueryMock.mockImplementation((query) => {
      if (getQueryText(query).includes("query Me")) {
        return { ...defaultQueryResult(), refetch: meRefetch };
      }
      return defaultQueryResult();
    });
    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("session-state")).toHaveTextContent("anonymous"));
    sessionStorage.setItem(SESSION_ACCESS_TOKEN_KEY, "pageshow-token");

    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));

    await waitFor(() => expect(screen.getByTestId("token")).toHaveTextContent("pageshow-token"));
    expect(screen.getByTestId("session-state")).toHaveTextContent("restoring");
    expect(meRefetch).toHaveBeenCalled();
  });

  it("loads memberships and restaurants through the authenticated business context", async () => {
    const businessContextResult = {
      ...defaultQueryResult(),
      data: {
        myBrandMemberships: [
          {
            id: "membership-1",
            brandId: "brand-1",
            role: "admin",
            restaurantIds: [],
            status: "active",
            brand: { id: "brand-1", name: "Cohan", slug: "cohan" },
          },
        ],
        scopedRestaurants: {
          edges: [
            {
              node: {
                id: "res-1",
                name: "Cohan Quận 1",
                brandId: "brand-1",
                initialSetup: { status: "pending" },
              },
            },
            { node: { id: "res-2", name: "Cohan Quận 3", brandId: "brand-1" } },
          ],
        },
      },
    };
    useQueryMock.mockImplementation((query, options = {}) => {
      const queryText = getQueryText(query);
      if (queryText.includes("query AuthBusinessContext") && !options.skip) {
        return businessContextResult;
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
    expect(screen.getByTestId("memberships")).toHaveTextContent("1");
    expect(screen.getByTestId("active-restaurant")).toHaveTextContent("res-1");
    expect(screen.getByTestId("restaurant-setup-status")).toHaveTextContent("pending");

    const businessCalls = useQueryMock.mock.calls.filter(([query]) =>
      getQueryText(query).includes("query AuthBusinessContext"),
    );
    expect(businessCalls.some(([, options]) => options?.skip === false)).toBe(true);
    expect(getQueryText(businessCalls[0]?.[0])).toContain("initialSetup");
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