import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findOneMock: vi.fn(),
  emitOrderEventMock: vi.fn(async () => true),
}));

vi.mock("../models/index.js", () => ({
  Order: { findOne: mocks.findOneMock },
  Reservation: {}, TableCustomer: {}, Warehouse: {}, Recipe: {}, Ingredient: {}, ModifierGroup: {}, CheckoutSession: {}, Coupon: {}, Customer: {}, User: {}, WalletTransaction: {}, PrintSetting: {}, Promotion: {}, Cart: {},
}));
vi.mock("../graphql/resolvers/order/helper/emitOrderEvent.js", () => ({ emitOrderEvent: mocks.emitOrderEventMock }));

import { OrderMutation } from "../graphql/resolvers/order/mutation.js";

describe("order tracking public mutations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requestPaymentFromTracking sets payment_requested", async () => {
    const order = { trackingQrRevokedAt: null, orderPaymentStatus: "unpaid", currentStatus: "confirmed", payment: {}, toObject: () => ({ trackingCode: "ORD", publicStatus: "ORDER_RECEIVED", items: [], statusHistory: [], totals: {}, payment: { status: "payment_requested" } }), save: vi.fn(async () => true) };
    mocks.findOneMock.mockResolvedValue(order);
    const out = await OrderMutation.requestPaymentFromTracking(null, { trackingToken: "t1" }, { io: { to: () => ({ emit: () => {} }) } });
    expect(out.success).toBe(true);
    expect(order.payment.status).toBe("payment_requested");
  });

  it("callStaffFromTracking rate-limits within 60s", async () => {
    const order = { trackingQrRevokedAt: null, currentStatus: "confirmed", lastCustomerStaffCallAt: new Date(), toObject: () => ({ trackingCode: "ORD", publicStatus: "ORDER_RECEIVED", items: [], statusHistory: [], totals: {}, payment: { status: "pending" } }) };
    mocks.findOneMock.mockResolvedValue(order);
    const out = await OrderMutation.callStaffFromTracking(null, { trackingToken: "t1" }, {});
    expect(out.success).toBe(false);
    expect(out.message).toMatch(/Vui lòng chờ nhân viên/);
  });
});
