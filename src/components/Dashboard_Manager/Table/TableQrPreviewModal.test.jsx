import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TableQrPreviewModal from "./TableQrPreviewModal";

vi.mock("../../common/Modal", () => ({
  default: ({ isOpen, title, children, onClose }) => isOpen ? (
    <section role="dialog" aria-label={title}>
      <button type="button" aria-label="Đóng" onClick={onClose}>×</button>
      {children}
    </section>
  ) : null,
}));

const table = {
  id: "table-101",
  code: "T101",
  floorLevel: 1,
  capacity: 4,
  tableAccessUrl: "https://cohan.test/table/restaurant-1/table-101?token=signed-token",
  tableQrCodeDataUrl: "data:image/png;base64,qr-code",
  tableQrGeneratedAt: "2026-07-14T06:05:00.000Z",
  tableQrExpiresAt: "2027-07-14T06:05:00.000Z",
};

describe("TableQrPreviewModal", () => {
  it("does not render when a table has no QR image", () => {
    render(<TableQrPreviewModal table={{ ...table, tableQrCodeDataUrl: "" }} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a large QR preview and exposes the related actions", () => {
    const onClose = vi.fn();
    const onCopy = vi.fn();
    const onOpen = vi.fn();
    const onPrint = vi.fn();

    render(
      <TableQrPreviewModal
        table={table}
        onClose={onClose}
        onCopy={onCopy}
        onOpen={onOpen}
        onPrint={onPrint}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Mã QR bàn T101" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Mã QR phóng to để truy cập bàn T101" })).toHaveAttribute("width", "420");
    expect(screen.getByText(table.tableAccessUrl)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sao chép liên kết" }));
    fireEvent.click(screen.getByRole("button", { name: "Mở trang bàn" }));
    fireEvent.click(screen.getByRole("button", { name: "In mã QR" }));
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));

    expect(onCopy).toHaveBeenCalledWith(table);
    expect(onOpen).toHaveBeenCalledWith(table);
    expect(onPrint).toHaveBeenCalledWith(table);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reflects the copied state in the preview", () => {
    render(<TableQrPreviewModal table={table} copied />);
    expect(screen.getByRole("button", { name: "Đã sao chép" })).toBeInTheDocument();
  });
});
