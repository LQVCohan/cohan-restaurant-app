import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ItemModal from "./ItemModal";

vi.mock("../../../common/Modal", () => {
  const Modal = ({ title, children }) => <section role="dialog" aria-label={title}>{children}</section>;
  Modal.Body = ({ children }) => <div>{children}</div>;
  Modal.Footer = ({ children }) => <footer>{children}</footer>;
  return { default: Modal };
});

describe("ItemModal", () => {
  it("uses a dish title, plain wording and an operational status flow", () => {
    render(
      <ItemModal
        onClose={vi.fn()}
        item={{
          name: "Cơm gà",
          quantity: 2,
          price: 59000,
          status: "preparing",
          note: "Không hành",
          ingredientsSnapshot: [
            { ingredientId: "rice", name: "Gạo", quantity: 360, unit: "g" },
          ],
        }}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Chi tiết món ăn" });
    expect(within(dialog).getAllByText("Đang chế biến")).toHaveLength(2);
    expect(within(dialog).getByLabelText("Tiến độ chuẩn bị món")).toBeInTheDocument();
    expect(within(dialog).getByText("Lưu ý từ khách")).toBeInTheDocument();
    expect(within(dialog).getByText("Nguyên liệu sử dụng")).toBeInTheDocument();
    expect(within(dialog).queryByText(/đã trừ kho/i)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/118\.000/)).toBeInTheDocument();
  });
});
