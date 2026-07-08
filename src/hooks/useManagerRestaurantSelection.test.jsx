import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

describe("useManagerRestaurantSelection", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/manager#dashboard");
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
    act(() => result.current.setSelectedRestaurantId("r2"));
    await waitFor(() => expect(result.current.selectedRestaurantId).toBe("r2"));

    state.value = { restaurants: [{ id: "r3", name: "Cohan 3" }], restaurantsLoading: false };
    rerender();

    await waitFor(() => expect(result.current.selectedRestaurantId).toBe("r3"));
  });

  it("đồng bộ lựa chọn chi nhánh ngay giữa các hook đang mở", async () => {
    const { Wrapper } = createMutableWrapper({
      restaurants: [{ id: "r1", name: "Cohan 1" }, { id: "r2", name: "Cohan 2" }],
      restaurantsLoading: false,
    });
    const first = renderHook(() => useManagerRestaurantSelection(), { wrapper: Wrapper });
    const second = renderHook(() => useManagerRestaurantSelection(), { wrapper: Wrapper });

    await waitFor(() => expect(first.result.current.selectedRestaurantId).toBe("r1"));
    await waitFor(() => expect(second.result.current.selectedRestaurantId).toBe("r1"));

    act(() => first.result.current.setSelectedRestaurantId("r2"));

    await waitFor(() => expect(first.result.current.selectedRestaurantId).toBe("r2"));
    await waitFor(() => expect(second.result.current.selectedRestaurantId).toBe("r2"));
    expect(localStorage.getItem("manager.selectedRestaurantId")).toBe("r2");
  });

  it("mở dashboard với đúng chi nhánh khi chọn từ trang quản lý chuỗi", async () => {
    window.history.replaceState(null, "", "/manager#brands");
    const { Wrapper } = createMutableWrapper({
      user: { id: "u1", userType: "MANAGER" },
      restaurantsLoading: false,
      restaurants: [
        { id: "r1", name: "Cohan Quận 1", brandId: "b1" },
        { id: "r2", name: "Cohan Thủ Đức", brandId: "b1" },
      ],
      brandMemberships: [
        {
          brandId: "b1",
          role: "manager",
          restaurantIds: ["r1", "r2"],
          brand: { id: "b1", name: "Cohan Group" },
        },
      ],
    });
    const onNavigate = vi.fn();
    window.addEventListener("manager:navigate", onNavigate);

    try {
      const { result } = renderHook(() => useManagerRestaurantSelection(), {
        wrapper: Wrapper,
      });

      await waitFor(() => expect(result.current.selectedBrandId).toBe("b1"));
      await waitFor(() => expect(result.current.restaurantOptions).toHaveLength(2));

      act(() => result.current.setSelectedRestaurantId("r2"));

      expect(localStorage.getItem("manager.selectedRestaurantId")).toBe("r2");
      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate.mock.calls[0][0].detail).toEqual({
        page: "dashboard",
        query: { restaurantId: "r2" },
        source: "brand-management",
      });
    } finally {
      window.removeEventListener("manager:navigate", onNavigate);
    }
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
