import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findOneMock: vi.fn(),
  findByIdMock: vi.fn(),
  requirePermMock: vi.fn(async () => true),
}));

vi.mock("../models/index.js", () => ({
  Order: { findOne: mocks.findOneMock, findById: mocks.findByIdMock },
  User: {}, Table: {}, Customer: {}, MenuItem: {}, StockItem: {}, Supply: {}, Promotion: {}, Staff: {}, Review: {},
}));
vi.mock("../src/services/auth/authorization.service.js", () => ({ requireRestaurantPermission: mocks.requirePermMock }));

import { OrderQuery } from "../graphql/resolvers/order/query.js";

describe("OrderQuery customerTrackOrder", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns null when token not found", async () => {
    mocks.findOneMock.mockReturnValue({ select: () => null });
    const out = await OrderQuery.customerTrackOrder(null, { trackingToken: "x" });
    expect(out).toBeNull();
  });

  it("throws for revoked token", async () => {
    mocks.findOneMock.mockReturnValue({ select: () => ({ trackingQrRevokedAt: new Date() }) });
    await expect(OrderQuery.customerTrackOrder(null, { trackingToken: "x" })).rejects.toThrow("expired");
  });

  it("does not save on public read", async () => {
    const order = { trackingQrRevokedAt: null, currentStatus: "pending", kitchenStatus: "pending", sessionStatus: "open", toObject: () => ({ trackingCode: "ORD", publicStatus: "ORDER_RECEIVED", items: [], statusHistory: [], totals: {} }) };
    mocks.findOneMock.mockReturnValue({ select: () => order });
    await OrderQuery.customerTrackOrder(null, { trackingToken: "x" });
    expect(order.save).toBeUndefined();
  });

  it("requires auth for QR svg", async () => {
    mocks.findByIdMock.mockResolvedValue({ restaurantId: "r1", trackingQrPayload: "https://x", trackingUrl: "https://x" });
    await OrderQuery.orderTrackingQrSvg(null, { orderId: "o1" }, { user: { id: "u1" } });
    expect(mocks.requirePermMock).toHaveBeenCalled();
  });
});
