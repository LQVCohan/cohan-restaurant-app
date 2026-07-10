import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TableMap from "./TableMap";

describe("TableMap", () => {
  it("renders the mapped staff-order table fields and selects the table", () => {
    const table = {
      id: "table-1",
      tableCode: "T101",
      floor: "Tầng 1",
      status: "checkout",
      guests: 6,
    };
    const onSelect = vi.fn();
    const { container } = render(
      <TableMap
        tables={[table]}
        floors={["Tầng 1"]}
        selectedTable={null}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("T101")).toBeInTheDocument();
    expect(screen.getByText("6 khách")).toBeInTheDocument();
    expect(screen.getByText("Đang phục vụ")).toBeInTheDocument();
    expect(container.querySelector("button button")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Chọn bàn T101, 6 khách, Đang phục vụ",
      }),
    );
    expect(onSelect).toHaveBeenCalledWith(table);
  });

  it("keeps an available table visibly ready", () => {
    render(
      <TableMap
        tables={[
          {
            id: "table-2",
            code: "T102",
            floor: "Tầng 1",
            status: "empty",
            capacity: 4,
          },
        ]}
        floors={["Tầng 1"]}
      />,
    );

    expect(screen.getByText("T102")).toBeInTheDocument();
    expect(screen.getByText("4 khách")).toBeInTheDocument();
    expect(screen.getByText("Sẵn sàng")).toBeInTheDocument();
  });
});
