import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BusinessOperationsOverview from "./BusinessOperationsOverview";

describe("BusinessOperationsOverview", () => {
  const baseProps = {
    requestLoading: false,
    requestError: null,
    statusCounts: { pending: 2, preparing: 1, completed: 3, cancelled: 1 },
    pendingRequestsCount: 1,
    acknowledgedRequestsCount: 2,
    lowStockItems: [{ id: "ls1", name: "Thịt", onHand: 2, reserved: 1 }],
    recentOrders: [],
    serviceRequests: [
      { requestId: "r1", orderCode: "A2", tableCode: "B2", type: "STAFF_CALL", status: "ACKNOWLEDGED", createdAt: "2026-05-27T11:00:00.000Z", message: "Need water", trackingToken: "secret-1", orderId: "oid-1" },
      { requestId: "r2", orderCode: "A3", tableCode: "B1", type: "PAYMENT_REQUEST", status: "PENDING", createdAt: "2026-05-27T12:00:00.000Z", message: "Pay please", trackingToken: "secret-2", orderId: "oid-2" },
    ],
  };

  it("renders operations summary labels", () => {
    render(<BusinessOperationsOverview {...baseProps} />);
    expect(screen.getByText("Vận hành hôm nay")).toBeInTheDocument();
    expect(screen.getByText("Đơn đang xử lý")).toBeInTheDocument();
    expect(screen.getByText("Yêu cầu chờ xử lý")).toBeInTheDocument();
    expect(screen.getByText("Đã nhận xử lý")).toBeInTheDocument();
  });

  it("renders request type labels and sorts newest first", () => {
    render(<BusinessOperationsOverview {...baseProps} serviceRequests={[...baseProps.serviceRequests].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))} />);
    const requestList = screen.getByTestId("customer-request-list");
    const requestItems = within(requestList).getAllByRole("listitem");
    expect(requestItems[0]).toHaveTextContent("Yêu cầu thanh toán");
    expect(screen.getByText("Gọi nhân viên")).toBeInTheDocument();
  });

  it("shows empty and error states", () => {
    const { rerender } = render(<BusinessOperationsOverview {...baseProps} serviceRequests={[]} />);
    expect(screen.getByText("Chưa có yêu cầu cần xử lý.")).toBeInTheDocument();
    rerender(<BusinessOperationsOverview {...baseProps} requestError={new Error("forbidden")} serviceRequests={[]} />);
    expect(screen.getByText("Không thể tải hàng đợi yêu cầu khách.")).toBeInTheDocument();
  });

  it("does not render internal fields", () => {
    render(<BusinessOperationsOverview {...baseProps} />);
    expect(screen.queryByText("secret-1")).not.toBeInTheDocument();
    expect(screen.queryByText("oid-1")).not.toBeInTheDocument();
    expect(screen.queryByText("r1")).not.toBeInTheDocument();
  });
});
