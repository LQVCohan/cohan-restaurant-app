import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "@/context/AuthContext";
import CouponPage from "./CouponPage";
import { useQuery } from "@apollo/client";
import useUserCoupons from "@/hooks/useUserCoupons";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

vi.mock("@/hooks/useUserCoupons", () => ({
  default: vi.fn(),
}));

const activeCoupon = {
  id: "coupon-1",
  name: "Coupon giảm 20%",
  code: "SAVE20",
  category: "order",
  description: "Giảm giá đặt món",
  discountType: "PERCENT",
  discountValue: 20,
  minOrderValue: 100000,
  maxDiscount: 50000,
  maxUsage: 100,
  used: 10,
  endAt: "2026-12-31T00:00:00.000Z",
  isActive: true,
  constraints: {},
};

const renderCouponPage = ({ path = "/coupons", authValue = {} } = {}) =>
  render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/coupons" element={<CouponPage />} />
          <Route path="/coupons/:restaurantId" element={<CouponPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

describe("CouponPage", () => {
  const saveCoupon = vi.fn();
  const removeSavedCoupon = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useQuery.mockReturnValue({ data: { coupons: [] }, loading: false });
    useUserCoupons.mockReturnValue({
      myCoupons: [],
      savedCouponIds: [],
      loading: false,
      error: null,
      saveCoupon,
      removeSavedCoupon,
      refetch: vi.fn(),
    });
  });

  it("does not query coupons without a restaurantId", () => {
    renderCouponPage();

    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        skip: true,
        variables: expect.objectContaining({ restaurantId: "" }),
      }),
    );
    expect(useUserCoupons).toHaveBeenCalledWith({ restaurantId: "", skip: true });
    expect(screen.getByText("Chọn nhà hàng để xem Coupon")).toBeInTheDocument();
  });

  it("queries coupons with the /coupons/:restaurantId route param", () => {
    renderCouponPage({ path: "/coupons/restaurant-123" });

    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        skip: false,
        variables: expect.objectContaining({ restaurantId: "restaurant-123" }),
      }),
    );
  });

  it("calls saveCoupon when an authenticated customer saves a coupon", () => {
    useQuery.mockReturnValue({ data: { coupons: [activeCoupon] }, loading: false });

    renderCouponPage({
      path: "/coupons/restaurant-123",
      authValue: { isAuthenticated: true, user: { id: "user-1" } },
    });

    fireEvent.click(screen.getByRole("button", { name: "Lưu ngay" }));

    expect(saveCoupon).toHaveBeenCalledWith("coupon-1");
  });

  it("shows backend saved state and removes a saved coupon on click", () => {
    useQuery.mockReturnValue({ data: { coupons: [activeCoupon] }, loading: false });
    useUserCoupons.mockReturnValue({
      myCoupons: [{ id: "uc-1", couponId: "coupon-1", status: "saved" }],
      savedCouponIds: ["coupon-1"],
      loading: false,
      error: null,
      saveCoupon,
      removeSavedCoupon,
      refetch: vi.fn(),
    });

    renderCouponPage({
      path: "/coupons/restaurant-123",
      authValue: { isAuthenticated: true, user: { id: "user-1" } },
    });

    fireEvent.click(screen.getAllByRole("button", { name: /^Đã lưu$/i }).at(-1));

    expect(removeSavedCoupon).toHaveBeenCalledWith("coupon-1");
  });

  it("shows a friendly error when saving fails", async () => {
    useQuery.mockReturnValue({ data: { coupons: [activeCoupon] }, loading: false });
    saveCoupon.mockRejectedValueOnce(new Error("network"));

    renderCouponPage({
      path: "/coupons/restaurant-123",
      authValue: { isAuthenticated: true, user: { id: "user-1" } },
    });

    fireEvent.click(screen.getByRole("button", { name: "Lưu ngay" }));

    expect(saveCoupon).toHaveBeenCalledWith("coupon-1");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không thể lưu Coupon. Vui lòng thử lại.",
    );
  });

  it("shows a friendly error when removing a saved coupon fails", async () => {
    useQuery.mockReturnValue({ data: { coupons: [activeCoupon] }, loading: false });
    removeSavedCoupon.mockRejectedValueOnce(new Error("network"));
    useUserCoupons.mockReturnValue({
      myCoupons: [{ id: "uc-1", couponId: "coupon-1", status: "saved" }],
      savedCouponIds: ["coupon-1"],
      loading: false,
      error: null,
      saveCoupon,
      removeSavedCoupon,
      refetch: vi.fn(),
    });

    renderCouponPage({
      path: "/coupons/restaurant-123",
      authValue: { isAuthenticated: true, user: { id: "user-1" } },
    });

    fireEvent.click(screen.getAllByRole("button", { name: /^Đã lưu$/i }).at(-1));

    expect(removeSavedCoupon).toHaveBeenCalledWith("coupon-1");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không thể bỏ lưu Coupon. Vui lòng thử lại.",
    );
  });

  it("clears a previous save/remove error after a successful retry", async () => {
    useQuery.mockReturnValue({ data: { coupons: [activeCoupon] }, loading: false });
    saveCoupon
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ id: "uc-1" });

    renderCouponPage({
      path: "/coupons/restaurant-123",
      authValue: { isAuthenticated: true, user: { id: "user-1" } },
    });

    const saveButton = screen.getByRole("button", { name: "Lưu ngay" });
    fireEvent.click(saveButton);
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("prompts unauthenticated users to log in and does not save", () => {
    useQuery.mockReturnValue({ data: { coupons: [activeCoupon] }, loading: false });

    renderCouponPage({ path: "/coupons/restaurant-123" });

    fireEvent.click(
      screen.getByRole("button", { name: "Đăng nhập để lưu Coupon" }),
    );

    expect(saveCoupon).not.toHaveBeenCalled();
    expect(removeSavedCoupon).not.toHaveBeenCalled();
  });
});
