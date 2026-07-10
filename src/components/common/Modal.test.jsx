import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Modal from "./Modal";

describe("Modal", () => {
  it("does not render an empty default header when the caller owns the close control", async () => {
    render(
      <Modal
        isOpen
        onClose={vi.fn()}
        closeOnEscape={false}
        closeOnOverlayClick={false}
        showCloseButton={false}
      >
        <button type="button" aria-label="Đóng biểu mẫu">
          ×
        </button>
        <p>Nội dung biểu mẫu</p>
      </Modal>,
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(document.querySelector(".modal-header")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đóng" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Đóng biểu mẫu" }),
    ).toBeInTheDocument();
  });

  it("keeps a titled header while hiding only its close button", async () => {
    render(
      <Modal isOpen title="Thông tin" onClose={vi.fn()} showCloseButton={false}>
        <p>Nội dung</p>
      </Modal>,
    );

    expect(
      await screen.findByRole("heading", { name: "Thông tin" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đóng" })).not.toBeInTheDocument();
  });
});
