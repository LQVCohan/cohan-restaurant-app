import { describe, expect, it } from "vitest";

import {
  assertOrderCanRequestPayment,
  canOrderRequestPayment,
  getOrderPaymentRequestBlockReason,
} from "../src/services/orderPaymentRequestGuard.service.js";

const makeOrder = (overrides = {}) => ({
  currentStatus: "confirmed",
  orderPaymentStatus: "unpaid",
  payment: { status: "pending" },
  items: [{ status: "served" }],
  ...overrides,
});

describe("order payment request guard", () => {
  it("allows payment request when all active items are served and no adjustments are pending", () => {
    const order = makeOrder();
    expect(canOrderRequestPayment(order)).toBe(true);
    expect(getOrderPaymentRequestBlockReason(order)).toBeNull();
    expect(() => assertOrderCanRequestPayment(order)).not.toThrow();
  });

  it("blocks payment request while kitchen or service work is still pending", () => {
    const order = makeOrder({ items: [{ status: "served" }, { status: "preparing" }] });
    expect(canOrderRequestPayment(order)).toBe(false);
    expect(getOrderPaymentRequestBlockReason(order)).toBe("ORDER_ITEMS_NOT_SERVED");
    expect(() => assertOrderCanRequestPayment(order)).toThrow(/món chưa phục vụ xong/i);
  });

  it("blocks payment request when void or return requests are still pending", () => {
    const order = makeOrder({
      items: [
        { status: "served", voidRequests: [{ status: "pending" }] },
        { status: "served", returnRequests: [{ status: "approved" }] },
      ],
    });
    expect(canOrderRequestPayment(order)).toBe(false);
    expect(getOrderPaymentRequestBlockReason(order)).toBe("PENDING_ADJUSTMENT_REQUESTS");
    expect(() => assertOrderCanRequestPayment(order)).toThrow(/hủy\/trả món đang chờ duyệt/i);
  });

  it("blocks already requested, paid or closed orders", () => {
    expect(getOrderPaymentRequestBlockReason(makeOrder({ orderPaymentStatus: "payment_requested" }))).toBe("PAYMENT_REQUEST_ALREADY_SENT");
    expect(getOrderPaymentRequestBlockReason(makeOrder({ orderPaymentStatus: "paid" }))).toBe("ORDER_ALREADY_PAID");
    expect(getOrderPaymentRequestBlockReason(makeOrder({ currentStatus: "completed" }))).toBe("ORDER_ALREADY_CLOSED");
  });
});
