import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BookingSummary from "./BookingSummary";

describe("BookingSummary table 360 action", () => {
  const selectedTable = {
    id: "table-1",
    label: "T01",
    capacity: 4,
    deposit: 0,
  };

  it("shows and invokes the 360 viewer action when the table has panorama content", () => {
    const onView360 = vi.fn();
    render(
      <BookingSummary
        selectedTable={selectedTable}
        selectedFloorName="Tầng 1"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onView360={onView360}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Xem không gian 360° của bàn" }),
    );
    expect(onView360).toHaveBeenCalledTimes(1);
  });

  it("does not show a misleading 360 action when no panorama is configured", () => {
    render(
      <BookingSummary
        selectedTable={selectedTable}
        selectedFloorName="Tầng 1"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Xem không gian 360° của bàn" }),
    ).not.toBeInTheDocument();
  });
});
