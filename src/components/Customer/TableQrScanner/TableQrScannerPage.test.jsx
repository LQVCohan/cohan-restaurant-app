import React from "react";
import { MockedProvider } from "@apollo/client/testing";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import TableQrScannerPage from "./TableQrScannerPage";

const restaurantId = "6a5018c92a9577d6a9cf4bb1";
const tableId = "6a5018c92a9577d6a9cf4bb2";

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

const renderScanner = () =>
  render(
    <MockedProvider mocks={[]}>
      <MemoryRouter initialEntries={["/scan-table"]}>
        <Routes>
          <Route path="/scan-table" element={<TableQrScannerPage />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );

describe("TableQrScannerPage", () => {
  it("opens a validated table link as an internal route", async () => {
    renderScanner();

    fireEvent.change(screen.getByLabelText("Nội dung mã QR"), {
      target: {
        value: `https://cohan.example/table/${restaurantId}/${tableId}?token=signed.table.token`,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /xử lý mã/i }));

    expect(await screen.findByTestId("location")).toHaveTextContent(
      `/table/${restaurantId}/${tableId}?token=signed.table.token`,
    );
  });

  it("keeps unrelated QR content on the scanner with actionable feedback", async () => {
    renderScanner();

    fireEvent.change(screen.getByLabelText("Nội dung mã QR"), {
      target: { value: "not-a-cohan-qr" },
    });
    fireEvent.click(screen.getByRole("button", { name: /xử lý mã/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Mã QR không phải mã bàn hoặc mã check-in đặt bàn hợp lệ.",
    );
  });

  it("asks for QR content before processing an empty manual form", async () => {
    renderScanner();

    fireEvent.click(screen.getByRole("button", { name: /xử lý mã/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Hãy dán đường dẫn hoặc nội dung mã QR trước khi xử lý.",
    );
    expect(screen.getByLabelText("Nội dung mã QR")).toHaveFocus();
  });
});
