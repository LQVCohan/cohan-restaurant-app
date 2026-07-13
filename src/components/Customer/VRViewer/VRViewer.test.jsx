import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/utils/vrStorage", () => ({
  loadTableVrImage: () => null,
}));

import VRViewer from "./VRViewer";

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

  it("closes the current tab when the close button is pressed", () => {
    render(
      <MemoryRouter initialEntries={["/vr/table/table-a1"]}>
        <Routes>
          <Route path="/vr/table/:tableId" element={<VRViewer />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Đóng trang xem không gian 360 độ",
      }),
    );

    expect(window.close).toHaveBeenCalledTimes(1);
  });

  it("shows an accurate close label instead of a misleading back action", () => {
    render(
      <MemoryRouter initialEntries={["/vr/table/table-a1"]}>
        <Routes>
          <Route path="/vr/table/:tableId" element={<VRViewer />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("× Đóng")).toBeInTheDocument();
    expect(screen.queryByText("← Quay lại")).not.toBeInTheDocument();
  });
});
