import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const OrderModel = vi.hoisted(() => ({}));
const startSessionMock = vi.hoisted(() => vi.fn());
const ensureActiveTableSessionForDineInOrderMock = vi.hoisted(() => vi.fn());
const clearPaymentRequestAfterNewChildOrderBatchCreatedMock = vi.hoisted(() =>
  vi.fn(),
);

vi.mock("mongoose", () => ({
  default: {
    startSession: startSessionMock,
  },
}));
vi.mock("../../models/index.js", () => ({ Order: OrderModel }));
vi.mock("../../utils/orderLifecycle.js", async () => {
  const actual = await vi.importActual("../../utils/orderLifecycle.js");
  return {
    ...actual,
    ensureActiveTableSessionForDineInOrder:
      ensureActiveTableSessionForDineInOrderMock,
    clearPaymentRequestAfterNewChildOrderBatchCreated:
      clearPaymentRequestAfterNewChildOrderBatchCreatedMock,
  };
});

describe("withTablePaymentRequestLifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearPaymentRequestAfterNewChildOrderBatchCreatedMock.mockResolvedValue({
      cleared: false,
      session: null,
      orders: [],
    });
  });

  it("clears stale payment request after createOrderForTable succeeds", async () => {
    const { withTablePaymentRequestLifecycle } = await import(
      "../../graphql/resolvers/order/tablePaymentRequestLifecycle.js"
    );
    const createdOrder = {
      _id: "child-1",
      orderType: "dine_in",
      orderKind: "order_batch",
      parentOrderId: "parent-1",
    };
    const baseMutation = {
      createOrderForTable: vi.fn().mockResolvedValue({
        isNewOrder: true,
        order: createdOrder,
      }),
    };

    const wrapped = withTablePaymentRequestLifecycle(baseMutation);
    const result = await wrapped.createOrderForTable(
      null,
      { input: { restaurantId: "rest-1" } },
      { user: { id: "staff-1" } },
    );

    expect(result.order).toBe(createdOrder);
    expect(clearPaymentRequestAfterNewChildOrderBatchCreatedMock).toHaveBeenCalledWith({
      OrderModel,
      order: createdOrder,
      reason: "Thêm món mới sau khi khách yêu cầu thanh toán.",
    });
  });

  it("still clears stale payment request with the original order when lifecycle hardening fails", async () => {
    const { withTablePaymentRequestLifecycle } = await import(
      "../../graphql/resolvers/order/tablePaymentRequestLifecycle.js"
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const txSession = {
      withTransaction: vi.fn(async (fn) => fn()),
      endSession: vi.fn().mockResolvedValue(undefined),
    };
    startSessionMock.mockResolvedValue(txSession);
    ensureActiveTableSessionForDineInOrderMock.mockRejectedValueOnce(
      new Error("harden failed"),
    );

    const createdOrder = {
      _id: "child-2",
      id: "child-2",
      orderType: "dine_in",
      orderKind: "order_batch",
      parentOrderId: "parent-2",
      rootOrderId: "root-2",
      restaurantId: "rest-2",
      tableId: "table-2",
      tableCode: "T2",
    };
    const result = {
      isNewOrder: true,
      order: createdOrder,
    };
    const baseMutation = {
      createOrderForTable: vi.fn().mockResolvedValue(result),
    };

    const wrapped = withTablePaymentRequestLifecycle(baseMutation);
    const out = await wrapped.createOrderForTable(
      null,
      {
        input: {
          restaurantId: "rest-2",
          tableId: "table-2",
          tableCode: "T2",
        },
      },
      { user: { id: "staff-2" } },
    );

    expect(out).toBe(result);
    expect(clearPaymentRequestAfterNewChildOrderBatchCreatedMock).toHaveBeenCalledWith({
      OrderModel,
      order: createdOrder,
      reason: "Thêm món mới sau khi khách yêu cầu thanh toán.",
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "[order] Failed to harden dine-in session lifecycle after createOrderForTable",
      {
        orderId: "child-2",
        parentOrderId: "parent-2",
        rootOrderId: "root-2",
        restaurantId: "rest-2",
        tableId: "table-2",
        tableCode: "T2",
        error: "harden failed",
      },
    );
  });

  it("returns created order even when stale payment clear fails", async () => {
    const { withTablePaymentRequestLifecycle } = await import(
      "../../graphql/resolvers/order/tablePaymentRequestLifecycle.js"
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const createdOrder = {
      _id: "child-3",
      id: "child-3",
      orderType: "dine_in",
      orderKind: "order_batch",
      parentOrderId: "parent-3",
      rootOrderId: "root-3",
      restaurantId: "rest-3",
      tableCode: "T3",
    };
    const result = {
      isNewOrder: true,
      order: createdOrder,
    };
    const baseMutation = {
      createOrderForTable: vi.fn().mockResolvedValue(result),
    };

    clearPaymentRequestAfterNewChildOrderBatchCreatedMock.mockRejectedValueOnce(
      new Error("clear failed"),
    );

    const wrapped = withTablePaymentRequestLifecycle(baseMutation);
    const out = await wrapped.createOrderForTable(
      null,
      {
        input: {
          restaurantId: "rest-3",
          tableCode: "T3",
        },
      },
      { user: { id: "staff-3" } },
    );

    expect(out).toBe(result);
    expect(warnSpy).toHaveBeenCalledWith(
      "[order] Failed to clear stale table payment request after new batch",
      {
        orderId: "child-3",
        parentOrderId: "parent-3",
        rootOrderId: "root-3",
        restaurantId: "rest-3",
        tableId: null,
        tableCode: "T3",
        error: "clear failed",
      },
    );
  });

  it("does not clear payment request when createOrderForTable fails", async () => {
    const { withTablePaymentRequestLifecycle } = await import(
      "../../graphql/resolvers/order/tablePaymentRequestLifecycle.js"
    );
    const baseMutation = {
      createOrderForTable: vi.fn().mockRejectedValue(new Error("create failed")),
    };

    const wrapped = withTablePaymentRequestLifecycle(baseMutation);

    await expect(
      wrapped.createOrderForTable(null, { input: {} }, {}),
    ).rejects.toThrow("create failed");
    expect(clearPaymentRequestAfterNewChildOrderBatchCreatedMock).not.toHaveBeenCalled();
  });

  it("does not clear payment request when createOrderForTable returns no order", async () => {
    const { withTablePaymentRequestLifecycle } = await import(
      "../../graphql/resolvers/order/tablePaymentRequestLifecycle.js"
    );
    const baseMutation = {
      createOrderForTable: vi.fn().mockResolvedValue({ isNewOrder: false }),
    };

    const wrapped = withTablePaymentRequestLifecycle(baseMutation);
    const result = await wrapped.createOrderForTable(null, { input: {} }, {});

    expect(result).toEqual({ isNewOrder: false });
    expect(clearPaymentRequestAfterNewChildOrderBatchCreatedMock).not.toHaveBeenCalled();
  });
});