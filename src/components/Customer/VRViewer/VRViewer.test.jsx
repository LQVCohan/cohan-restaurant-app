import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/utils/vrStorage", () => ({
  loadTableVrImage: () => null,
}));

import VRViewer from "./VRViewer";

const renderViewer = (initialEntries, initialIndex) =>
  render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <Routes>
        <Route path="/booking/:id" element={<div>Trang đặt bàn</div>} />
        <Route path="/vr/table/:tableId" element={<VRViewer />} />
      </Routes>
    </MemoryRouter>,
  );

describe("VRViewer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "close").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("closes the current tab only when the viewer was explicitly opened in a new tab", () => {
    renderViewer([
      "/vr/table/table-a1?openedInNewTab=1&returnTo=%2Fbooking%2Fr1",
    ]);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Đóng trang xem không gian 360 độ",
      }),
    );

    expect(window.close).toHaveBeenCalledTimes(1);
    expect(screen.getByText("× Đóng")).toBeInTheDocument();
  });

  it("goes back without closing when the viewer is being used in the current tab", () => {
    renderViewer(["/booking/r1", "/vr/table/table-a1"], 1);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Quay lại trang trước",
      }),
    );

    expect(window.close).not.toHaveBeenCalled();
    expect(screen.getByText("Trang đặt bàn")).toBeInTheDocument();
  });
});
