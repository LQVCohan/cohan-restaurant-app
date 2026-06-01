import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MockedProvider } from "@apollo/client/testing";
import PublicOrderTrackingPage, { CUSTOMER_TRACK_ORDER } from "./PublicOrderTrackingPage";

vi.mock("socket.io-client", () => ({ io: () => ({ on: () => {}, off: () => {}, emit: () => {}, disconnect: () => {} }) }));

const renderPage = (mocks, token = "token-1") => render(<MockedProvider mocks={mocks}><MemoryRouter initialEntries={[`/track-order/${token}`]}><Routes><Route path="/track-order/:trackingToken" element={<PublicOrderTrackingPage />} /></Routes></MemoryRouter></MockedProvider>);

const baseTracking = { trackingCode: "ORD-1", publicStatusLabel: "Đang chuẩn bị", items: [{ name: "Phở", quantity: 1, publicStatusLabel: "Đang chuẩn bị", publicStatus: "PREPARING", __typename: "CustomerTrackingItem" }], payment: { status: "UNPAID", totalAmount: 100000, canRequestPayment: true, __typename: "CustomerTrackingPayment" }, timeline: [{ status: "PREPARING", displayMessage: "Đang chuẩn bị món", changedAt: new Date().toISOString(), __typename: "CustomerTrackingTimeline" }], publicStatus: "PREPARING", customerVisibleNote: null, estimatedReadyAt: null, latestRequest: null, delivery: null, __typename: "CustomerOrderTrackingView" };

describe("PublicOrderTrackingPage", () => {
  it("renders tracking status and items", async () => {
    const mocks = [{ request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-1" } }, result: { data: { customerTrackOrder: baseTracking } } }];
    renderPage(mocks);
    expect(await screen.findByText("ORD-1")).toBeInTheDocument();
    expect(screen.getByText("Tiến trình đơn hàng")).toBeInTheDocument();
    expect(screen.getByText("Món đã gọi")).toBeInTheDocument();
    expect(screen.getByText("Phở")).toBeInTheDocument();
  });

  it("highlights latest timeline item by changedAt", async () => {
    const older = "2026-05-20T08:00:00.000Z";
    const newer = "2026-05-20T09:00:00.000Z";
    const mocks = [{ request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-timeline" } }, result: { data: { customerTrackOrder: { ...baseTracking, timeline: [{ status: "PREPARING", displayMessage: "Bếp đã nhận món", changedAt: older, __typename: "CustomerTrackingTimeline" }, { status: "READY", displayMessage: "Món đã sẵn sàng", changedAt: newer, __typename: "CustomerTrackingTimeline" }] } } } }];
    renderPage(mocks, "token-timeline");
    const latestText = await screen.findByText("Món đã sẵn sàng");
    expect(latestText.closest("li")).toHaveClass("current");
  });


  it("renders delivery section and timeline when delivery tracking exists", async () => {
    const delivery = {
      orderType: "delivery",
      deliveryStatus: "delivering",
      deliveryStatusLabel: "Đang giao đến bạn",
      shippingAddress: "12 Nguyễn Huệ",
      eta: "2026-05-20T09:30:00.000Z",
      distance: 3.5,
      duration: 18,
      driverName: "Anh Nam",
      driverPhone: "0909000111",
      driverVehiclePlate: "59A1-12345",
      externalTrackingCode: "EXT-9",
      timeline: [
        { status: "pending", label: "Đang chờ xử lý giao hàng", at: null, note: null, __typename: "CustomerDeliveryTimelineEvent" },
        { status: "picked_up", label: "Đã lấy món", at: null, note: null, __typename: "CustomerDeliveryTimelineEvent" },
        { status: "delivering", label: "Đang giao đến bạn", at: "2026-05-20T09:00:00.000Z", note: null, __typename: "CustomerDeliveryTimelineEvent" },
      ],
      __typename: "CustomerDeliveryTracking",
    };
    const mocks = [{ request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-delivery" } }, result: { data: { customerTrackOrder: { ...baseTracking, publicStatus: "DELIVERING", publicStatusLabel: "Đang giao đến bạn", delivery } } } }];
    renderPage(mocks, "token-delivery");
    expect(await screen.findByText("Thông tin giao hàng")).toBeInTheDocument();
    expect(screen.getAllByText("Đang giao đến bạn").length).toBeGreaterThan(0);
    expect(screen.getByText("12 Nguyễn Huệ")).toBeInTheDocument();
    expect(screen.getByText("3,5 km")).toBeInTheDocument();
    expect(screen.getByText("18 phút")).toBeInTheDocument();
    expect(screen.getByText("Anh Nam")).toBeInTheDocument();
    expect(screen.getByText("0909000111")).toBeInTheDocument();
    expect(screen.getByText("59A1-12345")).toBeInTheDocument();
    expect(screen.getByText("EXT-9")).toBeInTheDocument();
    expect(screen.getByText("Đã lấy món")).toBeInTheDocument();
    expect(screen.queryByText(/lat|lng|driverLocation/i)).not.toBeInTheDocument();
  });

  it("does not render delivery section when delivery is null", async () => {
    const mocks = [{ request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-no-delivery" } }, result: { data: { customerTrackOrder: baseTracking } } }];
    renderPage(mocks, "token-no-delivery");
    await screen.findByText("ORD-1");
    expect(screen.queryByText("Thông tin giao hàng")).not.toBeInTheDocument();
  });

  it("shows final indicator when order is paid", async () => {
    const mocks = [{ request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-final" } }, result: { data: { customerTrackOrder: { ...baseTracking, publicStatus: "PAID", publicStatusLabel: "Đã thanh toán", payment: { ...baseTracking.payment, status: "PAID", __typename: "CustomerTrackingPayment" } } } } }];
    renderPage(mocks, "token-final");
    expect(await screen.findByText("Đơn hàng đã hoàn tất")).toBeInTheDocument();
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

  it("disables payment button when payment status is PAYMENT_REQUESTED without latest request", async () => {
    const mocks = [{ request: { query: CUSTOMER_TRACK_ORDER, variables: { trackingToken: "token-6b" } }, result: { data: { customerTrackOrder: { ...baseTracking, latestRequest: null, payment: { ...baseTracking.payment, status: "PAYMENT_REQUESTED", __typename: "CustomerTrackingPayment" } } } } }];
    renderPage(mocks, "token-6b");
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
