import React from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import useCommunication from "./useCommunication";

const apolloMocks = vi.hoisted(() => ({
  loadThread: vi.fn(),
  queryRefetch: vi.fn(),
  mutation: vi.fn(),
}));

vi.mock("@apollo/client", () => ({
  gql: (parts) => parts,
  useQuery: vi.fn(() => ({
    data: null,
    loading: false,
    error: null,
    refetch: apolloMocks.queryRefetch,
  })),
  useLazyQuery: vi.fn(() => [
    apolloMocks.loadThread,
    { data: null, loading: false, error: null },
  ]),
  useMutation: vi.fn(() => [apolloMocks.mutation, { loading: false }]),
}));

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

vi.mock("@/lib/authStorage", () => ({
  getToken: vi.fn(() => null),
}));

const wrapper = ({ children }) => (
  <AuthContext.Provider value={{ user: { id: "staff-1" } }}>
    {children}
  </AuthContext.Provider>
);

describe("useCommunication selected thread refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    apolloMocks.loadThread.mockResolvedValue({
      data: { chatThread: { id: "thread-1" } },
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("reloads the opened thread on the communication polling cadence", async () => {
    const { result, unmount } = renderHook(
      () =>
        useCommunication({
          restaurantId: "restaurant-1",
          status: "open",
          notificationsEnabled: false,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.loadThread({ variables: { id: "thread-1" } });
    });
    expect(apolloMocks.loadThread).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    expect(apolloMocks.loadThread).toHaveBeenLastCalledWith({
      variables: { id: "thread-1" },
    });
    expect(apolloMocks.loadThread.mock.calls.length).toBeGreaterThanOrEqual(2);
    unmount();
  });

  it("stops refreshing the previous thread when restaurant scope changes", async () => {
    const { result, rerender, unmount } = renderHook(
      ({ restaurantId }) =>
        useCommunication({
          restaurantId,
          status: "open",
          notificationsEnabled: false,
        }),
      { wrapper, initialProps: { restaurantId: "restaurant-1" } },
    );

    await act(async () => {
      await result.current.loadThread({ variables: { id: "thread-1" } });
    });
    const callsBeforeChange = apolloMocks.loadThread.mock.calls.length;

    rerender({ restaurantId: "restaurant-2" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });

    expect(apolloMocks.loadThread).toHaveBeenCalledTimes(callsBeforeChange);
    unmount();
  });
});
