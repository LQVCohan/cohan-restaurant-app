import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "@/context/AuthContext";
import CouponPage from "./CouponPage";
import { useQuery } from "@apollo/client";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

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
  beforeEach(() => {
    vi.clearAllMocks();
    useQuery.mockReturnValue({ data: { coupons: [] }, loading: false });
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
    expect(screen.getByText("Chọn nhà hàng để xem Coupon")).toBeInTheDocument();
  });

  it("uses the /coupons/:restaurantId route param", () => {
    renderCouponPage({ path: "/coupons/restaurant-123" });

    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        skip: false,
        variables: expect.objectContaining({ restaurantId: "restaurant-123" }),
      }),
    );
  });
});
