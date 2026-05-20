import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import CustomerRequestQueuePanel, { ACK, Q, RES } from "./CustomerRequestQueuePanel";

const baseRequest = {
  orderId: "o1",
  orderCode: "ORD1",
  tableCode: "A1",
  requestId: "r1",
  type: "STAFF_CALL",
  status: "PENDING",
  message: "Help",
  createdAt: new Date().toISOString(),
};

const mk = (overrides = {}) => ({ ...baseRequest, ...overrides });

const queryMock = ({ status, rows, type = null }) => ({
  request: {
    query: Q,
    variables: { restaurantId: "res-1", type, limit: 50, status },
  },
  result: { data: { customerServiceRequests: rows } },
});

const renderPanel = (mocks, props = {}) =>
  render(
    <MockedProvider mocks={mocks}>
      <CustomerRequestQueuePanel restaurantId="res-1" {...props} />
    </MockedProvider>,
  );

describe("CustomerRequestQueuePanel", () => {
  it("renders staff/payment actions without internal fields", async () => {
    renderPanel([
      queryMock({ status: "PENDING", rows: [mk(), mk({ requestId: "r-pay", type: "PAYMENT_REQUEST", orderCode: "ORD2" })] }),
      queryMock({ status: "ACKNOWLEDGED", rows: [mk({ requestId: "r-ack", status: "ACKNOWLEDGED" })] }),
    ]);

    expect(await screen.findByRole("button", { name: "Nhận thanh toán" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nhận xử lý" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đã hỗ trợ" })).toBeInTheDocument();
    expect(screen.queryByText(/trackingToken/i)).not.toBeInTheDocument();
  });

  it("acknowledges payment request then opens payment context", async () => {
    const onOpenPayment = vi.fn();
    renderPanel([
      queryMock({ status: "PENDING", rows: [mk({ type: "PAYMENT_REQUEST" })] }),
      queryMock({ status: "ACKNOWLEDGED", rows: [] }),
      {
        request: { query: ACK, variables: { restaurantId: "res-1", orderId: "o1", requestId: "r1" } },
        result: { data: { acknowledgeCustomerServiceRequest: { ok: true, message: "ok", __typename: "ActionResultPayload" } } },
      },
      queryMock({ status: "PENDING", rows: [] }),
      queryMock({ status: "ACKNOWLEDGED", rows: [] }),
    ], { onOpenPayment });

    fireEvent.click(await screen.findByRole("button", { name: "Nhận thanh toán" }));

    await waitFor(() => {
      expect(onOpenPayment).toHaveBeenCalledWith("o1");
    });
  });

  it("resolves acknowledged staff call", async () => {
    renderPanel([
      queryMock({ status: "PENDING", rows: [] }),
      queryMock({ status: "ACKNOWLEDGED", rows: [mk({ requestId: "r2", orderId: "o2", status: "ACKNOWLEDGED" })] }),
      {
        request: { query: RES, variables: { restaurantId: "res-1", orderId: "o2", requestId: "r2" } },
        result: { data: { resolveCustomerServiceRequest: { ok: true, message: "ok", __typename: "ActionResultPayload" } } },
      },
      queryMock({ status: "PENDING", rows: [] }),
      queryMock({ status: "ACKNOWLEDGED", rows: [] }),
    ]);

    fireEvent.click(await screen.findByRole("button", { name: "Đã hỗ trợ" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Đã hỗ trợ" })).not.toBeInTheDocument();
    });
  });
});
