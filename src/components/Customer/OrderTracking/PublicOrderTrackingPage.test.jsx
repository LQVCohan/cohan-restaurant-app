import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MockedProvider } from "@apollo/client/testing";
import PublicOrderTrackingPage, { CALL_STAFF_FROM_TRACKING, CUSTOMER_TRACK_ORDER, REQUEST_PAYMENT_FROM_TRACKING } from "./PublicOrderTrackingPage";

vi.mock("socket.io-client", () => ({ io: () => ({ on: () => {}, off: () => {}, emit: () => {}, disconnect: () => {} }) }));

const renderPage = (mocks, token = "token-1") => render(<MockedProvider mocks={mocks}><MemoryRouter initialEntries={[`/track-order/${token}`]}><Routes><Route path="/track-order/:trackingToken" element={<PublicOrderTrackingPage />} /></Routes></MemoryRouter></MockedProvider>);
const baseTracking = { trackingCode: "ORD-1", publicStatusLabel: "Đang chuẩn bị", items: [{ name: "Phở", quantity: 1, publicStatusLabel: "Đang chuẩn bị", publicStatus: "PREPARING", __typename: "CustomerTrackingItem" }], payment: { status: "UNPAID", totalAmount: 100000, canRequestPayment: true, __typename: "CustomerTrackingPayment" }, timeline: [], publicStatus: "PREPARING", customerVisibleNote: null, estimatedReadyAt: null, latestRequest: null, __typename: "CustomerOrderTrackingView" };

describe("PublicOrderTrackingPage", () => {
  it("renders buttons and not raw _id", async () => {
    const mocks = [{ request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-1" } }, result: { data: { customerTrackOrder: { ...baseTracking, _id: "secret" } } } }];
    renderPage(mocks);
    expect(await screen.findByText(/Mã đơn: ORD-1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gọi nhân viên" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yêu cầu thanh toán" })).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("request payment mutation success", async () => {
    const mocks = [
      { request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-2" } }, result: { data: { customerTrackOrder: baseTracking } } },
      { request: { query: REQUEST_PAYMENT_FROM_TRACKING, variables: { trackingToken: "token-2" } }, result: { data: { requestPaymentFromTracking: { success: true, message: "Đã gửi yêu cầu thanh toán đến nhân viên.", tracking: { ...baseTracking, payment: { ...baseTracking.payment, status: "PAYMENT_REQUESTED", canRequestPayment: false, __typename: "CustomerTrackingPayment" } } } } } },
    ];
    renderPage(mocks, "token-2");
    fireEvent.click(await screen.findByRole("button", { name: "Yêu cầu thanh toán" }));
    expect(await screen.findByText(/Đã gửi yêu cầu thanh toán đến nhân viên/)).toBeInTheDocument();
    expect(screen.getByText(/Yêu cầu thanh toán đã được gửi/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yêu cầu thanh toán" })).toBeDisabled();
  });

  it("disabled with non-requestable payment", async () => {
    const mocks = [{ request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-3" } }, result: { data: { customerTrackOrder: { ...baseTracking, payment: { ...baseTracking.payment, canRequestPayment: false, __typename: "CustomerTrackingPayment" } } } } }];
    renderPage(mocks, "token-3");
    expect(await screen.findByText(/Hiện chưa thể yêu cầu thanh toán cho đơn này/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yêu cầu thanh toán" })).toBeDisabled();
  });

  it("call staff mutation and error message", async () => {
    const mocks = [
      { request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-4" } }, result: { data: { customerTrackOrder: baseTracking } } },
      { request: { query: CALL_STAFF_FROM_TRACKING, variables: { trackingToken: "token-4", reason: undefined } }, error: new Error("boom") },
    ];
    renderPage(mocks, "token-4");
    fireEvent.click(await screen.findByRole("button", { name: "Gọi nhân viên" }));
    expect(await screen.findByText(/Không thể gửi yêu cầu lúc này/)).toBeInTheDocument();
  });

  it("renders latest request in dedicated section", async () => {
    const mocks = [{ request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-5" } }, result: { data: { customerTrackOrder: { ...baseTracking, latestRequest: { requestId: "r1", type: "PAYMENT_REQUEST", status: "ACKNOWLEDGED", message: "Khách yêu cầu thanh toán", createdAt: new Date().toISOString(), acknowledgedAt: null, resolvedAt: null, __typename: "CustomerTrackingRequest" } } } } }];
    renderPage(mocks, "token-5");
    expect(await screen.findByText(/Trạng thái yêu cầu gần nhất/)).toBeInTheDocument();
    expect(screen.getByText(/Yêu cầu thanh toán: Nhân viên đã nhận yêu cầu/)).toBeInTheDocument();
    expect(screen.queryByText("r1")).not.toBeInTheDocument();
  });
});
