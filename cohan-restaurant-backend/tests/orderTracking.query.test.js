import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findOneMock: vi.fn(),
  findByIdMock: vi.fn(),
  existsMock: vi.fn(),
  requirePermMock: vi.fn(async () => true),
}));

vi.mock("../models/index.js", () => ({
  Order: { findOne: mocks.findOneMock, findById: mocks.findByIdMock, exists: mocks.existsMock },
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


  it("returns latestRequest when customerRequests exist", async () => {
    const order = {
      trackingQrRevokedAt: null,
      currentStatus: "pending",
      kitchenStatus: "pending",
      sessionStatus: "open",
      customerRequests: [
        { requestId: "req-1", type: "CALL_STAFF", status: "ACKNOWLEDGED", message: "Cần hỗ trợ", createdAt: new Date("2026-05-01T10:00:00.000Z"), acknowledgedAt: new Date("2026-05-01T10:01:00.000Z"), acknowledgedBy: "internal-user" },
      ],
      toObject: () => ({ trackingCode: "ORD", publicStatus: "ORDER_RECEIVED", items: [], statusHistory: [], totals: {}, customerRequests: order.customerRequests }),
    };
    mocks.findOneMock.mockReturnValue({ select: () => order });
    const out = await OrderQuery.customerTrackOrder(null, { trackingToken: "x" });
    expect(out.latestRequest).toEqual({
      requestId: "req-1",
      type: "CALL_STAFF",
      status: "ACKNOWLEDGED",
      message: "Cần hỗ trợ",
      createdAt: order.customerRequests[0].createdAt,
      acknowledgedAt: order.customerRequests[0].acknowledgedAt,
      resolvedAt: null,
    });
    expect(out.latestRequest.acknowledgedBy).toBeUndefined();
  });
  it("requires auth for QR svg", async () => {
    mocks.existsMock.mockResolvedValue(null);
    const order = {
      restaurantId: "r1",
      trackingQrPayload: "https://x",
      trackingUrl: "https://x",
      trackingToken: "token",
      trackingCode: "ORD-TEST",
      save: vi.fn(async () => order),
    };
    mocks.findByIdMock.mockResolvedValue(order);
    await OrderQuery.orderTrackingQrSvg(null, { orderId: "o1" }, { user: { id: "u1" } });
    expect(mocks.requirePermMock).toHaveBeenCalled();
  });

  it("customerServiceRequests filters by type and limit", async () => {
    mocks.findOneMock.mockReset();
    mocks.requirePermMock.mockResolvedValue(true);
    const rows = [
      { _id: "o1", orderCode: "ORD1", trackingCode: "T1", tableCode: "A1", customerRequests: [{ requestId: "1", type: "PAYMENT_REQUEST", status: "PENDING", createdAt: new Date("2026-05-01") }, { requestId: "2", type: "STAFF_CALL", status: "PENDING", createdAt: new Date("2026-05-03") }] },
      { _id: "o2", orderCode: "ORD2", trackingCode: "T2", tableCode: "A2", customerRequests: [{ requestId: "3", type: "STAFF_CALL", status: "PENDING", createdAt: new Date("2026-05-02") }] },
    ];
    const findMock = vi.fn().mockReturnValue({ select: () => rows });
    const { Order } = await import("../models/index.js");
    Order.find = findMock;
    const out = await OrderQuery.customerServiceRequests(null, { restaurantId: "507f1f77bcf86cd799439011", status: "pending", type: "STAFF_CALL", limit: 1 }, { user: { id: "u1" } });
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("STAFF_CALL");
  });
});
