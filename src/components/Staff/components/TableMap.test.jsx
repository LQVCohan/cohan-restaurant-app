import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TableMap from "./TableMap";

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: query === "(max-width: 560px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("TableMap", () => {
  it("renders compact table fields and selects the table", () => {
    const table = {
      id: "table-1",
      tableCode: "T101",
      floor: "Tầng 1",
      status: "checkout",
      guests: 6,
      customer: { name: "Khách quen" },
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
    expect(screen.getByText("Khách quen")).toBeInTheDocument();
    expect(container.querySelector(".table-status-text")).not.toBeInTheDocument();
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

  it("uses a collapsed floor filter and switches the visible table group", () => {
    const { container } = render(
      <TableMap
        tables={[
          {
            id: "table-1",
            code: "T101",
            floor: "Tầng 1",
            status: "empty",
            capacity: 4,
          },
          {
            id: "table-2",
            code: "T201",
            floor: "Tầng 2",
            status: "occupied",
            capacity: 2,
          },
        ]}
        floors={["Tầng 1", "Tầng 2"]}
      />,
    );

    const filter = screen.getByTestId("floor-filter");
    expect(filter).not.toHaveAttribute("open");
    expect(screen.getByText("Bộ lọc bàn")).toBeInTheDocument();
    expect(screen.getByText("T101")).toBeInTheDocument();
    expect(screen.queryByText("T201")).not.toBeInTheDocument();

    const floorButtons = container.querySelectorAll(".floor-chip");
    fireEvent.click(floorButtons[1]);

    expect(screen.getByText("T201")).toBeInTheDocument();
    expect(screen.queryByText("T101")).not.toBeInTheDocument();
    expect(screen.getByText("1 bàn")).toBeInTheDocument();
  });
});
