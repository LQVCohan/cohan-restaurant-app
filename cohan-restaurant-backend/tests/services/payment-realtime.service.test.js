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
  return { to: vi.fn(() => ({ emit })), emit };
}

function vnpayPayment() {
  return {
    _id: "64b0000000000000000000aa",
    reference: "ORD-20260714-50036D",
    userId,
    restaurantId,
    provider: "vnpay",
    paymentMethod: "vnpay",
    status: "success",
    metadata: { orderIds: [orderId], release: { orderIds: [orderId] } },
  };
}

describe("emitPaymentRealtime", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.Order.find.mockResolvedValue([
      {
        _id: orderId,
        restaurantId,
        toObject: () => ({ id: orderId, restaurantId }),
      },
    ]);
  });

  it("emits ORDER_CREATED only for released bank-transfer order ids", async () => {
    const { emitPaymentRealtime } = await import(
      "../../src/services/payment/paymentRealtime.service.js"
    );
    const io = ioMock();
    await emitPaymentRealtime({
      io,
      payment: {
        ...vnpayPayment(),
        provider: "bank_transfer",
        paymentMethod: "bank_transfer",
      },
    });

    const emittedEvents = io.emit.mock.calls.map(([eventName, payload]) => [
      eventName,
      payload?.type,
    ]);
    expect(emittedEvents).toContainEqual(["paymentEvents", "PAYMENT_VERIFIED"]);
    expect(emittedEvents).toContainEqual(["orderEvents", "PAYMENT_VERIFIED"]);
    expect(emittedEvents).toContainEqual(["orderEvents", "ORDER_CREATED"]);
  });

  it("does not emit ORDER_CREATED for VNPay/MoMo order-linked success", async () => {
    const { emitPaymentRealtime } = await import(
      "../../src/services/payment/paymentRealtime.service.js"
    );
    const io = ioMock();
    await emitPaymentRealtime({ io, payment: vnpayPayment() });

    const orderEventTypes = io.emit.mock.calls
      .filter(([eventName]) => eventName === "orderEvents")
      .map(([, payload]) => payload?.type);
    expect(orderEventTypes).toEqual(["PAYMENT_VERIFIED"]);
  });

  it("does not turn a settled VNPAY callback into a return-page failure when realtime lookup breaks", async () => {
    const { emitPaymentRealtime } = await import(
      "../../src/services/payment/paymentRealtime.service.js"
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    modelMocks.Order.find.mockRejectedValueOnce(new Error("socket-side lookup failed"));

    await expect(
      emitPaymentRealtime({ io: ioMock(), payment: vnpayPayment() }),
    ).resolves.toEqual({
      ok: false,
      errorCode: "PAYMENT_REALTIME_EMIT_FAILED",
    });

    expect(warn).toHaveBeenCalledWith(
      "[payment] realtime emission failed",
      expect.objectContaining({
        eventType: "PAYMENT_VERIFIED",
        reference: "ORD-20260714-50036D",
        errorCode: "Error",
      }),
    );
    warn.mockRestore();
  });
});
