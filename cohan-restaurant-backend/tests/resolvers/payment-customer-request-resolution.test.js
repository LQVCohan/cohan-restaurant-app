import { describe, it, expect } from "vitest";
import { resolveActivePaymentRequest } from "../../graphql/resolvers/payment/mutation.js";

describe("resolveActivePaymentRequest", () => {
  it("resolves active PAYMENT_REQUEST and sets metadata", () => {
    const order = {
      customerVisibleNote: null,
      customerRequests: [
        { requestId: "s1", type: "STAFF_CALL", status: "PENDING" },
        { requestId: "p1", type: "PAYMENT_REQUEST", status: "ACKNOWLEDGED", message: "pay" },
      ],
    };

    const req = resolveActivePaymentRequest(order, "staff-1");
    expect(req?.requestId).toBe("p1");
    expect(req?.status).toBe("RESOLVED");
    expect(req?.resolvedBy).toBe("staff-1");
    expect(req?.resolvedAt).toBeInstanceOf(Date);
    expect(order.customerVisibleNote).toBe("Đơn hàng đã thanh toán. Cảm ơn quý khách.");
    expect(order.customerRequests[0].status).toBe("PENDING");
  });

  it("does not touch STAFF_CALL only orders", () => {
    const order = { customerRequests: [{ requestId: "s1", type: "STAFF_CALL", status: "ACKNOWLEDGED" }] };
    const req = resolveActivePaymentRequest(order, "staff-1");
    expect(req).toBeNull();
    expect(order.customerRequests[0].status).toBe("ACKNOWLEDGED");
  });

  it("ignores already resolved payment request", () => {
    const prev = new Date("2026-05-01T00:00:00.000Z");
    const order = {
      customerRequests: [{ requestId: "p1", type: "PAYMENT_REQUEST", status: "RESOLVED", resolvedAt: prev }],
    };
    const req = resolveActivePaymentRequest(order, "staff-1");
    expect(req).toBeNull();
    expect(order.customerRequests[0].resolvedAt).toBe(prev);
  });

  it("is safe for empty/null customerRequests", () => {
    expect(resolveActivePaymentRequest({}, "staff-1")).toBeNull();
    expect(resolveActivePaymentRequest({ customerRequests: null }, "staff-1")).toBeNull();
    expect(resolveActivePaymentRequest({ customerRequests: [] }, "staff-1")).toBeNull();
  });
});
