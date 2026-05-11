import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const OrderModel = vi.hoisted(() => ({
  updateOne: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
}));
const startSessionMock = vi.hoisted(() => vi.fn());
const ensureActiveTableSessionForDineInOrderMock = vi.hoisted(() => vi.fn());
const clearPaymentRequestAfterNewChildOrderBatchCreatedMock = vi.hoisted(() =>
  vi.fn(),
);
const generateOrderCodeMock = vi.hoisted(() => vi.fn());

vi.mock("mongoose", () => ({
  default: {
    startSession: startSessionMock,
  },
}));
vi.mock("../../models/index.js", () => ({ Order: OrderModel }));
vi.mock("../../utils/generateOrderCode.js", () => ({
  default: generateOrderCodeMock,
}));
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

function leanQuery(value) {
  return {
    session: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(value),
  };
}

describe("createOrderForTable session-batch lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    OrderModel.updateOne.mockResolvedValue({ acknowledged: true });
    OrderModel.create.mockResolvedValue([{ _id: "child-created" }]);
    clearPaymentRequestAfterNewChildOrderBatchCreatedMock.mockResolvedValue({
      cleared: false,
      session: null,
      orders: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createOrderForTable creates table_session and first order_batch for new dine-in table", async () => {
    const { withTablePaymentRequestLifecycle } = await import(
      "../../graphql/resolvers/order/tablePaymentRequestLifecycle.js"
    );
    const txSession = {
      withTransaction: vi.fn(async (fn) => fn()),
      endSession: vi.fn().mockResolvedValue(undefined),
    };
    startSessionMock.mockResolvedValue(txSession);
    const createdParent = {
      _id: "parent-1",
      orderCode: "TS-001",
      activeSessionKey: "rest-1:table-1:active",
      currentStatus: "pending",
      openedAt: new Date("2026-05-11T00:00:00.000Z"),
    };
    const createdChild = {
      _id: "child-1",
      restaurantId: "rest-1",
      tableId: "table-1",
      tableCode: "T1",
      orderType: "dine_in",
      orderKind: "order_batch",
      parentOrderId: "parent-1",
      rootOrderId: "parent-1",
      activeSessionKey: null,
      items: [{ name: "Pho", quantity: 1 }],
      totals: { grandTotal: 55000 },
    };
    ensureActiveTableSessionForDineInOrderMock.mockResolvedValue({
      sessionOrder: createdParent,
      created: true,
    });
    generateOrderCodeMock.mockResolvedValue("BATCH-001");
    OrderModel.create.mockResolvedValue([{ _id: "child-1" }]);
    OrderModel.findById.mockReturnValueOnce(leanQuery(createdChild));

    const baseMutation = {
      createOrderForTable: vi.fn().mockResolvedValue({
        isNewOrder: true,
        order: {
          _id: "parent-1",
          restaurantId: "rest-1",
          tableId: "table-1",
          tableCode: "t1",
          orderType: "dine_in",
          orderKind: "table_session",
          orderCode: "TS-001",
          currentStatus: "pending",
          kitchenStatus: "draft",
          items: [{ name: "Pho", quantity: 1 }],
          totals: { grandTotal: 55000 },
          payment: { status: "pending" },
        },
      }),
    };

    const wrapped = withTablePaymentRequestLifecycle(baseMutation);
    const result = await wrapped.createOrderForTable(
      null,
      {
        input: {
          restaurantId: "rest-1",
          tableId: "table-1",
          tableCode: "t1",
        },
      },
      { user: { id: "staff-1" } },
    );

    expect(ensureActiveTableSessionForDineInOrderMock).toHaveBeenCalledWith({
      OrderModel,
      createOrderCode: generateOrderCodeMock,
      restaurantId: "rest-1",
      tableId: "table-1",
      tableCode: "T1",
      userId: null,
      session: txSession,
    });
    expect(OrderModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          orderCode: "BATCH-001",
          parentOrderCode: "TS-001",
          orderKind: "order_batch",
          parentOrderId: "parent-1",
          rootOrderId: "parent-1",
          tableCode: "T1",
          activeSessionKey: null,
        }),
      ],
      { session: txSession },
    );
    expect(OrderModel.updateOne).toHaveBeenCalledWith(
      {
        _id: "parent-1",
        restaurantId: "rest-1",
        orderKind: "table_session",
      },
      {
        $set: expect.objectContaining({
          activeSessionKey: "rest-1:table-1:active",
          sessionStatus: "dining",
          orderPaymentStatus: "unpaid",
          items: [],
        }),
      },
      { session: txSession },
    );
    expect(result.order).toEqual(createdChild);
    expect(clearPaymentRequestAfterNewChildOrderBatchCreatedMock).toHaveBeenCalledWith({
      OrderModel,
      order: createdChild,
      reason: "Thêm món mới sau khi khách yêu cầu thanh toán.",
    });
  });

  it("createOrderForTable reuses existing active table_session and keeps activeSessionKey off child order_batch", async () => {
    const { withTablePaymentRequestLifecycle } = await import(
      "../../graphql/resolvers/order/tablePaymentRequestLifecycle.js"
    );
    const txSession = {
      withTransaction: vi.fn(async (fn) => fn()),
      endSession: vi.fn().mockResolvedValue(undefined),
    };
    startSessionMock.mockResolvedValue(txSession);

    ensureActiveTableSessionForDineInOrderMock.mockResolvedValue({
      sessionOrder: {
        _id: "parent-2",
        orderCode: "TS-002",
        activeSessionKey: "rest-1:table-2:active",
        currentStatus: "pending",
        openedAt: new Date("2026-05-11T00:00:00.000Z"),
      },
      created: false,
    });
    const updatedChild = {
      _id: "child-2",
      restaurantId: "rest-1",
      tableId: "table-2",
      tableCode: "T2",
      orderType: "dine_in",
      orderKind: "order_batch",
      parentOrderId: "parent-2",
      rootOrderId: "parent-2",
      activeSessionKey: null,
      items: [{ name: "Tea", quantity: 2 }],
    };
    OrderModel.findById.mockReturnValueOnce(leanQuery(updatedChild));

    const baseMutation = {
      createOrderForTable: vi.fn().mockResolvedValue({
        isNewOrder: true,
        order: {
          _id: "child-2",
          restaurantId: "rest-1",
          tableId: "table-2",
          tableCode: "t2",
          orderType: "dine_in",
          orderKind: "order_batch",
          orderCode: "ORD-002",
          kitchenStatus: "draft",
          payment: { status: "payment_requested" },
        },
      }),
    };

    const wrapped = withTablePaymentRequestLifecycle(baseMutation);
    const result = await wrapped.createOrderForTable(
      null,
      {
        input: {
          restaurantId: "rest-1",
          tableId: "table-2",
          tableCode: "t2",
        },
      },
      { user: { id: "staff-2" } },
    );

    expect(OrderModel.updateOne).toHaveBeenNthCalledWith(
      1,
      { _id: "child-2", restaurantId: "rest-1" },
      {
        $set: expect.objectContaining({
          orderKind: "order_batch",
          parentOrderId: "parent-2",
          rootOrderId: "parent-2",
          parentOrderCode: "TS-002",
          tableCode: "T2",
          kitchenStatus: "pending",
          orderPaymentStatus: "unpaid",
          activeSessionKey: null,
          "payment.status": "pending",
        }),
      },
      { session: txSession },
    );
    expect(OrderModel.updateOne).toHaveBeenNthCalledWith(
      2,
      {
        _id: "parent-2",
        restaurantId: "rest-1",
        orderKind: "table_session",
      },
      {
        $set: expect.objectContaining({
          activeSessionKey: "rest-1:table-2:active",
          sessionStatus: "dining",
          orderPaymentStatus: "unpaid",
          "payment.status": "pending",
        }),
      },
      { session: txSession },
    );
    expect(result.order).toEqual(updatedChild);
    expect(result.order.activeSessionKey).toBeNull();
    expect(clearPaymentRequestAfterNewChildOrderBatchCreatedMock).toHaveBeenCalledWith({
      OrderModel,
      order: updatedChild,
      reason: "Thêm món mới sau khi khách yêu cầu thanh toán.",
    });
  });

  it("skips lifecycle hardening for off-premise createOrderForTable results", async () => {
    const { withTablePaymentRequestLifecycle } = await import(
      "../../graphql/resolvers/order/tablePaymentRequestLifecycle.js"
    );
    const baseMutation = {
      createOrderForTable: vi.fn().mockResolvedValue({
        isNewOrder: true,
        order: {
          _id: "delivery-1",
          restaurantId: "rest-1",
          orderType: "delivery",
          orderKind: "order_batch",
        },
      }),
    };

    const wrapped = withTablePaymentRequestLifecycle(baseMutation);
    const result = await wrapped.createOrderForTable(null, { input: {} }, {});

    expect(result.order).toEqual({
      _id: "delivery-1",
      restaurantId: "rest-1",
      orderType: "delivery",
      orderKind: "order_batch",
    });
    expect(startSessionMock).not.toHaveBeenCalled();
    expect(ensureActiveTableSessionForDineInOrderMock).not.toHaveBeenCalled();
    expect(clearPaymentRequestAfterNewChildOrderBatchCreatedMock).toHaveBeenCalledWith({
      OrderModel,
      order: {
        _id: "delivery-1",
        restaurantId: "rest-1",
        orderType: "delivery",
        orderKind: "order_batch",
      },
      reason: "Thêm món mới sau khi khách yêu cầu thanh toán.",
    });
  });
});
