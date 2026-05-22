import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import OrderTrackingQrCard from "./OrderTrackingQrCard";
import { gql } from "@apollo/client";

const ORDER_TRACKING_QR_SVG = gql`
  query OrderTrackingQrSvg($orderId: ID!) {
    orderTrackingQrSvg(orderId: $orderId)
  }
`;

describe("OrderTrackingQrCard", () => {
  it("initially shows Hiển thị QR and then renders SVG after click", async () => {
    const mocks = [{ request: { query: ORDER_TRACKING_QR_SVG, variables: { orderId: "o1" } }, result: { data: { orderTrackingQrSvg: "<svg><title>QR</title></svg>" } } }];
    render(<MockedProvider mocks={mocks}><OrderTrackingQrCard orderId="o1" /></MockedProvider>);
    const btn = screen.getByRole("button", { name: /Hiển thị hoặc tải lại mã QR/ });
    expect(btn).toHaveTextContent("Hiển thị QR");
    fireEvent.click(btn);
    expect(await screen.findByTitle("QR")).toBeInTheDocument();
  });

  it("shows permission error copy", async () => {
    const mocks = [{ request: { query: ORDER_TRACKING_QR_SVG, variables: { orderId: "o2" } }, error: new Error("permission denied") }];
    render(<MockedProvider mocks={mocks}><OrderTrackingQrCard orderId="o2" /></MockedProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Hiển thị hoặc tải lại mã QR/ }));
    expect(await screen.findByText("Bạn không có quyền xem QR theo dõi đơn này.")).toBeInTheDocument();
  });
});
