import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import MenuOrdering from "./MenuOrdering";

const menuItem = {
  id: "dish-1",
  menuId: "menu-1",
  categoryId: "category-1",
  category: "Món chính",
  name: "Mực lá nướng sa tế",
  price: 235000,
  stock: 99,
  status: "available",
  servingVariants: [
    {
      key: "portion",
      name: "Phần tiêu chuẩn",
      mode: "PORTION",
      price: 235000,
      sellUnit: "portion",
      sellQty: 1,
    },
    {
      key: "by-weight",
      name: "Theo kilogram",
      mode: "BY_WEIGHT",
      price: 520000,
      sellUnit: "kg",
      sellQty: 1,
    },
  ],
};

const renderMenu = (onAdd) =>
  render(
    <AuthContext.Provider value={{ user: { id: "staff-1", roleName: "server" } }}>
      <MenuOrdering
        onAdd={onAdd}
        selectedTable={{ id: "table-1", name: "Bàn T01" }}
        menuItems={[menuItem]}
        categories={["Tất cả", "Món chính"]}
      />
    </AuthContext.Provider>,
  );

describe("MenuOrdering quantity selection", () => {
  it("adds an integer number of portions", () => {
    const onAdd = vi.fn();
    renderMenu(onAdd);

    fireEvent.click(screen.getByRole("button", { name: /Mực lá nướng sa tế/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Số phần" }), {
      target: { value: "3" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Thêm vào đơn.*705\.000đ/i }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ id: "dish-1" }),
      expect.objectContaining({
        quantity: 3,
        weightGrams: null,
        variant: expect.objectContaining({ key: "portion" }),
      }),
    );
  });

  it("accepts decimal kilograms and converts them to grams", () => {
    const onAdd = vi.fn();
    renderMenu(onAdd);

    fireEvent.click(screen.getByRole("button", { name: /Mực lá nướng sa tế/i }));
    fireEvent.click(screen.getByRole("button", { name: /Theo kilogram.*520\.000đ/i }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Khối lượng kilogram" }),
      { target: { value: "0,75" } },
    );

    fireEvent.click(screen.getByRole("button", { name: /Thêm vào đơn.*390\.000đ/i }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ id: "dish-1" }),
      expect.objectContaining({
        quantity: 1,
        weightGrams: 750,
        variant: expect.objectContaining({ key: "by-weight" }),
      }),
    );
  });
});
