import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("antd", () => ({
  Select: (props) => (
    <select
      id={props.id}
      aria-label={props["aria-label"]}
      value={props.value || ""}
      disabled={props.disabled}
      onChange={(event) => props.onChange?.(event.target.value || undefined)}
    >
      <option value="">{props.placeholder || "Chọn"}</option>
      {(props.options || []).map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  ),
}));

vi.mock("../../../../components/common/Modal", () => ({
  default: ({ isOpen, title, children }) => isOpen ? <section role="dialog" aria-label={title}>{children}</section> : null,
}));

vi.mock("../../../../hooks/useFloorManagement", () => ({
  default: () => ({ floors: [{ id: "floor-1", name: "Tầng 1", level: 1 }], activeLevel: null, setActiveLevel: vi.fn() }),
}));

vi.mock("../../../../hooks/useTableManagement", () => ({
  default: () => ({
    tablesLoading: false,
    tables: [{ id: "table-1", code: "T101", floorLevel: 1, status: "available" }],
  }),
}));

vi.mock("../../../../hooks/useMenuManagement", () => ({
  default: () => ({
    menus: [{ id: "menu-1", timeSlot: "breakfast" }],
    itemsLoading: false,
    selectedTimeSlot: "breakfast",
    setSelectedTimeSlot: vi.fn(),
    itemsWithPrice: [{
      id: "dish-1",
      name: "Cơm gà",
      categoryId: "main",
      _displayPrice: 59000,
      servingVariants: [{
        key: "portion",
        name: "Theo phần",
        mode: "PORTION",
        sellQty: 1,
        sellUnit: "portion",
        price: 59000,
        isDefault: true,
      }],
    }],
  }),
}));

vi.mock("../../../../hooks/useCategoryManagement", () => ({
  useCategoryManagement: () => ({ categories: [{ id: "main", name: "Món chính", isActive: true }] }),
}));

vi.mock("../../../../hooks/useOrderManagement", () => ({
  default: (context) => {
    const subtotal = (context.currentOrder || []).reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0,
    );
    return {
      totals: { subtotal, total: subtotal },
      addToOrder: ({ menuItem, quantity, unit, price, variantName }) => {
        context.setCurrentOrder((current) => [...current, {
          _lineId: `${menuItem.id}-line`,
          name: menuItem.name,
          quantity,
          unit,
          price,
          method: variantName,
        }]);
      },
      updateItemQty: vi.fn(),
      removeItem: vi.fn(),
      saveOrder: vi.fn(async () => ({ success: true })),
    };
  },
}));

vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: vi.fn() }),
}));

vi.mock("../../../../hooks/useModalDraft", () => ({
  default: () => ({ requestCloseWithDraft: (close) => close(), clearDraft: vi.fn() }),
}));

import NewOrderModal from "./NewOrderModal";

describe("NewOrderModal table selection", () => {
  it("places table search in the review column and blocks saving until selected", async () => {
    render(
      <NewOrderModal
        isOpen
        onClose={vi.fn()}
        restaurantId="restaurant-1"
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cấu hình Cơm gà" }));
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào giỏ" }));
    fireEvent.click(await screen.findByRole("button", { name: /Xem giỏ/ }));

    expect(screen.getByText("Chọn bàn trước khi lưu đơn")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu đơn hàng" })).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox", { name: "Chọn bàn cho đơn hàng" }), {
      target: { value: "T101" },
    });

    await waitFor(() => expect(screen.getAllByText("Bàn T101")).toHaveLength(2));
    expect(screen.getByRole("button", { name: "Lưu đơn hàng" })).toBeEnabled();
  });
});
