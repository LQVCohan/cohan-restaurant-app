import { describe, expect, it, vi } from "vitest";
import {
  ACTIVE_TABLE_SESSION_SORT,
  ORDER_KIND,
  ORDER_PAYMENT_STATUS,
  SESSION_STATUS,
  activeTableSessionLookupFilter,
  buildActiveTableSessionKey,
  buildClearPaymentRequestUpdate,
  childOrdersForSessionFilter,
  clearPaymentRequestAfterNewChildOrderBatchCreated,
  clearTablePaymentRequestState,
  ensureActiveTableSessionForDineInOrder,
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

  it("ensureActiveTableSessionForDineInOrder reuses existing active table_session by activeSessionKey", async () => {
    const existingSession = {
      _id: "parent-1",
      restaurantId: "rest-1",
      tableId: "table-1",
      tableCode: "T1",
      activeSessionKey: "rest-1:table-1:active",
    };
    const OrderModel = {
      findOne: vi.fn().mockReturnValueOnce(queryChain(existingSession)),
      updateOne: vi.fn(),
      create: vi.fn(),
    };

    const out = await ensureActiveTableSessionForDineInOrder({
      OrderModel,
      createOrderCode: vi.fn(),
      restaurantId: "rest-1",
      tableId: "table-1",
      tableCode: "t1",
    });

    expect(out).toEqual({ sessionOrder: existingSession, created: false });
    expect(OrderModel.findOne).toHaveBeenCalledWith({
      restaurantId: "rest-1",
      activeSessionKey: "rest-1:table-1:active",
      orderKind: ORDER_KIND.TABLE_SESSION,
      sessionStatus: { $in: ["open", "dining", "ready_to_pay"] },
      orderPaymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
    });
    expect(OrderModel.create).not.toHaveBeenCalled();
  });

  it("ensureActiveTableSessionForDineInOrder backfills activeSessionKey and creates a new table_session when needed", async () => {
    const now = new Date("2026-05-10T20:30:00.000Z");
    const existingSession = {
      _id: "parent-legacy",
      restaurantId: "rest-1",
      tableId: "table-1",
      tableCode: "T1",
      activeSessionKey: null,
    };
    const createdSession = {
      _id: "parent-2",
      restaurantId: "rest-1",
      tableId: "table-2",
      tableCode: "T2",
      activeSessionKey: "rest-1:table-2:active",
      orderKind: ORDER_KIND.TABLE_SESSION,
      sessionStatus: SESSION_STATUS.OPEN,
      kitchenStatus: "draft",
      orderPaymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
    };
    const createOrderCode = vi
      .fn()
      .mockResolvedValueOnce("TS-001")
      .mockResolvedValueOnce("TS-002");
    const OrderModel = {
      findOne: vi
        .fn()
        .mockReturnValueOnce(queryChain(null))
        .mockReturnValueOnce(queryChain(existingSession))
        .mockReturnValueOnce(queryChain(null))
        .mockReturnValueOnce(queryChain(null)),
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
      create: vi.fn().mockResolvedValueOnce([createdSession]),
    };

    const reused = await ensureActiveTableSessionForDineInOrder({
      OrderModel,
      createOrderCode,
      restaurantId: "rest-1",
      tableId: "table-1",
      tableCode: "t1",
    });

    expect(reused.created).toBe(false);
    expect(reused.sessionOrder).toEqual({
      ...existingSession,
      activeSessionKey: "rest-1:table-1:active",
    });
    expect(OrderModel.updateOne).toHaveBeenCalledWith(
      { _id: "parent-legacy", activeSessionKey: { $in: [null, undefined] } },
      { $set: { activeSessionKey: "rest-1:table-1:active" } },
      {},
    );

    const created = await ensureActiveTableSessionForDineInOrder({
      OrderModel,
      createOrderCode,
      restaurantId: "rest-1",
      tableId: "table-2",
      tableCode: "t2",
      userId: "staff-1",
      now,
    });

    expect(created).toEqual({ sessionOrder: createdSession, created: true });
    expect(createOrderCode).toHaveBeenNthCalledWith(2, {
      restaurantId: "rest-1",
      tableId: "table-2",
      tableCode: "T2",
      session: null,
    });
    expect(OrderModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          orderCode: "TS-002",
          tableCode: "T2",
          userId: "staff-1",
          activeSessionKey: "rest-1:table-2:active",
          orderKind: ORDER_KIND.TABLE_SESSION,
          sessionStatus: SESSION_STATUS.OPEN,
          currentStatus: "pending",
          openedAt: now,
        }),
      ],
      {},
    );
  });

  it("ensureActiveTableSessionForDineInOrder retries lookup after duplicate activeSessionKey race", async () => {
    const existingSession = {
      _id: "parent-race",
      restaurantId: "rest-1",
      tableId: "table-5",
      tableCode: "T5",
      activeSessionKey: "rest-1:table-5:active",
    };
    const duplicateKeyError = Object.assign(new Error("E11000 duplicate key error"), {
      code: 11000,
    });
    const OrderModel = {
      findOne: vi
        .fn()
        .mockReturnValueOnce(queryChain(null))
        .mockReturnValueOnce(queryChain(null))
        .mockReturnValueOnce(queryChain(existingSession)),
      updateOne: vi.fn(),
      create: vi.fn().mockRejectedValueOnce(duplicateKeyError),
    };

    const out = await ensureActiveTableSessionForDineInOrder({
      OrderModel,
      createOrderCode: vi.fn().mockResolvedValue("TS-005"),
      restaurantId: "rest-1",
      tableId: "table-5",
      tableCode: "t5",
    });

    expect(out).toEqual({ sessionOrder: existingSession, created: false });
    expect(OrderModel.findOne.mock.calls[2][0]).toEqual({
      restaurantId: "rest-1",
      activeSessionKey: "rest-1:table-5:active",
      orderKind: ORDER_KIND.TABLE_SESSION,
      sessionStatus: { $in: ["open", "dining", "ready_to_pay"] },
      orderPaymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
    });
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
      "payment.status": { $ne: "paid" },
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
    expect(OrderModel.find).toHaveBeenCalledWith({
      $and: [
        childOrdersForSessionFilter({
          restaurantId: "rest-1",
          parentOrderId: "parent-1",
        }),
        {
          currentStatus: { $nin: ["completed", "cancelled", "failed"] },
          orderPaymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
          "payment.status": { $ne: "paid" },
        },
      ],
    });
  });

  it("clearPaymentRequestAfterNewChildOrderBatchCreated clears stale request after a new order_batch is created", async () => {
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
    const createdOrder = {
      _id: "new-child",
      orderType: "dine_in",
      orderKind: ORDER_KIND.ORDER_BATCH,
      restaurantId: "rest-1",
      tableId: "table-1",
      tableCode: "T1",
      parentOrderId: "parent-1",
    };

    const out = await clearPaymentRequestAfterNewChildOrderBatchCreated({
      OrderModel,
      order: createdOrder,
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

  it("clearPaymentRequestAfterNewChildOrderBatchCreated does nothing for delivery/takeaway orders", async () => {
    const OrderModel = {
      findOne: vi.fn(),
      updateMany: vi.fn(),
      updateOne: vi.fn(),
      find: vi.fn(),
    };

    for (const orderType of ["delivery", "takeaway"]) {
      const out = await clearPaymentRequestAfterNewChildOrderBatchCreated({
        OrderModel,
        order: {
          _id: "new-child",
          orderType,
          orderKind: ORDER_KIND.ORDER_BATCH,
          restaurantId: "rest-1",
          tableId: "table-1",
          tableCode: "T1",
          parentOrderId: "parent-1",
        },
        reason: "Thêm món mới sau khi khách yêu cầu thanh toán.",
      });

      expect(out).toEqual({ cleared: false, session: null, orders: [] });
    }

    expect(OrderModel.findOne).not.toHaveBeenCalled();
    expect(OrderModel.updateMany).not.toHaveBeenCalled();
    expect(OrderModel.updateOne).not.toHaveBeenCalled();
  });

  it("clearPaymentRequestAfterNewChildOrderBatchCreated does nothing when session is not payment_requested", async () => {
    const OrderModel = {
      findOne: vi.fn().mockReturnValue(queryChain(null)),
      updateMany: vi.fn(),
      updateOne: vi.fn(),
      find: vi.fn(),
    };

    const out = await clearPaymentRequestAfterNewChildOrderBatchCreated({
      OrderModel,
      order: {
        _id: "new-child",
        orderType: "dine_in",
        orderKind: ORDER_KIND.ORDER_BATCH,
        restaurantId: "rest-1",
        tableId: "table-1",
        tableCode: "T1",
        parentOrderId: "parent-1",
      },
      reason: "Thêm món mới sau khi khách yêu cầu thanh toán.",
    });

    expect(out).toEqual({ cleared: false, session: null, orders: [] });
    expect(OrderModel.updateMany).not.toHaveBeenCalled();
    expect(OrderModel.updateOne).not.toHaveBeenCalled();
  });

  it("exports deterministic active table session sort for parent lookup", () => {
    expect(ACTIVE_TABLE_SESSION_SORT).toEqual({
      openedAt: -1,
      createdAt: -1,
      _id: -1,
    });
  });
});
