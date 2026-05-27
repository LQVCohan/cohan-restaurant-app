import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import OrderTrackingQrCard, { ORDER_TRACKING_QR_SVG } from "./OrderTrackingQrCard";

describe("OrderTrackingQrCard", () => {
  it("initially shows Hiển thị QR and then renders QR image after click", async () => {
    const mocks = [{ request: { query: ORDER_TRACKING_QR_SVG, variables: { orderId: "o1" } }, result: { data: { orderTrackingQrSvg: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" } } }];
    render(<MockedProvider mocks={mocks}><OrderTrackingQrCard orderId="o1" /></MockedProvider>);
    const btn = screen.getByRole("button", { name: /Hiển thị hoặc tải lại mã QR/ });
    expect(btn).toHaveTextContent("Hiển thị QR");
    fireEvent.click(btn);
    const img = await screen.findByRole("img", { name: "Mã QR theo dõi đơn hàng" });
    expect(img).toHaveAttribute("src", expect.stringContaining("data:image/svg+xml;base64"));
  });

  it("shows permission error copy", async () => {
    const mocks = [{ request: { query: ORDER_TRACKING_QR_SVG, variables: { orderId: "o2" } }, error: new Error("permission denied") }];
    render(<MockedProvider mocks={mocks}><OrderTrackingQrCard orderId="o2" /></MockedProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Hiển thị hoặc tải lại mã QR/ }));
    expect(await screen.findByText("Bạn không có quyền xem QR theo dõi đơn này.")).toBeInTheDocument();
  });
});
