import { beforeEach, describe, expect, it, vi } from "vitest";

const emitOrderEventMock = vi.hoisted(() => vi.fn());

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

  it("payOrdersByTableId does not reference undefined activeOrderIds", async () => {
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

    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([servedOrder]) }).mockResolvedValueOnce([servedOrder]);

    await expect(
      payOrdersByTableId(null, { input: { restaurantId: "65f000000000000000000099", tableId: "table-1", method: "cash", includeUnserved: true } }, { user: { id: "65f000000000000000000777", _id: "65f000000000000000000777", restaurantId: "65f000000000000000000099" } }),
    ).resolves.toBeTruthy();

    const listFilter = modelMocks.Order.find.mock.calls.at(0)[0];
    expect(listFilter.$or).toEqual([
      { orderKind: "order_batch" },
      { orderKind: { $exists: false } },
      { orderKind: null },
    ]);

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

  it("payOrdersByTableId blocks when any order item is confirmed", async () => {
    const { payOrdersByTableId } = await import("../../graphql/resolvers/payment/mutation.js");
    const blockedOrder = {
      _id: "65f000000000000000000121", restaurantId: "65f000000000000000000099", tableId: "table-1", currentStatus: "served",
      items: [{ status: "confirmed", quantity: 1, lineSubtotal: 10000, unitPrice: 10000, dishId: "dish-1", name: "Dish", voidRequests: [], returnRequests: [] }],
      totals: { subtotal: 10000, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 10000 },
    };
    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([blockedOrder]) });

    await expect(payOrdersByTableId(null, { input: { restaurantId: "65f000000000000000000099", tableId: "table-1", method: "cash" } }, AUTH_CONTEXT))
      .rejects.toThrow("Không thể thanh toán khi còn món chưa phục vụ xong.");
  });

  it("payOrdersByTableId blocks when pending void request exists", async () => {
    const { payOrdersByTableId } = await import("../../graphql/resolvers/payment/mutation.js");
    const blockedOrder = {
      _id: "65f000000000000000000122", restaurantId: "65f000000000000000000099", tableId: "table-1", currentStatus: "served",
      items: [{ status: "served", quantity: 1, lineSubtotal: 10000, unitPrice: 10000, dishId: "dish-1", name: "Dish", voidRequests: [{ status: "pending" }], returnRequests: [] }],
      totals: { subtotal: 10000, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 10000 },
    };
    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([blockedOrder]) });

    await expect(payOrdersByTableId(null, { input: { restaurantId: "65f000000000000000000099", tableId: "table-1", method: "cash" } }, AUTH_CONTEXT))
      .rejects.toThrow("Không thể thanh toán khi còn yêu cầu hủy/trả món đang chờ duyệt.");
  });

  it("payOrdersByTableId blocks when pending return request exists", async () => {
    const { payOrdersByTableId } = await import("../../graphql/resolvers/payment/mutation.js");
    const blockedOrder = {
      _id: "65f000000000000000000123", restaurantId: "65f000000000000000000099", tableId: "table-1", currentStatus: "served",
      items: [{ status: "served", quantity: 1, lineSubtotal: 10000, unitPrice: 10000, dishId: "dish-1", name: "Dish", voidRequests: [], returnRequests: [{ status: "pending" }] }],
      totals: { subtotal: 10000, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 10000 },
    };
    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([blockedOrder]) });

    await expect(payOrdersByTableId(null, { input: { restaurantId: "65f000000000000000000099", tableId: "table-1", method: "cash" } }, AUTH_CONTEXT))
      .rejects.toThrow("Không thể thanh toán khi còn yêu cầu hủy/trả món đang chờ duyệt.");
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
    expect(modelMocks.Order.updateMany).toHaveBeenCalledTimes(1);
  });

  it("payOrdersByOrderIds applies orderBatchOrLegacyFilter", async () => {
    const { payOrdersByOrderIds } = await import("../../graphql/resolvers/payment/mutation.js");
    const paidOrder = {
      _id: "65f000000000000000000161", restaurantId: "65f000000000000000000099", orderCode: "ORD-161", currentStatus: "served",
      items: [{ status: "served", quantity: 1, lineSubtotal: 20000, unitPrice: 20000, dishId: "d3", name: "C", voidRequests: [], returnRequests: [] }],
      totals: { subtotal: 20000, discount: 0, tax: 0, service: 0, shippingFee: 0, grandTotal: 20000 },
      payment: { status: "payment_requested" },
    };
    modelMocks.Order.find.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([paidOrder]) }).mockResolvedValueOnce([paidOrder]);

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
