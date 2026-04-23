import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PromotionManagement from "./PromotionManagement";
import { usePromotions } from "@/hooks/usePromotions";
import { useVouchers } from "@/hooks/useVouchers";

vi.mock("@/hooks/usePromotions", () => ({
  usePromotions: vi.fn(),
}));

vi.mock("@/hooks/useVouchers", () => ({
  useVouchers: vi.fn(),
}));

vi.mock("./components/StatsCard/StatsCard", () => ({
  default: () => <div data-testid="promotion-stats-card" />,
}));

vi.mock("./components/PromotionsGrid/PromotionsGrid", () => ({
  default: () => <div data-testid="promotions-grid" />,
}));

vi.mock("./components/VoucherModal/VoucherModal", () => ({
  default: () => null,
}));

vi.mock("./components/VoucherPackageModal/VoucherPackageModal", () => ({
  default: () => null,
}));

vi.mock("./components/PromotionModal/PromotionModal", () => ({
  default: ({ restaurants, defaultRestaurantId, onSave }) => (
    <div data-testid="promotion-modal">
      <div data-testid="promotion-modal-default">{defaultRestaurantId}</div>
      <div data-testid="promotion-modal-restaurants">
        {restaurants.map((restaurant) => restaurant.name).join(", ")}
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
      discountValue: 10,
      usageCount: 0,
      usageLimit: 100,
      startDate: "2026-04-01T10:00",
      endDate: "2026-04-30T22:00",
      status: "active",
      restaurantId: "restaurant-1",
    },
  ],
  allPromotions: [
    {
      id: "promo-1",
      name: "Combo trua",
      code: "TRUA10",
      type: "percentage",
      discountValue: 10,
      usageCount: 0,
      usageLimit: 100,
      startDate: "2026-04-01T10:00",
      endDate: "2026-04-30T22:00",
      status: "active",
      restaurantId: "restaurant-1",
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
  addPromotion,
  updatePromotion,
  deletePromotion: vi.fn(),
  duplicatePromotion: vi.fn(),
  updateFilters,
  loading: false,
  error: null,
  ...overrides,
});

const buildVoucherHookValue = (overrides = {}) => ({
  vouchers: [],
  allVouchers: [],
  voucherFilters: { search: "", category: "all", status: "all" },
  updateVoucherFilters: vi.fn(),
  addVoucher: vi.fn(),
  updateVoucher: vi.fn(),
  deleteVoucher: vi.fn(),
  duplicateVoucher: vi.fn(),
  packages: [],
  allPackages: [],
  packageFilters: { search: "", status: "all" },
  updatePackageFilters: vi.fn(),
  addPackage: vi.fn(),
  updatePackage: vi.fn(),
  deletePackage: vi.fn(),
  duplicatePackage: vi.fn(),
  resolveStatus: vi.fn(() => "draft"),
  ...overrides,
});

describe("PromotionManagement restaurant selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addPromotion.mockResolvedValue("restaurant-2");
    updatePromotion.mockResolvedValue("restaurant-2");
    usePromotions.mockReturnValue(buildPromotionHookValue());
    useVouchers.mockReturnValue(buildVoucherHookValue());
  });

  it("renders a real restaurant selector and updates the promotion filter", () => {
    render(<PromotionManagement />);

    const selector = screen.getByLabelText("Chon nha hang khuyen mai");

    expect(screen.getByRole("option", { name: "Chi nhanh Quan 1" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Chi nhanh Phu Nhuan" })).toBeInTheDocument();

    fireEvent.change(selector, { target: { value: "restaurant-2" } });

    expect(updateFilters).toHaveBeenCalledWith({ restaurant: "restaurant-2" });
  });

  it("passes real restaurants into the modal and syncs the filter after saving for another restaurant", async () => {
    const { container } = render(<PromotionManagement />);

    fireEvent.click(container.querySelector(".filter-toolbar .btn-primary"));

    expect(screen.getByTestId("promotion-modal-default")).toHaveTextContent(
      "restaurant-1"
    );
    expect(screen.getByTestId("promotion-modal-restaurants")).toHaveTextContent(
      "Chi nhanh Quan 1, Chi nhanh Phu Nhuan"
    );

    fireEvent.click(screen.getByRole("button", { name: "Luu promotion mock" }));

    await waitFor(() => {
      expect(addPromotion).toHaveBeenCalledWith({
        name: "Khuyen mai moi",
        restaurantId: "restaurant-2",
      });
    });

    expect(updateFilters).toHaveBeenCalledWith({ restaurant: "restaurant-2" });
  });
});
