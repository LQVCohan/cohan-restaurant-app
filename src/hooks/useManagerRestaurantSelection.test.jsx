import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@apollo/client";
import useManagerRestaurantSelection from "./useManagerRestaurantSelection";
import { AuthContext } from "../context/AuthContext";

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: null, loading: false, error: null, refetch: vi.fn() })),
  };
});

const createMutableWrapper = (initialValue) => {
  const state = { value: initialValue };
  const Wrapper = ({ children }) => (
    <AuthContext.Provider value={state.value}>{children}</AuthContext.Provider>
  );
  return { state, Wrapper };
};

const emptyQueryResult = () => ({
  data: null,
  loading: false,
  error: null,
  refetch: vi.fn(),
});

describe("useManagerRestaurantSelection", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/manager#dashboard");
    useQuery.mockReturnValue(emptyQueryResult());
  });

  it("auto chọn nhà hàng đầu tiên sau khi restaurants load async", async () => {
    const { state, Wrapper } = createMutableWrapper({ restaurants: [], restaurantsLoading: true });
    const { result, rerender } = renderHook(() => useManagerRestaurantSelection(), {
      wrapper: Wrapper,
    });

    expect(result.current.selectedRestaurantId).toBe("");

    state.value = {
      restaurants: [{ _id: "r1", name: "Cohan 1" }, { id: "r2", name: "Cohan 2" }],
      restaurantsLoading: false,
    };
    rerender();

    await waitFor(() => expect(result.current.selectedRestaurantId).toBe("r1"));
    expect(result.current.restaurantOptions[0]).toMatchObject({ id: "r1", name: "Cohan 1" });
  });

  it("đổi selectedRestaurantId nếu id cũ không còn trong list", async () => {
    const { state, Wrapper } = createMutableWrapper({ restaurants: [{ id: "r1" }, { id: "r2" }], restaurantsLoading: false });
    const { result, rerender } = renderHook(() => useManagerRestaurantSelection(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.selectedRestaurantId).toBe("r1"));
    result.current.setSelectedRestaurantId("r2");
    await waitFor(() => expect(result.current.selectedRestaurantId).toBe("r2"));

    state.value = { restaurants: [{ id: "r3", name: "Cohan 3" }], restaurantsLoading: false };
    rerender();

    await waitFor(() => expect(result.current.selectedRestaurantId).toBe("r3"));
  });

  it("mở dashboard theo chi nhánh khi chọn từ trang quản lý chuỗi", async () => {
    window.history.replaceState(null, "", "/manager#brands");
    useQuery.mockReturnValue({
      data: {
        myBrands: [
          {
            id: "b1",
            name: "Cohan Group",
            restaurants: [
              { id: "r1", name: "Cohan Quận 1", brandId: "b1" },
              { id: "r2", name: "Cohan Thủ Đức", brandId: "b1" },
            ],
          },
        ],
        myBrandMemberships: [
          {
            id: "m1",
            brandId: "b1",
            role: "admin",
            status: "active",
            restaurantIds: [],
          },
        ],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { Wrapper } = createMutableWrapper({
      user: { id: "u1" },
      restaurants: [],
      restaurantsLoading: false,
    });
    const onNavigate = vi.fn();
    window.addEventListener("manager:navigate", onNavigate);

    const { result } = renderHook(() => useManagerRestaurantSelection(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.selectedBrandId).toBe("b1"));

    act(() => result.current.setSelectedRestaurantId("r2"));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0][0].detail).toEqual({
      page: "dashboard",
      query: { restaurantId: "r2" },
      source: "brand-management",
    });

    window.removeEventListener("manager:navigate", onNavigate);
  });

  it("không select khi list rỗng", async () => {
    const { Wrapper } = createMutableWrapper({ restaurants: [], restaurantsLoading: false });
    const { result } = renderHook(() => useManagerRestaurantSelection(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.selectedRestaurantId).toBe(""));
    expect(result.current.hasRestaurants).toBe(false);
  });
});
