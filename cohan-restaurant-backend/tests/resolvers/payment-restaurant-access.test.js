import { beforeEach, describe, expect, it, vi } from "vitest";

const dayjsState = vi.hoisted(() => ({
  current: new Date("2026-05-06T00:00:00.000Z"),
}));

vi.mock("dayjs", () => {
  function makeDay(value) {
    const date = value instanceof Date ? new Date(value) : new Date(value || dayjsState.current);
    const api = {
      startOf: vi.fn(() => api),
      endOf: vi.fn(() => api),
      toDate: vi.fn(() => new Date(date)),
      month: vi.fn(() => api),
      isBefore: vi.fn(() => false),
      isSame: vi.fn(() => false),
      add: vi.fn(() => api),
      format: vi.fn(() => "06/05"),
    };
    return api;
  }

  return { default: vi.fn(makeDay) };
});

const modelMocks = vi.hoisted(() => ({
  Order: { findById: vi.fn(), find: vi.fn() },
  Table: { findById: vi.fn() },
  Invoice: { find: vi.fn(), findByIdAndUpdate: vi.fn() },
  PaymentTransaction: { find: vi.fn() },
  Cashflow: { find: vi.fn() },
  PaymentSession: { findById: vi.fn() },
  PaymentReconciliation: { find: vi.fn(), aggregate: vi.fn() },
  BankTransaction: { aggregate: vi.fn() },
  Restaurant: { findByIdAndUpdate: vi.fn() },
  EventLog: { log: vi.fn() },
}));

const guardMocks = vi.hoisted(() => ({ requireRestaurantAccess: vi.fn() }));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../utils/generateInvoiceNumber.ts", () => ({
  generateInvoiceNumber: vi.fn().mockResolvedValue("INV-0001"),
}));
vi.mock("../../src/services/payment/paymentSession.service.js", () => ({
  createReservationPayment: vi.fn(),
  getProviderPublicConfig: vi.fn(),
}));
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => ({
  emitOrderEvent: vi.fn(),
}));
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

  it("payment mutation exports payment guard targets", async () => {
    const { payOrdersByTableId, payOrdersByOrderIds } = await import(
      "../../graphql/resolvers/payment/mutation.js"
    );

    expect(typeof payOrdersByTableId).toBe("function");
    expect(typeof payOrdersByOrderIds).toBe("function");
  });
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
    modelMocks.PaymentReconciliation.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) }) });
    modelMocks.PaymentReconciliation.aggregate.mockResolvedValue([]);
    modelMocks.BankTransaction.aggregate.mockResolvedValue([]);
    modelMocks.Order.findById.mockReturnValue(leanResult(null));
  });

  it("financeDashboard calls requireRestaurantAccess before finance queries", async () => {
    const { PaymentQuery } = await import("../../graphql/resolvers/payment/query.js");
    const ctx = { user: { id: "u1", roleName: "manager" } };

    const input = {
      restaurantId: "valid-r1",
      dateFrom: "2026-05-06",
      dateTo: "2026-05-06",
    };
    const res = await PaymentQuery.financeDashboard(null, { input }, ctx);

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ value: "valid-r1" }),
    );
    expect(res).toEqual(expect.objectContaining({
      summary: expect.any(Object),
      trend: expect.any(Array),
      transactions: expect.any(Array),
      debts: expect.any(Array),
      costBreakdown: expect.any(Object),
    }));
  });

  it("financeDashboard denied does not query finance models", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const { PaymentQuery } = await import("../../graphql/resolvers/payment/query.js");

    await expect(
      PaymentQuery.financeDashboard(null, { input: { restaurantId: "valid-r1" } }, { user: { id: "u1", roleName: "manager" } }),
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
        { user: { id: "u1", roleName: "manager" } },
      ),
    ).rejects.toThrow("Invalid orderIds");

    expect(modelMocks.Order.find).not.toHaveBeenCalled();
  });

  it("payOrdersByOrderIds rejects non-string orderIds", async () => {
    const { payOrdersByOrderIds } = await import("../../graphql/resolvers/payment/mutation.js");

    await expect(
      payOrdersByOrderIds(
        null,
        {
          input: {
            restaurantId: "valid-r1",
            orderIds: ["valid-order-1", 6],
            method: "cash",
          },
        },
        { user: { id: "u1", roleName: "manager" } },
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

    await PaymentQuery.paymentTransactionsByOrder(null, { orderId: "valid-o1" }, { user: { id: "u1", roleName: "manager" } });

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalled();
    expect(modelMocks.PaymentTransaction.find).toHaveBeenCalled();
  });

  it("paymentTransactionsByOrder returns [] when order not found", async () => {
    modelMocks.Order.findById.mockReturnValue(leanResult(null));
    const { PaymentQuery } = await import("../../graphql/resolvers/payment/query.js");

    const result = await PaymentQuery.paymentTransactionsByOrder(
      null,
      { orderId: "valid-o1" },
      { user: { id: "u1", roleName: "manager" } },
    );

    expect(result).toEqual([]);
    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(modelMocks.PaymentTransaction.find).not.toHaveBeenCalled();
  });

  it("paymentTransactionsByOrder denied does not query transactions", async () => {
    modelMocks.Order.findById.mockReturnValue(leanResult({ _id: "valid-o1", restaurantId: "valid-r1" }));
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const { PaymentQuery } = await import("../../graphql/resolvers/payment/query.js");

    await expect(
      PaymentQuery.paymentTransactionsByOrder(null, { orderId: "valid-o1" }, { user: { id: "u1", roleName: "manager" } }),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(modelMocks.PaymentTransaction.find).not.toHaveBeenCalled();
  });

  it("invoicesByOrder loads order and guards by order.restaurantId", async () => {
    modelMocks.Order.findById.mockReturnValue(leanResult({ _id: "valid-o1", restaurantId: "valid-r1" }));
    const { PaymentQuery } = await import("../../graphql/resolvers/payment/query.js");

    await PaymentQuery.invoicesByOrder(null, { orderId: "valid-o1" }, { user: { id: "u1", roleName: "manager" } });

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalled();
    expect(modelMocks.Invoice.find).toHaveBeenCalled();
  });

  it("invoicesByOrder returns [] when order not found", async () => {
    modelMocks.Order.findById.mockReturnValue(leanResult(null));
    const { PaymentQuery } = await import("../../graphql/resolvers/payment/query.js");

    const result = await PaymentQuery.invoicesByOrder(
      null,
      { orderId: "valid-o1" },
      { user: { id: "u1", roleName: "manager" } },
    );

    expect(result).toEqual([]);
    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(modelMocks.Invoice.find).not.toHaveBeenCalled();
  });

  it("invoicesByOrder denied does not query invoices", async () => {
    modelMocks.Order.findById.mockReturnValue(leanResult({ _id: "valid-o1", restaurantId: "valid-r1" }));
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const { PaymentQuery } = await import("../../graphql/resolvers/payment/query.js");

    await expect(
      PaymentQuery.invoicesByOrder(null, { orderId: "valid-o1" }, { user: { id: "u1", roleName: "manager" } }),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(modelMocks.Invoice.find).not.toHaveBeenCalled();
  });
});
