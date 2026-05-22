import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MockedProvider } from "@apollo/client/testing";
import PublicOrderTrackingPage, { CUSTOMER_TRACK_ORDER } from "./PublicOrderTrackingPage";

vi.mock("socket.io-client", () => ({ io: () => ({ on: () => {}, off: () => {}, emit: () => {}, disconnect: () => {} }) }));

const renderPage = (mocks, token = "token-1") => render(<MockedProvider mocks={mocks}><MemoryRouter initialEntries={[`/track-order/${token}`]}><Routes><Route path="/track-order/:trackingToken" element={<PublicOrderTrackingPage />} /></Routes></MemoryRouter></MockedProvider>);

const baseTracking = { trackingCode: "ORD-1", publicStatusLabel: "Đang chuẩn bị", items: [{ name: "Phở", quantity: 1, publicStatusLabel: "Đang chuẩn bị", publicStatus: "PREPARING", __typename: "CustomerTrackingItem" }], payment: { status: "UNPAID", totalAmount: 100000, canRequestPayment: true, __typename: "CustomerTrackingPayment" }, timeline: [{ status: "PREPARING", displayMessage: "Đang chuẩn bị món", changedAt: new Date().toISOString(), __typename: "CustomerTrackingTimeline" }], publicStatus: "PREPARING", customerVisibleNote: null, estimatedReadyAt: null, latestRequest: null, __typename: "CustomerOrderTrackingView" };

describe("PublicOrderTrackingPage", () => {
  it("renders tracking status and items", async () => {
    const mocks = [{ request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-1" } }, result: { data: { customerTrackOrder: baseTracking } } }];
    renderPage(mocks);
    expect(await screen.findByText(/Mã theo dõi: ORD-1/)).toBeInTheDocument();
    expect(screen.getByText("Tiến trình đơn hàng")).toBeInTheDocument();
    expect(screen.getByText("Món đã gọi")).toBeInTheDocument();
    expect(screen.getByText("Phở")).toBeInTheDocument();
  });

  it("renders only one latest request section and no raw enum", async () => {
    const mocks = [{ request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-5" } }, result: { data: { customerTrackOrder: { ...baseTracking, latestRequest: { requestId: "r1", type: "PAYMENT_REQUEST", status: "ACKNOWLEDGED", message: "Khách yêu cầu thanh toán", createdAt: new Date().toISOString(), __typename: "CustomerTrackingRequest" } } } } }];
    renderPage(mocks, "token-5");
    expect(await screen.findByText("Yêu cầu gần nhất")).toBeInTheDocument();
    expect(screen.getAllByText("Yêu cầu gần nhất")).toHaveLength(1);
    expect(screen.queryByText("ACKNOWLEDGED")).not.toBeInTheDocument();
  });

  it("disables payment button when latest payment request is pending", async () => {
    const mocks = [{ request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-6" } }, result: { data: { customerTrackOrder: { ...baseTracking, latestRequest: { requestId: "r2", type: "PAYMENT_REQUEST", status: "PENDING", message: null, createdAt: null, __typename: "CustomerTrackingRequest" } } } } }];
    renderPage(mocks, "token-6");
    expect(await screen.findByText("Yêu cầu thanh toán đang được xử lý.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yêu cầu thanh toán" })).toBeDisabled();
  });

  it("disables staff call button when latest staff call request is acknowledged", async () => {
    const mocks = [{ request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-7" } }, result: { data: { customerTrackOrder: { ...baseTracking, latestRequest: { requestId: "r3", type: "STAFF_CALL", status: "ACKNOWLEDGED", message: null, createdAt: null, __typename: "CustomerTrackingRequest" } } } } }];
    renderPage(mocks, "token-7");
    expect(await screen.findByText("Nhân viên đã nhận yêu cầu hỗ trợ.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gọi nhân viên hỗ trợ" })).toBeDisabled();
  });

  it("expired link renders friendly message", async () => {
    const mocks = [{ request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-8" } }, error: new Error("Liên kết đã hết hiệu lực") }];
    renderPage(mocks, "token-8");
    expect(await screen.findByText("Liên kết theo dõi đã hết hiệu lực")).toBeInTheDocument();
  });

  it("generic error has retry button", async () => {
    const mocks = [{ request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-9" } }, error: new Error("network down") }];
    renderPage(mocks, "token-9");
    expect(await screen.findByText("Không thể tải trạng thái đơn hàng")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });
});
