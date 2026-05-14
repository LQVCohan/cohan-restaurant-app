import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PromotionManagement from "./PromotionManagement";
import { usePromotions } from "@/hooks/usePromotions";
import { useCoupons } from "@/hooks/useCoupons";
import { downloadXlsxWorkbook } from "@/utils/xlsxWorkbook";

const useCouponAnalytics = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/usePromotions", () => ({
  usePromotions: vi.fn(),
}));

vi.mock("@/hooks/useCoupons", () => ({
  useCoupons: vi.fn(),
}));

vi.mock("@/hooks/useCouponAnalytics", () => ({
  useCouponAnalytics,
}));

vi.mock("@/utils/xlsxWorkbook", () => ({
  downloadXlsxWorkbook: vi.fn(),
}));

vi.mock("./components/StatsCard/StatsCard", () => ({
  default: () => <div data-testid="promotion-stats-card" />,
}));

vi.mock("./components/PromotionsGrid/PromotionsGrid", () => ({
  default: () => <div data-testid="promotions-grid" />,
}));

vi.mock("./components/CouponModal/CouponModal", () => ({
  default: () => null,
}));

vi.mock("./components/CouponPackageModal/CouponPackageModal", () => ({
  default: () => null,
}));

vi.mock("./components/PromotionModal/PromotionModal", () => ({
  default: ({ categories, defaultRestaurantId, menuItems, onSave, restaurants }) => (
    <div data-testid="promotion-modal">
      <div data-testid="promotion-modal-default">{defaultRestaurantId}</div>
      <div data-testid="promotion-modal-restaurants">
        {restaurants.map((restaurant) => restaurant.name).join(", ")}
      </div>
      <div data-testid="promotion-modal-categories">
        {categories.map((category) => category.name).join(", ")}
      </div>
      <div data-testid="promotion-modal-items">
        {menuItems.map((item) => item.name).join(", ")}
      </div>
      <button
        type="button"
        onClick={() =>
          onSave({
            name: "Khuyen mai moi",
            restaurantId: "restaurant-2",
          })
        }
      >
        Luu promotion mock
      </button>
    </div>
  ),
}));

const updateFilters = vi.fn();
const addPromotion = vi.fn();
const updatePromotion = vi.fn();

const buildPromotionHookValue = (overrides = {}) => ({
  promotions: [
    {
      id: "promo-1",
      name: "Combo trua",
      code: "TRUA10",
      type: "percentage",
      scope: "order",
      discountValue: 10,
      buyQuantity: 0,
      getQuantity: 0,
      usageCount: 0,
      usageLimit: 100,
      startDate: "2026-04-01T10:00",
      endDate: "2026-04-30T22:00",
      status: "active",
      restaurantId: "restaurant-1",
      description: "Khuyen mai ban trua",
      conditions: ["Ap dung gio trua"],
    },
  ],
  allPromotions: [
    {
      id: "promo-1",
      name: "Combo trua",
      code: "TRUA10",
      type: "percentage",
      scope: "order",
      discountValue: 10,
      buyQuantity: 0,
      getQuantity: 0,
      usageCount: 0,
      usageLimit: 100,
      startDate: "2026-04-01T10:00",
      endDate: "2026-04-30T22:00",
      status: "active",
      restaurantId: "restaurant-1",
      description: "Khuyen mai ban trua",
      conditions: ["Ap dung gio trua"],
    },
  ],
  restaurants: [
    { id: "restaurant-1", name: "Chi nhanh Quan 1" },
    { id: "restaurant-2", name: "Chi nhanh Phu Nhuan" },
  ],
  selectedRestaurantId: "restaurant-1",
  filters: {
    search: "",
    status: "all",
    restaurant: "restaurant-1",
  },
  categories: [{ id: "cat-1", name: "Mon chinh" }],
  menuItems: [
    { id: "item-1", name: "Pho bo", categoryId: "cat-1" },
    { id: "item-2", name: "Tra da", categoryId: "cat-1" },
  ],
  addPromotion,
  updatePromotion,
  deletePromotion: vi.fn(),
  duplicatePromotion: vi.fn(),
  updateFilters,
  loading: false,
  error: null,
  ...overrides,
});

const buildCouponHookValue = (overrides = {}) => ({
  coupons: [],
  allCoupons: [],
  couponFilters: { search: "", category: "all", status: "all" },
  updateCouponFilters: vi.fn(),
  addCoupon: vi.fn(),
  updateCoupon: vi.fn(),
  deleteCoupon: vi.fn(),
  duplicateCoupon: vi.fn(),
  couponPackages: [],
  allCouponPackages: [],
  couponPackageFilters: { search: "", status: "all" },
  updateCouponPackageFilters: vi.fn(),
  addCouponPackage: vi.fn(),
  updateCouponPackage: vi.fn(),
  deleteCouponPackage: vi.fn(),
  duplicateCouponPackage: vi.fn(),
  resolveStatus: vi.fn(() => "draft"),
  ...overrides,
});

describe("PromotionManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addPromotion.mockResolvedValue("restaurant-2");
    updatePromotion.mockResolvedValue("restaurant-2");
    usePromotions.mockReturnValue(buildPromotionHookValue());
    useCoupons.mockReturnValue(buildCouponHookValue());
    useCouponAnalytics.mockReturnValue({
      analytics: {
        totalCoupons: 0,
        activeCoupons: 0,
        savedCoupons: 0,
        usedCoupons: 0,
        totalRedemptions: 0,
        totalDiscountAmount: 0,
        usageRate: 0,
        expiringSoon: 0,
        nearUsageLimit: 0,
        topCoupons: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("renders the real restaurant selector and updates the promotion filter", () => {
    render(<PromotionManagement />);

    const selector = screen.getByLabelText("Chon nha hang khuyen mai");

    fireEvent.change(selector, { target: { value: "restaurant-2" } });

    expect(screen.getByRole("option", { name: "Chi nhanh Quan 1" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Chi nhanh Phu Nhuan" })).toBeInTheDocument();
    expect(updateFilters).toHaveBeenCalledWith({ restaurant: "restaurant-2" });
    expect(useCoupons).toHaveBeenCalledWith("restaurant-1");
  });

  it("passes restaurant, category, and item data into the promotion modal", () => {
    const { container } = render(<PromotionManagement />);

    fireEvent.click(container.querySelector(".filter-toolbar .btn-primary"));

    expect(screen.getByTestId("promotion-modal-default")).toHaveTextContent(
      "restaurant-1",
    );
    expect(screen.getByTestId("promotion-modal-restaurants")).toHaveTextContent(
      "Chi nhanh Quan 1, Chi nhanh Phu Nhuan",
    );
    expect(screen.getByTestId("promotion-modal-categories")).toHaveTextContent(
      "Mon chinh",
    );
    expect(screen.getByTestId("promotion-modal-items")).toHaveTextContent(
      "Pho bo, Tra da",
    );
  });

  it("syncs the restaurant filter after saving a promotion for another restaurant", async () => {
    const { container } = render(<PromotionManagement />);

    fireEvent.click(container.querySelector(".filter-toolbar .btn-primary"));
    fireEvent.click(screen.getByRole("button", { name: "Luu promotion mock" }));

    await waitFor(() => {
      expect(addPromotion).toHaveBeenCalledWith({
        name: "Khuyen mai moi",
        restaurantId: "restaurant-2",
      });
    });

    expect(updateFilters).toHaveBeenCalledWith({ restaurant: "restaurant-2" });
  });

  it("exports promotions to a real xlsx workbook instead of showing a placeholder alert", () => {
    render(<PromotionManagement />);

    fireEvent.click(screen.getByRole("button", { name: /Xuất/i }));

    expect(downloadXlsxWorkbook).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Promotions",
          rows: expect.arrayContaining([
            expect.arrayContaining(["Tên chương trình", "Mã"]),
            expect.arrayContaining(["Combo trua", "TRUA10"]),
          ]),
        }),
      ]),
      expect.stringMatching(/^promotion-promotions-restaurant-1-\d{4}-\d{2}-\d{2}\.xlsx$/),
    );
  });

  it("renders Coupon stack flags under Dùng chồng and status under Trạng thái", () => {
    useCoupons.mockReturnValue(
      buildCouponHookValue({
        coupons: [
          {
            id: "coupon-1",
            name: "Coupon Stack",
            code: "STACK10",
            category: "food",
            discountType: "percent",
            discountValue: 10,
            startDate: "2026-05-01T10:00",
            endDate: "2026-05-31T10:00",
            publishAt: "",
            combinableWithPromotions: true,
            stackable: true,
            exclusive: false,
            priority: 2,
          },
        ],
        allCoupons: [
          {
            id: "coupon-1",
            name: "Coupon Stack",
            code: "STACK10",
            category: "food",
            discountType: "percent",
            discountValue: 10,
            startDate: "2026-05-01T10:00",
            endDate: "2026-05-31T10:00",
            publishAt: "",
            combinableWithPromotions: true,
            stackable: true,
            exclusive: false,
            priority: 2,
          },
        ],
        resolveStatus: vi.fn(() => "active"),
      }),
    );

    render(<PromotionManagement />);
    fireEvent.click(screen.getByRole("button", { name: "Coupon" }));

    const row = screen.getByText("Coupon Stack").closest("tr");
    const cells = row.querySelectorAll("td");

    expect(cells[4]).toHaveTextContent("+ Promotion");
    expect(cells[4]).toHaveTextContent("+ Coupon");
    expect(cells[5]).toHaveTextContent("Đang chạy");
  });

  it("loads package data for the selected restaurant and resolves coupon names from real hook data", () => {
    useCoupons.mockReturnValue(
      buildCouponHookValue({
        allCoupons: [
          {
            id: "coupon-1",
            name: "Coupon Mon Chinh",
            code: "FOOD10",
            category: "food",
          },
        ],
        couponPackages: [
          {
            id: "package-1",
            name: "Goi VIP",
            code: "VIP-01",
            couponIds: ["coupon-1"],
            startDate: "2026-05-01T10:00",
            endDate: "2026-05-31T10:00",
            publishAt: "",
            conditions: [],
          },
        ],
        allCouponPackages: [
          {
            id: "package-1",
            name: "Goi VIP",
            code: "VIP-01",
            couponIds: ["coupon-1"],
            startDate: "2026-05-01T10:00",
            endDate: "2026-05-31T10:00",
            publishAt: "",
            conditions: [],
          },
        ],
        resolveStatus: vi.fn(() => "active"),
      }),
    );

    render(<PromotionManagement />);

    fireEvent.click(screen.getByRole("button", { name: "Gói Coupon" }));

    expect(screen.getByText("Goi VIP")).toBeInTheDocument();
    expect(screen.getByText("Coupon Mon Chinh")).toBeInTheDocument();
  });
});
