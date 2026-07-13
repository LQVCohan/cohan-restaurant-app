import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutate = vi.fn();

vi.mock("@/apollo/client", () => ({
  apolloClient: { mutate },
}));

import StaffReservationQrScanner from "./StaffReservationQrScanner";

const reservationId = "507f1f77bcf86cd799439013";
const qrPayload = JSON.stringify({
  type: "COHAN_RESERVATION_CHECK_IN",
  reservationId,
  orderCode: "RSV-001",
  tableId: "507f1f77bcf86cd799439014",
});

describe("StaffReservationQrScanner", () => {
  beforeEach(() => {
    mutate.mockReset();
  });

  it("asks for confirmation when the guest arrives early, then checks in", async () => {
    mutate
      .mockRejectedValueOnce({
        graphQLErrors: [
          {
            extensions: {
              code: "RESERVATION_CHECK_IN_TOO_EARLY",
              orderCode: "RSV-001",
              customerName: "Nguyễn Minh Anh",
              tableCode: "T101",
              reservationTime: "2026-07-14T10:00:00.000Z",
              earliestCheckInAt: "2026-07-14T09:45:00.000Z",
              minutesBeforeReservation: 30,
              requiresStaffConfirmation: true,
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        data: {
          checkInReservation: {
            id: reservationId,
            orderCode: "RSV-001",
            tableId: "507f1f77bcf86cd799439014",
            tableCode: "T101",
            tableName: "Bàn cửa sổ",
            customerName: "Nguyễn Minh Anh",
            partySize: 2,
            timeTo: "2026-07-14T10:00:00.000Z",
            status: "seated",
          },
        },
      });

    render(<StaffReservationQrScanner />);

    fireEvent.change(screen.getByLabelText("Nội dung mã QR"), {
      target: { value: qrPayload },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra mã" }));

    expect(await screen.findByRole("heading", { name: "Khách đến sớm" })).toBeInTheDocument();
    expect(screen.getByText(/đến sớm khoảng 30 phút/i)).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Minh Anh")).toBeInTheDocument();
    expect(screen.getByText("T101")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận nhận khách" }),
    );

    await waitFor(() => {
      expect(screen.getByText(/Đã nhận khách RSV-001 tại Bàn cửa sổ/i)).toBeInTheDocument();
    });

    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate.mock.calls[0][0].variables.input).toMatchObject({
      reservationId,
      confirmEarlyArrival: false,
    });
    expect(mutate.mock.calls[1][0].variables.input).toMatchObject({
      reservationId,
      confirmEarlyArrival: true,
    });
  });

  it("shows the real permission error only when the account truly cannot operate the reservation", async () => {
    mutate.mockRejectedValueOnce({
      graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }],
    });

    render(<StaffReservationQrScanner />);
    fireEvent.change(screen.getByLabelText("Nội dung mã QR"), {
      target: { value: qrPayload },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra mã" }));

    expect(
      await screen.findByText(/Bạn không có quyền thực hiện thao tác đặt bàn này/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Khách đến sớm" }),
    ).not.toBeInTheDocument();
  });
});
