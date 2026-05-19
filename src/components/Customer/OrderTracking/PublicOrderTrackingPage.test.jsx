import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MockedProvider } from "@apollo/client/testing";
import PublicOrderTrackingPage, { CUSTOMER_TRACK_ORDER } from "./PublicOrderTrackingPage";

vi.mock("socket.io-client", () => ({ io: () => ({ on: () => {}, off: () => {}, emit: () => {}, disconnect: () => {} }) }));

describe("PublicOrderTrackingPage", () => {
  it("renders tracking content", async () => {
    const mocks = [{ request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-1" } }, result: { data: { customerTrackOrder: { trackingCode: "ORD-1", publicStatusLabel: "Đang chuẩn bị", items: [{ name: "Phở", quantity: 1, publicStatusLabel: "Đang chuẩn bị", publicStatus: "PREPARING", __typename: "CustomerOrderTrackingItemView" }], payment: { status: "UNPAID", totalAmount: 100000, canRequestPayment: true, __typename: "CustomerTrackingPaymentView" }, timeline: [], publicStatus: "PREPARING", customerVisibleNote: null, estimatedReadyAt: null, trackingQrRevokedAt: null, __typename: "CustomerOrderTrackingView" } } } }];
    render(<MockedProvider mocks={mocks}><MemoryRouter initialEntries={["/track-order/token-1"]}><Routes><Route path="/track-order/:trackingToken" element={<PublicOrderTrackingPage />} /></Routes></MemoryRouter></MockedProvider>);
    expect(await screen.findByText(/Mã đơn: ORD-1/)).toBeInTheDocument();
    expect(screen.getByText("Đang chuẩn bị")).toBeInTheDocument();
  });
});
