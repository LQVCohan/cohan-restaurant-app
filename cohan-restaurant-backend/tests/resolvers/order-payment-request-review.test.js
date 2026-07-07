import { beforeEach, describe, expect, it, vi } from "vitest";

const restaurantScopeMocks = vi.hoisted(() => ({
  canAccessRestaurant: vi.fn(async () => true),
}));
const emitOrderEventMock = vi.hoisted(() => vi.fn());
const findOneChainFactory = (value) => {
  const chain = {
    sort: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(value),
    session: vi.fn().mockReturnThis(),
  };
  return chain;
};

const orderDocFactory = (overrides = {}) => ({
  _id: "65f000000000000000000001",
  restaurantId: "65f000000000000000000099",
  currentStatus: "served",
  items: [{ status: "served", voidRequests: [], returnRequests: [] }],
  payment: { status: "pending" },
  statusTimeline: [],
  save: vi.fn().mockResolvedValue(true),
  ...overrides,
});

const modelMocks = vi.hoisted(() => ({
  Order: {
    find: vi.fn(),
    findOne: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ acknowledged: true }),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  },
  Invoice: { create: vi.fn().mockResolvedValue([{ _id: "inv-1" }]) },
  PaymentTransaction: { create: vi.fn().mockResolvedValue([{ _id: "trx-1" }]) },
  Cashflow: { create: vi.fn().mockResolvedValue([{ _id: "cf-1" }]) },
  EventLog: { log: vi.fn().mockResolvedValue(true) },
  Table: {
    findById: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "table-1", code: "T1", restaurantId: "65f000000000000000000099" }) }),
    updateOne: vi.fn().mockResolvedValue(true),
  },
  Restaurant: { exists: vi.fn() },
  PaymentSession: {},
}));

vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => ({ emitOrderEvent: emitOrderEventMock }));
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", async (importOriginal) => ({
  ...(await importOriginal()),
  canAccessRestaurant: restaurantScopeMocks.canAccessRestaurant,
}));
vi.mock("../../utils/generateInvoiceNumber.ts", () => ({ generateInvoiceNumber: vi.fn().mockResolvedValue("INV-001") }));
vi.mock("../../src/services/payment/paymentSession.service.js", () => ({ createReservationPayment: vi.fn() }));
vi.mock("mongoose", () => {
  const startSession = vi.fn(async () => ({
    startTransaction: vi.fn(),
    commitTransaction: vi.fn().mockResolvedValue(true),
    abortTransaction: vi.fn().mockResolvedValue(true),
    endSession: vi.fn(),
  }));
  return {
    default: {
      isValidObjectId: vi.fn(() => true),
      Types: { ObjectId: function ObjectId(v) { this.value = v; this.toString = () => String(v); } },
    },
    startSession,
  };
});

describe("payment request + confirm guards", () => {
  const AUTH_CONTEXT = {
    user: {
      id: "65f000000000000000000777",
      _id: "65f000000000000000000777",
      roles: ["manager"],
      roleName: "manager",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    restaurantScopeMocks.canAccessRestaurant.mockResolvedValue(true);
    modelMocks.Order.find.mockReset();
    modelMocks.Order.findOne.mockReset();
    modelMocks.Order.updateMany.mockReset();
    modelMocks.Order.updateOne.mockReset();
    modelMocks.Order.updateMany.mockResolvedValue({ acknowledged: true });
    modelMocks.Order.updateOne.mockResolvedValue({ acknowledged: true });
    modelMocks.Restaurant.exists.mockResolvedValue(true);
    modelMocks.Order.findOne.mockReturnValue(findOneChainFactory(null));
  });

  it("requestPaymentForOrder succeeds for fully served order", async () => {
    const { OrderMutation } = await import("../../graphql/resolvers/order/mutation.js");
    const order = orderDocFactory();
    modelMocks.Order.find.mockResolvedValue([order]);

    await OrderMutation.requestPaymentForOrder(
      null,
      { input: { restaurantId: "65f000000000000000000099", orderIds: ["65f000000000000000000001"] } },
      AUTH_CONTEXT,
    );

    expect(order.payment.status).toBe("payment_requested");
    expect(order.payment.requestedAt).toBeTruthy();
    expect(order.payment.requestedBy).toBeTruthy();
    expect(order.statusTimeline.at(-1)?.note).toBe("Nhân viên yêu cầu thanh toán.");
    expect(order.save).toHaveBeenCalled();
    expect(emitOrderEventMock).toHaveBeenCalled();
  });

  it("requestPaymentForOrder blocks when unfinished item exists", async () => {
    const { OrderMutation } = await import("../../graphql/resolvers/order/mutation.js");
    const order = orderDocFactory({ items: [{ status: "preparing", voidRequests: [], returnRequests: [] }] });
    modelMocks.Order.find.mockResolvedValue([order]);

    await expect(
      OrderMutation.requestPaymentForOrder(null, { input: { restaurantId: "65f000000000000000000099", orderIds: ["65f000000000000000000001"] } }, AUTH_CONTEXT),
    ).rejects.toThrow("Không thể yêu cầu thanh toán khi còn món chưa phục vụ xong.");
    expect(order.save).not.toHaveBeenCalled();
  });

  it("requestPaymentForOrder blocks when pending void/return exists", async () => {
    const { OrderMutation } = await import("../../graphql/resolvers/order/mutation.js");
    const order = orderDocFactory({ items: [{ status: "served", voidRequests: [{ status: "pending" }], returnRequests: [] }] });
    modelMocks.Order.find.mockResolvedValue([order]);

    await expect(
      OrderMutation.requestPaymentForOrder(null, { input: { restaurantId: "65f000000000000000000099", orderIds: ["65f000000000000000000001"] } }, AUTH_CONTEXT),
    ).rejects.toThrow("Không thể yêu cầu thanh toán khi còn yêu cầu hủy/trả món đang chờ duyệt.");
    expect(order.save).not.toHaveBeenCalled();
  });

  it("requestTablePayment marks active parent session and child batches as payment_requested and returns detailed readiness payload", async () => {
    const { requestTablePayment } = await import("../../graphql/resolvers/payment/mutation.js");
    const activeSession = { _id: "65f00000000000000000aa10", currentStatus: "served" };
    const childOrder = {
      _id: "65f000000000000000000111",
      restaurantId: "65f000000000000000000099",
      currentStatus: "served",
      orderKind: "order_batch",
      parentOrderId: "65f00000000000000000aa10",
      orderCode: "ORD-111",
      payment: { status: "pending" },
    };

    modelMocks.Order.findOne.mockReturnValueOnce(findOneChainFactory(activeSession));
    modelMocks.Order.find.mockReturnValueOnce({ sort: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([childOrder]) });

    const out = await requestTablePayment(
      null,
      {
        input: {
          restaurantId: "65f000000000000000000099",
          tableId: "table-1",
          source: "customer_qr",
          requestedBy: "65f000000000000000000999",
          note: "please bring card machine",
        },
      },
      AUTH_CONTEXT,
    );

    expect(out.ok).toBe(true);
    expect(out.warning).toBe(false);
    expect(out.readyForPayment).toBe(true);
    expect(out.pendingOrderCodes).toEqual([]);
    expect(out.session).toMatchObject({
      _id: "65f00000000000000000aa10",
      sessionStatus: "ready_to_pay",
      orderPaymentStatus: "payment_requested",
    });
    expect(out.orders).toHaveLength(1);
    expect(out.requestedAt).toBeTruthy();
    expect(modelMocks.Order.updateMany).toHaveBeenCalledTimes(2);
  });

  it("requestTablePayment returns warning details when child orders are not ready yet", async () => {
    const { requestTablePayment } = await import("../../graphql/resolvers/payment/mutation.js");
    const activeSession = { _id: "65f00000000000000000aa12", currentStatus: "served" };
    const preparingChild = {
      _id: "65f000000000000000000122",
      restaurantId: "65f000000000000000000099",
      currentStatus: "preparing",
      orderKind: "order_batch",
      parentOrderId: "65f00000000000000000aa12",
      orderCode: "ORD-122",
      items: [{ status: "preparing", voidRequests: [], returnRequests: [] }],
      payment: { status: "pending" },
    };

    modelMocks.Order.findOne.mockReturnValueOnce(findOneChainFactory(activeSession));
    modelMocks.Order.find.mockReturnValueOnce({ sort: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([preparingChild]) });

    const out = await requestTablePayment(
      null,
      { input: { restaurantId: "65f000000000000000000099", tableId: "table-1" } },
      AUTH_CONTEXT,
    );

    expect(out.ok).toBe(true);
    expect(out.warning).toBe(true);
    expect(out.readyForPayment).toBe(false);
    expect(out.pendingOrderCodes).toEqual(["ORD-122"]);
    expect(out.requestedAt).toBeTruthy();
  });

  it("clearTablePaymentRequest clears parent and active child payment_requested fields", async () => {
    const { clearTablePaymentRequest } = await import("../../graphql/resolvers/payment/mutation.js");
    const activeSession = {
      _id: "65f00000000000000000bb10",
      restaurantId: "65f000000000000000000099",
      sessionStatus: "ready_to_pay",
      payment: { status: "payment_requested" },
    };
    const updatedSession = {
      _id: "65f00000000000000000bb10",
      sessionStatus: "dining",
      payment: { status: "pending", requestClearReason: "manual" },
    };
    const updatedOrders = [
      {
        _id: "65f000000000000000000211",
        currentStatus: "served",
        payment: { status: "pending" },
      },
    ];

    modelMocks.Order.findOne
      .mockReturnValueOnce(findOneChainFactory(activeSession))
      .mockReturnValueOnce(findOneChainFactory(updatedSession));
    modelMocks.Order.find.mockReturnValueOnce({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(updatedOrders),
      session: vi.fn().mockReturnThis(),
    });

    const out = await clearTablePaymentRequest(
      null,
      {
        input: {
          restaurantId: "65f000000000000000000099",
          tableId: "table-1",
          reason: "manual",
        },
      },
      AUTH_CONTEXT,
    );

    expect(out.ok).toBe(true);
    expect(out.session).toEqual(updatedSession);
    expect(out.orders).toEqual(updatedOrders);
    expect(modelMocks.Order.updateMany).toHaveBeenCalledTimes(1);
    expect(modelMocks.Order.updateOne).toHaveBeenCalledTimes(1);
    expect(modelMocks.Order.updateOne.mock.calls[0][1].$set.sessionStatus).toBe("dining");
    expect(modelMocks.Order.updateOne.mock.calls[0][1].$set["payment.status"]).toBe("pending");
  });

  it("clearTablePaymentRequest does not touch paid completed cancelled failed children via filter", async () => {
    const { clearTablePaymentRequest } = await import("../../graphql/resolvers/payment/mutation.js");
    const activeSession = {
      _id: "65f00000000000000000bb11",
      restaurantId: "65f000000000000000000099",
      sessionStatus: "ready_to_pay",
      payment: { status: "payment_requested" },
    };

    modelMocks.Order.findOne
      .mockReturnValueOnce(findOneChainFactory(activeSession))
      .mockReturnValueOnce(findOneChainFactory(activeSession));
    modelMocks.Order.find.mockReturnValueOnce({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
      session: vi.fn().mockReturnThis(),
    });

    await clearTablePaymentRequest(
      null,
      { input: { restaurantId: "65f000000000000000000099", tableId: "table-1" } },
      AUTH_CONTEXT,
    );

    expect(modelMocks.Order.updateMany.mock.calls[0][0].$and[1]).toMatchObject({
      currentStatus: { $nin: ["completed", "cancelled", "failed"] },
      orderPaymentStatus: { $ne: "paid" },
    });
  });

  it("payOrdersByOrderIds succeeds and sets paid status with authenticated actor context", async () => {
    const { payOrdersByOrderIds } = await import("../../graphql/resolvers/payment/mutation.js");
    const paidOrder = {
      _id: "65f000000000000000000001",
      restaurantId: "65f000000000000000000099",
      orderCode: "ORD-001",
      currentStatus: "served",
      items: [{ status: "served", quantity: 1, lineSubtotal: 100000, unitPrice: 100000, dishId: "dish-1", name: "Món test", voidRequests: [], returnRequests: [] }],
      totals: { subtotal: 100000, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 100000 },
      payment: { status: "payment_requested" },
    };

    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([paidOrder]) }).mockResolvedValueOnce([paidOrder]);

    await payOrdersByOrderIds(null, { input: { restaurantId: "65f000000000000000000099", orderIds: ["65f000000000000000000001"], method: "cash", note: "test" } }, AUTH_CONTEXT);

    expect(modelMocks.Order.updateMany).toHaveBeenCalled();
    const payload = modelMocks.Order.updateMany.mock.calls.at(-1)[1];
    expect(payload.$set["payment.status"]).toBe("paid");
    expect(payload.$set["payment.paidBy"]).toBeTruthy();
    expect(payload.$set["payment.paidAt"]).toBeTruthy();
    expect(payload.$set.currentStatus).toBe("completed");
    expect(payload.$push.statusTimeline.note).toBe("Đã thanh toán và hoàn tất đơn.");
    expect(emitOrderEventMock).toHaveBeenCalled();
  });

  it.each(["delivery", "takeaway"])(
    "payOrdersByOrderIds for %s does not touch table lifecycle models",
    async (orderType) => {
      const { payOrdersByOrderIds } = await import("../../graphql/resolvers/payment/mutation.js");
      const offPremiseOrder = {
        _id: `65f0000000000000000003${orderType === "delivery" ? "01" : "02"}`,
        restaurantId: "65f000000000000000000099",
        orderCode: orderType === "delivery" ? "SHIP-301" : "TAKE-302",
        orderType,
        tableId: null,
        tableCode: null,
        currentStatus: "served",
        items: [{ status: "served", quantity: 1, lineSubtotal: 120000, unitPrice: 120000, dishId: "dish-ship-1", name: "Ship dish", voidRequests: [], returnRequests: [] }],
        totals: { subtotal: 120000, discount: 0, tax: 0, service: 0, shippingFee: 15000, grandTotal: 135000 },
        payment: { status: "payment_requested" },
      };

      modelMocks.Order.find
        .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([offPremiseOrder]) })
        .mockResolvedValueOnce([offPremiseOrder]);

      const out = await payOrdersByOrderIds(
        null,
        {
          input: {
            restaurantId: "65f000000000000000000099",
            orderIds: [offPremiseOrder._id],
            method: "cash",
          },
        },
        AUTH_CONTEXT,
      );

      expect(modelMocks.Table.findById).not.toHaveBeenCalled();
      expect(modelMocks.Table.updateOne).not.toHaveBeenCalled();
      expect(modelMocks.Order.updateMany).toHaveBeenCalled();

      const payload = modelMocks.Order.updateMany.mock.calls.at(-1)[1];
      expect(payload.$set["payment.status"]).toBe("paid");
      expect(payload.$set.currentStatus).toBe("completed");
      expect(payload.$push.statusTimeline.note).toBe("Đã thanh toán và hoàn tất đơn.");
      expect(out?.invoice).toBeTruthy();
    },
  );

  it.each([
    ["delivery", "failed"],
    ["delivery", "cancelled"],
    ["takeaway", "failed"],
    ["takeaway", "cancelled"],
  ])(
    "payOrdersByOrderIds ignores %s order when payment/current status is %s",
    async (orderType, terminalStatus) => {
      const { payOrdersByOrderIds } = await import("../../graphql/resolvers/payment/mutation.js");
      const orderId = `65f0000000000000000004${orderType === "delivery" ? "01" : "02"}`;
      const terminalOrder = {
        _id: orderId,
        id: orderId,
        restaurantId: "65f000000000000000000099",
        orderType,
        tableId: null,
        tableCode: null,
        currentStatus: terminalStatus,
        payment: { status: terminalStatus },
        items: [{ status: "served", quantity: 1, lineSubtotal: 100000, unitPrice: 100000, dishId: "dish-terminal-1", name: "Terminal dish", voidRequests: [], returnRequests: [] }],
        totals: { grandTotal: 100000 },
        code: `OFF-${orderType}-${terminalStatus}`,
      };

      modelMocks.Order.find.mockImplementationOnce((filter) => ({
        lean: vi.fn().mockResolvedValue(
          filter.currentStatus?.$nin?.includes(terminalOrder.currentStatus)
            ? []
            : [terminalOrder],
        ),
      }));

      const out = await payOrdersByOrderIds(
        null,
        {
          input: {
            restaurantId: "65f000000000000000000099",
            orderIds: [orderId],
            method: "cash",
          },
        },
        AUTH_CONTEXT,
      );

      const orderFindFilter = modelMocks.Order.find.mock.calls[0][0];
      expect(orderFindFilter.currentStatus).toEqual({ $nin: ["completed", "cancelled", "failed"] });
      expect(orderFindFilter.currentStatus.$nin).toContain(terminalStatus);
      expect(orderFindFilter._id.$in.map(String)).toContain(orderId);
      expect(orderFindFilter.restaurantId.toString()).toBe("65f000000000000000000099");
      expect(terminalOrder.currentStatus).toBe(terminalStatus);
      expect(orderFindFilter.currentStatus.$nin.includes(terminalOrder.currentStatus)).toBe(true);
      expect(out).toEqual({
        warning: true,
        pendingOrderCodes: [],
        invoice: null,
        transaction: null,
        cashflow: null,
      });
      expect(modelMocks.Order.updateMany).not.toHaveBeenCalled();
      expect(modelMocks.Table.findById).not.toHaveBeenCalled();
      expect(modelMocks.Table.updateOne).not.toHaveBeenCalled();
    },
  );

  it("payOrdersByTableId returns warning for unserved child with active parent and does not close parent", async () => {
    const { payOrdersByTableId } = await import("../../graphql/resolvers/payment/mutation.js");
    const unservedChild = {
      _id: "65f000000000000000000131", restaurantId: "65f000000000000000000099", orderKind: "order_batch", orderCode: "ORD-C1", currentStatus: "preparing",
      items: [{ status: "served", quantity: 1, lineSubtotal: 10000, unitPrice: 10000, dishId: "dish-1", name: "Dish", voidRequests: [], returnRequests: [] }],
    };
    modelMocks.Order.findOne.mockReturnValueOnce(findOneChainFactory({ _id: "65f00000000000000000aa12" }));
    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([unservedChild]) });
    const out = await payOrdersByTableId(null, { input: { restaurantId: "65f000000000000000000099", tableId: "table-1", method: "cash", includeUnserved: false } }, AUTH_CONTEXT);
    expect(out.warning).toBe(true);
    expect(out.pendingOrderCodes).toEqual(["ORD-C1"]);
    expect(out.invoice).toBeNull();
    expect(modelMocks.Order.updateMany).not.toHaveBeenCalled();
  });
});
