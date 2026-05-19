import { describe, it, expect } from "vitest";
import {
  computePublicOrderStatus,
  toCustomerTrackingPayload,
  ensureOrderTracking,
  updatePublicStatusHistory,
} from "../src/services/orderTracking.service.js";
import { Order } from "../models/index.js";
import { vi } from "vitest";

describe("orderTracking.service", () => {
  it("maps preparing items to PREPARING", () => {
    expect(computePublicOrderStatus({ items: [{ status: "preparing" }] })).toBe("PREPARING");
  });

  it("maps partially ready items to PARTIALLY_READY", () => {
    expect(computePublicOrderStatus({ items: [{ status: "ready" }, { status: "preparing" }] })).toBe("PARTIALLY_READY");
  });

  it("maps all ready items to READY_TO_SERVE", () => {
    expect(computePublicOrderStatus({ items: [{ status: "ready" }, { status: "served" }] })).toBe("READY_TO_SERVE");
  });

  it("maps all served to SERVED", () => {
    expect(computePublicOrderStatus({ items: [{ status: "served" }] })).toBe("SERVED");
  });

  it("maps paid and cancelled priority", () => {
    expect(computePublicOrderStatus({ currentStatus: "cancelled", orderPaymentStatus: "paid", items: [] })).toBe("CANCELLED");
    expect(computePublicOrderStatus({ orderPaymentStatus: "paid", items: [] })).toBe("PAID");
  });

  it("sanitizes payload without internal ids", () => {
    const payload = toCustomerTrackingPayload({
      trackingCode: "ORD-20260519-AB12CD",
      publicStatus: "PREPARING",
      items: [{ _id: "secret", name: "Cafe", quantity: 1, status: "preparing" }],
      totals: { grandTotal: 45000 },
      orderPaymentStatus: "unpaid",
      statusHistory: [{ status: "ORDER_RECEIVED", displayMessage: "ok", changedAt: new Date() }],
    });
    expect(payload.trackingCode).toContain("ORD-");
    expect(payload.items[0]._id).toBeUndefined();
  });
  it("maps all cancelled/returned to CANCELLED", () => {
    expect(computePublicOrderStatus({ items: [{ status: "cancelled" }, { status: "returned" }] })).toBe("CANCELLED");
  });
  it("generates tracking fields", async () => {
    vi.spyOn(Order, "exists").mockResolvedValueOnce(null);
    const orderDoc = {};
    await ensureOrderTracking(orderDoc);
    expect(orderDoc.trackingCode).toContain("ORD-");
    expect(orderDoc.trackingToken?.length).toBeGreaterThan(20);
    expect(orderDoc.trackingQrPayload).toBe(orderDoc.trackingUrl);
  });
  it("does not append duplicate statusHistory entry", () => {
    const changedAt = new Date();
    const order = { publicStatus: "PREPARING", currentStatus: "preparing", items: [{ status: "preparing" }], statusHistory: [{ status: "PREPARING", displayMessage: "x", changedAt }] };
    updatePublicStatusHistory(order, "SYSTEM");
    expect(order.statusHistory).toHaveLength(1);
  });
});
