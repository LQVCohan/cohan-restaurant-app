import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import QuickStockModal from "./QuickStockModal";

vi.mock("../../../../common/Modal", () => {
  const Footer = ({ children }) => <div>{children}</div>;
  const Modal = ({ isOpen, title, children }) =>
    isOpen ? (
      <section role="dialog" aria-label={title}>
        {children}
      </section>
    ) : null;
  Modal.Footer = Footer;
  return { default: Modal };
});

describe("QuickStockModal unit conversion", () => {
  it("offers convertible units and keeps the selected unit in the receipt payload", async () => {
    const onSubmit = vi.fn(async () => undefined);

    render(
      <QuickStockModal
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
        entries={[
          {
            id: "ingredient-1",
            type: "ingredient",
            name: "Gạo",
            unit: "g",
          },
        ]}
        ingredients={[
          {
            id: "ingredient-1",
            name: "Gạo",
            baseUnit: "g",
            conversions: [],
          },
        ]}
      />,
    );

    const unitSelect = screen.getByLabelText("Đơn vị nhập");
    expect([...unitSelect.options].map((option) => option.value)).toEqual(["g", "kg"]);

    fireEvent.change(screen.getByLabelText(/Số lượng/), {
      target: { value: "2" },
    });
    fireEvent.change(unitSelect, { target: { value: "kg" } });
    fireEvent.change(screen.getByLabelText(/Giá lô nhập/), {
      target: { value: "120000" },
    });

    expect(await screen.findByText(/Quy đổi:/)).toHaveTextContent("2.000 g");

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận nhập kho" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0][0]).toMatchObject({
      id: "ingredient-1",
      type: "ingredient",
      qty: 2,
      unit: "kg",
      unitPrice: 120000,
      expiry: null,
    });
  });
});
