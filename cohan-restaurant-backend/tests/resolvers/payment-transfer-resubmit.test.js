import { beforeEach, describe, expect, it, vi } from "vitest";

const ids = {
  payment: "64b0000000000000000000aa",
  user: "64b000000000000000000099",
  restaurant: "64b000000000000000000001",
  order: "64b0000000000000000000bb",
};

const modelMocks = vi.hoisted(() => ({
  EventLog: { log: vi.fn() },
  Order: { find: vi.fn(), updateMany: vi.fn(), countDocuments: vi.fn() },
  PaymentSession: { findById: vi.fn(), findOne: vi.fn() },
  PaymentTransaction: { findOne: vi.fn() },
}));
const authMocks = vi.hoisted(() => ({ requireRestaurantPermission: vi.fn() }));
const paymentSessionMocks = vi.hoisted(() => ({
  TRANSFER_PAYMENT_TTL_MS: 600000,
  createOrderPayment: vi.fn(),
  sanitizePaymentSessionForClient: vi.fn((value) => value),
  settlePaidOrderPaymentSession: vi.fn(),
}));
const trackingMocks = vi.hoisted(() => ({ emitCustomerTrackingUpdateIfChanged: vi.fn() }));
const emitMocks = vi.hoisted(() => ({ emitOrderEvent: vi.fn(), emitRestaurantEvent: vi.fn() }));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("../../src/services/payment/paymentSession.service.js", () => paymentSessionMocks);
vi.mock("../../src/services/orderTracking.service.js", () => trackingMocks);
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => emitMocks);

function paymentDoc(overrides = {}) {
  return {
    _id: ids.payment,
    restaurantId: ids.restaurant,
    userId: ids.user,
    provider: "bank_transfer",
    paymentMethod: "bank_transfer",
    status: "pending",
    callbackStatus: "none",
    amount: 100000,
    reference: "ORD-20260618-ABC123",
    metadata: { orderIds: [ids.order] },
    transfer: { status: "INSTRUCTIONS_SHOWN" },
    events: [],
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("submitTransferProof retry behavior", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.Order.find.mockResolvedValue([]);
    modelMocks.Order.updateMany.mockResolvedValue({ modifiedCount: 1 });
    modelMocks.EventLog.log.mockResolvedValue(undefined);
    emitMocks.emitRestaurantEvent.mockResolvedValue(undefined);
  });

  it("keeps first proof submission as pending SUBMITTED", async () => {
    const payment = paymentDoc();
    modelMocks.PaymentSession.findById.mockResolvedValue(payment);
    const { submitTransferProof } = await import("../../graphql/resolvers/payment/transferMutation.js");

    const result = await submitTransferProof(null, {
      input: { paymentSessionId: ids.payment, proofImages: ["https://example.test/proof.jpg"], proofNote: "paid" },
    }, { user: { id: ids.user }, io: { to: vi.fn() } });

    expect(result).toBe(payment);
    expect(payment.status).toBe("pending");
    expect(payment.callbackStatus).toBe("received");
    expect(payment.transfer.status).toBe("SUBMITTED");
    expect(payment.transfer.proofImages).toEqual(["https://example.test/proof.jpg"]);
    expect(payment.events.at(-1)).toMatchObject({ type: "transfer_proof_submitted", payload: { by: ids.user } });
    expect(payment.save).toHaveBeenCalled();
  });

  it("allows rejected transfer proof resubmission and clears rejection metadata", async () => {
    const rejectedAt = new Date("2026-06-18T10:00:00.000Z");
    const payment = paymentDoc({
      status: "failed",
      callbackStatus: "rejected",
      transfer: {
        status: "REJECTED",
        rejectedAt,
        rejectedBy: ids.restaurant,
        rejectReason: "Ảnh mờ",
        proofImages: ["old.jpg"],
      },
      events: [{ type: "transfer_rejected", payload: { reason: "Ảnh mờ" } }],
    });
    modelMocks.PaymentSession.findById.mockResolvedValue(payment);
    const { submitTransferProof } = await import("../../graphql/resolvers/payment/transferMutation.js");

    await submitTransferProof(null, {
      input: { paymentSessionId: ids.payment, proofImages: ["new.jpg"], proofNote: "new proof" },
    }, { user: { id: ids.user }, io: { to: vi.fn() } });

    expect(payment.status).toBe("pending");
    expect(payment.callbackStatus).toBe("received");
    expect(payment.transfer.status).toBe("SUBMITTED");
    expect(payment.transfer.proofImages).toEqual(["new.jpg"]);
    expect(payment.transfer.proofNote).toBe("new proof");
    expect(payment.transfer.rejectedAt).toBeUndefined();
    expect(payment.transfer.rejectedBy).toBeUndefined();
    expect(payment.transfer.rejectReason).toBeUndefined();
    expect(payment.events.at(-1)).toMatchObject({ type: "transfer_proof_resubmitted", payload: { by: ids.user } });
    expect(modelMocks.Order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ _id: { $in: [ids.order] }, restaurantId: ids.restaurant, "payment.status": { $ne: "paid" } }),
      expect.objectContaining({ $set: expect.objectContaining({ "payment.status": "pending" }) }),
    );
  });
});
