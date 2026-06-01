import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Order: { findOne: vi.fn() },
}));

const guardMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
}));

const helperMocks = vi.hoisted(() => ({
  emitOrderEvent: vi.fn(),
  toId: vi.fn((value) => {
    if (!value || value === "bad-id") return null;
    return `oid:${value}`;
  }),
}));

const trackingMocks = vi.hoisted(() => ({
  createOrderTrackingEvent: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../graphql/resolvers/order/helper/index.js", () => helperMocks);
vi.mock("../../graphql/resolvers/order/helper/tracking.js", () => trackingMocks);

describe("shipping tracking restaurant access guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue(undefined);
  });

  const validInput = {
    orderId: "valid-order-1",
    restaurantId: "valid-restaurant-1",
  };

  it("updateDriverLocation denied before Order.findOne", async () => {
    const { ShippingTrackingMutation } = await import("../../graphql/resolvers/shippingTracking/mutation.js");
    guardMocks.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));

    await expect(
      ShippingTrackingMutation.updateDriverLocation(null, { input: { ...validInput, lat: 10, lng: 106 } }, {}),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(modelMocks.Order.findOne).not.toHaveBeenCalled();
    expect(trackingMocks.createOrderTrackingEvent).not.toHaveBeenCalled();
    expect(helperMocks.emitOrderEvent).not.toHaveBeenCalled();
  });

  it("updateDeliveryStatus denied before Order.findOne", async () => {
    const { ShippingTrackingMutation } = await import("../../graphql/resolvers/shippingTracking/mutation.js");
    guardMocks.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));

    await expect(
      ShippingTrackingMutation.updateDeliveryStatus(null, { input: { ...validInput, status: "delivering" } }, {}),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(modelMocks.Order.findOne).not.toHaveBeenCalled();
    expect(trackingMocks.createOrderTrackingEvent).not.toHaveBeenCalled();
    expect(helperMocks.emitOrderEvent).not.toHaveBeenCalled();
  });

  it("updateDeliveryETA denied before Order.findOne", async () => {
    const { ShippingTrackingMutation } = await import("../../graphql/resolvers/shippingTracking/mutation.js");
    guardMocks.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));

    await expect(
      ShippingTrackingMutation.updateDeliveryETA(null, { input: { ...validInput, eta: new Date().toISOString() } }, {}),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(modelMocks.Order.findOne).not.toHaveBeenCalled();
    expect(trackingMocks.createOrderTrackingEvent).not.toHaveBeenCalled();
    expect(helperMocks.emitOrderEvent).not.toHaveBeenCalled();
  });

  it("assignDriverToOrder denied before Order.findOne", async () => {
    const { ShippingTrackingMutation } = await import("../../graphql/resolvers/shippingTracking/mutation.js");
    guardMocks.requireRestaurantAccess.mockRejectedValueOnce(new Error("FORBIDDEN_SCOPE"));

    await expect(
      ShippingTrackingMutation.assignDriverToOrder(null, { input: { ...validInput, driverName: "A" } }, {}),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(modelMocks.Order.findOne).not.toHaveBeenCalled();
    expect(trackingMocks.createOrderTrackingEvent).not.toHaveBeenCalled();
    expect(helperMocks.emitOrderEvent).not.toHaveBeenCalled();
  });

  it("updateDriverLocation invalid restaurantId does not call requireRestaurantAccess or Order.findOne", async () => {
    const { ShippingTrackingMutation } = await import("../../graphql/resolvers/shippingTracking/mutation.js");

    await expect(
      ShippingTrackingMutation.updateDriverLocation(
        null,
        { input: { ...validInput, restaurantId: "bad-id", lat: 10, lng: 106 } },
        {},
      ),
    ).rejects.toThrow("Invalid restaurantId");

    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(modelMocks.Order.findOne).not.toHaveBeenCalled();
  });

  it("allowed updateDeliveryStatus calls guard then updates order", async () => {
    const { ShippingTrackingMutation } = await import("../../graphql/resolvers/shippingTracking/mutation.js");
    const save = vi.fn();
    const order = {
      shipping: { deliveryStatus: "pending" },
      restaurantId: "oid:valid-restaurant-1",
      orderCode: "O-1",
      save,
      toJSON: vi.fn(() => ({ id: "order-1" })),
    };
    modelMocks.Order.findOne.mockResolvedValueOnce(order);

    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    const ctx = { io: { to } };

    await ShippingTrackingMutation.updateDeliveryStatus(
      null,
      { input: { ...validInput, status: "delivering", message: "on the way" } },
      ctx,
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(ctx, "oid:valid-restaurant-1");
    expect(order.shipping.deliveryStatus).toBe("delivering");
    expect(save).toHaveBeenCalled();
    expect(trackingMocks.createOrderTrackingEvent).toHaveBeenCalled();
    expect(helperMocks.emitOrderEvent).toHaveBeenCalledWith(
      ctx,
      "oid:valid-restaurant-1",
      "DELIVERY_STATUS_UPDATED",
      expect.any(Object),
    );
    expect(to).toHaveBeenCalledWith("order_O-1");
    expect(emit).toHaveBeenCalled();
  });


  it("emits public customer tracking update to tracking token room", async () => {
    const { ShippingTrackingMutation } = await import("../../graphql/resolvers/shippingTracking/mutation.js");
    const save = vi.fn();
    const order = {
      shipping: { deliveryStatus: "pending", driverName: "Anh Nam" },
      restaurantId: "oid:valid-restaurant-1",
      orderType: "delivery",
      orderCode: "O-2",
      trackingToken: "public-token",
      trackingCode: "ORD-2",
      items: [],
      statusHistory: [],
      totals: {},
      save,
      toJSON: vi.fn(() => ({ id: "order-2" })),
      toObject: vi.fn(() => ({
        orderType: order.orderType,
        trackingCode: order.trackingCode,
        currentStatus: order.currentStatus,
        shipping: order.shipping,
        items: order.items,
        statusHistory: order.statusHistory,
        totals: order.totals,
      })),
    };
    modelMocks.Order.findOne.mockResolvedValueOnce(order);
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    const ctx = { io: { to } };

    await ShippingTrackingMutation.updateDeliveryStatus(null, { input: { ...validInput, status: "delivering" } }, ctx);

    expect(to).toHaveBeenCalledWith("order-tracking:public-token");
    expect(emit).toHaveBeenCalledWith("customer-order-tracking-updated", expect.objectContaining({
      publicStatus: "DELIVERING",
      delivery: expect.objectContaining({ deliveryStatus: "delivering", deliveryStatusLabel: "Đang giao đến bạn" }),
    }));
  });

  it("allowed assignDriverToOrder calls guard and saves driver fields", async () => {
    const { ShippingTrackingMutation } = await import("../../graphql/resolvers/shippingTracking/mutation.js");
    const save = vi.fn();
    const order = {
      shipping: { deliveryStatus: "pending" },
      restaurantId: "oid:valid-restaurant-1",
      orderCode: "O-1",
      save,
      toJSON: vi.fn(() => ({ id: "order-1" })),
    };
    modelMocks.Order.findOne.mockResolvedValueOnce(order);

    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    const ctx = { io: { to } };

    await ShippingTrackingMutation.assignDriverToOrder(
      null,
      {
        input: {
          ...validInput,
          driverName: "Driver A",
          driverPhone: "0909",
        },
      },
      ctx,
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(ctx, "oid:valid-restaurant-1");
    expect(order.shipping.driverName).toBe("Driver A");
    expect(order.shipping.driverPhone).toBe("0909");
    expect(order.shipping.deliveryStatus).toBe("driver_assigned");
    expect(save).toHaveBeenCalled();
    expect(trackingMocks.createOrderTrackingEvent).toHaveBeenCalled();
    expect(helperMocks.emitOrderEvent).toHaveBeenCalledWith(
      ctx,
      "oid:valid-restaurant-1",
      "DELIVERY_DRIVER_ASSIGNED",
      expect.any(Object),
    );
  });
});
