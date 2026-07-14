import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrintModal } from "./PrintModal";

vi.mock("./useModalKeyboardClose", () => ({
  default: vi.fn(),
}));

afterEach(() => cleanup());

const baseProps = {
  isOpen: true,
  mode: "temp",
  tempPreview: "Tạm tính",
  stationPreviews: [],
  onChangeMode: vi.fn(),
  onAddQueue: vi.fn(),
  onPrintNow: vi.fn(),
  onOpenQueue: vi.fn(),
  onClose: vi.fn(),
};

describe("PrintModal cashier printer selection", () => {
  it("shows and selects the cashier printer instead of the kitchen printer", async () => {
    const onPickPrinter = vi.fn();
    const kitchenPrinter = {
      id: "kitchen-1",
      name: "Máy bếp",
      location: "kitchen",
      status: "online",
      ip: "192.168.1.10",
      type: "thermal",
    };
    const cashierPrinter = {
      id: "cashier-1",
      name: "Máy thu ngân",
      location: "cashier",
      status: "online",
      ip: "192.168.1.11",
      type: "thermal",
    };

    render(
      <PrintModal
        {...baseProps}
        printers={[kitchenPrinter, cashierPrinter]}
        selectedPrinter={kitchenPrinter}
        onPickPrinter={onPickPrinter}
      />,
    );

    expect(screen.getByText("Máy thu ngân")).toBeInTheDocument();
    expect(screen.queryByText("Máy bếp")).not.toBeInTheDocument();
    await waitFor(() => expect(onPickPrinter).toHaveBeenCalledWith(cashierPrinter));
  });

  it("keeps the configured list as fallback when printer locations are absent", async () => {
    const onPickPrinter = vi.fn();
    const fallbackPrinter = {
      id: "printer-1",
      name: "Máy in mặc định",
      status: "configured",
      ip: "192.168.1.20",
      type: "thermal",
    };

    render(
      <PrintModal
        {...baseProps}
        printers={[fallbackPrinter]}
        selectedPrinter={null}
        onPickPrinter={onPickPrinter}
      />,
    );

    expect(screen.getByText("Máy in mặc định")).toBeInTheDocument();
    await waitFor(() => expect(onPickPrinter).toHaveBeenCalledWith(fallbackPrinter));
  });
});
