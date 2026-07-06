import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import IngredientModal from "./IngredientModal";

const showNotification = vi.fn();
const clearDraft = vi.fn();

vi.mock("../../../../../hooks/useNotification", () => ({
  useNotification: () => ({ showNotification }),
}));

vi.mock("../../../../../hooks/useModalDraft", () => ({
  default: () => ({
    clearDraft,
    requestCloseWithDraft: (onClose) => onClose?.(),
  }),
}));

const initialIngredient = {
  id: "ingredient-1",
  name: "Bánh mì",
  sku: "CR1-ING-019",
  ingredientCategoryId: "category-1",
  category: "Starch",
  baseUnit: "piece",
  costPerBaseUnit: 6500,
  minStock: 40,
  notes: "",
  isActive: true,
  conversions: [],
  photos: [],
};

describe("IngredientModal edit layout", () => {
  it("uses native pressed controls and expands the single stock field", async () => {
    render(
      <IngredientModal
        isOpen
        onClose={vi.fn()}
        initial={initialIngredient}
        isEditing
        onSubmit={vi.fn()}
        categoryOptions={[{ id: "category-1", name: "Starch" }]}
      />,
    );

    await screen.findByRole("dialog", { name: "Cập nhật nguyên vật liệu" });

    const activeButton = screen.getByRole("button", { name: "Đang bán" });
    const pausedButton = screen.getByRole("button", { name: "Tạm ngưng" });

    expect(activeButton).toHaveAttribute("aria-pressed", "true");
    expect(pausedButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(pausedButton);

    expect(activeButton).toHaveAttribute("aria-pressed", "false");
    expect(pausedButton).toHaveAttribute("aria-pressed", "true");

    const minStockInput = screen.getByLabelText(/Mức cảnh báo tồn thấp/i);
    expect(minStockInput.closest(".form-group")).toHaveClass("form-group--full");
  });
});
