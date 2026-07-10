import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import TableQrScannerPage from "./TableQrScannerPage";

const restaurantId = "6a5018c92a9577d6a9cf4bb1";
const tableId = "6a5018c92a9577d6a9cf4bb2";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

const renderScanner = () =>
  render(
    <MemoryRouter initialEntries={["/scan-table"]}>
      <Routes>
        <Route path="/scan-table" element={<TableQrScannerPage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

describe("TableQrScannerPage", () => {
  it("opens a validated table link as an internal route", () => {
    renderScanner();

    fireEvent.change(screen.getByLabelText("Địa chỉ truy cập bàn"), {
      target: {
        value: `https://another-host.example/table/${restaurantId}/${tableId}?token=signed.table.token`,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /mở bàn/i }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      `/table/${restaurantId}/${tableId}?token=signed.table.token`,
    );
  });

  it("keeps unrelated QR content on the scanner with actionable feedback", () => {
    renderScanner();

    fireEvent.change(screen.getByLabelText("Địa chỉ truy cập bàn"), {
      target: { value: "https://example.com/promotions" },
    });
    fireEvent.click(screen.getByRole("button", { name: /mở bàn/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Đây không phải mã QR truy cập bàn của COHAN.",
    );
  });
});

