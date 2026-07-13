import React from "react";
import { gql } from "@apollo/client";
import { MockedProvider } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import TableQrScannerPage from "./TableQrScannerPage";

const CHECK_IN_RESERVATION = gql`
  mutation ScanReservationCheckIn($input: CheckInReservationInput!) {
    checkInReservation(input: $input) {
      id
      orderCode
      tableId
      tableCode
      tableName
      status
    }
  }
`;

const reservationId = "507f1f77bcf86cd799439013";
const payload = JSON.stringify({
  type: "COHAN_RESERVATION_CHECK_IN",
  reservationId,
  orderCode: "RSV-001",
  tableId: "507f1f77bcf86cd799439014",
});

describe("TableQrScannerPage reservation QR", () => {
  it("submits a reservation check-in payload and shows the resolved table", async () => {
    const mocks = [
      {
        request: {
          query: CHECK_IN_RESERVATION,
          variables: {
            input: {
              reservationId,
              note: "Nhân viên check-in bằng mã QR đặt bàn.",
            },
          },
        },
        result: {
          data: {
            checkInReservation: {
              id: reservationId,
              orderCode: "RSV-001",
              tableId: "507f1f77bcf86cd799439014",
              tableCode: "T201",
              tableName: "Bàn cửa sổ",
              status: "seated",
            },
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <MemoryRouter>
          <TableQrScannerPage />
        </MemoryRouter>
      </MockedProvider>,
    );

    fireEvent.change(screen.getByLabelText("Nội dung mã QR"), {
      target: { value: payload },
    });
    fireEvent.click(screen.getByRole("button", { name: /xử lý mã/i }));

    await waitFor(() => {
      expect(screen.getByText(/Đã check-in RSV-001 tại Bàn cửa sổ/i)).toBeInTheDocument();
    });
  });

  it("rejects unrelated JSON without calling the reservation mutation", async () => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <MemoryRouter>
          <TableQrScannerPage />
        </MemoryRouter>
      </MockedProvider>,
    );

    fireEvent.change(screen.getByLabelText("Nội dung mã QR"), {
      target: { value: JSON.stringify({ type: "OTHER", reservationId }) },
    });
    fireEvent.click(screen.getByRole("button", { name: /xử lý mã/i }));

    expect(await screen.findByText(/không phải mã bàn hoặc mã check-in/i)).toBeInTheDocument();
  });
});
