import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "@/context/AuthContext";
import CouponPage from "./CouponPage";
import { useQuery } from "@apollo/client";
import useUserCoupons from "@/hooks/useUserCoupons";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return { ...actual, useQuery: vi.fn() };
});

vi.mock("@/hooks/useUserCoupons", () => ({ default: vi.fn() }));

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
  restaurantId: "restaurant-123",
};

const savedUserCoupon = {
  id: "uc-1",
  couponId: "coupon-1",
  restaurantId: "restaurant-123",
  status: "saved",
  coupon: activeCoupon,
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const renderCouponPage = ({ path = "/coupons", authValue = {} } = {}) =>
  render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/coupons" element={<CouponPage />} />
          <Route path="/coupons/:restaurantId" element={<CouponPage />} />
          <Route path="/login" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

describe("CouponPage", () => {
  const saveCoupon = vi.fn();
  const removeSavedCoupon = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    saveCoupon.mockResolvedValue({ id: "uc-1" });
    removeSavedCoupon.mockResolvedValue(true);
    useQuery.mockReturnValue({ data: { coupons: [] }, loading: false, error: null, refetch: vi.fn() });
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

  it("does not query restaurant coupons on /coupons and asks anonymous users to log in", () => {
    renderCouponPage();

    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        skip: true,
        variables: expect.objectContaining({ restaurantId: undefined }),
      }),
    );
    expect(useUserCoupons).toHaveBeenCalledWith({ restaurantId: null, status: null, skip: true });
    expect(screen.getByText("Đăng nhập để xem Kho Coupon")).toBeInTheDocument();
  });

  it("renders saved wallet coupons and real stats on /coupons for logged-in users", () => {
    useUserCoupons.mockReturnValue({
      myCoupons: [savedUserCoupon],
      savedCouponIds: ["coupon-1"],
      loading: false,
      error: null,
      saveCoupon,
      removeSavedCoupon,
      refetch: vi.fn(),
    });

    renderCouponPage({ authValue: { isAuthenticated: true, user: { id: "user-1" } } });

    expect(screen.getByText("Coupon giảm 20%")).toBeInTheDocument();
    expect(screen.getByText("SAVE20")).toBeInTheDocument();
    expect(screen.getByText("Tổng coupon").previousSibling).toHaveTextContent("1");
    expect(screen.getAllByText("Đã lưu")[0].previousSibling).toHaveTextContent("1");
  });

  it("queries coupons and saved wallet state with the /coupons/:restaurantId route param", () => {
    renderCouponPage({ path: "/coupons/restaurant-123", authValue: { isAuthenticated: true, user: { id: "user-1" } } });

    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        skip: false,
        variables: expect.objectContaining({ restaurantId: "restaurant-123" }),
      }),
    );
    expect(useUserCoupons).toHaveBeenCalledWith({ restaurantId: "restaurant-123", status: "saved", skip: false });
  });

  it("calls saveCoupon when an authenticated customer saves a coupon", async () => {
    useQuery.mockReturnValue({ data: { coupons: [activeCoupon] }, loading: false, error: null, refetch: vi.fn() });

    renderCouponPage({ path: "/coupons/restaurant-123", authValue: { isAuthenticated: true, user: { id: "user-1" } } });

    fireEvent.click(screen.getByRole("button", { name: "Lưu coupon" }));

    await waitFor(() => expect(saveCoupon).toHaveBeenCalledWith("coupon-1"));
  });

  it("shows backend saved state and removes a saved coupon on click", async () => {
    useQuery.mockReturnValue({ data: { coupons: [activeCoupon] }, loading: false, error: null, refetch: vi.fn() });
    useUserCoupons.mockReturnValue({
      myCoupons: [{ id: "uc-1", couponId: "coupon-1", status: "saved" }],
      savedCouponIds: ["coupon-1"],
      loading: false,
      error: null,
      saveCoupon,
      removeSavedCoupon,
      refetch: vi.fn(),
    });

    renderCouponPage({ path: "/coupons/restaurant-123", authValue: { isAuthenticated: true, user: { id: "user-1" } } });

    fireEvent.click(screen.getByRole("button", { name: "Bỏ lưu" }));

    await waitFor(() => expect(removeSavedCoupon).toHaveBeenCalledWith("coupon-1"));
  });

  it("shows a friendly error when saving fails", async () => {
    useQuery.mockReturnValue({ data: { coupons: [activeCoupon] }, loading: false, error: null, refetch: vi.fn() });
    saveCoupon.mockRejectedValueOnce(new Error("network"));

    renderCouponPage({ path: "/coupons/restaurant-123", authValue: { isAuthenticated: true, user: { id: "user-1" } } });

    fireEvent.click(screen.getByRole("button", { name: "Lưu coupon" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể lưu coupon. Vui lòng thử lại.");
  });

  it("shows a friendly error when removing a saved coupon fails", async () => {
    useQuery.mockReturnValue({ data: { coupons: [activeCoupon] }, loading: false, error: null, refetch: vi.fn() });
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

    renderCouponPage({ path: "/coupons/restaurant-123", authValue: { isAuthenticated: true, user: { id: "user-1" } } });

    fireEvent.click(screen.getByRole("button", { name: "Bỏ lưu" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể bỏ lưu coupon. Vui lòng thử lại.");
  });

  it("clears a previous save/remove error after a successful retry", async () => {
    useQuery.mockReturnValue({ data: { coupons: [activeCoupon] }, loading: false, error: null, refetch: vi.fn() });
    saveCoupon.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ id: "uc-1" });

    renderCouponPage({ path: "/coupons/restaurant-123", authValue: { isAuthenticated: true, user: { id: "user-1" } } });

    const saveButton = screen.getByRole("button", { name: "Lưu coupon" });
    fireEvent.click(saveButton);
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    fireEvent.click(saveButton);

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("displays advanced eligibility conditions in coupon details", () => {
    useQuery.mockReturnValue({
      data: {
        coupons: [{
          ...activeCoupon,
          constraints: {
            perUserLimit: 2,
            orderTypes: ["dine_in", "takeaway", "delivery"],
            paymentMethods: ["cash", "card", "e_wallet"],
            firstOrderOnly: true,
          },
        }],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderCouponPage({ path: "/coupons/restaurant-123" });
    fireEvent.click(screen.getByRole("button", { name: /Điều kiện/i }));

    expect(screen.getByText("Mỗi khách dùng tối đa 2 lần.")).toBeInTheDocument();
    expect(screen.getByText("Loại đơn áp dụng: Dùng tại bàn / Mang đi / Giao hàng.")).toBeInTheDocument();
    expect(screen.getByText("Phương thức thanh toán: Tiền mặt / Thẻ / Ví điện tử.")).toBeInTheDocument();
    expect(screen.getByText("Chỉ áp dụng cho đơn đầu tiên.")).toBeInTheDocument();
  });

  it("prompts unauthenticated users to log in and does not save", () => {
    useQuery.mockReturnValue({ data: { coupons: [activeCoupon] }, loading: false, error: null, refetch: vi.fn() });

    renderCouponPage({ path: "/coupons/restaurant-123" });

    fireEvent.click(screen.getByRole("button", { name: "Lưu coupon" }));

    expect(saveCoupon).not.toHaveBeenCalled();
    expect(removeSavedCoupon).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/login");
  });
});
