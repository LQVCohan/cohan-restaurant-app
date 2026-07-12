import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import MenuItemCard, { getMenuItemPricePresentation } from "./MenuItemCard";

const item = {
  id: "food-promo",
  restaurantId: "restaurant-1",
  name: "Bò sốt tiêu",
  description: "Bò mềm sốt tiêu đen",
  basePrice: 100000,
  status: "available",
  inventoryStatus: "IN_STOCK",
  servingVariants: [{ key: "portion", price: 100000, isDefault: true }],
  promotion: {
    id: "promo-1",
    name: "Giảm 20% món bò",
    discountType: "PERCENT",
    discountValue: 20,
    maxDiscount: 0,
    minOrderValue: 0,
  },
  promotionLabel: "-20%",
};

describe("MenuItemCard promotion price", () => {
  it("returns original and discounted price labels", () => {
    expect(getMenuItemPricePresentation(item)).toMatchObject({
      hasImmediateDiscount: true,
      originalLabel: expect.stringContaining("100.000"),
      discountedLabel: expect.stringContaining("80.000"),
    });
  });

  it("renders the original price crossed out beside the discounted price", () => {
    render(
      <MemoryRouter>
        <MenuItemCard item={item} />
      </MemoryRouter>,
    );

    expect(screen.getByText("-20%")).toBeInTheDocument();
    expect(screen.getByText(/100\.000/)).toHaveClass(
      "menu-item-card__original-price",
    );
    expect(screen.getByText(/80\.000/)).toHaveClass("price");
  });
});
