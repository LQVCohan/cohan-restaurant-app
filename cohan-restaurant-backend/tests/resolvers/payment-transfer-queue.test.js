import { beforeEach, describe, expect, it, vi } from "vitest";

const RESTAURANT_ID = "64b000000000000000000001";
const ALL_STATUSES = ["SUBMITTED", "VERIFYING", "REJECTED", "VERIFIED", "FAILED", "EXPIRED"];

const modelMocks = vi.hoisted(() => ({
  PaymentSession: {
    find: vi.fn(),
    aggregate: vi.fn(),
  },
}));
const authMocks = vi.hoisted(() => ({ requireRestaurantPermission: vi.fn() }));
const paymentMocks = vi.hoisted(() => ({ sanitizePaymentSessionForClient: vi.fn((row) => ({ ...row, sanitized: true })) }));
const expiryMocks = vi.hoisted(() => ({ expireStaleTransferPayments: vi.fn() }));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("../../src/services/payment/paymentSession.service.js", () => paymentMocks);
vi.mock("../../src/services/payment/transferExpiry.service.js", () => expiryMocks);

describe("BankTransferPaymentQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireRestaurantPermission.mockResolvedValue(undefined);
    expiryMocks.expireStaleTransferPayments.mockResolvedValue(undefined);
  });

  it("queries the selected restaurant with the explicit status set", async () => {
    const limit = vi.fn().mockResolvedValue([{ id: "payment-1" }]);
    const sort = vi.fn().mockReturnValue({ limit });
    modelMocks.PaymentSession.find.mockReturnValue({ sort });
    const { BankTransferPaymentQuery } = await import("../../graphql/resolvers/payment/bankTransferQuery.js");

    const result = await BankTransferPaymentQuery.transferPaymentQueue(
      null,
      { restaurantId: RESTAURANT_ID, statuses: ALL_STATUSES, limit: 500 },
      { user: { id: "manager-1" }, io: {} },
    );

    const filter = modelMocks.PaymentSession.find.mock.calls[0][0];
    expect(String(filter.restaurantId)).toBe(RESTAURANT_ID);
    expect(filter).toMatchObject({
      provider: "bank_transfer",
      "transfer.status": { $in: ALL_STATUSES },
    });
    expect(sort).toHaveBeenCalledWith({ "transfer.submittedAt": -1, createdAt: -1 });
    expect(limit).toHaveBeenCalledWith(100);
    expect(authMocks.requireRestaurantPermission).toHaveBeenCalledWith(
      expect.objectContaining({ user: { id: "manager-1" } }),
      expect.anything(),
      "payment.read",
    );
    expect(result).toEqual([{ id: "payment-1", sanitized: true }]);
  });

  it("returns exact totals independently from the active queue filter", async () => {
    modelMocks.PaymentSession.aggregate.mockResolvedValue([
      { _id: "SUBMITTED", count: 2 },
      { _id: "VERIFYING", count: 1 },
      { _id: "REJECTED", count: 3 },
      { _id: "VERIFIED", count: 4 },
      { _id: "FAILED", count: 1 },
      { _id: "EXPIRED", count: 2 },
    ]);
    const { BankTransferPaymentQuery } = await import("../../graphql/resolvers/payment/bankTransferQuery.js");

    const result = await BankTransferPaymentQuery.transferPaymentQueueSummary(
      null,
      { restaurantId: RESTAURANT_ID },
      { user: { id: "manager-1" }, io: {} },
    );

    const pipeline = modelMocks.PaymentSession.aggregate.mock.calls[0][0];
    expect(String(pipeline[0].$match.restaurantId)).toBe(RESTAURANT_ID);
    expect(pipeline[0].$match).toMatchObject({
      provider: "bank_transfer",
      "transfer.status": { $in: ALL_STATUSES },
    });
    expect(result).toEqual({
      total: 13,
      actionable: 3,
      submitted: 2,
      verifying: 1,
      rejected: 3,
      verified: 4,
      failed: 1,
      expired: 2,
    });
  });
});
