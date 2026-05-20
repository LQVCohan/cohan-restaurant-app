import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findOneMock: vi.fn(),
  emitOrderEventMock: vi.fn(async () => true),
  emitRestaurantEventMock: vi.fn(async () => true),
}));

vi.mock("../models/index.js", () => ({
  Order: { findOne: mocks.findOneMock },
  Reservation: {}, TableCustomer: {}, Warehouse: {}, Recipe: {}, Ingredient: {}, ModifierGroup: {}, CheckoutSession: {}, Coupon: {}, Customer: {}, User: {}, WalletTransaction: {}, PrintSetting: {}, Promotion: {}, Cart: {},
}));
vi.mock("../graphql/resolvers/order/helper/emitOrderEvent.js", () => ({
  emitOrderEvent: mocks.emitOrderEventMock,
  emitRestaurantEvent: mocks.emitRestaurantEventMock,
}));

import { OrderMutation } from "../graphql/resolvers/order/mutation.js";

const mkOrder = (overrides = {}) => ({
  trackingToken: "token-1",
  trackingCode: "ORD",
  tableCode: "A1",
  restaurantId: "res-1",
  trackingQrRevokedAt: null,
  currentStatus: "confirmed",
  orderPaymentStatus: "unpaid",
  payment: { status: "pending" },
  publicStatus: "ORDER_RECEIVED",
  items: [],
  statusHistory: [],
  totals: {},
  save: vi.fn(async () => true),
  toObject() { return { trackingCode: "ORD", publicStatus: "ORDER_RECEIVED", items: [], statusHistory: [], totals: {}, payment: { status: this.payment?.status || "pending" }, customerVisibleNote: this.customerVisibleNote || null }; },
  ...overrides,
});

describe("order tracking public mutations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requestPaymentFromTracking invalid token", async () => {
    const out = await OrderMutation.requestPaymentFromTracking(null, { trackingToken: "" }, {});
    expect(out.success).toBe(false);
    expect(mocks.findOneMock).not.toHaveBeenCalled();
    expect(mocks.emitRestaurantEventMock).not.toHaveBeenCalled();
  });

  it("requestPaymentFromTracking revoked token", async () => {
    mocks.findOneMock.mockResolvedValue(mkOrder({ trackingQrRevokedAt: new Date() }));
    const out = await OrderMutation.requestPaymentFromTracking(null, { trackingToken: "x" }, {});
    expect(out.success).toBe(false);
    expect(out.message).toMatch(/hết hiệu lực/i);
  });

  it("requestPaymentFromTracking paid/cancelled/idempotent", async () => {
    mocks.findOneMock.mockResolvedValueOnce(mkOrder({ orderPaymentStatus: "paid", payment: { status: "paid" } }));
    expect((await OrderMutation.requestPaymentFromTracking(null, { trackingToken: "x" }, {})).success).toBe(false);

    const cancelled = mkOrder({ currentStatus: "cancelled" });
    mocks.findOneMock.mockResolvedValueOnce(cancelled);
    const c = await OrderMutation.requestPaymentFromTracking(null, { trackingToken: "x" }, {});
    expect(c.success).toBe(false);

    const idem = mkOrder({ orderPaymentStatus: "payment_requested", payment: { status: "payment_requested" } });
    mocks.findOneMock.mockResolvedValueOnce(idem);
    const i = await OrderMutation.requestPaymentFromTracking(null, { trackingToken: "x" }, {});
    expect(i.success).toBe(true);
    expect(i.message).toMatch(/trước đó/);
    expect(idem.save).not.toHaveBeenCalled();
    expect(mocks.emitRestaurantEventMock).not.toHaveBeenCalled();
  });

  it("requestPaymentFromTracking success emits sanitized payload", async () => {
    const order = mkOrder();
    mocks.findOneMock.mockResolvedValue(order);
    const out = await OrderMutation.requestPaymentFromTracking(null, { trackingToken: "x" }, { io: { to: () => ({ emit: () => {} }) } });
    expect(out.success).toBe(true);
    expect(order.save).toHaveBeenCalled();
    expect(order.orderPaymentStatus).toBe("payment_requested");
    expect(order.lastCustomerPaymentRequestAt).toBeInstanceOf(Date);
    expect(mocks.emitRestaurantEventMock).toHaveBeenCalledWith(expect.anything(), "res-1", "CUSTOMER_PAYMENT_REQUESTED", expect.objectContaining({ trackingCode: "ORD", message: "Khách yêu cầu thanh toán" }));
    const payload = mocks.emitRestaurantEventMock.mock.calls[0][3];
    expect(payload.order._id).toBeUndefined();
    expect(payload.order.userId).toBeUndefined();
    expect(payload.order.restaurantId).toBeUndefined();
    expect(payload.trackingToken).toBeUndefined();
    expect(payload.request.type).toBe("PAYMENT_REQUEST");
  });

  it("requestPaymentFromTracking does not duplicate active PAYMENT_REQUEST", async () => {
    const order = mkOrder({ customerRequests: [{ requestId: "r1", type: "PAYMENT_REQUEST", status: "PENDING", createdAt: new Date() }] });
    mocks.findOneMock.mockResolvedValue(order);
    const out = await OrderMutation.requestPaymentFromTracking(null, { trackingToken: "x" }, {});
    expect(out.success).toBe(true);
    expect(order.save).not.toHaveBeenCalled();
    expect(order.customerRequests).toHaveLength(1);
    expect(mocks.emitRestaurantEventMock).not.toHaveBeenCalled();
  });

  it("callStaffFromTracking invalid/revoked/inactive/rate-limit", async () => {
    expect((await OrderMutation.callStaffFromTracking(null, { trackingToken: "" }, {})).success).toBe(false);
    mocks.findOneMock.mockResolvedValueOnce(mkOrder({ trackingQrRevokedAt: new Date() }));
    expect((await OrderMutation.callStaffFromTracking(null, { trackingToken: "x" }, {})).success).toBe(false);
    mocks.findOneMock.mockResolvedValueOnce(mkOrder({ currentStatus: "completed" }));
    expect((await OrderMutation.callStaffFromTracking(null, { trackingToken: "x" }, {})).success).toBe(false);
    const rate = mkOrder({ lastCustomerStaffCallAt: new Date() });
    mocks.findOneMock.mockResolvedValueOnce(rate);
    const r = await OrderMutation.callStaffFromTracking(null, { trackingToken: "x" }, {});
    expect(r.success).toBe(false);
    expect(rate.save).not.toHaveBeenCalled();
    expect(mocks.emitRestaurantEventMock).not.toHaveBeenCalled();
  });

  it("callStaffFromTracking success trims/truncates and emits sanitized", async () => {
    const order = mkOrder();
    mocks.findOneMock.mockResolvedValue(order);
    const reason = `  ${"a".repeat(260)}   b  `;
    const out = await OrderMutation.callStaffFromTracking(null, { trackingToken: "x", reason }, { io: { to: () => ({ emit: () => {} }) } });
    expect(out.success).toBe(true);
    expect(order.customerVisibleNote.length).toBe(200);
    expect(order.lastCustomerStaffCallAt).toBeInstanceOf(Date);
    expect(mocks.emitRestaurantEventMock).toHaveBeenCalledWith(expect.anything(), "res-1", "CUSTOMER_STAFF_CALL_REQUESTED", expect.objectContaining({ trackingCode: "ORD" }));
    const payload = mocks.emitRestaurantEventMock.mock.calls[0][3];
    expect(payload.order._id).toBeUndefined();
    expect(payload.order.restaurantId).toBeUndefined();
    expect(payload.trackingToken).toBeUndefined();
    expect(payload.request.type).toBe("STAFF_CALL");
  });

  it("callStaffFromTracking does not duplicate active STAFF_CALL", async () => {
    const order = mkOrder({ customerRequests: [{ requestId: "r1", type: "STAFF_CALL", status: "ACKNOWLEDGED", createdAt: new Date() }], lastCustomerStaffCallAt: new Date(Date.now() - 120000) });
    mocks.findOneMock.mockResolvedValue(order);
    const out = await OrderMutation.callStaffFromTracking(null, { trackingToken: "x" }, {});
    expect(out.success).toBe(false);
    expect(order.save).not.toHaveBeenCalled();
    expect(mocks.emitRestaurantEventMock).not.toHaveBeenCalled();
  });
});
