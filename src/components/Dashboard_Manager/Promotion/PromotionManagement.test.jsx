import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PromotionManagement from "./PromotionManagement";
import { AuthContext } from "@/context/AuthContext";
import { usePromotions } from "@/hooks/usePromotions";
import { useCoupons } from "@/hooks/useCoupons";
import { downloadXlsxWorkbook } from "@/utils/xlsxWorkbook";

const useCouponAnalytics = vi.hoisted(() => vi.fn());
const usePromotionAnalytics = vi.hoisted(() => vi.fn());
const statsCardMock = vi.hoisted(() => vi.fn());

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: { customerRankSettings: { ranks: [] } },
      loading: false,
      error: null,
    })),
  };
});

vi.mock("@/hooks/usePromotions", () => ({
  usePromotions: vi.fn(),
}));

vi.mock("@/hooks/useCoupons", () => ({
  useCoupons: vi.fn(),
}));

vi.mock("@/hooks/useCouponAnalytics", () => ({
  useCouponAnalytics,
}));

vi.mock("@/hooks/usePromotionAnalytics", () => ({
  usePromotionAnalytics,
}));

vi.mock("@/utils/xlsxWorkbook", () => ({
  downloadXlsxWorkbook: vi.fn(),
}));

vi.mock("./components/StatsCard/StatsCard", () => ({
  default: (props) => {
    statsCardMock(props);
    return <div data-testid="promotion-stats-card" />;
  },
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

const managerWithPromotionPermissions = {
  role: {
    permissions: [
      { code: "promotion.write" },
      { code: "coupon.write" },
      { code: "promotion.read" },
      { code: "coupon.read" },
    ],
  },
};

const readOnlyPromotionUser = {
  role: {
    permissions: [{ code: "promotion.read" }, { code: "coupon.read" }],
  },
};

const renderPromotionManagement = (user = managerWithPromotionPermissions) =>
  render(
    <AuthContext.Provider value={{ user }}>
      <PromotionManagement />
    </AuthContext.Provider>,
  );

const sampleCoupon = {
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
};

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

const getRestaurantSelector = () => screen.getAllByRole("combobox")[0];
const getMutationButtons = (container, selector) =>
  [...container.querySelectorAll(selector)].filter((button) => {
    const label = `${button.getAttribute("aria-label") || ""} ${button.title || ""} ${button.textContent || ""}`.toLowerCase();
    return !label.includes("xem");
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
    usePromotionAnalytics.mockReturnValue({
      analytics: {
        totalPromotions: 0,
        activePromotions: 0,
        scheduledPromotions: 0,
        expiredPromotions: 0,
        totalRedemptions: 0,
        totalPromotionDiscount: 0,
        totalShippingDiscount: 0,
        totalDiscountAmount: 0,
        usageRate: 0,
        topPromotions: [],
        byType: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("renders without an AuthContext provider and disables mutation affordances", () => {
    render(<PromotionManagement />);

    expect(screen.getByRole("heading", { level: 1, name: /khuyến mãi/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tạo khuyến mãi/i })).toBeDisabled();
  });

  it("renders the real restaurant selector and updates the promotion filter", () => {
    renderPromotionManagement();

    const selector = getRestaurantSelector();

    fireEvent.change(selector, { target: { value: "restaurant-2" } });

    expect(screen.getByRole("option", { name: "Chi nhanh Quan 1" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Chi nhanh Phu Nhuan" })).toBeInTheDocument();
    expect(updateFilters).toHaveBeenCalledWith({ restaurant: "restaurant-2" });
    expect(useCoupons).toHaveBeenCalledWith("restaurant-1");
  });

  it("passes restaurant, category, and item data into the promotion modal", () => {
    renderPromotionManagement();
    fireEvent.click(screen.getByRole("button", { name: /tạo khuyến mãi/i }));

    expect(screen.getByTestId("promotion-modal-default")).toHaveTextContent("restaurant-1");
    expect(screen.getByTestId("promotion-modal-restaurants")).toHaveTextContent("Chi nhanh Quan 1, Chi nhanh Phu Nhuan");
    expect(screen.getByTestId("promotion-modal-categories")).toHaveTextContent("Mon chinh");
    expect(screen.getByTestId("promotion-modal-items")).toHaveTextContent("Pho bo, Tra da");
  });

  it("syncs the restaurant filter after saving a promotion for another restaurant", async () => {
    renderPromotionManagement();
    fireEvent.click(screen.getByRole("button", { name: /tạo khuyến mãi/i }));
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
    renderPromotionManagement();

    fireEvent.click(screen.getByRole("button", { name: /Xuất/i }));

    expect(downloadXlsxWorkbook).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Promotions",
          rows: expect.arrayContaining([
            expect.arrayContaining(["Tên", "Mã", "Loại", "Giá trị"]),
            expect.arrayContaining(["Combo trua", "TRUA10", "Giảm phần trăm", "10%"]),
          ]),
        }),
      ]),
      expect.stringMatching(/^promotion-promotions-restaurant-1-\d{4}-\d{2}-\d{2}\.xlsx$/),
    );
  });

  it("disables promotion mutation buttons when promotion.write is missing", () => {
    const { container } = renderPromotionManagement(readOnlyPromotionUser);

    fireEvent.click(screen.getByRole("button", { name: /danh sách/i }));

    expect(screen.getByRole("button", { name: /tạo khuyến mãi/i })).toBeDisabled();
    const mutationButtons = getMutationButtons(container, ".premium-table .action-buttons button");
    expect(mutationButtons.length).toBeGreaterThan(0);
    mutationButtons.forEach((button) => expect(button).toBeDisabled());
  });

  it("renders Coupon stack flag and status under the current coupon table columns", () => {
    useCoupons.mockReturnValue(
      buildCouponHookValue({
        coupons: [sampleCoupon],
        allCoupons: [sampleCoupon],
        resolveStatus: vi.fn(() => "active"),
      }),
    );

    renderPromotionManagement();
    fireEvent.click(screen.getByRole("button", { name: "Coupon" }));

    const row = screen.getByText("Coupon Stack").closest("tr");
    expect(row).toHaveTextContent("Có");
    expect(row).toHaveTextContent("Đang chạy");
  });

  it("disables coupon mutation buttons when coupon.write is missing", () => {
    useCoupons.mockReturnValue(
      buildCouponHookValue({
        coupons: [sampleCoupon],
        allCoupons: [sampleCoupon],
        resolveStatus: vi.fn(() => "active"),
      }),
    );

    const { container } = renderPromotionManagement(readOnlyPromotionUser);
    fireEvent.click(screen.getByRole("button", { name: "Coupon" }));

    expect(screen.getByRole("button", { name: /tạo coupon/i })).toBeDisabled();
    const mutationButtons = getMutationButtons(container, ".coupon-table .action-buttons button");
    expect(mutationButtons.length).toBeGreaterThan(0);
    mutationButtons.forEach((button) => expect(button).toBeDisabled());
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

    renderPromotionManagement();

    fireEvent.click(screen.getByRole("button", { name: "Gói Coupon" }));

    expect(screen.getByText("Goi VIP")).toBeInTheDocument();
    expect(screen.getByText("Coupon Mon Chinh")).toBeInTheDocument();
  });

  it("uses real promotion analytics values for promotion StatsCard", () => {
    usePromotionAnalytics.mockReturnValue({
      analytics: {
        totalPromotions: 4,
        activePromotions: 2,
        scheduledPromotions: 1,
        expiredPromotions: 1,
        totalRedemptions: 7,
        totalPromotionDiscount: 30000,
        totalShippingDiscount: 12000,
        totalDiscountAmount: 42000,
        usageRate: 175,
        topPromotions: [{ promotionId: "promo-1" }, { promotionId: "promo-2" }],
        byType: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPromotionManagement();

    const promotionStatsCall = statsCardMock.mock.calls.find(
      ([props]) => props.labels?.total === "Lượt dùng Promotion",
    );

    expect(promotionStatsCall?.[0]).toEqual(expect.objectContaining({
        stats: {
          totalSavings: 42000,
          usageRate: 175,
          totalUsage: 7,
          hotPromotions: 2,
        },
        labels: expect.objectContaining({
          savings: expect.any(String),
          total: "Lượt dùng Promotion",
          hot: "Top Promotion",
        }),
      }),
    );
  });

  it("keeps coupon analytics values for the Coupon section", () => {
    useCouponAnalytics.mockReturnValue({
      analytics: {
        totalCoupons: 1,
        activeCoupons: 1,
        savedCoupons: 0,
        usedCoupons: 0,
        totalRedemptions: 9,
        totalDiscountAmount: 90000,
        usageRate: 90,
        expiringSoon: 0,
        nearUsageLimit: 0,
        topCoupons: [{ couponId: "coupon-1" }],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPromotionManagement();
    fireEvent.click(screen.getByRole("button", { name: "Coupon" }));

    const couponStatsCall = statsCardMock.mock.calls.find(
      ([props]) => props.labels?.total === "Lượt dùng Coupon",
    );

    expect(couponStatsCall?.[0]).toEqual(expect.objectContaining({
        stats: {
          totalSavings: 90000,
          usageRate: 90,
          totalUsage: 9,
          hotPromotions: 1,
        },
        labels: expect.objectContaining({
          total: "Lượt dùng Coupon",
          hot: "Top Coupon",
        }),
      }),
    );
  });

  it("does not crash when promotion analytics is loading or errors", () => {
    usePromotionAnalytics.mockReturnValue({
      analytics: {
        totalPromotions: 0,
        activePromotions: 0,
        scheduledPromotions: 0,
        expiredPromotions: 0,
        totalRedemptions: 0,
        totalPromotionDiscount: 0,
        totalShippingDiscount: 0,
        totalDiscountAmount: 0,
        usageRate: 0,
        topPromotions: [],
        byType: [],
      },
      loading: true,
      error: new Error("network"),
      refetch: vi.fn(),
    });

    renderPromotionManagement();

    expect(screen.getByText("Đang cập nhật thống kê Promotion...")).toBeInTheDocument();
    expect(
      screen.getByText("Chưa tải được thống kê Promotion, đang hiển thị giá trị mặc định."),
    ).toBeInTheDocument();
  });
});
