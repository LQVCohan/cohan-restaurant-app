import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import MenuItemCard, { getMenuItemPriceLabel } from "./MenuItemCard";

const renderCard = (props) =>
  render(
    <MemoryRouter>
      <MenuItemCard {...props} />
    </MemoryRouter>,
  );

describe("customer MenuItemCard", () => {
  it("shows a price range when serving variants have different prices", () => {
    expect(
      getMenuItemPriceLabel({
        basePrice: 80000,
        servingVariants: [{ price: 80000 }, { price: 120000 }],
      }),
    ).toContain("Từ");
  });

  it("still opens details when the restaurant is not accepting orders", () => {
    const onClick = vi.fn();
    renderCard({
      disabled: true,
      item: {
        id: "food-1",
        restaurantId: "restaurant-1",
        name: "Cá nướng",
        description: "Nướng cùng gia vị",
        basePrice: 150000,
        status: "available",
        inventoryStatus: "IN_STOCK",
        servingVariants: [
          { key: "portion", name: "Phần", price: 150000 },
        ],
      },
      onClick,
    });

    const card = screen.getByRole("link", {
      name: /xem chi tiết cá nướng/i,
    });
    expect(screen.getByText("Xem chi tiết")).toBeInTheDocument();
    expect(card).toHaveAttribute(
      "href",
      "/food/food-1?restaurantId=restaurant-1",
    );
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "food-1" }),
    );
  });

  it("keeps a sold-out dish visible as a native keyboard link", () => {
    renderCard({
      item: {
        id: "food-2",
        restaurantId: "restaurant-1",
        name: "Tôm hấp",
        basePrice: 100000,
        status: "out_of_stock",
        inventoryStatus: "OUT_OF_STOCK",
        servingVariants: [
          { key: "portion", name: "Phần", price: 100000 },
        ],
      },
    });

    const card = screen.getByRole("link", {
      name: /xem chi tiết tôm hấp/i,
    });
    expect(screen.getByText("Hết món")).toBeInTheDocument();
    expect(card).toHaveAttribute(
      "href",
      "/food/food-2?restaurantId=restaurant-1",
    );
  });
});
