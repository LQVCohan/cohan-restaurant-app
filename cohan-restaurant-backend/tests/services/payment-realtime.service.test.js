import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({ Order: { find: vi.fn() } }));
const trackingMocks = vi.hoisted(() => ({ emitCustomerTrackingUpdateIfChanged: vi.fn() }));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/orderTracking.service.js", () => trackingMocks);

const orderId = "64b0000000000000000000bb";
const restaurantId = "64b000000000000000000001";
const userId = "64b000000000000000000099";

function ioMock() {
  const emit = vi.fn();
  return { to: vi.fn(() => ({ emit })) , emit };
}

describe("emitPaymentRealtime", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.Order.find.mockResolvedValue([{ _id: orderId, restaurantId, toObject: () => ({ id: orderId, restaurantId }) }]);
  });

  it("emits ORDER_CREATED only for released bank-transfer order ids", async () => {
    const { emitPaymentRealtime } = await import("../../src/services/payment/paymentRealtime.service.js");
    const io = ioMock();
    await emitPaymentRealtime({
      io,
      payment: {
        _id: "64b0000000000000000000aa",
        userId,
        restaurantId,
        provider: "bank_transfer",
        paymentMethod: "bank_transfer",
        status: "success",
        metadata: { orderIds: [orderId], release: { orderIds: [orderId] } },
      },
    });

    const emittedEvents = io.emit.mock.calls.map(([eventName, payload]) => [eventName, payload?.type]);
    expect(emittedEvents).toContainEqual(["paymentEvents", "PAYMENT_VERIFIED"]);
    expect(emittedEvents).toContainEqual(["orderEvents", "PAYMENT_VERIFIED"]);
    expect(emittedEvents).toContainEqual(["orderEvents", "ORDER_CREATED"]);
  });

  it("does not emit ORDER_CREATED for VNPay/MoMo order-linked success", async () => {
    const { emitPaymentRealtime } = await import("../../src/services/payment/paymentRealtime.service.js");
    const io = ioMock();
    await emitPaymentRealtime({
      io,
      payment: {
        _id: "64b0000000000000000000aa",
        userId,
        restaurantId,
        provider: "vnpay",
        paymentMethod: "vnpay",
        status: "success",
        metadata: { orderIds: [orderId], release: { orderIds: [orderId] } },
      },
    });

    const orderEventTypes = io.emit.mock.calls
      .filter(([eventName]) => eventName === "orderEvents")
      .map(([, payload]) => payload?.type);
    expect(orderEventTypes).toEqual(["PAYMENT_VERIFIED"]);
  });
});
