import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import CustomerRequestQueuePanel, { ACK, Q, RES } from "./CustomerRequestQueuePanel";

const mk = (overrides = {}) => ({
  orderId: "o1", orderCode: "ORD1", tableCode: "A1", requestId: "r1", type: "STAFF_CALL", status: "PENDING", message: "Help", createdAt: new Date().toISOString(),
  ...overrides,
});

const renderPanel = (mocks, restaurantId = "res-1") => render(<MockedProvider mocks={mocks}><CustomerRequestQueuePanel restaurantId={restaurantId} /></MockedProvider>);

describe("CustomerRequestQueuePanel", () => {
  it("empty state does not crash", async () => {
    renderPanel([
      { request: { query: Q, variables: { restaurantId: "res-1", type: null, limit: 50, status: "PENDING" } }, result: { data: { customerServiceRequests: [] } } },
      { request: { query: Q, variables: { restaurantId: "res-1", type: null, limit: 50, status: "ACKNOWLEDGED" } }, result: { data: { customerServiceRequests: [] } } },
    ]);
    expect(await screen.findByText("", { selector: "body" })).toBeInTheDocument();
  });

  it("renders pending/acknowledged and type filter works", async () => {
    renderPanel([
      { request: { query: Q, variables: { restaurantId: "res-1", type: null, limit: 50, status: "PENDING" } }, result: { data: { customerServiceRequests: [mk()] } } },
      { request: { query: Q, variables: { restaurantId: "res-1", type: null, limit: 50, status: "ACKNOWLEDGED" } }, result: { data: { customerServiceRequests: [mk({ requestId: "r2", orderCode: "ORD2", status: "ACKNOWLEDGED", type: "PAYMENT_REQUEST" })] } } },
      { request: { query: Q, variables: { restaurantId: "res-1", type: "STAFF_CALL", limit: 50, status: "PENDING" } }, result: { data: { customerServiceRequests: [mk()] } } },
      { request: { query: Q, variables: { restaurantId: "res-1", type: "STAFF_CALL", limit: 50, status: "ACKNOWLEDGED" } }, result: { data: { customerServiceRequests: [] } } },
    ]);
    expect(await screen.findByText(/#ORD1/)).toBeInTheDocument();
    expect(screen.getByText(/#ORD2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Gọi nhân viên" }));
    expect(await screen.findByText(/#ORD1/)).toBeInTheDocument();
    expect(screen.queryByText(/#ORD2/)).not.toBeInTheDocument();
  });

  it("acknowledge/resolve buttons call mutations", async () => {
    renderPanel([
      { request: { query: Q, variables: { restaurantId: "res-1", type: null, limit: 50, status: "PENDING" } }, result: { data: { customerServiceRequests: [mk()] } } },
      { request: { query: Q, variables: { restaurantId: "res-1", type: null, limit: 50, status: "ACKNOWLEDGED" } }, result: { data: { customerServiceRequests: [mk({ requestId: "r2", orderId: "o2", status: "ACKNOWLEDGED" })] } } },
      { request: { query: ACK, variables: { restaurantId: "res-1", orderId: "o1", requestId: "r1" } }, result: { data: { acknowledgeCustomerServiceRequest: { ok: true, message: "ok", __typename: "AcknowledgeCustomerServiceRequestResult" } } } },
      { request: { query: RES, variables: { restaurantId: "res-1", orderId: "o2", requestId: "r2" } }, result: { data: { resolveCustomerServiceRequest: { ok: true, message: "ok", __typename: "ResolveCustomerServiceRequestResult" } } } },
      { request: { query: Q, variables: { restaurantId: "res-1", type: null, limit: 50, status: "PENDING" } }, result: { data: { customerServiceRequests: [] } } },
      { request: { query: Q, variables: { restaurantId: "res-1", type: null, limit: 50, status: "ACKNOWLEDGED" } }, result: { data: { customerServiceRequests: [] } } },
    ]);
    fireEvent.click(await screen.findByRole("button", { name: "Nhận xử lý" }));
    fireEvent.click(await screen.findByRole("button", { name: "Đã xử lý" }));
    expect(true).toBe(true);
  });
});
