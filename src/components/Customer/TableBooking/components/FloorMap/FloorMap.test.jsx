import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../../../../../context/AuthContext";
import FloorMap from "./FloorMap";

vi.mock("../../../../../hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: vi.fn() }),
}));

vi.mock("../../../NotifyModal/NotifyModal", () => ({
  default: ({ isOpen, table }) => isOpen ? <div role="dialog">Nhắc bàn {table?.label}</div> : null,
}));

const originalPointerEvent = window.PointerEvent;

beforeAll(() => {
  if (!window.PointerEvent) window.PointerEvent = MouseEvent;
});

afterAll(() => {
  window.PointerEvent = originalPointerEvent;
});

const availableTable = {
  id: "table-a1",
  label: "A1",
  capacity: 4,
  status: "available",
  position: { x: 40, y: 60, w: 68, h: 68, rotation: 0, shape: "round" },
  photos: [],
  visualConfig: {},
};

const renderMap = (props = {}) => render(
  <AuthContext.Provider value={{ user: { id: "user-1" } }}>
    <FloorMap
      tables={[availableTable]}
      layout={[]}
      floorName="Tầng trệt"
      onSelectTable={vi.fn()}
      {...props}
    />
  </AuthContext.Provider>,
);

describe("FloorMap", () => {
  it("renders each table as a named native button and selects it with the keyboard", () => {
    const onSelectTable = vi.fn();
    renderMap({ onSelectTable });

    const tableButton = screen.getByRole("button", { name: /Bàn A1, 4 chỗ, trống/i });
    expect(tableButton.tagName).toBe("BUTTON");
    tableButton.focus();
    expect(tableButton).toHaveFocus();

    fireEvent.keyDown(tableButton, { key: "Enter" });
    expect(onSelectTable).toHaveBeenCalledWith(availableTable);
  });

  it("opens the notification flow for a table that is not available", () => {
    const reservedTable = { ...availableTable, id: "table-b2", label: "B2", status: "reserved" };
    const onSelectTable = vi.fn();
    renderMap({ tables: [reservedTable], onSelectTable });

    fireEvent.click(screen.getByRole("button", { name: /Bàn B2, 4 chỗ, đã được đặt/i }));

    expect(onSelectTable).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("Nhắc bàn B2");
  });

  it("automatically fits the table and layout data, then restores that view after panning", () => {
    const widthSpy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
    const heightSpy = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);

    try {
      const { container } = renderMap({
        layout: [{ id: "wall-1", type: "wall", x: 100, y: 80, w: 600, h: 400 }],
        tables: [{ ...availableTable, position: { ...availableTable.position, x: 640, y: 420 } }],
      });
      const viewport = container.querySelector(".viewport");
      const canvas = container.querySelector(".map-transform-layer");
      const fittedTransform = canvas.style.transform;

      expect(fittedTransform).not.toBe("translate(0px, 0px) scale(1)");
      expect(container.querySelector(".zoom-output")).toHaveTextContent("110%");

      fireEvent.pointerDown(viewport, { pointerId: 1, button: 0, clientX: 10, clientY: 20 });
      fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 54, clientY: 72 });
      expect(canvas.style.transform).not.toBe(fittedTransform);

      fireEvent.click(screen.getByRole("button", { name: /Căn lại sơ đồ theo dữ liệu bàn/i }));
      expect(canvas.style.transform).toBe(fittedTransform);
    } finally {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
    }
  });

  it("moves the map with pointer events", () => {
    const { container } = renderMap();
    const viewport = container.querySelector(".viewport");
    const canvas = container.querySelector(".map-transform-layer");

    fireEvent.pointerDown(viewport, { pointerId: 1, button: 0, clientX: 10, clientY: 20 });
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 54, clientY: 72 });

    expect(canvas.style.transform).toContain("translate(44px, 52px)");
  });
});
