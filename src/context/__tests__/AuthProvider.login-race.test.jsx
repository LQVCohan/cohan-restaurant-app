import React, { useContext } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "../AuthProvider";
import { AuthContext } from "../AuthContext";
import { clearRefreshPromise } from "@/lib/authRefresh";
import { setAuth } from "@/lib/authStorage";

const navigateMock = vi.fn();
const clearStoreMock = vi.hoisted(() => vi.fn());
const useQueryMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
}));

vi.mock("@apollo/client/react", () => ({
  useApolloClient: () => ({ clearStore: clearStoreMock }),
  useQuery: useQueryMock,
}));

const getQueryText = (query) => query?.loc?.source?.body || "";
const defaultQueryResult = () => ({
  data: null,
  loading: false,
  error: null,
  refetch: vi.fn().mockResolvedValue({ data: { me: null } }),
});

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
        brand: { id: "brand-1", name: "COHAN", slug: "cohan" },
      },
    ],
    scopedRestaurants: {
      edges: [
        {
          node: {
            id: "restaurant-1",
            name: "COHAN Quận 1",
            brandId: "brand-1",
          },
        },
      ],
    },
  },
};

function Consumer() {
  const auth = useContext(AuthContext);
  return (
    <>
      <div data-testid="session-state">{auth.sessionState}</div>
      <div data-testid="token">{auth.token || ""}</div>
      <div data-testid="user-id">{auth.user?.id || ""}</div>
      <div data-testid="user-name">{auth.user?.fullName || ""}</div>
      <div data-testid="restaurants">
        {(auth.restaurants || []).map((restaurant) => restaurant.name).join(",")}
      </div>
      <button
        onClick={() =>
          auth.login("old-token", {
            id: "old-manager",
            fullName: "Old Manager",
            roleName: "manager",
            emailVerified: true,
          })
        }
      >
        login-old
      </button>
      <button
        onClick={() =>
          auth.login("new-token", {
            id: "new-manager",
            fullName: "New Manager",
            roleName: "manager",
            emailVerified: true,
          })
        }
      >
        login-new
      </button>
      <button onClick={() => auth.logout()}>logout</button>
    </>
  );
}

describe("AuthProvider account switch isolation", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setAuth({ token: null });
    navigateMock.mockReset();
    clearStoreMock.mockReset();
    clearStoreMock.mockResolvedValue(undefined);
    clearRefreshPromise();
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    useQueryMock.mockImplementation((query, options = {}) => {
      if (
        getQueryText(query).includes("query AuthBusinessContext") &&
        !options.skip
      ) {
        return businessContextResult;
      }
      return defaultQueryResult();
    });
  });

  afterEach(() => {
    cleanup();
    clearRefreshPromise();
    vi.clearAllMocks();
  });

  it("waits for logout cache clearing before loading the next account restaurants", async () => {
    let finishCacheReset;
    clearStoreMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishCacheReset = resolve;
        }),
    );

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("session-state")).toHaveTextContent("anonymous"),
    );

    fireEvent.click(screen.getByText("login-old"));
    await waitFor(() => {
      expect(screen.getByTestId("user-id")).toHaveTextContent("old-manager");
      expect(screen.getByTestId("restaurants")).toHaveTextContent("COHAN Quận 1");
    });

    fireEvent.click(screen.getByText("logout"));
    fireEvent.click(screen.getByText("login-new"));

    expect(clearStoreMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("token")).toHaveTextContent("");
    expect(screen.getByTestId("user-id")).toHaveTextContent("");
    expect(screen.getByTestId("restaurants")).toHaveTextContent("");

    await act(async () => {
      finishCacheReset();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId("user-id")).toHaveTextContent("new-manager");
      expect(screen.getByTestId("token")).toHaveTextContent("new-token");
      expect(screen.getByTestId("restaurants")).toHaveTextContent("COHAN Quận 1");
    });
  });

  it("ignores a refresh response that belongs to the previous session", async () => {
    let finishRefresh;
    global.fetch = vi.fn().mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRefresh = resolve;
        }),
    );

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText("login-new"));
    await waitFor(() => {
      expect(screen.getByTestId("user-id")).toHaveTextContent("new-manager");
      expect(screen.getByTestId("user-name")).toHaveTextContent("New Manager");
    });

    await act(async () => {
      finishRefresh({
        ok: true,
        json: async () => ({
          token: "old-refresh-token",
          user: {
            id: "old-manager",
            fullName: "Old Manager",
            roleName: "manager",
            emailVerified: true,
          },
        }),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("user-id")).toHaveTextContent("new-manager");
    expect(screen.getByTestId("user-name")).toHaveTextContent("New Manager");
    expect(screen.getByTestId("token")).toHaveTextContent("new-token");
  });

  it("ignores a late Me result from the account that already logged out", async () => {
    let completeOldMe;
    useQueryMock.mockImplementation((query, options = {}) => {
      const queryText = getQueryText(query);
      if (queryText.includes("query Me")) {
        if (!options.skip && !completeOldMe) completeOldMe = options.onCompleted;
        return defaultQueryResult();
      }
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

    await waitFor(() =>
      expect(screen.getByTestId("session-state")).toHaveTextContent("anonymous"),
    );

    fireEvent.click(screen.getByText("login-old"));
    await waitFor(() => {
      expect(screen.getByTestId("user-id")).toHaveTextContent("old-manager");
      expect(completeOldMe).toEqual(expect.any(Function));
    });

    fireEvent.click(screen.getByText("logout"));
    fireEvent.click(screen.getByText("login-new"));

    await waitFor(() => {
      expect(screen.getByTestId("user-id")).toHaveTextContent("new-manager");
      expect(screen.getByTestId("user-name")).toHaveTextContent("New Manager");
    });

    act(() => {
      completeOldMe({
        me: {
          id: "old-manager",
          fullName: "Old Manager",
          roleName: "manager",
          emailVerified: true,
        },
      });
    });

    expect(screen.getByTestId("user-id")).toHaveTextContent("new-manager");
    expect(screen.getByTestId("user-name")).toHaveTextContent("New Manager");
    expect(screen.getByTestId("token")).toHaveTextContent("new-token");
  });
});
