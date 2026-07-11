import { beforeEach, describe, expect, it, vi } from "vitest";

const ids = {
  payment: "64b0000000000000000000aa",
  user: "64b000000000000000000099",
  restaurant: "64b000000000000000000001",
  order: "64b0000000000000000000bb",
};

const sessionMocks = vi.hoisted(() => {
  const session = {
    withTransaction: vi.fn(async (callback) => callback()),
    endSession: vi.fn(),
  };
  return { session, startSession: vi.fn(async () => session) };
});

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
const realtimeMocks = vi.hoisted(() => ({ emitPaymentRealtime: vi.fn() }));
const expiryMocks = vi.hoisted(() => ({ cancelDraftTransferOrdersForExpiredPayment: vi.fn() }));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("../../src/services/payment/paymentSession.service.js", () => paymentSessionMocks);
vi.mock("../../src/services/orderTracking.service.js", () => trackingMocks);
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => emitMocks);
vi.mock("../../src/services/payment/paymentRealtime.service.js", () => realtimeMocks);
vi.mock("../../src/services/payment/transferExpiry.service.js", () => expiryMocks);
vi.mock("mongoose", () => {
  function ObjectId(value) {
    this.value = value;
  }
  ObjectId.prototype.toString = function toString() {
    return String(this.value);
  };
  return {
    default: {
      isValidObjectId: vi.fn((value) => Boolean(value)),
      Types: { ObjectId },
      startSession: sessionMocks.startSession,
    },
  };
});

const sessionQuery = (value) => ({
  session: vi.fn().mockResolvedValue(value),
});

function paymentDoc(overrides = {}) {
  return {
    _id: ids.payment,
    restaurantId: ids.restaurant,
    userId: ids.user,
    provider: "bank_transfer",
    paymentMethod: "bank_transfer",
    status: "pending",
    callbackStatus: "received",
    amount: 100000,
    reference: "ORD-20260711-ABC123",
    providerTransactionId: null,
    metadata: { orderIds: [ids.order] },
    transfer: {
      status: "SUBMITTED",
      proofImages: ["proof.jpg"],
      rejectedCount: 0,
      maxRejectedCount: 3,
    },
    events: [],
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const context = { user: { id: ids.user }, io: {} };

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  sessionMocks.session.withTransaction.mockImplementation(async (callback) => callback());
  sessionMocks.startSession.mockResolvedValue(sessionMocks.session);
  authMocks.requireRestaurantPermission.mockResolvedValue(undefined);
  modelMocks.EventLog.log.mockResolvedValue(undefined);
  modelMocks.Order.find.mockResolvedValue([]);
  modelMocks.Order.updateMany.mockResolvedValue({ modifiedCount: 1 });
  modelMocks.PaymentTransaction.findOne.mockReturnValue(sessionQuery(null));
  emitMocks.emitRestaurantEvent.mockResolvedValue(undefined);
  realtimeMocks.emitPaymentRealtime.mockResolvedValue(undefined);
  paymentSessionMocks.settlePaidOrderPaymentSession.mockResolvedValue({});
});

describe("manual transfer review integrity", () => {
  it("rejects manual verification outside submitted or verifying state", async () => {
    const payment = paymentDoc({
      status: "failed",
      transfer: { status: "REJECTED", proofImages: ["proof.jpg"] },
    });
    modelMocks.PaymentSession.findById.mockResolvedValue(payment);
    const { verifyTransferPayment } = await import(
      "../../graphql/resolvers/payment/transferMutation.js"
    );

    await expect(
      verifyTransferPayment(
        null,
        { input: { paymentSessionId: ids.payment, receivedAmount: 100000 } },
        context,
      ),
    ).rejects.toThrow("không còn ở trạng thái chờ duyệt");
    expect(sessionMocks.startSession).not.toHaveBeenCalled();
    expect(paymentSessionMocks.settlePaidOrderPaymentSession).not.toHaveBeenCalled();
  });

  it("rejects a received amount that does not exactly match the expected VND amount", async () => {
    const payment = paymentDoc();
    modelMocks.PaymentSession.findById.mockResolvedValue(payment);
    const { verifyTransferPayment } = await import(
      "../../graphql/resolvers/payment/transferMutation.js"
    );

    await expect(
      verifyTransferPayment(
        null,
        { input: { paymentSessionId: ids.payment, receivedAmount: 99000 } },
        context,
      ),
    ).rejects.toThrow("Số tiền thực nhận phải khớp");
    expect(sessionMocks.startSession).not.toHaveBeenCalled();
  });

  it("settles an exact payment once without duplicating the order release update", async () => {
    const payment = paymentDoc();
    modelMocks.PaymentSession.findById.mockResolvedValue(payment);
    modelMocks.PaymentSession.findOne.mockReturnValue(sessionQuery(payment));
    const { verifyTransferPayment } = await import(
      "../../graphql/resolvers/payment/transferMutation.js"
    );

    await verifyTransferPayment(
      null,
      {
        input: {
          paymentSessionId: ids.payment,
          receivedAmount: 100000,
          providerTransactionId: "BANK-001",
        },
      },
      context,
    );

    expect(payment.transfer.status).toBe("VERIFIED");
    expect(payment.transfer.varianceAmount).toBe(0);
    expect(payment.save).toHaveBeenCalledWith({ session: sessionMocks.session });
    expect(paymentSessionMocks.settlePaidOrderPaymentSession).toHaveBeenCalledWith({
      payment,
      source: "manual_transfer_verification",
      session: sessionMocks.session,
    });
    expect(modelMocks.Order.updateMany).not.toHaveBeenCalled();
  });

  it("blocks a bank transaction code already attached to another payment", async () => {
    const payment = paymentDoc();
    modelMocks.PaymentSession.findById.mockResolvedValue(payment);
    modelMocks.PaymentSession.findOne.mockReturnValue(sessionQuery(payment));
    modelMocks.PaymentTransaction.findOne.mockReturnValue(
      sessionQuery({ _id: "transaction-existing", externalRef: "OTHER-PAYMENT" }),
    );
    const { verifyTransferPayment } = await import(
      "../../graphql/resolvers/payment/transferMutation.js"
    );

    await expect(
      verifyTransferPayment(
        null,
        {
          input: {
            paymentSessionId: ids.payment,
            receivedAmount: 100000,
            providerTransactionId: "BANK-DUPLICATE",
          },
        },
        context,
      ),
    ).rejects.toThrow("đã được dùng cho thanh toán khác");
    expect(paymentSessionMocks.settlePaidOrderPaymentSession).not.toHaveBeenCalled();
  });

  it("persists a non-terminal rejection and order state in the same transaction", async () => {
    const payment = paymentDoc();
    modelMocks.PaymentSession.findById.mockResolvedValue(payment);
    modelMocks.PaymentSession.findOne.mockReturnValue(sessionQuery(payment));
    const { rejectTransferPayment } = await import(
      "../../graphql/resolvers/payment/transferMutation.js"
    );

    await rejectTransferPayment(
      null,
      { input: { paymentSessionId: ids.payment, reason: "Ảnh giao dịch bị mờ" } },
      context,
    );

    expect(payment.transfer.status).toBe("REJECTED");
    expect(payment.save).toHaveBeenCalledWith({ session: sessionMocks.session });
    expect(modelMocks.Order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: ids.restaurant }),
      expect.objectContaining({
        $set: expect.objectContaining({ "payment.status": "failed" }),
      }),
      { session: sessionMocks.session },
    );
  });
});
