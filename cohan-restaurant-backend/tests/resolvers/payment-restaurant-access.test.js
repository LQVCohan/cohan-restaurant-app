import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Order: { findById: vi.fn(), find: vi.fn() },
  Table: { findById: vi.fn() },
  Invoice: { find: vi.fn(), findByIdAndUpdate: vi.fn() },
  PaymentTransaction: { find: vi.fn() },
  Cashflow: { find: vi.fn() },
  PaymentSession: { findById: vi.fn() },
  Restaurant: { findByIdAndUpdate: vi.fn() },
  EventLog: { log: vi.fn() },
}));

const guardMocks = vi.hoisted(() => ({ requireRestaurantAccess: vi.fn() }));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((value) => String(value || "").startsWith("valid-")),
    Types: {
      ObjectId: function ObjectId(value) {
        this.value = value;
        this.toString = () => String(value);
      },
    },
  },
  startSession: vi.fn(),
}));

function sortedLeanResult(value) {
  return { sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(value) }) };
}

function leanResult(value) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

describe("payment resolvers restaurant access guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue(undefined);
    modelMocks.Cashflow.find.mockReturnValue(sortedLeanResult([]));
    modelMocks.Invoice.find.mockImplementation(() => ({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
      lean: vi.fn().mockResolvedValue([]),
    }));
    modelMocks.PaymentTransaction.find.mockReturnValue(sortedLeanResult([]));
    modelMocks.Order.findById.mockReturnValue(leanResult(null));
  });

  it("financeDashboard calls requireRestaurantAccess before finance queries", async () => {
    const { PaymentQuery } = await import("../../graphql/resolvers/payment/query.js");
    const ctx = { user: { id: "u1" } };

    const res = await PaymentQuery.financeDashboard(null, { input: { restaurantId: "valid-r1" } }, ctx);

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ value: "valid-r1" }),
    );
    expect(res).toEqual(expect.objectContaining({
      summary: expect.any(Object),
      trend: expect.any(Array),
      transactions: expect.any(Array),
      debts: expect.any(Object),
      costBreakdown: expect.any(Object),
    }));
  });

  it("financeDashboard denied does not query finance models", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const { PaymentQuery } = await import("../../graphql/resolvers/payment/query.js");

    await expect(
      PaymentQuery.financeDashboard(null, { input: { restaurantId: "valid-r1" } }, { user: { id: "u1" } }),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(modelMocks.Cashflow.find).not.toHaveBeenCalled();
    expect(modelMocks.Invoice.find).not.toHaveBeenCalled();
    expect(modelMocks.PaymentTransaction.find).not.toHaveBeenCalled();
  });

  it("payOrdersByTableId denied before Table.findById", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const { payOrdersByTableId } = await import("../../graphql/resolvers/payment/mutation.js");

    await expect(
      payOrdersByTableId(null, { input: { restaurantId: "valid-r1", tableId: "valid-t1", method: "cash" } }, {}),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(modelMocks.Table.findById).not.toHaveBeenCalled();
  });

  it("payOrdersByOrderIds denied before Order.find", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const { payOrdersByOrderIds } = await import("../../graphql/resolvers/payment/mutation.js");

    await expect(
      payOrdersByOrderIds(
        null,
        { input: { restaurantId: "valid-r1", orderIds: ["valid-o1"], method: "cash" } },
        {},
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(modelMocks.Order.find).not.toHaveBeenCalled();
  });

  it("payOrdersByOrderIds rejects invalid mixed orderIds", async () => {
    const { payOrdersByOrderIds } = await import("../../graphql/resolvers/payment/mutation.js");

    await expect(
      payOrdersByOrderIds(
        null,
        { input: { restaurantId: "valid-r1", orderIds: ["valid-order-1", "bad-id"], method: "cash" } },
        {},
      ),
    ).rejects.toThrow("Invalid orderIds");

    expect(modelMocks.Order.find).not.toHaveBeenCalled();
  });

  it("updateRestaurantPaymentSettings denied before Restaurant.findByIdAndUpdate", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const { updateRestaurantPaymentSettings } = await import("../../graphql/resolvers/payment/mutation.js");

    await expect(
      updateRestaurantPaymentSettings(
        null,
        { input: { restaurantId: "valid-r1", providers: [] } },
        { user: { id: "u1", roleName: "manager" } },
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(modelMocks.Restaurant.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("paymentTransactionsByOrder loads order and guards by order.restaurantId", async () => {
    modelMocks.Order.findById.mockReturnValue(leanResult({ _id: "valid-o1", restaurantId: "valid-r1" }));
    const { PaymentQuery } = await import("../../graphql/resolvers/payment/query.js");

    await PaymentQuery.paymentTransactionsByOrder(null, { orderId: "valid-o1" }, { user: { id: "u1" } });

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalled();
    expect(modelMocks.PaymentTransaction.find).toHaveBeenCalled();
  });

  it("paymentTransactionsByOrder denied does not query transactions", async () => {
    modelMocks.Order.findById.mockReturnValue(leanResult({ _id: "valid-o1", restaurantId: "valid-r1" }));
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const { PaymentQuery } = await import("../../graphql/resolvers/payment/query.js");

    await expect(
      PaymentQuery.paymentTransactionsByOrder(null, { orderId: "valid-o1" }, { user: { id: "u1" } }),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(modelMocks.PaymentTransaction.find).not.toHaveBeenCalled();
  });

  it("invoicesByOrder loads order and guards by order.restaurantId", async () => {
    modelMocks.Order.findById.mockReturnValue(leanResult({ _id: "valid-o1", restaurantId: "valid-r1" }));
    const { PaymentQuery } = await import("../../graphql/resolvers/payment/query.js");

    await PaymentQuery.invoicesByOrder(null, { orderId: "valid-o1" }, { user: { id: "u1" } });

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalled();
    expect(modelMocks.Invoice.find).toHaveBeenCalled();
  });

  it("invoicesByOrder denied does not query invoices", async () => {
    modelMocks.Order.findById.mockReturnValue(leanResult({ _id: "valid-o1", restaurantId: "valid-r1" }));
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const { PaymentQuery } = await import("../../graphql/resolvers/payment/query.js");

    await expect(
      PaymentQuery.invoicesByOrder(null, { orderId: "valid-o1" }, { user: { id: "u1" } }),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(modelMocks.Invoice.find).not.toHaveBeenCalled();
  });
});
