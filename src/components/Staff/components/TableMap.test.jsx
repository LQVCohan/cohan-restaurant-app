import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TableMap from "./TableMap";

beforeEach(() => {
  window.sessionStorage.clear();
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: vi.fn((callback) => callback()),
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches:
        query === "(max-width: 560px)" || query === "(max-width: 899px)",
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
    expect(
      JSON.parse(
        window.sessionStorage.getItem("cohan:staff-order:selected-table"),
      ),
    ).toEqual({ id: "table-1", tableCode: "T101" });
  });

  it("continues to the menu tab after a mobile table selection", () => {
    const table = {
      id: "table-1",
      code: "T101",
      floor: "Tầng 1",
      status: "empty",
      capacity: 4,
    };
    const menuClick = vi.fn();

    render(
      <>
        <nav className="staff-pos-bottom-nav">
          <button type="button" className="nav-item" onClick={menuClick}>
            Menu
          </button>
        </nav>
        <TableMap
          tables={[table]}
          floors={["Tầng 1"]}
          selectedTable={null}
          onSelect={vi.fn()}
        />
      </>,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Chọn bàn T101, 4 khách, Sẵn sàng",
      }),
    );

    expect(menuClick).toHaveBeenCalledTimes(1);
  });

  it("restores a valid saved table and rejects stale selections", async () => {
    const table = {
      id: "table-1",
      code: "T101",
      floor: "Tầng 1",
      status: "empty",
      capacity: 4,
    };
    const onSelect = vi.fn();
    window.sessionStorage.setItem(
      "cohan:staff-order:selected-table",
      JSON.stringify({ id: "table-1", tableCode: "T101" }),
    );

    const { unmount } = render(
      <TableMap
        tables={[table]}
        floors={["Tầng 1"]}
        selectedTable={null}
        onSelect={onSelect}
      />,
    );

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(table));
    unmount();

    window.sessionStorage.setItem(
      "cohan:staff-order:selected-table",
      JSON.stringify({ id: "missing-table", tableCode: "T999" }),
    );
    render(
      <TableMap
        tables={[table]}
        floors={["Tầng 1"]}
        selectedTable={null}
        onSelect={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        window.sessionStorage.getItem("cohan:staff-order:selected-table"),
      ).toBeNull(),
    );
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
