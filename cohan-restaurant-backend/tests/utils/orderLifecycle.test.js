import { describe, expect, it, vi } from "vitest";
import {
  ORDER_KIND,
  ORDER_PAYMENT_STATUS,
  SESSION_STATUS,
  activeTableSessionLookupFilter,
  autoClearPaymentRequestForNewChildOrder,
  buildActiveTableSessionKey,
  buildClearPaymentRequestUpdate,
  childOrdersForSessionFilter,
  clearTablePaymentRequestState,
  isKitchenPayable,
  isOrderBatch,
  isPaymentClosed,
  isSessionActive,
  isTableSession,
  orderBatchOrLegacyFilter,
  resolveSessionStatusAfterClearingPaymentRequest,
  withOrderBatchOrLegacyFilter,
} from "../../utils/orderLifecycle.js";

function queryChain(value) {
  return {
    session: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(value),
  };
}

describe("orderLifecycle helpers", () => {
  it("isTableSession returns true for orderKind='table_session'", () => {
    expect(isTableSession({ orderKind: "table_session" })).toBe(true);
  });

  it("isOrderBatch returns true for missing orderKind for legacy orders", () => {
    expect(isOrderBatch({})).toBe(true);
  });

  it("isSessionActive returns true for open/dining/ready_to_pay table_session", () => {
    expect(
      isSessionActive({ orderKind: "table_session", sessionStatus: "open" }),
    ).toBe(true);
    expect(
      isSessionActive({ orderKind: "table_session", sessionStatus: "dining" }),
    ).toBe(true);
    expect(
      isSessionActive({
        orderKind: "table_session",
        sessionStatus: "ready_to_pay",
      }),
    ).toBe(true);
  });

  it("isPaymentClosed returns true for orderPaymentStatus='paid'", () => {
    expect(isPaymentClosed({ orderPaymentStatus: "paid" })).toBe(true);
  });

  it("isPaymentClosed falls back when orderPaymentStatus is 'unpaid' and payment.status is 'paid'", () => {
    expect(
      isPaymentClosed({ orderPaymentStatus: "unpaid", payment: { status: "paid" } }),
    ).toBe(true);
  });

  it("isPaymentClosed falls back when orderPaymentStatus is missing and payment.status is 'paid'", () => {
    expect(isPaymentClosed({ payment: { status: "paid" } })).toBe(true);
  });

  it("isPaymentClosed returns false when orderPaymentStatus is 'unpaid' and payment.status is 'failed'", () => {
    expect(
      isPaymentClosed({ orderPaymentStatus: "unpaid", payment: { status: "failed" } }),
    ).toBe(false);
  });

  it("isPaymentClosed returns true for orderPaymentStatus='refunded'", () => {
    expect(isPaymentClosed({ orderPaymentStatus: "refunded" })).toBe(true);
  });

  it("isPaymentClosed returns true for orderPaymentStatus='partially_refunded'", () => {
    expect(isPaymentClosed({ orderPaymentStatus: "partially_refunded" })).toBe(
      true,
    );
  });

  it("isKitchenPayable returns true for kitchenStatus='served'", () => {
    expect(isKitchenPayable({ kitchenStatus: "served" })).toBe(true);
  });

  it("isKitchenPayable falls back to currentStatus='served' for legacy orders", () => {
    expect(isKitchenPayable({ currentStatus: "served" })).toBe(true);
  });

  it("isKitchenPayable falls back when kitchenStatus is 'pending' and currentStatus is 'served'", () => {
    expect(
      isKitchenPayable({ kitchenStatus: "pending", currentStatus: "served" }),
    ).toBe(true);
  });

  it("isKitchenPayable falls back when kitchenStatus is missing and currentStatus is 'served'", () => {
    expect(isKitchenPayable({ currentStatus: "served" })).toBe(true);
  });

  it("isKitchenPayable returns false for table_session even if served", () => {
    expect(
      isKitchenPayable({
        orderKind: "table_session",
        kitchenStatus: "served",
        currentStatus: "served",
      }),
    ).toBe(false);
  });

  it("isKitchenPayable returns false for split_bill even if served", () => {
    expect(
      isKitchenPayable({
        orderKind: "split_bill",
        kitchenStatus: "served",
        currentStatus: "served",
      }),
    ).toBe(false);
  });

  it("isKitchenPayable returns false when kitchenStatus is 'pending' and currentStatus is 'ready'", () => {
    expect(
      isKitchenPayable({ kitchenStatus: "pending", currentStatus: "ready" }),
    ).toBe(false);
  });

  it("orderBatchOrLegacyFilter includes legacy and order_batch only", () => {
    const filter = orderBatchOrLegacyFilter();
    expect(filter).toEqual({
      $or: [
        { orderKind: "order_batch" },
        { orderKind: { $exists: false } },
        { orderKind: null },
      ],
    });
  });

  it("withOrderBatchOrLegacyFilter preserves keyword $or by wrapping in $and", () => {
    const baseFilter = {
      restaurantId: "r1",
      $or: [{ orderCode: /abc/i }, { tableCode: /abc/i }],
    };

    expect(withOrderBatchOrLegacyFilter(baseFilter)).toEqual({
      $and: [baseFilter, orderBatchOrLegacyFilter()],
    });
  });

  it("buildActiveTableSessionKey returns deterministic key", () => {
    expect(
      buildActiveTableSessionKey({
        restaurantId: "rest-1",
        tableId: "table-9",
      }),
    ).toBe("rest-1:table-9:active");
  });

  it("buildActiveTableSessionKey returns null when restaurantId or tableId missing", () => {
    expect(buildActiveTableSessionKey({ restaurantId: null, tableId: "t1" })).toBeNull();
    expect(buildActiveTableSessionKey({ restaurantId: "r1", tableId: null })).toBeNull();
  });

  it("activeTableSessionLookupFilter builds active table_session filter", () => {
    const out = activeTableSessionLookupFilter({ restaurantId: "r1", tableId: "t1" });
    expect(out).toMatchObject({
      restaurantId: "r1",
      tableId: "t1",
      orderKind: "table_session",
      sessionStatus: { $in: ["open", "dining", "ready_to_pay"] },
      orderPaymentStatus: { $ne: "paid" },
    });
  });

  it("childOrdersForSessionFilter builds parent/root child order_batch filter", () => {
    expect(childOrdersForSessionFilter({ restaurantId: "r1", parentOrderId: "p1" })).toEqual({
      restaurantId: "r1",
      orderKind: "order_batch",
      $or: [{ parentOrderId: "p1" }, { rootOrderId: "p1" }],
    });
  });

  it("buildClearPaymentRequestUpdate resets request-payment markers", () => {
    const now = new Date("2026-05-10T20:00:00.000Z");
    expect(
      buildClearPaymentRequestUpdate({ now, reason: "new batch" }),
    ).toEqual({
      $set: {
        orderPaymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
        "payment.status": "pending",
        "payment.requestClearedAt": now,
        "payment.requestClearReason": "new batch",
      },
      $unset: {
        "payment.requestedAt": "",
        "payment.requestSource": "",
        "payment.requestedBy": "",
        "payment.requestNote": "",
      },
    });
  });

  it("resolveSessionStatusAfterClearingPaymentRequest moves ready_to_pay back to dining", () => {
    expect(
      resolveSessionStatusAfterClearingPaymentRequest(SESSION_STATUS.READY_TO_PAY),
    ).toBe(SESSION_STATUS.DINING);
    expect(
      resolveSessionStatusAfterClearingPaymentRequest(SESSION_STATUS.OPEN),
    ).toBe(SESSION_STATUS.OPEN);
  });

  it("clearTablePaymentRequestState clears parent and active child payment_requested fields only", async () => {
    const activeSession = {
      _id: "parent-1",
      restaurantId: "rest-1",
      sessionStatus: SESSION_STATUS.READY_TO_PAY,
    };
    const updatedSession = {
      _id: "parent-1",
      payment: { status: "pending" },
      sessionStatus: SESSION_STATUS.DINING,
    };
    const updatedOrders = [
      { _id: "child-1", payment: { status: "pending" } },
    ];
    const OrderModel = {
      updateMany: vi.fn().mockResolvedValue({ acknowledged: true }),
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
      findOne: vi
        .fn()
        .mockReturnValueOnce(queryChain(updatedSession)),
      find: vi.fn().mockReturnValue(queryChain(updatedOrders)),
    };

    const out = await clearTablePaymentRequestState({
      OrderModel,
      restaurantId: "rest-1",
      activeSession,
      reason: "manual clear",
      now: new Date("2026-05-10T20:10:00.000Z"),
    });

    expect(out).toEqual({ session: updatedSession, orders: updatedOrders });
    expect(OrderModel.updateMany).toHaveBeenCalledTimes(1);
    expect(OrderModel.updateMany.mock.calls[0][0].$and[0]).toEqual(
      childOrdersForSessionFilter({
        restaurantId: "rest-1",
        parentOrderId: "parent-1",
      }),
    );
    expect(OrderModel.updateMany.mock.calls[0][0].$and[1]).toMatchObject({
      currentStatus: { $nin: ["completed", "cancelled", "failed"] },
      orderPaymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
    });
    expect(OrderModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "parent-1",
        restaurantId: "rest-1",
        orderKind: ORDER_KIND.TABLE_SESSION,
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          sessionStatus: SESSION_STATUS.DINING,
          orderPaymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
          "payment.status": "pending",
        }),
      }),
      {},
    );
  });

  it("autoClearPaymentRequestForNewChildOrder clears stale request when adding a new order_batch", async () => {
    const updatedSession = {
      _id: "parent-1",
      sessionStatus: SESSION_STATUS.DINING,
      payment: { status: "pending" },
    };
    const updatedOrders = [
      { _id: "existing-child", payment: { status: "pending" } },
    ];
    const OrderModel = {
      findOne: vi
        .fn()
        .mockReturnValueOnce(queryChain({
          _id: "parent-1",
          restaurantId: "rest-1",
          sessionStatus: SESSION_STATUS.READY_TO_PAY,
          payment: { status: "payment_requested" },
        }))
        .mockReturnValueOnce(queryChain(updatedSession)),
      updateMany: vi.fn().mockResolvedValue({ acknowledged: true }),
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
      find: vi.fn().mockReturnValue(queryChain(updatedOrders)),
    };
    const newOrderDoc = {
      _id: "new-child",
      isNew: true,
      orderType: "dine_in",
      orderKind: ORDER_KIND.ORDER_BATCH,
      restaurantId: "rest-1",
      tableId: "table-1",
      tableCode: "T1",
      parentOrderId: "parent-1",
      $session: () => null,
    };

    const out = await autoClearPaymentRequestForNewChildOrder({
      OrderModel,
      newOrderDoc,
      reason: "Thêm món mới sau khi khách yêu cầu thanh toán.",
      now: new Date("2026-05-10T20:20:00.000Z"),
    });

    expect(out.cleared).toBe(true);
    expect(out.session).toEqual(updatedSession);
    expect(out.orders).toEqual(updatedOrders);
    expect(OrderModel.updateMany.mock.calls[0][0].$and.at(-1)).toEqual({
      _id: { $nin: ["new-child"] },
    });
  });

  it("autoClearPaymentRequestForNewChildOrder does nothing when session is not payment_requested", async () => {
    const OrderModel = {
      findOne: vi.fn().mockReturnValue(queryChain(null)),
      updateMany: vi.fn(),
      updateOne: vi.fn(),
      find: vi.fn(),
    };

    const out = await autoClearPaymentRequestForNewChildOrder({
      OrderModel,
      newOrderDoc: {
        _id: "new-child",
        isNew: true,
        orderType: "dine_in",
        orderKind: ORDER_KIND.ORDER_BATCH,
        restaurantId: "rest-1",
        tableId: "table-1",
        tableCode: "T1",
        parentOrderId: "parent-1",
        $session: () => null,
      },
      reason: "Thêm món mới sau khi khách yêu cầu thanh toán.",
    });

    expect(out).toEqual({ cleared: false, session: null, orders: [] });
    expect(OrderModel.updateMany).not.toHaveBeenCalled();
    expect(OrderModel.updateOne).not.toHaveBeenCalled();
  });
});
