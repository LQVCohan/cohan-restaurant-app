import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MenuItemCard, { getMenuItemPriceLabel } from "./MenuItemCard";

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
    render(
      <MenuItemCard
        disabled
        item={{
          id: "food-1",
          name: "Cá nướng",
          description: "Nướng cùng gia vị",
          basePrice: 150000,
          status: "available",
          inventoryStatus: "IN_STOCK",
          servingVariants: [
            { key: "portion", name: "Phần", price: 150000 },
          ],
        }}
        onClick={onClick}
      />,
    );

    const card = screen.getByRole("button", {
      name: /xem chi tiết cá nướng/i,
    });
    expect(screen.getByText("Xem chi tiết")).toBeInTheDocument();
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: "food-1" }));
  });

  it("keeps a sold-out dish visible and keyboard accessible", () => {
    const onClick = vi.fn();
    render(
      <MenuItemCard
        item={{
          id: "food-2",
          name: "Tôm hấp",
          basePrice: 100000,
          status: "out_of_stock",
          inventoryStatus: "OUT_OF_STOCK",
          servingVariants: [
            { key: "portion", name: "Phần", price: 100000 },
          ],
        }}
        onClick={onClick}
      />,
    );

    const card = screen.getByRole("button", {
      name: /xem chi tiết tôm hấp/i,
    });
    expect(screen.getByText("Hết món")).toBeInTheDocument();
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
