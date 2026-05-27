import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BusinessOperationsOverview from "./BusinessOperationsOverview";

describe("BusinessOperationsOverview", () => {
  const onRefreshRequests = vi.fn();
  const onOpenPOS = vi.fn();
  const onOpenOrders = vi.fn();

  const baseProps = {
    requestLoading: false,
    requestError: null,
    statusCounts: { pending: 2, preparing: 1, completed: 3, cancelled: 1 },
    pendingRequestsCount: 1,
    acknowledgedRequestsCount: 2,
    lowStockItems: [{ id: "ls1", name: "Thịt", onHand: 2, reserved: 1 }],
    recentOrders: [],
    onRefreshRequests,
    onOpenPOS,
    onOpenOrders,
    serviceRequests: [
      { requestId: "r1", orderCode: "A2", tableCode: "B2", type: "STAFF_CALL", status: "ACKNOWLEDGED", createdAt: "2026-05-27T11:00:00.000Z", message: "Need water", trackingToken: "secret-1", orderId: "oid-1" },
    ],
  };

  it("renders Vận hành hôm nay and refresh actions", () => {
    render(<BusinessOperationsOverview {...baseProps} />);
    expect(screen.getByText("Vận hành hôm nay")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
    expect(onRefreshRequests).toHaveBeenCalled();
  });

  it("disables refresh while loading", () => {
    render(<BusinessOperationsOverview {...baseProps} requestLoading />);
    expect(screen.getByRole("button", { name: "Làm mới" })).toBeDisabled();
  });

  it("shows request error and retry", () => {
    render(<BusinessOperationsOverview {...baseProps} requestError={new Error("x")} serviceRequests={[]} />);
    expect(screen.getByText("Không thể tải hàng đợi yêu cầu khách.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(onRefreshRequests).toHaveBeenCalled();
  });

  it("shows POS CTA and hides internal ids", () => {
    render(<BusinessOperationsOverview {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Xử lý trong POS" }));
    expect(onOpenPOS).toHaveBeenCalled();
    expect(screen.queryByText("secret-1")).not.toBeInTheDocument();
    expect(screen.queryByText("oid-1")).not.toBeInTheDocument();
    expect(screen.queryByText("r1")).not.toBeInTheDocument();
  });

  it("renders recent order without leaking internal id and formats VND", () => {
    render(
      <BusinessOperationsOverview
        {...baseProps}
        recentOrders={[{ id: "internal-order-id", orderCode: "A10", customerName: "Lan", status: "PENDING", total: 150000, createdAt: "2026-05-27T12:00:00.000Z" }]}
      />,
    );

    expect(screen.getByText("#A10")).toBeInTheDocument();
    expect(screen.getByText(/150\.000đ/)).toBeInTheDocument();
    expect(screen.queryByText("internal-order-id")).not.toBeInTheDocument();
  });
});
