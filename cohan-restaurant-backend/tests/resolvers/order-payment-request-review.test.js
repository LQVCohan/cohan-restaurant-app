import { beforeEach, describe, expect, it, vi } from "vitest";

const emitOrderEventMock = vi.hoisted(() => vi.fn());
const findOneChainFactory = (value) => {
  const chain = {
    sort: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(value),
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
  },
  Invoice: { create: vi.fn().mockResolvedValue([{ _id: "inv-1" }]) },
  PaymentTransaction: { create: vi.fn().mockResolvedValue([{ _id: "trx-1" }]) },
  Cashflow: { create: vi.fn().mockResolvedValue([{ _id: "cf-1" }]) },
  EventLog: { log: vi.fn().mockResolvedValue(true) },
  Table: {
    findById: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "table-1", code: "T1", restaurantId: "65f000000000000000000099" }) }),
    updateOne: vi.fn().mockResolvedValue(true),
  },
  Restaurant: {},
  PaymentSession: {},
}));

vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => ({ emitOrderEvent: emitOrderEventMock }));
vi.mock("../../models/index.js", () => modelMocks);
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
      refRestaurants: ["65f000000000000000000099"],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.Order.find.mockReset();
    modelMocks.Order.findOne.mockReset();
    modelMocks.Order.updateMany.mockReset();
    modelMocks.Order.updateMany.mockResolvedValue({ acknowledged: true });
    modelMocks.Order.findOne.mockReturnValue(findOneChainFactory(null));
  });

  it("requestPaymentForOrder succeeds for fully served order", async () => {
    const { OrderMutation } = await import("../../graphql/resolvers/order/mutation.js");
    const order = orderDocFactory();
    modelMocks.Order.find.mockResolvedValue([order]);

    await OrderMutation.requestPaymentForOrder(
      null,
      { input: { restaurantId: "65f000000000000000000099", orderIds: ["65f000000000000000000001"] } },
      { user: { _id: "65f000000000000000000777" } },
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
      OrderMutation.requestPaymentForOrder(null, { input: { restaurantId: "65f000000000000000000099", orderIds: ["65f000000000000000000001"] } }, { user: { _id: "u1" } }),
    ).rejects.toThrow("Không thể yêu cầu thanh toán khi còn món chưa phục vụ xong.");
    expect(order.save).not.toHaveBeenCalled();
  });

  it("requestPaymentForOrder blocks when pending void/return exists", async () => {
    const { OrderMutation } = await import("../../graphql/resolvers/order/mutation.js");
    const order = orderDocFactory({ items: [{ status: "served", voidRequests: [{ status: "pending" }], returnRequests: [] }] });
    modelMocks.Order.find.mockResolvedValue([order]);

    await expect(
      OrderMutation.requestPaymentForOrder(null, { input: { restaurantId: "65f000000000000000000099", orderIds: ["65f000000000000000000001"] } }, { user: { _id: "u1" } }),
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
    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([childOrder]) });

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
    expect(out.orders[0]).toMatchObject({
      _id: "65f000000000000000000111",
      orderPaymentStatus: "payment_requested",
    });
    expect(out.requestedAt).toBeTruthy();
    expect(modelMocks.Order.updateMany).toHaveBeenCalledTimes(2);
    expect(modelMocks.Order.updateMany.mock.calls[0][1].$set["payment.status"]).toBe("payment_requested");
    expect(modelMocks.Order.updateMany.mock.calls[0][1].$set.orderPaymentStatus).toBe("payment_requested");
    expect(modelMocks.Order.updateMany.mock.calls[0][1].$set["payment.requestSource"]).toBe("customer_qr");
    expect(modelMocks.Order.updateMany.mock.calls[1][0]).toMatchObject({
      restaurantId: expect.anything(),
      orderKind: "table_session",
    });
    expect(modelMocks.Order.updateMany.mock.calls[1][1].$set.sessionStatus).toBe("ready_to_pay");
    expect(modelMocks.Order.updateMany.mock.calls[1][1].$set.orderPaymentStatus).toBe("payment_requested");
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
    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([preparingChild]) });

    const out = await requestTablePayment(
      null,
      { input: { restaurantId: "65f000000000000000000099", tableId: "table-1" } },
      AUTH_CONTEXT,
    );

    expect(out.ok).toBe(true);
    expect(out.warning).toBe(true);
    expect(out.readyForPayment).toBe(false);
    expect(out.pendingOrderCodes).toEqual(["ORD-122"]);
    expect(out.session).toMatchObject({ _id: "65f00000000000000000aa12" });
    expect(out.orders).toHaveLength(1);
    expect(out.requestedAt).toBeTruthy();
    expect(modelMocks.Order.updateMany).toHaveBeenCalledTimes(2);
  });

  it("requestTablePayment does not use legacy fallback when active session has no child orders", async () => {
    const { requestTablePayment } = await import("../../graphql/resolvers/payment/mutation.js");
    modelMocks.Order.findOne.mockReturnValueOnce(findOneChainFactory({ _id: "65f00000000000000000ab88" }));
    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) });

    const out = await requestTablePayment(
      null,
      { input: { restaurantId: "65f000000000000000000099", tableId: "table-1" } },
      AUTH_CONTEXT,
    );

    expect(out).toMatchObject({
      ok: false,
      warning: true,
      readyForPayment: false,
      pendingOrderCodes: [],
      orders: [],
      requestedAt: null,
    });
    expect(out.session).toMatchObject({ _id: "65f00000000000000000ab88" });
    expect(modelMocks.Order.updateMany).not.toHaveBeenCalled();
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

    await payOrdersByOrderIds(null, { input: { restaurantId: "65f000000000000000000099", orderIds: ["65f000000000000000000001"], method: "cash", note: "test" } }, { user: { id: "65f000000000000000000777", _id: "65f000000000000000000777", restaurantId: "65f000000000000000000099" } });

    expect(modelMocks.Order.updateMany).toHaveBeenCalled();
    const payload = modelMocks.Order.updateMany.mock.calls.at(-1)[1];
    expect(payload.$set["payment.status"]).toBe("paid");
    expect(payload.$set["payment.paidBy"]).toBeTruthy();
    expect(payload.$set["payment.paidAt"]).toBeTruthy();
    expect(payload.$set.currentStatus).toBe("completed");
    expect(payload.$push.statusTimeline.note).toBe("Đã thanh toán và hoàn tất đơn.");
    expect(emitOrderEventMock).toHaveBeenCalled();
  });

  it("payOrdersByTableId pays child orders from active parent session only", async () => {
    const { payOrdersByTableId } = await import("../../graphql/resolvers/payment/mutation.js");
    const servedOrder = {
      _id: "65f000000000000000000111",
      restaurantId: "65f000000000000000000099",
      tableId: "table-1",
      orderCode: "ORD-T1",
      currentStatus: "served",
      items: [{ status: "served", quantity: 1, lineSubtotal: 50000, unitPrice: 50000, dishId: "dish-1", name: "Món A", voidRequests: [], returnRequests: [] }],
      totals: { subtotal: 50000, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 50000 },
      parentOrderId: "65f00000000000000000aa11",
    };

    modelMocks.Order.findOne.mockReturnValueOnce(findOneChainFactory({ _id: "65f00000000000000000aa11" }));
    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([servedOrder]) }).mockResolvedValueOnce([servedOrder]);

    await expect(
      payOrdersByTableId(null, { input: { restaurantId: "65f000000000000000000099", tableId: "table-1", method: "cash", includeUnserved: true } }, { user: { id: "65f000000000000000000777", _id: "65f000000000000000000777", restaurantId: "65f000000000000000000099" } }),
    ).resolves.toBeTruthy();

    const listFilter = modelMocks.Order.find.mock.calls.at(0)[0];
    expect(listFilter.$and?.[0]).toMatchObject({
      restaurantId: expect.anything(),
      orderKind: "order_batch",
    });

    const childUpdate = modelMocks.Order.updateMany.mock.calls[0];
    expect(childUpdate[1].$push.statusTimeline.note).toBe("Đã thanh toán và hoàn tất đơn.");

    const parentUpdate = modelMocks.Order.updateMany.mock.calls[1];
    expect(parentUpdate[0]).toMatchObject({
      restaurantId: expect.anything(),
      orderKind: "table_session",
    });
    expect(parentUpdate[1].$set.sessionStatus).toBe("closed");
    expect(parentUpdate[1].$set.orderPaymentStatus).toBe("paid");
    expect(parentUpdate[1].$set.activeSessionKey).toBeNull();
    expect(parentUpdate[1].$set.currentStatus).toBe("completed");
    expect(parentUpdate[1].$set.closedAt).toBeTruthy();
    expect(emitOrderEventMock).toHaveBeenCalled();
  });

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

  it("requestPaymentForTable marks multiple active orders of same table as payment_requested", async () => {
    const { OrderMutation } = await import("../../graphql/resolvers/order/mutation.js");
    const orderA = orderDocFactory({ _id: "65f0000000000000000000a1", tableCode: "T1" });
    const orderB = orderDocFactory({ _id: "65f0000000000000000000a2", tableCode: "T1" });
    modelMocks.Order.find.mockResolvedValue([orderA, orderB]);

    await OrderMutation.requestPaymentForTable(
      null,
      { input: { restaurantId: "65f000000000000000000099", tableCode: "T1" } },
      { user: { _id: "65f000000000000000000777" } },
    );

    expect(orderA.payment.status).toBe("payment_requested");
    expect(orderB.payment.status).toBe("payment_requested");
    expect(orderA.save).toHaveBeenCalled();
    expect(orderB.save).toHaveBeenCalled();
  });

  it("payOrdersByTableId returns structured warning when any child item is confirmed", async () => {
    const { payOrdersByTableId } = await import("../../graphql/resolvers/payment/mutation.js");
    const blockedOrder = {
      _id: "65f000000000000000000121", restaurantId: "65f000000000000000000099", tableId: "table-1", currentStatus: "served",
      items: [{ status: "confirmed", quantity: 1, lineSubtotal: 10000, unitPrice: 10000, dishId: "dish-1", name: "Dish", voidRequests: [], returnRequests: [] }],
      totals: { subtotal: 10000, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 10000 },
    };
    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([blockedOrder]) });

    const out = await payOrdersByTableId(null, { input: { restaurantId: "65f000000000000000000099", tableId: "table-1", method: "cash" } }, AUTH_CONTEXT);
    expect(out.warning).toBe(true);
    expect(out.pendingOrderCodes).toEqual(["65f000000000000000000121"]);
    expect(out.invoice).toBeNull();
    expect(modelMocks.Order.updateMany).not.toHaveBeenCalled();
  });

  it("payOrdersByTableId returns structured warning when pending void request exists", async () => {
    const { payOrdersByTableId } = await import("../../graphql/resolvers/payment/mutation.js");
    const blockedOrder = {
      _id: "65f000000000000000000122", restaurantId: "65f000000000000000000099", tableId: "table-1", currentStatus: "served",
      items: [{ status: "served", quantity: 1, lineSubtotal: 10000, unitPrice: 10000, dishId: "dish-1", name: "Dish", voidRequests: [{ status: "pending" }], returnRequests: [] }],
      totals: { subtotal: 10000, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 10000 },
    };
    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([blockedOrder]) });

    const out = await payOrdersByTableId(null, { input: { restaurantId: "65f000000000000000000099", tableId: "table-1", method: "cash" } }, AUTH_CONTEXT);
    expect(out.warning).toBe(true);
    expect(out.pendingOrderCodes).toEqual(["65f000000000000000000122"]);
    expect(out.invoice).toBeNull();
    expect(modelMocks.Order.updateMany).not.toHaveBeenCalled();
  });

  it("payOrdersByTableId returns structured warning when pending return request exists", async () => {
    const { payOrdersByTableId } = await import("../../graphql/resolvers/payment/mutation.js");
    const blockedOrder = {
      _id: "65f000000000000000000123", restaurantId: "65f000000000000000000099", tableId: "table-1", currentStatus: "served",
      items: [{ status: "served", quantity: 1, lineSubtotal: 10000, unitPrice: 10000, dishId: "dish-1", name: "Dish", voidRequests: [], returnRequests: [{ status: "pending" }] }],
      totals: { subtotal: 10000, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 10000 },
    };
    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([blockedOrder]) });

    const out = await payOrdersByTableId(null, { input: { restaurantId: "65f000000000000000000099", tableId: "table-1", method: "cash" } }, AUTH_CONTEXT);
    expect(out.warning).toBe(true);
    expect(out.pendingOrderCodes).toEqual(["65f000000000000000000123"]);
    expect(out.invoice).toBeNull();
    expect(modelMocks.Order.updateMany).not.toHaveBeenCalled();
  });

  it("payOrdersByTableId applies deterministic sort when finding active session", async () => {
    const { payOrdersByTableId } = await import("../../graphql/resolvers/payment/mutation.js");
    const findOneChain = findOneChainFactory({ _id: "65f00000000000000000aa99" });
    modelMocks.Order.findOne.mockReturnValueOnce(findOneChain);
    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) }).mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) });

    const out = await payOrdersByTableId(null, { input: { restaurantId: "65f000000000000000000099", tableId: "table-1", method: "cash" } }, AUTH_CONTEXT);
    expect(findOneChain.sort).toHaveBeenCalledWith({ openedAt: -1, createdAt: -1, _id: -1 });
    expect(out.warning).toBe(true);
  });

  it("payOrdersByTableId falls back to legacy table orders and closes derived parent sessions only", async () => {
    const { payOrdersByTableId } = await import("../../graphql/resolvers/payment/mutation.js");
    const legacyOrder = {
      _id: "65f000000000000000000188", restaurantId: "65f000000000000000000099", orderCode: "LEG-188", currentStatus: "served",
      parentOrderId: "65f00000000000000000cc88",
      items: [{ status: "served", quantity: 1, lineSubtotal: 12000, unitPrice: 12000, dishId: "d8", name: "Legacy", voidRequests: [], returnRequests: [] }],
      totals: { subtotal: 12000, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 12000 },
    };
    modelMocks.Order.findOne.mockReturnValueOnce(findOneChainFactory({ _id: "65f00000000000000000ab88" }));
    modelMocks.Order.find
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([legacyOrder]) })
      .mockResolvedValueOnce([legacyOrder]);

    const out = await payOrdersByTableId(null, { input: { restaurantId: "65f000000000000000000099", tableId: "table-1", method: "cash", includeUnserved: false } }, AUTH_CONTEXT);
    expect(out.warning).toBe(false);
    expect(out.invoice).toBeTruthy();
    expect(modelMocks.Order.updateMany).toHaveBeenCalledTimes(2);
    expect(modelMocks.Order.updateMany.mock.calls[1][0]).toMatchObject({
      orderKind: "table_session",
    });
    expect(modelMocks.Order.updateMany.mock.calls[1][0]._id.$in.map(String)).toEqual(["65f00000000000000000cc88"]);
  });

  it("payOrdersByTableId does not close unrelated active session during legacy fallback without parent refs", async () => {
    const { payOrdersByTableId } = await import("../../graphql/resolvers/payment/mutation.js");
    const legacyOrder = {
      _id: "65f000000000000000000189", restaurantId: "65f000000000000000000099", orderCode: "LEG-189", currentStatus: "served",
      items: [{ status: "served", quantity: 1, lineSubtotal: 9000, unitPrice: 9000, dishId: "d9", name: "Legacy 2", voidRequests: [], returnRequests: [] }],
      totals: { subtotal: 9000, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 9000 },
    };
    modelMocks.Order.findOne.mockReturnValueOnce(findOneChainFactory({ _id: "65f00000000000000000ab89" }));
    modelMocks.Order.find
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([legacyOrder]) })
      .mockResolvedValueOnce([legacyOrder]);

    const out = await payOrdersByTableId(null, { input: { restaurantId: "65f000000000000000000099", tableId: "table-1", method: "cash", includeUnserved: true } }, AUTH_CONTEXT);
    expect(out.warning).toBe(false);
    expect(out.invoice).toBeTruthy();
    expect(modelMocks.Order.updateMany).toHaveBeenCalledTimes(1);
  });

  it("payOrdersByTableId returns warning when both child and legacy fallback orders are empty", async () => {
    const { payOrdersByTableId } = await import("../../graphql/resolvers/payment/mutation.js");
    modelMocks.Order.findOne.mockReturnValueOnce(findOneChainFactory({ _id: "65f00000000000000000ab89" }));
    modelMocks.Order.find
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) });

    const out = await payOrdersByTableId(null, { input: { restaurantId: "65f000000000000000000099", tableId: "table-1", method: "cash" } }, AUTH_CONTEXT);
    expect(out).toMatchObject({
      warning: true,
      pendingOrderCodes: [],
      invoice: null,
      transaction: null,
      cashflow: null,
    });
    expect(modelMocks.Order.updateMany).not.toHaveBeenCalled();
  });

  it("payOrdersByTableId completes multiple served orders on same table", async () => {
    const { payOrdersByTableId } = await import("../../graphql/resolvers/payment/mutation.js");
    const order1 = { _id: "65f000000000000000000131", restaurantId: "65f000000000000000000099", tableId: "table-1", orderCode: "ORD-1", currentStatus: "served", items: [{ status: "served", quantity: 1, lineSubtotal: 30000, unitPrice: 30000, dishId: "d1", name: "A", voidRequests: [], returnRequests: [] }], totals: { subtotal: 30000, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 30000 } };
    const order2 = { _id: "65f000000000000000000132", restaurantId: "65f000000000000000000099", tableId: "table-1", orderCode: "ORD-2", currentStatus: "served", items: [{ status: "served", quantity: 1, lineSubtotal: 20000, unitPrice: 20000, dishId: "d2", name: "B", voidRequests: [], returnRequests: [] }], totals: { subtotal: 20000, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 20000 } };
    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([order1, order2]) }).mockResolvedValueOnce([order1, order2]);

    const out = await payOrdersByTableId(null, { input: { restaurantId: "65f000000000000000000099", tableId: "table-1", method: "cash", includeUnserved: true } }, AUTH_CONTEXT);

    expect(out?.invoice).toBeTruthy();
    expect(modelMocks.Order.updateMany).toHaveBeenCalled();
    const filter = modelMocks.Order.updateMany.mock.calls.at(-1)[0];
    expect(filter._id.$in).toHaveLength(2);
  });

  it("payOrdersByTableId does not close parent session when unserved orders are excluded", async () => {
    const { payOrdersByTableId } = await import("../../graphql/resolvers/payment/mutation.js");
    const servedOrder = {
      _id: "65f000000000000000000151", restaurantId: "65f000000000000000000099", tableId: "table-1", orderCode: "ORD-S", currentStatus: "served",
      parentOrderId: "65f00000000000000000bb11",
      items: [{ status: "served", quantity: 1, lineSubtotal: 30000, unitPrice: 30000, dishId: "d1", name: "A", voidRequests: [], returnRequests: [] }],
      totals: { subtotal: 30000, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 30000 },
    };
    const unservedOrder = {
      _id: "65f000000000000000000152", restaurantId: "65f000000000000000000099", tableId: "table-1", orderCode: "ORD-U", currentStatus: "pending",
      parentOrderId: "65f00000000000000000bb11",
      items: [{ status: "served", quantity: 1, lineSubtotal: 10000, unitPrice: 10000, dishId: "d2", name: "B", voidRequests: [], returnRequests: [] }],
      totals: { subtotal: 10000, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 10000 },
    };

    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([servedOrder, unservedOrder]) }).mockResolvedValueOnce([servedOrder]);

    const out = await payOrdersByTableId(null, { input: { restaurantId: "65f000000000000000000099", tableId: "table-1", method: "cash", includeUnserved: false } }, AUTH_CONTEXT);

    expect(out.warning).toBe(true);
    expect(modelMocks.Order.updateMany).not.toHaveBeenCalled();
  });

  it("payOrdersByOrderIds applies orderBatchOrLegacyFilter", async () => {
    const { payOrdersByOrderIds } = await import("../../graphql/resolvers/payment/mutation.js");
    const paidOrder = {
      _id: "65f000000000000000000161", restaurantId: "65f000000000000000000099", orderCode: "ORD-161", currentStatus: "served",
      items: [{ status: "served", quantity: 1, lineSubtotal: 20000, unitPrice: 20000, dishId: "d3", name: "C", voidRequests: [], returnRequests: [] }],
      totals: { subtotal: 20000, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 20000 },
      payment: { status: "payment_requested" },
    };
    modelMocks.Order.find
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([paidOrder]) })
      .mockResolvedValueOnce([paidOrder]);

    await payOrdersByOrderIds(null, { input: { restaurantId: "65f000000000000000000099", orderIds: ["65f000000000000000000161"], method: "cash" } }, AUTH_CONTEXT);

    const listFilter = modelMocks.Order.find.mock.calls.at(0)[0];
    expect(listFilter.$or).toEqual([
      { orderKind: "order_batch" },
      { orderKind: { $exists: false } },
      { orderKind: null },
    ]);
  });

  it("payOrdersByOrderIds succeeds for off-premise order without real tableCode", async () => {
    const { payOrdersByOrderIds } = await import("../../graphql/resolvers/payment/mutation.js");
    const offPremiseOrder = {
      _id: "65f000000000000000000141", restaurantId: "65f000000000000000000099", orderCode: "TAKE-1", tableCode: null, orderType: "takeaway", currentStatus: "served",
      items: [{ status: "served", quantity: 1, lineSubtotal: 40000, unitPrice: 40000, dishId: "d3", name: "C", voidRequests: [], returnRequests: [] }],
      totals: { subtotal: 40000, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 40000 }, payment: { status: "payment_requested" },
    };
    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([offPremiseOrder]) }).mockResolvedValueOnce([offPremiseOrder]);

    const out = await payOrdersByOrderIds(null, { input: { restaurantId: "65f000000000000000000099", orderIds: ["65f000000000000000000141"], method: "cash" } }, AUTH_CONTEXT);

    expect(out?.invoice).toBeTruthy();
    expect(modelMocks.Table.updateOne).not.toHaveBeenCalled();
    expect(modelMocks.Order.updateMany).toHaveBeenCalled();
  });
});
