import { describe, it, expect } from "vitest";
import {
  computePublicOrderStatus,
  toCustomerTrackingPayload,
  ensureOrderTracking,
  updatePublicStatusHistory,
  emitCustomerTrackingUpdateIfChanged,
  validateOrderTrackingToken,
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


  it("maps delivery statuses to public delivery statuses", () => {
    expect(computePublicOrderStatus({ orderType: "delivery", shipping: { deliveryStatus: "delivering" }, items: [{ status: "ready" }] })).toBe("DELIVERING");
    expect(computePublicOrderStatus({ orderType: "delivery", shipping: { deliveryStatus: "delivered" }, orderPaymentStatus: "paid" })).toBe("DELIVERED");
    expect(computePublicOrderStatus({ orderType: "takeaway", shipping: { deliveryStatus: "delivering" }, items: [{ status: "preparing" }] })).toBe("PREPARING");
  });

  it("returns public delivery payload without driver coordinates", () => {
    const eta = new Date("2026-05-20T09:00:00.000Z");
    const payload = toCustomerTrackingPayload({
      orderType: "delivery",
      trackingCode: "ORD-DELIVERY",
      currentStatus: "confirmed",
      updatedAt: eta,
      shipping: {
        deliveryStatus: "delivering",
        address: "12 Nguyễn Huệ",
        eta,
        distance: 3.2,
        duration: 17,
        driverName: "Anh Nam",
        driverPhone: "0909",
        driverVehiclePlate: "59A1-12345",
        externalTrackingCode: "EXT-1",
        driverLocation: { lat: 10.7, lng: 106.7 },
      },
      statusHistory: [],
      items: [],
      totals: {},
    });
    expect(payload.publicStatus).toBe("DELIVERING");
    expect(payload.publicStatusLabel).toBe("Đang giao đến bạn");
    expect(payload.delivery).toMatchObject({
      orderType: "delivery",
      deliveryStatus: "delivering",
      deliveryStatusLabel: "Đang giao đến bạn",
      shippingAddress: "12 Nguyễn Huệ",
      eta,
      distance: 3.2,
      duration: 17,
      driverName: "Anh Nam",
      driverPhone: "0909",
      driverVehiclePlate: "59A1-12345",
      externalTrackingCode: "EXT-1",
    });
    expect(payload.delivery.driverLocation).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain("\"lat\"");
    expect(JSON.stringify(payload)).not.toContain("\"lng\"");
    expect(payload.delivery.timeline.map((step) => step.status)).toEqual(["pending", "driver_assigned", "picked_up", "delivering"]);
  });

  it("returns null delivery payload for dine-in orders", () => {
    const payload = toCustomerTrackingPayload({ orderType: "dine_in", items: [], statusHistory: [], totals: {} });
    expect(payload.delivery).toBeNull();
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
    expect(computePublicOrderStatus({ items: [{ status: "cancelled" }, { status: "cancelled" }] })).toBe("CANCELLED");
    expect(computePublicOrderStatus({ items: [{ status: "returned" }, { status: "returned" }] })).toBe("ISSUE_REPORTED");
    expect(computePublicOrderStatus({ items: [{ status: "cancelled" }, { status: "returned" }] })).toBe("ISSUE_REPORTED");
    expect(computePublicOrderStatus({ currentStatus: "cancelled", items: [{ status: "returned" }] })).toBe("CANCELLED");
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
  it("maps payment canRequestPayment safely", () => {
    expect(toCustomerTrackingPayload({ orderPaymentStatus: "payment_requested", items: [], statusHistory: [] }).payment.canRequestPayment).toBe(false);
    expect(toCustomerTrackingPayload({ orderPaymentStatus: "paid", items: [], statusHistory: [] }).payment.canRequestPayment).toBe(false);
    expect(toCustomerTrackingPayload({ orderPaymentStatus: "unpaid", items: [], statusHistory: [] }).payment.canRequestPayment).toBe(true);
  });
  it("handles latestRequest edge cases and sanitizes internal fields", () => {
    const empty = toCustomerTrackingPayload({ customerRequests: [] });
    expect(empty.latestRequest).toBeNull();

    const withGarbage = toCustomerTrackingPayload({
      customerRequests: [
        null,
        undefined,
        { requestId: "", type: "STAFF_CALL", status: "PENDING", createdAt: new Date() },
        { requestId: "req-ok", type: "STAFF_CALL", status: "ACKNOWLEDGED", createdAt: new Date("2026-05-01T10:00:00.000Z") },
        { requestId: "req-latest", type: "PAYMENT_REQUEST", status: "PENDING", createdAt: new Date("2026-05-01T11:00:00.000Z") },
      ],
      _id: "secret",
      restaurantId: "r1",
      userId: "u1",
      staffId: "s1",
      trackingToken: "token",
    });
    expect(withGarbage.latestRequest).toEqual({
      requestId: "req-latest",
      type: "PAYMENT_REQUEST",
      status: "PENDING",
      message: null,
      createdAt: new Date("2026-05-01T11:00:00.000Z"),
      acknowledgedAt: null,
      resolvedAt: null,
    });
    expect(withGarbage._id).toBeUndefined();
    expect(withGarbage.restaurantId).toBeUndefined();
    expect(withGarbage.userId).toBeUndefined();
    expect(withGarbage.staffId).toBeUndefined();
    expect(withGarbage.trackingToken).toBeUndefined();
  });

  it("validates public tracking tokens against Order trackingToken and revocation", async () => {
    const lean = vi.fn();
    const select = vi.fn(() => ({ lean }));
    vi.spyOn(Order, "findOne").mockReturnValue({ select });

    lean.mockResolvedValueOnce({ _id: "o1", trackingQrRevokedAt: null });
    await expect(validateOrderTrackingToken("token-ok")).resolves.toEqual({ ok: true, token: "token-ok" });
    expect(Order.findOne).toHaveBeenCalledWith({ trackingToken: "token-ok" });
    expect(select).toHaveBeenCalledWith("_id trackingQrRevokedAt");

    lean.mockResolvedValueOnce({ _id: "o1", trackingQrRevokedAt: new Date() });
    await expect(validateOrderTrackingToken("token-expired")).resolves.toEqual({ ok: false, code: "EXPIRED" });

    lean.mockResolvedValueOnce(null);
    await expect(validateOrderTrackingToken("missing")).resolves.toEqual({ ok: false, code: "FORBIDDEN" });
    await expect(validateOrderTrackingToken("")).resolves.toEqual({ ok: false, code: "INVALID" });
  });

  it("emits tracking update when forced even if status unchanged", () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    const ctx = { io: { to } };
    const orderDoc = { trackingToken: "abc", publicStatus: "PREPARING", toObject: () => ({ trackingCode: "ORD", publicStatus: "PREPARING", items: [{ _id: "x", name: "A", quantity: 1, status: "preparing" }], statusHistory: [] }) };
    emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc, previousPublicStatus: "PREPARING", force: false });
    expect(emit).not.toHaveBeenCalled();
    emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc, previousPublicStatus: "PREPARING", force: true });
    expect(emit).toHaveBeenCalledTimes(1);
    const payload = emit.mock.calls[0][1];
    expect(payload.items?.[0]?._id).toBeUndefined();
  });
  it("ensures checkout-created orders receive tracking before emit", async () => {
    vi.spyOn(Order, "exists").mockResolvedValueOnce(null);
    const emit = vi.fn();
    const ctx = { io: { to: vi.fn(() => ({ emit })) } };
    const save = vi.fn(async () => orderDoc);
    const orderDoc = {
      orderType: "takeaway",
      restaurantId: "r1",
      publicStatus: "ORDER_RECEIVED",
      currentStatus: "pending",
      items: [{ name: "Cafe", quantity: 1, status: "pending", _id: "secret" }],
      statusHistory: [],
      totals: { grandTotal: 45000 },
      trackingToken: null,
      trackingCode: null,
      save,
      toObject: () => ({
        trackingCode: orderDoc.trackingCode,
        trackingToken: orderDoc.trackingToken,
        trackingQrPayload: orderDoc.trackingQrPayload,
        publicStatus: orderDoc.publicStatus,
        items: orderDoc.items,
        statusHistory: orderDoc.statusHistory,
        totals: orderDoc.totals,
      }),
    };
    await ensureOrderTracking(orderDoc);
    updatePublicStatusHistory(orderDoc, "SYSTEM");
    await orderDoc.save();
    emitCustomerTrackingUpdateIfChanged({ ctx, orderDoc, previousPublicStatus: "ORDER_RECEIVED", force: true });
    expect(orderDoc.trackingToken).toBeTruthy();
    expect(orderDoc.trackingCode).toContain("ORD-");
    expect(orderDoc.trackingQrPayload).toBe(orderDoc.trackingUrl);
    expect(save).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][1]?.items?.[0]?._id).toBeUndefined();
  });
});
