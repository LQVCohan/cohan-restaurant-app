import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MockedProvider } from "@apollo/client/testing";
import PublicOrderTrackingPage, { CALL_STAFF_FROM_TRACKING, CUSTOMER_TRACK_ORDER, REQUEST_PAYMENT_FROM_TRACKING } from "./PublicOrderTrackingPage";

vi.mock("socket.io-client", () => ({ io: () => ({ on: () => {}, off: () => {}, emit: () => {}, disconnect: () => {} }) }));

describe("PublicOrderTrackingPage", () => {
  it("renders tracking content", async () => {
    const mocks = [{ request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-1" } }, result: { data: { customerTrackOrder: { trackingCode: "ORD-1", publicStatusLabel: "Đang chuẩn bị", items: [{ name: "Phở", quantity: 1, publicStatusLabel: "Đang chuẩn bị", publicStatus: "PREPARING", __typename: "CustomerTrackingItem" }], payment: { status: "UNPAID", totalAmount: 100000, canRequestPayment: true, __typename: "CustomerTrackingPayment" }, timeline: [], publicStatus: "PREPARING", customerVisibleNote: null, estimatedReadyAt: null, __typename: "CustomerOrderTrackingView" } } } }];
    render(<MockedProvider mocks={mocks}><MemoryRouter initialEntries={["/track-order/token-1"]}><Routes><Route path="/track-order/:trackingToken" element={<PublicOrderTrackingPage />} /></Routes></MemoryRouter></MockedProvider>);
    expect(await screen.findByText(/Mã đơn: ORD-1/)).toBeInTheDocument();
    expect(screen.getByText("Đang chuẩn bị")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gọi nhân viên" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yêu cầu thanh toán" })).toBeInTheDocument();
  });
  it("calls request payment mutation and shows message", async () => {
    const tracking = { trackingCode: "ORD-2", publicStatusLabel: "Đang chuẩn bị", items: [], payment: { status: "UNPAID", totalAmount: 100000, canRequestPayment: true, __typename: "CustomerTrackingPayment" }, timeline: [], publicStatus: "PREPARING", customerVisibleNote: null, estimatedReadyAt: null, __typename: "CustomerOrderTrackingView" };
    const mocks = [
      { request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-2" } }, result: { data: { customerTrackOrder: tracking } } },
      { request: { query: REQUEST_PAYMENT_FROM_TRACKING, variables: { trackingToken: "token-2" } }, result: { data: { requestPaymentFromTracking: { success: true, message: "Đã gửi yêu cầu thanh toán đến nhân viên.", tracking: { ...tracking, payment: { ...tracking.payment, status: "PAYMENT_REQUESTED", __typename: "CustomerTrackingPayment" }, __typename: "CustomerOrderTrackingView" }, __typename: "CustomerTrackingActionResult" } } } },
    ];
    render(<MockedProvider mocks={mocks}><MemoryRouter initialEntries={["/track-order/token-2"]}><Routes><Route path="/track-order/:trackingToken" element={<PublicOrderTrackingPage />} /></Routes></MemoryRouter></MockedProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Yêu cầu thanh toán" }));
    expect(await screen.findByText(/Đã gửi yêu cầu thanh toán đến nhân viên/)).toBeInTheDocument();
  });

  it("shows expired message when tracking link is revoked", async () => {
    const mocks = [
      {
        request: {
          query: CUSTOMER_TRACK_ORDER,
          variables: { trackingToken: "expired-token" },
        },
        error: new Error("Tracking link has expired"),
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <MemoryRouter initialEntries={["/track-order/expired-token"]}>
          <Routes>
            <Route
              path="/track-order/:trackingToken"
              element={<PublicOrderTrackingPage />}
            />
          </Routes>
        </MemoryRouter>
      </MockedProvider>
    );

    expect(
      await screen.findByText(/Liên kết theo dõi đơn hàng đã hết hiệu lực/i)
    ).toBeInTheDocument();
  });
});
