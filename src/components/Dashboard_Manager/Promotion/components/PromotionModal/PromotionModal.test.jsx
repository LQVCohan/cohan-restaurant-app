import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PromotionModal from "./PromotionModal";

const restaurants = [
  { id: "restaurant-1", name: "Chi nhanh Quan 1" },
  { id: "restaurant-2", name: "Chi nhanh Phu Nhuan" },
];

describe("PromotionModal restaurant data", () => {
  it("renders restaurant options from real props and submits the selected restaurant id", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <PromotionModal
        restaurants={restaurants}
        defaultRestaurantId="restaurant-1"
        onSave={onSave}
        onClose={onClose}
      />
    );

    const restaurantSelect = document.querySelector(
      'select[name="restaurantId"]'
    );

    expect(screen.getByRole("option", { name: "Chi nhanh Quan 1" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Chi nhanh Phu Nhuan" })).toBeInTheDocument();
    expect(restaurantSelect.value).toBe("restaurant-1");

    fireEvent.change(document.querySelector('input[name="name"]'), {
      target: { name: "name", value: "Mung le" },
    });
    fireEvent.change(document.querySelector('input[name="code"]'), {
      target: { name: "code", value: "LE2026" },
    });
    fireEvent.change(document.querySelector('select[name="type"]'), {
      target: { name: "type", value: "percentage" },
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
        })
      );
    });
  });

  it("shows the promotion restaurant when editing an existing record", () => {
    render(
      <PromotionModal
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
        defaultRestaurantId="restaurant-1"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const restaurantSelect = document.querySelector(
      'select[name="restaurantId"]'
    );

    expect(restaurantSelect.value).toBe("restaurant-2");
  });
});
