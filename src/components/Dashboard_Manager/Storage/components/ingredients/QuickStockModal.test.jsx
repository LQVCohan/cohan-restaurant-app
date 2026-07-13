import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import QuickStockModal from "./QuickStockModal";

vi.mock("../../../../common/Modal", () => {
  const Body = ({ children, className = "" }) => <div className={className}>{children}</div>;
  const Footer = ({ children, className = "" }) => <div className={className}>{children}</div>;
  const Modal = ({ isOpen, title, children }) =>
    isOpen ? (
      <section role="dialog" aria-label={title}>
        {children}
      </section>
    ) : null;
  Modal.Body = Body;
  Modal.Footer = Footer;
  return { default: Modal };
});

afterEach(() => {
  vi.useRealTimers();
});

const ingredientEntry = {
  id: "ingredient-1",
  type: "ingredient",
  name: "Gạo",
  unit: "g",
};

const ingredient = {
  id: "ingredient-1",
  name: "Gạo",
  baseUnit: "g",
  conversions: [],
};

describe("QuickStockModal", () => {
  it("submits only the rows the user filled in", async () => {
    const onSubmit = vi.fn(async () => undefined);

    render(
      <QuickStockModal
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
        entries={[
          ingredientEntry,
          { ...ingredientEntry, id: "ingredient-2", name: "Muối" },
        ]}
        ingredients={[
          ingredient,
          { ...ingredient, id: "ingredient-2", name: "Muối" },
        ]}
      />,
    );

    const rowCheckboxes = screen.getAllByRole("checkbox");
    fireEvent.click(rowCheckboxes[0]);
    const quantityInputs = await screen.findAllByLabelText(/Số lượng/);
    const priceInputs = screen.getAllByLabelText(/Giá lô/);
    fireEvent.change(quantityInputs[0], {
      target: { value: "5" },
    });
    fireEvent.change(priceInputs[0], {
      target: { value: "90000" },
    });
    expect(quantityInputs[0]).toHaveValue(5);
    fireEvent.click(screen.getByRole("button", { name: "Nhập 1 mặt hàng" }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toHaveLength(1);
    expect(onSubmit.mock.calls[0][0][0]).toMatchObject({
      id: "ingredient-1",
      qty: 5,
      unitPrice: 90000,
    });
    expect(onSubmit.mock.calls[0][0]).toHaveLength(1);
  });

  it("does not validate rows the user did not select", async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(
      <QuickStockModal
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
        entries={[
          ingredientEntry,
          { ...ingredientEntry, id: "ingredient-2", name: "Muối" },
        ]}
        ingredients={[
          ingredient,
          { ...ingredient, id: "ingredient-2", name: "Muối" },
        ]}
      />,
    );

    fireEvent.click(screen.getByLabelText("Chọn Muối để nhập kho"));
    const selectedRow = screen.getByText("Muối").closest("article");
    const quantityInput = within(selectedRow).getByLabelText(/Số lượng/);
    const priceInput = within(selectedRow).getByLabelText(/Giá lô/);
    fireEvent.change(quantityInput, { target: { value: "3" } });
    fireEvent.change(priceInput, { target: { value: "45000" } });
    fireEvent.click(screen.getByRole("button", { name: "Nhập 1 mặt hàng" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: "ingredient-2", qty: 3, unitPrice: 45000 }),
    ]);
  });

  it("offers convertible units and keeps the selected unit in the receipt payload", async () => {
    const onSubmit = vi.fn(async () => undefined);

    render(
      <QuickStockModal
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
        entries={[ingredientEntry]}
        ingredients={[ingredient]}
      />,
    );

    const unitSelect = screen.getByLabelText("Đơn vị");
    expect([...unitSelect.options].map((option) => option.value)).toEqual(["g", "kg"]);

    fireEvent.change(screen.getByLabelText(/Số lượng/), {
      target: { value: "2" },
    });
    fireEvent.change(unitSelect, { target: { value: "kg" } });
    fireEvent.change(screen.getByLabelText(/Giá lô/), {
      target: { value: "120000" },
    });

    expect(await screen.findByText(/Nhập vào kho/)).toHaveTextContent("2.000 g");

    fireEvent.click(screen.getByRole("button", { name: /Nhập kho ngay/ }));

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

  it("focuses quantity and completes a shared receipt with two Enter presses", async () => {
    const onSubmit = vi.fn(async () => undefined);

    render(
      <QuickStockModal
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
        entries={[ingredientEntry]}
        ingredients={[ingredient]}
      />,
    );

    const quantityInput = screen.getByLabelText(/Số lượng/);
    const priceInput = screen.getByLabelText(/Giá lô/);

    await waitFor(() => expect(quantityInput).toHaveFocus());

    fireEvent.change(screen.getByLabelText("Nhà cung cấp / Nguồn chung"), {
      target: { value: "Chợ đầu mối" },
    });
    fireEvent.change(screen.getByLabelText(/Thời gian nhập/), {
      target: { value: "2026-07-12T08:15" },
    });
    fireEvent.change(quantityInput, { target: { value: "10" } });
    fireEvent.keyDown(quantityInput, { key: "Enter", code: "Enter" });

    expect(priceInput).toHaveFocus();

    fireEvent.change(priceInput, { target: { value: "250000" } });
    fireEvent.keyDown(priceInput, { key: "Enter", code: "Enter" });

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0][0]).toMatchObject({
      qty: 10,
      unitPrice: 250000,
      supplier: "Chợ đầu mối",
      datetime: "2026-07-12T01:15:00.000Z",
    });
  });

  it("shows Vietnam time and submits the matching UTC instant", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T01:29:00.000Z"));
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
            name: "Bánh phở",
            unit: "kg",
          },
        ]}
        ingredients={[
          {
            id: "ingredient-1",
            name: "Bánh phở",
            baseUnit: "kg",
            conversions: [],
          },
        ]}
      />,
    );

    expect(screen.getByLabelText(/Thời gian nhập/)).toHaveValue("2026-07-10T08:29");
    expect(screen.getByText(/Giờ Việt Nam:/)).toHaveTextContent("10/07/2026, 08:29");

    fireEvent.change(screen.getByLabelText(/Số lượng/), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText(/Giá lô/), {
      target: { value: "200000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Nhập kho ngay/ }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0][0].datetime).toBe("2026-07-10T01:29:00.000Z");
  });
});
