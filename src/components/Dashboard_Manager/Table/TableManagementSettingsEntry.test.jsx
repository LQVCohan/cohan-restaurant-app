import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TableManagementSettingsEntry from "./TableManagementSettingsEntry";

vi.mock("./TableManagement", () => ({
  default: () => (
    <main>
      <div className="management-page-header">
        <div className="mph-controls-row" />
      </div>
      Trang quản lý bàn
    </main>
  ),
}));

vi.mock("./TableReservationTimingOverlay", () => ({
  default: () => null,
}));

describe("TableManagementSettingsEntry", () => {
  it("opens table settings from the table page header", () => {
    const onOpenTableSettings = vi.fn();

    render(
      <TableManagementSettingsEntry onOpenTableSettings={onOpenTableSettings} />,
    );

    expect(screen.getByText("Trang quản lý bàn")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Loại bàn & không gian" }),
    );
    expect(onOpenTableSettings).toHaveBeenCalledTimes(1);
  });

  it("hides the settings action when no opener is provided", () => {
    render(<TableManagementSettingsEntry />);

    expect(
      screen.queryByRole("button", { name: "Loại bàn & không gian" }),
    ).not.toBeInTheDocument();
  });
});
