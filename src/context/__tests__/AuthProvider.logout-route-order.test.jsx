import React, { useContext } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "../AuthProvider";
import { AuthContext } from "../AuthContext";
import { clearRefreshPromise } from "@/lib/authRefresh";
import { setAuth } from "@/lib/authStorage";

const navigateMock = vi.fn();
const clearStoreMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const useQueryMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
}));

vi.mock("@apollo/client/react", () => ({
  useApolloClient: () => ({ clearStore: clearStoreMock }),
  useQuery: useQueryMock,
}));

const defaultQueryResult = () => ({
  data: null,
  loading: false,
  error: null,
  refetch: vi.fn().mockResolvedValue({ data: { me: null } }),
});

function Consumer() {
  const { logout, sessionState } = useContext(AuthContext);
  return (
    <>
      <div data-testid="session-state">{sessionState}</div>
      <button type="button" onClick={logout}>logout</button>
    </>
  );
}

describe("AuthProvider logout route ordering", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setAuth({ token: null });
    navigateMock.mockReset();
    clearStoreMock.mockReset();
    clearStoreMock.mockResolvedValue(undefined);
    useQueryMock.mockImplementation(() => defaultQueryResult());
    clearRefreshPromise();
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
  });

  afterEach(() => {
    cleanup();
    clearRefreshPromise();
    vi.clearAllMocks();
  });

  it("leaves the protected route before clearing the previous account cache", async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("session-state")).toHaveTextContent("anonymous"),
    );

    fireEvent.click(screen.getByRole("button", { name: "logout" }));

    expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true });
    expect(clearStoreMock).toHaveBeenCalledTimes(1);
    expect(navigateMock.mock.invocationCallOrder[0]).toBeLessThan(
      clearStoreMock.mock.invocationCallOrder[0],
    );
  });
});
