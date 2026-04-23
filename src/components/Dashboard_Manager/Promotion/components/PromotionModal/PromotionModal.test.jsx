import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PromotionModal from "./PromotionModal";

const restaurants = [
  { id: "restaurant-1", name: "Chi nhanh Quan 1" },
  { id: "restaurant-2", name: "Chi nhanh Phu Nhuan" },
];

const categories = [
  { id: "cat-1", name: "Mon chinh" },
  { id: "cat-2", name: "Do uong" },
];

const menuItems = [
  { id: "item-1", name: "Pho bo", categoryId: "cat-1" },
  { id: "item-2", name: "Com tam", categoryId: "cat-1" },
  { id: "item-3", name: "Tra da", categoryId: "cat-2" },
];

describe("PromotionModal", () => {
  it("renders restaurant options from props and submits the selected restaurant id", async () => {
    const onSave = vi.fn();

    render(
      <PromotionModal
        categories={categories}
        defaultRestaurantId="restaurant-1"
        menuItems={menuItems}
        onClose={vi.fn()}
        onSave={onSave}
        restaurants={restaurants}
      />,
    );

    const restaurantSelect = document.querySelector('select[name="restaurantId"]');

    fireEvent.change(document.querySelector('input[name="name"]'), {
      target: { name: "name", value: "Mung le" },
    });
    fireEvent.change(document.querySelector('input[name="code"]'), {
      target: { name: "code", value: "LE2026" },
    });
    fireEvent.change(document.querySelector('input[name="discountValue"]'), {
      target: { name: "discountValue", value: "15" },
    });
    fireEvent.change(restaurantSelect, {
      target: { name: "restaurantId", value: "restaurant-2" },
    });
    fireEvent.change(document.querySelector('input[name="startDate"]'), {
      target: { name: "startDate", value: "2026-05-01T10:00" },
    });
    fireEvent.change(document.querySelector('input[name="endDate"]'), {
      target: { name: "endDate", value: "2026-05-05T22:00" },
    });

    fireEvent.click(document.querySelector('button[form="promoForm"]'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Mung le",
          code: "LE2026",
          restaurantId: "restaurant-2",
          type: "percentage",
        }),
      );
    });
  });

  it("forces BOGO promotions to capture both the purchased item and the gifted item", async () => {
    const onSave = vi.fn();

    render(
      <PromotionModal
        categories={categories}
        defaultRestaurantId="restaurant-1"
        menuItems={menuItems}
        onClose={vi.fn()}
        onSave={onSave}
        restaurants={restaurants}
      />,
    );

    fireEvent.change(document.querySelector('input[name="name"]'), {
      target: { name: "name", value: "Mua 1 tang 1 pho" },
    });
    fireEvent.change(document.querySelector('input[name="code"]'), {
      target: { name: "code", value: "BOGO-PHO" },
    });
    fireEvent.change(document.querySelector('select[name="type"]'), {
      target: { name: "type", value: "bogo" },
    });
    fireEvent.change(document.querySelector('input[name="startDate"]'), {
      target: { name: "startDate", value: "2026-05-01T10:00" },
    });
    fireEvent.change(document.querySelector('input[name="endDate"]'), {
      target: { name: "endDate", value: "2026-05-05T22:00" },
    });
    fireEvent.change(document.querySelector('select[name="categoryId"]'), {
      target: { name: "categoryId", value: "cat-1" },
    });
    fireEvent.change(document.querySelector('select[name="itemId"]'), {
      target: { name: "itemId", value: "item-1" },
    });
    fireEvent.change(document.querySelector('select[name="giftItemId"]'), {
      target: { name: "giftItemId", value: "item-2" },
    });
    fireEvent.change(document.querySelector('input[name="buyQuantity"]'), {
      target: { name: "buyQuantity", value: "1" },
    });
    fireEvent.change(document.querySelector('input[name="getQuantity"]'), {
      target: { name: "getQuantity", value: "1" },
    });

    fireEvent.click(document.querySelector('button[form="promoForm"]'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "bogo",
          scope: "item",
          itemId: "item-1",
          giftItemId: "item-2",
          productId: "item-2",
          buyQuantity: 1,
          getQuantity: 1,
          discountValue: 0,
        }),
      );
    });
  });

  it("shows the promotion restaurant when editing an existing record", () => {
    render(
      <PromotionModal
        categories={categories}
        defaultRestaurantId="restaurant-1"
        menuItems={menuItems}
        onClose={vi.fn()}
        onSave={vi.fn()}
        promotion={{
          id: "promotion-1",
          name: "Khuyen mai cu",
          code: "PROMO1",
          type: "percentage",
          discountValue: 10,
          restaurantId: "restaurant-2",
          startDate: "2026-05-01T10:00",
          endDate: "2026-05-05T22:00",
          conditions: [],
        }}
        restaurants={restaurants}
      />,
    );

    const restaurantSelect = document.querySelector('select[name="restaurantId"]');

    expect(screen.getByRole("option", { name: "Chi nhanh Quan 1" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Chi nhanh Phu Nhuan" })).toBeInTheDocument();
    expect(restaurantSelect.value).toBe("restaurant-2");
  });
});
